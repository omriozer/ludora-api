import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import fileService from '../services/FileService.js';
import db from '../models/index.js';
import { sequelize } from '../models/index.js';
import { mergePdfFooter } from '../utils/pdfFooterMerge.js';
import { addPdfWatermarks } from '../utils/pdfWatermark.js';
import { mergeFooterSettings } from '../utils/footerSettingsHelper.js';
import AccessControlService from '../services/AccessControlService.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import { createFileLogger, createErrorResponse, createSuccessResponse } from '../utils/fileOperationLogger.js';
import { createFileVerifier } from '../utils/fileOperationVerifier.js';
import { createPreUploadValidator } from '../utils/preUploadValidator.js';
// Import pptx2html library - try using dynamic import to handle the UMD build correctly
let renderPptx;

const router = express.Router();
const { File: FileModel, User, Purchase, Settings } = db;

/**
 * Helper: Encode filename for Content-Disposition header
 *
 * HTTP headers cannot contain non-ASCII characters directly.
 * This function creates a proper Content-Disposition header value
 * with both a fallback ASCII filename and an RFC 5987 encoded filename.
 *
 * @param {string} disposition - 'attachment' or 'inline'
 * @param {string} filename - Original filename (may contain Hebrew/Unicode)
 * @returns {string} Properly formatted Content-Disposition header value
 */
function encodeContentDisposition(disposition, filename) {
  // Create ASCII fallback by removing non-ASCII characters
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');

  // RFC 5987 encoding: UTF-8 percent-encoding
  const encodedFilename = encodeURIComponent(filename);

  // Return both formats for maximum compatibility
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

// Configure multer for asset uploads (memory storage for S3)
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  }
});


/**
 * Helper: Process PDF with footer and/or watermarks
 *
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} fileEntity - File entity from database
 * @param {boolean} hasAccess - Whether user has access
 * @param {Object} settings - System settings
 * @returns {Promise<Buffer>} Processed PDF buffer
 */
async function processPdf(pdfBuffer, fileEntity, hasAccess, settings, skipFooter = false) {
  const shouldMergeFooter = fileEntity.add_copyrights_footer && !skipFooter;
  const shouldAddWatermarks = !hasAccess && fileEntity.allow_preview;

  let finalPdfBuffer = pdfBuffer;

  // Build complete footer settings using helper function
  let footerSettings = null;
  if (shouldMergeFooter) {
    footerSettings = mergeFooterSettings(fileEntity.footer_settings, settings);
  }

  // DEBUG: Log PDF processing decisions
  console.log('🔍 PDF Processing Debug:', {
    fileName: fileEntity.file_name,
    hasAccess,
    skipFooter,
    add_copyrights_footer: fileEntity.add_copyrights_footer,
    allow_preview: fileEntity.allow_preview,
    shouldMergeFooter,
    shouldAddWatermarks,
    watermarkLogic: `!hasAccess(${!hasAccess}) && allow_preview(${fileEntity.allow_preview}) = ${shouldAddWatermarks}`,
    hasFileFooterSettings: !!fileEntity.footer_settings,
    hasSystemFooterSettings: !!settings?.footer_settings,
    finalFooterSettings: footerSettings ? 'generated' : 'none'
  });

  // Step 1: Apply footer if needed
  if (shouldMergeFooter && footerSettings) {
    try {
      finalPdfBuffer = await mergePdfFooter(finalPdfBuffer, footerSettings);
      console.log(`✅ Footer merged successfully`);
    } catch (error) {
      console.error('❌ Footer merge failed, continuing without footer:', error);
    }
  }

  // Step 2: Apply watermarks if needed
  if (shouldAddWatermarks) {
    try {
      // Always use the backend logo file
      const logoUrl = path.join(process.cwd(), 'assets', 'images', 'logo.png');

      console.log('🔍 PDF Watermark: Logo URL resolution:', {
        originalUrl: settings?.footer_settings?.logo?.url || settings?.logo_url,
        resolvedUrl: logoUrl,
        fileExists: logoUrl ? fs.existsSync(logoUrl) : false
      });
      finalPdfBuffer = await addPdfWatermarks(finalPdfBuffer, logoUrl);
      console.log(`✅ Watermarks added successfully`);
    } catch (error) {
      console.error('❌ Watermark addition failed, continuing without watermarks:', error);
    }
  }

  return finalPdfBuffer;
}

/**
 * Helper: Delete all assets for a File entity
 *
 * Deletes document and marketing video assets for a File entity.
 * This should be called when deleting a File entity or replacing files.
 *
 * @param {string} fileEntityId - ID of the File entity
 * @returns {Promise<Object>} Object with deletion results
 */
async function deleteAllFileAssets(fileEntityId) {
  const results = {
    document: { deleted: false, error: null },
    marketingVideo: { deleted: false, error: null }
  };

  try {
    // Get File entity to check if document exists
    const fileEntity = await FileModel.findByPk(fileEntityId);
    if (!fileEntity) {
      return results;
    }

    // Delete document if it exists
    if (fileEntity.file_name) {
      try {
        const deleteResult = await fileService.deleteAsset({
          entityType: 'file',
          entityId: fileEntityId,
          assetType: 'document',
          userId: 'system' // System deletion
        });
        results.document.deleted = deleteResult.success;
        console.log(`✅ Deleted document asset for File ${fileEntityId}`);
      } catch (error) {
        results.document.error = error.message;
        console.error(`❌ Failed to delete document for File ${fileEntityId}:`, error);
      }
    }

    // Delete marketing video if it exists
    try {
      const deleteResult = await fileService.deleteAsset({
        entityType: 'file',
        entityId: fileEntityId,
        assetType: 'marketing-video',
        userId: 'system' // System deletion
      });
      results.marketingVideo.deleted = deleteResult.success;
      console.log(`✅ Deleted marketing video for File ${fileEntityId}`);
    } catch (error) {
      // Marketing video might not exist, which is okay
      if (error.message?.includes('not found') || error.message?.includes('already deleted')) {
        results.marketingVideo.deleted = true; // Treat as success if already deleted
      } else {
        results.marketingVideo.error = error.message;
        console.error(`❌ Failed to delete marketing video for File ${fileEntityId}:`, error);
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Error in deleteAllFileAssets for ${fileEntityId}:`, error);
    throw error;
  }
}


/**
 * Helper: Check if user has access to a File entity using AccessControlService
 *
 * @param {Object} user - Authenticated user object
 * @param {Object} fileEntity - File entity from database
 * @returns {Promise<boolean>} True if user has access
 */
async function checkUserAccess(user, fileEntity) {
  // For asset-only files, they don't have Products - check via lesson plan ownership instead
  if (fileEntity.is_asset_only) {
    console.log('🔍 Asset-only file detected, checking lesson plan access for user:', user.id);

    // Asset-only files are internal to lesson plans, so we grant access if user has access
    // to any lesson plan that references this file. This is handled by the presentation
    // endpoint's access control, so if we reached here, access should be granted.

    // For security, we could add additional checks here in the future
    console.log('🔍 Access granted: Asset-only file in lesson plan context');
    return true;
  }

  // For non-asset files, check via Product
  const product = await db.Product.findOne({
      where: {
        product_type: 'file',
        entity_id: fileEntity.id
      }
    });

  if (!product) {
    console.log('🔍 No product found for file entity:', fileEntity.id);
    return false;
  }

  if (product.creator_user_id === user.id) {
    console.log('🔍 Access granted: User is creator of file');
    return true;
  }

  // Use AccessControlService to check if user has purchased access
  try {
    const accessResult = await AccessControlService.checkAccess(user.id, 'file', fileEntity.id);

    console.log('🔍 Access control result:', {
      userId: user.id,
      fileId: fileEntity.id,
      hasAccess: accessResult.hasAccess,
      isLifetime: accessResult.isLifetimeAccess,
      expiresAt: accessResult.expiresAt
    });

    return accessResult.hasAccess;
  } catch (error) {
    console.error('❌ Error checking access via AccessControlService:', error);
    return false;
  }
}

/**
 * Upload Asset (Video or Document)
 *
 * Uploads an asset to S3 with predictable path structure.
 * For documents, saves filename to File entity's file_name field.
 * For videos, uses standard "video.mp4" filename.
 *
 * @route POST /api/assets/upload
 * @access Private (requires authentication)
 *
 * @queryparam {string} entityType - Type of entity (workshop, course, file, tool)
 * @queryparam {string} entityId - ID of the entity
 * @queryparam {string} assetType - Type of asset (marketing-video, content-video, document)
 * @formparam {File} file - Multipart file upload
 *
 * @returns {200} Success with S3 key and filename
 * @returns {400} Bad request (missing params, invalid file)
 * @returns {401} Unauthorized
 * @returns {500} Server error
 *
 * @example Upload Document
 * POST /api/assets/upload?entityType=file&entityId=test_file_001&assetType=document
 * Content-Type: multipart/form-data
 * Authorization: Bearer <token>
 *
 * file: [binary PDF file]
 *
 * Response:
 * {
 *   "success": true,
 *   "s3Key": "development/private/document/file/test_file_001/sample.pdf",
 *   "filename": "sample.pdf",
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "size": 1048576,
 *   "uploadedAt": "2025-10-01T12:00:00.000Z"
 * }
 *
 * @example Upload Marketing Video
 * POST /api/assets/upload?entityType=workshop&entityId=abc123&assetType=marketing-video
 * Content-Type: multipart/form-data
 * Authorization: Bearer <token>
 *
 * file: [binary video file]
 *
 * Response:
 * {
 *   "success": true,
 *   "s3Key": "development/public/marketing-video/workshop/abc123/video.mp4",
 *   "filename": "video.mp4",
 *   "entityType": "workshop",
 *   "entityId": "abc123",
 *   "assetType": "marketing-video",
 *   "size": 52428800,
 *   "uploadedAt": "2025-10-01T12:00:00.000Z"
 * }
 */
router.post('/upload', authenticateToken, assetUpload.single('file'), async (req, res) => {
  try {
    const { entityType, entityId, assetType } = req.query;

    // Validate required parameters
    if (!entityType || !entityId || !assetType) {
      return res.status(400).json(createErrorResponse(
        'Missing required parameters',
        'entityType, entityId, and assetType are required as query parameters',
        {
          received: { entityType, entityId, assetType },
          hint: 'Example: /api/assets/upload?entityType=file&entityId=test_file_001&assetType=document'
        }
      ));
    }

    // Validate assetType
    const validAssetTypes = ['marketing-video', 'content-video', 'document', 'image'];
    if (!validAssetTypes.includes(assetType)) {
      return res.status(400).json(createErrorResponse(
        'Invalid assetType',
        `assetType must be one of: ${validAssetTypes.join(', ')}`,
        {
          received: assetType,
          validOptions: validAssetTypes
        }
      ));
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json(createErrorResponse(
        'No file uploaded',
        'Please select a file to upload',
        { contentType: req.headers['content-type'] }
      ));
    }

    console.log(`📤 Asset upload: User ${req.user.id}, Type: ${assetType}, Entity: ${entityType}/${entityId}, File: ${req.file.originalname}`);

    // Create logger for this operation
    const logger = createFileLogger('Asset Upload', req.user, {
      entityType,
      entityId,
      assetType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    logger.start({
      entityType,
      entityId,
      assetType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      method: 'POST',
      url: req.originalUrl
    });

    // Determine filename based on asset type
    let filename;
    if (assetType === 'marketing-video' || assetType === 'content-video') {
      filename = 'video.mp4'; // Standard video filename
    } else if (assetType === 'image') {
      // For images, use standard filename for predictable paths (like marketing videos)
      filename = 'image.jpg';
    } else {
      filename = req.file.originalname; // Preserve original filename for documents
    }

    // PRE-UPLOAD VALIDATION - Comprehensive validation before any operations
    logger.info('Starting pre-upload validation');
    const validator = createPreUploadValidator(logger);

    const validationResult = await validator.validateUpload({
      file: req.file,
      user: req.user,
      entityType,
      entityId,
      assetType,
      filename
    });

    if (!validationResult.valid) {
      logger.error(new Error('Pre-upload validation failed'), validationResult.error);
      return res.status(400).json(validationResult.error);
    }

    // Log validation warnings if any
    if (validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        logger.warn(warning.message, warning);
      }
    }

    logger.info('Pre-upload validation passed', {
      validations: Object.keys(validationResult.validations),
      warnings: validationResult.warnings.length,
      entity: validationResult.entity ? validationResult.entity.id : null
    });

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, assetType, filename);

    // Use transaction to ensure atomicity between S3 upload and database update
    const transaction = await sequelize.transaction();
    logger.transaction('start', { s3Key, validationPassed: true });
    let s3UploadCompleted = false;

    try {
      // Upload using consolidated FileService method
      logger.info('Starting consolidated asset upload', { s3Key, assetType });
      const uploadResult = await fileService.uploadAsset({
        file: req.file,
        entityType,
        entityId,
        assetType,
        userId: req.user.id,
        transaction,
        logger
      });

      if (!uploadResult.success) {
        throw new Error('Asset upload failed');
      }

      s3UploadCompleted = true;
      logger.s3Operation('upload', uploadResult.s3Key, { success: true, size: uploadResult.size });

      // Commit transaction - both S3 upload and DB update succeeded
      await transaction.commit();
      logger.transaction('commit', { s3Key, s3UploadCompleted });

      // Post-upload verification - ensure upload was successful and consistent
      logger.info('Performing post-upload verification', { s3Key: uploadResult.s3Key });
      const verifier = createFileVerifier();
      const uploadVerification = await verifier.verifyUpload(uploadResult.s3Key, {
        size: uploadResult.size,
        contentType: uploadResult.mimeType
      }, logger);

      const responseData = createSuccessResponse({
        ...uploadResult, // Include all uploadResult properties (s3Key, filename, etc.)
        validation: {
          preUpload: {
            passed: true,
            warnings: validationResult.warnings.length
          },
          postUpload: uploadVerification.success ? {
            verified: uploadVerification.verified,
            s3Size: uploadVerification.fileDetails?.size,
            s3ContentType: uploadVerification.fileDetails?.contentType
          } : {
            error: uploadVerification.error,
            details: uploadVerification.details
          }
        }
      }, logger.requestId);

      // Log verification warnings if any
      if (!uploadVerification.success) {
        logger.warn('Post-upload verification warnings detected', uploadVerification);
      }

      // Log successful operation
      logger.success({
        s3Key: uploadResult.s3Key,
        filename: uploadResult.filename,
        entityType: uploadResult.entityType,
        entityId: uploadResult.entityId,
        assetType: uploadResult.assetType,
        fileSize: uploadResult.size,
        accessLevel: uploadResult.accessLevel,
        verification: {
          preUploadPassed: true,
          postUploadPassed: uploadVerification.success
        }
      });

      res.json(responseData);

    } catch (uploadError) {
      // Rollback transaction
      await transaction.rollback();
      logger.transaction('rollback', { reason: 'Upload operation failed', error: uploadError.message });

      // Clean up S3 file if it was uploaded but DB operation failed
      if (s3UploadCompleted) {
        try {
          await fileService.deleteS3Object(s3Key);
          logger.info('Cleaned up orphaned S3 file after transaction failure', { s3Key });
        } catch (cleanupError) {
          logger.error(cleanupError, { stage: 's3_cleanup', s3Key });
          // Continue with error response - cleanup failure shouldn't hide original error
        }
      }

      const errorResponse = createErrorResponse(
        'Upload failed',
        'Failed to upload file to storage',
        {
          details: uploadError.message,
          s3Key: s3Key || 'unknown',
          s3UploadCompleted,
          transactionRolledBack: true,
          assetType,
          entityType,
          entityId
        },
        logger.requestId
      );

      logger.error(uploadError, { stage: 'upload_transaction', s3UploadCompleted });
      return res.status(500).json(errorResponse);
    }

  } catch (error) {
    const errorResponse = createErrorResponse(
      'Upload failed',
      'Failed to process asset upload request',
      { details: error.message },
      req.logger?.requestId || null
    );

    // If we have a logger, use it; otherwise fall back to console
    if (logger) {
      logger.error(error, { stage: 'request_processing' });
    } else {
      console.error('❌ Asset upload error:', error);
    }

    res.status(500).json(errorResponse);
  }
});

// LEGACY ENDPOINT REMOVED: Use POST /api/assets/upload?assetType=marketing-video instead

// LEGACY ENDPOINT REMOVED: Use POST /api/assets/upload?assetType=content-video instead

/**
 * Serve Public Image with Database Validation
 *
 * Serves a public image directly from S3 storage, but ONLY if the entity
 * should have an image according to the database state. This prevents
 * serving orphaned files that exist in S3 but shouldn't be accessible.
 *
 * @route GET /api/assets/image/:entityType/:entityId/:filename
 * @access Public (no authentication required)
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool, product)
 * @param {string} entityId - ID of the entity
 * @param {string} filename - Image filename
 *
 * @returns {200} Image binary data (only if database indicates image should exist)
 * @returns {404} Image not found or not supposed to exist
 * @returns {500} Server error
 */
router.get('/image/:entityType/:entityId/:filename', async (req, res) => {
  try {
    const { entityType, entityId, filename } = req.params;

    console.log(`🖼️ Public image request: ${entityType}/${entityId}/${filename}`);

    // VALIDATION: Check if entity should have an image according to database
    let shouldHaveImage = false;
    let entityData = null;

    try {
      if (entityType === 'product') {
        // For products, check has_image field and image_filename
        const product = await db.Product.findByPk(entityId);
        if (product) {
          entityData = product;
          shouldHaveImage = product.has_image === true ||
                           (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');
        }
      } else if (entityType === 'gamecontent') {
        // For GameContent entities, check the GameContent table for image data
        console.log(`🔍 GameContent entity image request: Checking GameContent ${entityId}`);

        const gameContent = await db.GameContent.findByPk(entityId);
        if (gameContent && (gameContent.semantic_type === 'image' || gameContent.semantic_type === 'game_card_bg' || gameContent.semantic_type === 'complete_card')) {
          entityData = gameContent;
          // GameContent should have an image if it has a value field with an S3 key
          shouldHaveImage = !!(gameContent.value && gameContent.value.trim().length > 0);

          console.log(`🔍 GameContent image check: Found GameContent ${gameContent.id}, semantic_type: ${gameContent.semantic_type}, has_value: ${!!gameContent.value}`);
        } else if (gameContent) {
          console.warn(`⚠️ GameContent ${entityId} exists but semantic_type is '${gameContent.semantic_type}', not 'image', 'game_card_bg', or 'complete_card'`);
        } else {
          console.warn(`⚠️ GameContent ${entityId} not found in database`);
        }
      } else if (entityType === 'file') {
        // FIXED: For marketing images on File products, the entityId is actually the Product ID
        // We need to check if this entityId is a Product ID first, then fall back to File entity lookup
        console.log(`🔍 File entity image request: Checking entityId ${entityId} for marketing image`);

        // First try: Check if entityId is a Product ID (for marketing images)
        let product = await db.Product.findByPk(entityId);

        if (product && product.product_type === 'file') {
          // This is a marketing image request for a File product
          entityData = product;
          shouldHaveImage = product.has_image === true ||
                           (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');

          console.log(`🔍 Marketing image for File product: Found product ${product.id}, has_image: ${product.has_image}`);
        } else {
          // Second try: Check if this is a File entity ID and find its associated Product
          product = await db.Product.findOne({
            where: {
              product_type: 'file',
              entity_id: entityId
            }
          });

          if (product) {
            entityData = product; // Use product data for image validation
            shouldHaveImage = product.has_image === true ||
                             (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');

            console.log(`🔍 File entity image check: Found product ${product.id} for file ${entityId}, has_image: ${product.has_image}`);
          } else {
            // No product found for this file entity
            console.warn(`⚠️ No product found for file entity ${entityId} - cannot serve marketing image`);
          }
        }
      } else {
        // FIXED: For ALL other entity types, check the PRODUCT entity for marketing images
        // All product types (workshop, course, tool, lesson_plan, game) store marketing images on Product entity
        // This implements consistent 3-layer architecture across all entity types

        // SPECIAL CASE: If entityType matches a product_type (like lesson_plan),
        // the entityId might be the Product ID directly, not the content entity ID
        let product = null;

        // First try: Check if entityId is a Product ID for this product type
        if (['lesson_plan', 'workshop', 'course', 'tool', 'game'].includes(entityType)) {
          product = await db.Product.findOne({
            where: {
              id: entityId,
              product_type: entityType
            }
          });

          if (product) {
            console.log(`🔍 Direct product lookup: Found product ${product.id} with product_type ${product.product_type}`);
          }
        }

        // Second try: If not found, try the entity_id approach (backwards compatibility)
        if (!product) {
          product = await db.Product.findOne({
            where: {
              product_type: entityType,
              entity_id: entityId
            }
          });

          if (product) {
            console.log(`🔍 Entity-based lookup: Found product ${product.id} for ${entityType} entity ${entityId}`);
          }
        }

        if (product) {
          entityData = product; // Use product data for image validation
          shouldHaveImage = product.has_image === true ||
                           (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');

          console.log(`🔍 ${entityType} entity image check: Found product ${product.id} for ${entityType} ${entityId}, has_image: ${product.has_image}`);
        } else {
          // Check if the content entity exists (for logging purposes)
          const entityModel = db[entityType.charAt(0).toUpperCase() + entityType.slice(1)];
          if (entityModel) {
            const entity = await entityModel.findByPk(entityId);
            if (entity) {
              console.warn(`⚠️ ${entityType} entity ${entityId} exists but no product found - cannot serve marketing image`);
            } else {
              console.warn(`⚠️ ${entityType} entity ${entityId} not found in database`);
            }
          }
        }
      }
    } catch (dbError) {
      console.error(`❌ Database validation error for ${entityType}/${entityId}:`, dbError);
      // If database check fails, don't serve the image for security
      return res.status(500).json(createErrorResponse(
        'Database validation failed',
        'Unable to verify if image should exist',
        { entityType, entityId, filename }
      ));
    }

    // If entity doesn't exist in database, don't serve any images
    if (!entityData) {
      console.warn(`⚠️ Entity not found in database: ${entityType}/${entityId}, refusing to serve image`);

      // Log this inconsistency to the log table
      await db.Logs.create({
        source_type: 'api',
        log_type: 'warn',
        message: `Image request for non-existent entity: ${JSON.stringify({
          entityType,
          entityId,
          filename,
          issue: 'entity_not_found',
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString()
        })}`,
        created_at: new Date()
      });

      return res.status(404).json(createErrorResponse(
        'Entity not found',
        'The requested entity does not exist',
        { entityType, entityId }
      ));
    }

    // If entity exists but shouldn't have an image, check if image exists in S3
    if (!shouldHaveImage) {
      const s3Key = constructS3Path(entityType, entityId, 'image', filename);

      try {
        const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

        if (metadataResult.success) {
          // POTENTIAL INCONSISTENCY: Image exists in S3 but database says has_image=false
          // This could be a normal race condition during upload (S3 upload completes before DB transaction commits)
          // OR it could be a genuine orphaned file issue

          console.warn(`⚠️ TIMING ISSUE: Image exists in S3 but database shows has_image=false: ${s3Key}`);
          console.log(`🔍 This could be an upload in progress. Checking if we should retry...`);

          // Check if this looks like a recent upload (file is less than 30 seconds old)
          const fileAge = new Date() - new Date(metadataResult.data.lastModified);
          const isRecentUpload = fileAge < 30000; // 30 seconds

          if (isRecentUpload) {
            // This appears to be an upload in progress - wait briefly and retry database check
            console.log(`🕐 File age: ${Math.round(fileAge/1000)}s - appears to be recent upload, retrying database check...`);

            // Wait 1 second for database transaction to potentially commit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Retry database check
            let retryEntityData = null;
            let retryShouldHaveImage = false;

            try {
              if (entityType === 'gamecontent') {
                // For GameContent entities, retry the same logic
                const retryGameContent = await db.GameContent.findByPk(entityId);
                if (retryGameContent && (retryGameContent.semantic_type === 'image' || retryGameContent.semantic_type === 'game_card_bg' || retryGameContent.semantic_type === 'complete_card')) {
                  retryEntityData = retryGameContent;
                  retryShouldHaveImage = !!(retryGameContent.value && retryGameContent.value.trim().length > 0);
                  console.log(`🔄 Retry check (GameContent): Found GameContent ${retryGameContent.id}, semantic_type: ${retryGameContent.semantic_type}, has_value: ${!!retryGameContent.value}`);
                }
              } else if (entityType === 'file') {
                // Same logic as above: try Product ID first, then File entity ID
                let retryProduct = await db.Product.findByPk(entityId);

                if (retryProduct && retryProduct.product_type === 'file') {
                  // This is a marketing image request for a File product
                  retryEntityData = retryProduct;
                  retryShouldHaveImage = retryProduct.has_image === true ||
                                       (retryProduct.has_image === undefined && retryProduct.image_url && retryProduct.image_url.trim().length > 0 && retryProduct.image_url !== 'HAS_IMAGE');
                  console.log(`🔄 Retry check (Product ID): Found product ${retryProduct.id}, has_image: ${retryProduct.has_image}`);
                } else {
                  // Try File entity ID lookup
                  retryProduct = await db.Product.findOne({
                    where: {
                      product_type: 'file',
                      entity_id: entityId
                    }
                  });
                  if (retryProduct) {
                    retryEntityData = retryProduct;
                    retryShouldHaveImage = retryProduct.has_image === true ||
                                         (retryProduct.has_image === undefined && retryProduct.image_url && retryProduct.image_url.trim().length > 0 && retryProduct.image_url !== 'HAS_IMAGE');
                    console.log(`🔄 Retry check (entity_id): Found product ${retryProduct.id} for file ${entityId}, has_image: ${retryProduct.has_image}`);
                  }
                }
              } else if (entityType === 'product') {
                const retryProduct = await db.Product.findByPk(entityId);
                if (retryProduct) {
                  retryEntityData = retryProduct;
                  retryShouldHaveImage = retryProduct.has_image === true ||
                                       (retryProduct.has_image === undefined && retryProduct.image_url && retryProduct.image_url.trim().length > 0 && retryProduct.image_url !== 'HAS_IMAGE');
                }
              } else {
                // Apply same fix for retry logic - check direct product lookup first
                let retryProduct = null;

                // First try: Check if entityId is a Product ID for this product type
                if (['lesson_plan', 'workshop', 'course', 'tool', 'game'].includes(entityType)) {
                  retryProduct = await db.Product.findOne({
                    where: {
                      id: entityId,
                      product_type: entityType
                    }
                  });

                  if (retryProduct) {
                    console.log(`🔄 Retry direct product lookup: Found product ${retryProduct.id} with product_type ${retryProduct.product_type}`);
                  }
                }

                // Second try: If not found, try the entity_id approach (backwards compatibility)
                if (!retryProduct) {
                  retryProduct = await db.Product.findOne({
                    where: {
                      product_type: entityType,
                      entity_id: entityId
                    }
                  });

                  if (retryProduct) {
                    console.log(`🔄 Retry entity-based lookup: Found product ${retryProduct.id} for ${entityType} entity ${entityId}`);
                  }
                }

                if (retryProduct) {
                  retryEntityData = retryProduct;
                  retryShouldHaveImage = retryProduct.has_image === true ||
                                       (retryProduct.has_image === undefined && retryProduct.image_url && retryProduct.image_url.trim().length > 0 && retryProduct.image_url !== 'HAS_IMAGE');
                }
              }

              if (retryShouldHaveImage) {
                // Great! Database has been updated - serve the image
                console.log(`✅ Retry successful: Database now shows has_image=true, serving image`);
                entityData = retryEntityData;
                shouldHaveImage = true;
                // Continue to image serving logic below
              } else {
                // Still shows has_image=false after retry - this might be a genuine orphan
                console.warn(`⚠️ After retry, database still shows has_image=false - potential orphaned file`);

                // Log as warning (not error) since we're not certain it's an orphan
                await db.Logs.create({
                  source_type: 'api',
                  log_type: 'warn',
                  message: `Potential orphaned image file detected after retry: ${JSON.stringify({
                    entityType,
                    entityId,
                    filename,
                    s3Key,
                    issue: 'potential_orphaned_s3_file',
                    fileAge: Math.round(fileAge/1000),
                    retryPerformed: true,
                    entityData: {
                      id: entityData.id,
                      has_image: entityData.has_image,
                      image_url: entityData.image_url,
                      image_filename: entityData.image_filename
                    },
                    s3Metadata: metadataResult.data,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                  })}`,
                  created_at: new Date()
                });

                // Still return 404 to not serve potentially orphaned files
                return res.status(404).json(createErrorResponse(
                  'Image not available',
                  'Image exists in storage but database indicates it should not be accessible',
                  {
                    entityType,
                    entityId,
                    hint: 'This may indicate an orphaned file or a timing issue during upload'
                  }
                ));
              }
            } catch (retryError) {
              console.error(`❌ Error during retry database check:`, retryError);
              // Fall through to treat as orphaned file
            }
          } else {
            // File is older than 30 seconds and still has has_image=false - likely orphaned
            console.error(`🚨 ORPHANED FILE: Image exists in S3 but database shows has_image=false for ${Math.round(fileAge/1000)}s: ${s3Key}`);

            // Log this as an error since it's likely a genuine orphan
            await db.Logs.create({
              source_type: 'api',
              log_type: 'error',
              message: `Confirmed orphaned image file detected in S3: ${JSON.stringify({
                entityType,
                entityId,
                filename,
                s3Key,
                issue: 'confirmed_orphaned_s3_file',
                fileAge: Math.round(fileAge/1000),
                entityData: {
                  id: entityData.id,
                  has_image: entityData.has_image,
                  image_url: entityData.image_url,
                  image_filename: entityData.image_filename
                },
                s3Metadata: metadataResult.data,
                userAgent: req.headers['user-agent'],
                ip: req.ip,
                timestamp: new Date().toISOString()
              })}`,
              created_at: new Date()
            });

            // DO NOT serve the image - return 404 as if it doesn't exist
            return res.status(404).json(createErrorResponse(
              'Image not available',
              'Image exists in storage but is not supposed to be accessible',
              {
                entityType,
                entityId,
                hint: 'This appears to be an orphaned file that should be cleaned up'
              }
            ));
          }
        }
      } catch (s3Error) {
        // Image doesn't exist in S3, which is correct - return 404
      }

      // Only reach here if shouldHaveImage is still false and no S3 image exists
      if (!shouldHaveImage) {
        return res.status(404).json(createErrorResponse(
          'Image not found',
          'No image available for this entity',
          { entityType, entityId }
        ));
      }
    }

    // Entity should have an image according to database - proceed to serve it
    const s3Key = constructS3Path(entityType, entityId, 'image', filename);

    try {
      // Get image metadata first - wrap in try-catch to handle S3 errors
      let metadataResult;
      try {
        metadataResult = await fileService.getS3ObjectMetadata(s3Key);
      } catch (s3MetadataError) {
        // Convert S3 exception to a failed result for consistent handling
        metadataResult = { success: false, error: s3MetadataError.message };
      }

      let activeS3Key = s3Key;

      if (!metadataResult.success) {
        // FALLBACK: For gamecontent entities, try legacy S3 path (from when assetType was undefined)
        let legacyS3Key = null;
        let legacyMetadataResult = null;

        if (entityType === 'gamecontent' && (entityData?.semantic_type === 'game_card_bg' || entityData?.semantic_type === 'complete_card')) {
          // Construct legacy S3 path: development/private/undefined/gamecontent/entityId/filename
          const env = process.env.ENVIRONMENT || 'development';
          legacyS3Key = `${env}/private/undefined/gamecontent/${entityId}/${filename}`;

          console.log(`🔄 Trying legacy S3 path for ${entityData.semantic_type}: ${legacyS3Key}`);

          try {
            legacyMetadataResult = await fileService.getS3ObjectMetadata(legacyS3Key);
            if (legacyMetadataResult.success) {
              console.log(`✅ Found legacy ${entityData.semantic_type} image at: ${legacyS3Key}`);
              // Use the legacy S3 key for streaming
              activeS3Key = legacyS3Key;
              metadataResult = legacyMetadataResult;
            }
          } catch (legacyError) {
            console.log(`❌ Legacy path also failed: ${legacyError.message}`);
          }
        }

        // If both current and legacy paths failed, return 404
        if (!metadataResult.success) {
          // Image should exist but doesn't - log this inconsistency
          console.warn(`⚠️ Expected image missing in S3: ${s3Key}${legacyS3Key ? ` and legacy path: ${legacyS3Key}` : ''}`);

          await db.Logs.create({
            level: 'warning',
            message: 'Expected image file missing from S3',
            details: JSON.stringify({
              entityType,
              entityId,
              filename,
              s3Key,
              legacyS3Key,
              issue: 'missing_expected_file',
              entityData: {
                id: entityData.id,
                has_image: entityData.has_image,
                image_url: entityData.image_url,
                image_filename: entityData.image_filename
              },
              userAgent: req.headers['user-agent'],
              ip: req.ip,
              timestamp: new Date().toISOString()
            }),
            created_at: new Date(),
            updated_at: new Date()
          });

          return res.status(404).json(createErrorResponse(
            'Image not found',
            'Image not found in storage',
            { s3Key, legacyS3Key, entityType, entityId, filename }
          ));
        }
      }

      // Stream image from S3 using the active S3 key (could be original or legacy path)
      const stream = await fileService.createS3Stream(activeS3Key);

      // Set appropriate headers
      res.setHeader('Content-Type', metadataResult.data.contentType || 'image/jpeg');
      res.setHeader('Content-Length', metadataResult.data.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Pipe stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error) => {
        console.error('❌ Image stream error:', error);
        if (!res.headersSent) {
          res.status(500).json(createErrorResponse(
            'Stream error',
            'Failed to stream image from storage',
            { s3Key: activeS3Key, error: error.message }
          ));
        }
      });

      console.log(`✅ Image served (validated): ${filename} from ${activeS3Key}`);

    } catch (s3Error) {
      console.error('❌ S3 image error:', s3Error);
      return res.status(404).json(createErrorResponse(
        'Image not found',
        'Failed to retrieve image from S3',
        { s3Key: s3Error.s3Key || s3Key, details: s3Error.message }
      ));
    }

  } catch (error) {
    console.error('❌ Image serve error:', error);
    res.status(500).json(createErrorResponse(
      'Image serve failed',
      'Failed to process image request',
      { details: error.message }
    ));
  }
});

/**
 * Download Lesson Plan Slide
 *
 * Downloads a specific SVG slide from a lesson plan stored in direct storage.
 * Serves slides that are stored directly in LessonPlan file_configs.presentation
 * array, bypassing the Files table entirely.
 *
 * @route GET /api/assets/download/lesson-plan-slide/:lessonPlanId/:slideId
 * @access Public (no authentication required - lesson plan slides are public assets)
 *
 * @param {string} lessonPlanId - ID of the lesson plan
 * @param {string} slideId - ID of the slide within the lesson plan
 *
 * @returns {200} SVG file binary data
 * @returns {404} Lesson plan or slide not found
 * @returns {500} Server error
 *
 * @example Download SVG Slide
 * GET /api/assets/download/lesson-plan-slide/abc123/slide_123456_xyz
 *
 * Response:
 * Content-Disposition: attachment; filename="slide-1.svg"
 * Content-Type: image/svg+xml
 * [Binary SVG data]
 */
router.get('/download/lesson-plan-slide/:lessonPlanId/:slideId', async (req, res) => {
  try {
    const { lessonPlanId, slideId } = req.params;

    console.log(`📥 Lesson plan slide download: LessonPlan ${lessonPlanId}, Slide ${slideId}`);

    // Import DirectSlideService
    const DirectSlideService = (await import('../services/DirectSlideService.js')).default;

    // Get lesson plan
    const lessonPlan = await db.LessonPlan.findByPk(lessonPlanId);
    if (!lessonPlan) {
      return res.status(404).json(createErrorResponse(
        'Lesson plan not found',
        `Lesson plan ${lessonPlanId} not found in database`,
        { lessonPlanId }
      ));
    }

    // Get slide from lesson plan
    const slide = lessonPlan.getDirectPresentationSlide(slideId);
    if (!slide) {
      return res.status(404).json(createErrorResponse(
        'Slide not found',
        `Slide ${slideId} not found in lesson plan ${lessonPlanId}`,
        { lessonPlanId, slideId }
      ));
    }

    console.log(`📄 Found slide: ${slide.filename} (${slide.s3_key})`);

    try {
      // Get file metadata first to check existence
      const metadataResult = await fileService.getS3ObjectMetadata(slide.s3_key);

      if (!metadataResult.success) {
        return res.status(404).json(createErrorResponse(
          'Slide file not found in storage',
          'Slide exists in database but not found in S3',
          { s3Key: slide.s3_key, slideId, lessonPlanId }
        ));
      }

      // Stream SVG file from S3
      const stream = await fileService.createS3Stream(slide.s3_key);

      // Set headers for download
      res.setHeader('Content-Disposition', encodeContentDisposition('attachment', slide.filename));
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Length', metadataResult.data.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Pipe stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error) => {
        console.error('❌ Slide stream error:', error);
        if (!res.headersSent) {
          res.status(500).json(createErrorResponse(
            'Stream error',
            'Failed to stream slide from storage',
            { s3Key: slide.s3_key, error: error.message }
          ));
        }
      });

      console.log(`✅ Slide download started: ${slide.filename}`);

    } catch (s3Error) {
      console.error('❌ S3 slide download error:', s3Error);
      return res.status(404).json(createErrorResponse(
        'Slide file not found in storage',
        'Failed to retrieve slide from S3',
        { s3Key: slide.s3_key, details: s3Error.message }
      ));
    }

  } catch (error) {
    console.error('❌ Lesson plan slide download error:', error);

    if (!res.headersSent) {
      res.status(500).json(createErrorResponse(
        'Download failed',
        'Failed to process slide download request',
        { details: error.message }
      ));
    }
  }
});

/**
 * Check Asset Existence
 *
 * Checks if an asset exists in S3 storage without downloading it.
 * Returns metadata if found.
 *
 * @route GET /api/assets/check/:entityType/:entityId
 * @access Private (requires authentication)
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @queryparam {string} assetType - Type of asset (marketing-video, content-video, document)
 * @queryparam {string} [filename] - Filename (required for documents, optional for videos)
 *
 * @returns {200} Asset exists with metadata
 * @returns {404} Asset not found
 * @returns {400} Bad request (missing params)
 * @returns {401} Unauthorized
 *
 * @example Check Marketing Video
 * GET /api/assets/check/workshop/abc123?assetType=marketing-video
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "exists": true,
 *   "entityType": "workshop",
 *   "entityId": "abc123",
 *   "assetType": "marketing-video",
 *   "filename": "video.mp4",
 *   "s3Key": "development/public/marketing-video/workshop/abc123/video.mp4",
 *   "size": 52428800,
 *   "lastModified": "2025-10-01T12:00:00.000Z"
 * }
 *
 * @example Check Document (File entity)
 * GET /api/assets/check/file/test_file_001?assetType=document
 * Authorization: Bearer <token>
 *
 * Response (if file_name is set in DB):
 * {
 *   "success": true,
 *   "exists": true,
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "filename": "sample.pdf",
 *   "s3Key": "development/private/document/file/test_file_001/sample.pdf",
 *   "size": 1048576,
 *   "lastModified": "2025-10-01T12:00:00.000Z"
 * }
 *
 * Response (if file_name is NULL):
 * {
 *   "success": true,
 *   "exists": false,
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "message": "File not yet uploaded (file_name is NULL in database)"
 * }
 */
router.get('/check/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { assetType, filename } = req.query;

    // Validate required parameters
    if (!assetType) {
      return res.status(400).json(createErrorResponse(
        'Missing required parameter',
        'assetType is required as query parameter',
        {
          hint: 'Example: /api/assets/check/file/test_file_001?assetType=document',
          received: { entityType, entityId, assetType }
        }
      ));
    }

    console.log(`🔍 Asset check: User ${req.user.id}, Type: ${assetType}, Entity: ${entityType}/${entityId}`);

    // Determine filename
    let targetFilename = filename;

    if (assetType === 'marketing-video' || assetType === 'content-video') {
      targetFilename = 'video.mp4';
    } else if (assetType === 'image') {
      // For images, use standard filename for predictable paths
      targetFilename = 'image.jpg';
    } else if (assetType === 'document' && entityType === 'file') {
      // For documents on File entities, get filename from database
      const fileEntity = await FileModel.findByPk(entityId);

      if (!fileEntity) {
        return res.status(404).json(createErrorResponse(
          'File entity not found',
          `File entity ${entityId} not found in database`,
          { entityId, entityType }
        ));
      }

      if (!fileEntity.file_name) {
        return res.json({
          success: true,
          exists: false,
          entityType,
          entityId,
          assetType,
          message: 'File not yet uploaded (file_name is NULL in database)'
        });
      }

      targetFilename = fileEntity.file_name;
    } else if (!targetFilename) {
      return res.status(400).json(createErrorResponse(
        'Missing filename',
        'filename query parameter is required for this asset type',
        {
          hint: 'Example: ?assetType=document&filename=sample.pdf',
          assetType,
          received: req.query
        }
      ));
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, assetType, targetFilename);

    try {
      // Check if asset exists in S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

      if (metadataResult.success) {
        const metadata = metadataResult.data;

        res.json({
          success: true,
          exists: true,
          entityType,
          entityId,
          assetType,
          filename: targetFilename,
          s3Key,
          size: metadata.size,
          contentType: metadata.contentType,
          lastModified: metadata.lastModified
        });
      } else {
        res.json({
          success: true,
          exists: false,
          entityType,
          entityId,
          assetType,
          message: 'Asset not found in storage'
        });
      }

    } catch (s3Error) {
      console.log('ℹ️ Asset not found in S3:', s3Error.message);
      res.json({
        success: true,
        exists: false,
        entityType,
        entityId,
        assetType,
        message: 'Asset not found in storage'
      });
    }

  } catch (error) {
    console.error('❌ Asset check error:', error);
    res.status(500).json(createErrorResponse(
      'Check failed',
      'Failed to check asset existence',
      { details: error.message }
    ));
  }
});

/**
 * Download Document
 *
 * Downloads a document from S3 storage.
 * ONLY available for File entities with assetType=document.
 * Enforces access control (purchase verification).
 * Preserves original filename in download.
 *
 * @route GET /api/assets/download/:entityType/:entityId
 * @access Private (requires authentication + access control)
 *
 * @param {string} entityType - Type of entity (must be "file")
 * @param {string} entityId - ID of the File entity
 *
 * @returns {200} Binary file stream with original filename
 * @returns {400} Invalid entityType (not "file")
 * @returns {401} Unauthorized
 * @returns {403} Access denied (no purchase)
 * @returns {404} File entity not found or file_name is NULL
 * @returns {500} Server error
 *
 * @example Download PDF from File Entity
 * GET /api/assets/download/file/test_file_001_free_pdf_complete
 * Authorization: Bearer <token>
 *
 * Response:
 * Content-Disposition: attachment; filename="sample.pdf"
 * Content-Type: application/pdf
 * [Binary PDF data]
 *
 * @example Error - Not a File Entity
 * GET /api/assets/download/workshop/abc123
 *
 * Response: 400
 * {
 *   "error": "Invalid entityType",
 *   "message": "Download only available for File entities (entityType=file)",
 *   "hint": "Use /api/media/stream/:entityType/:entityId for video streaming"
 * }
 *
 * @example Error - File Not Uploaded
 * GET /api/assets/download/file/test_file_002
 *
 * Response: 404
 * {
 *   "error": "File not yet uploaded",
 *   "message": "file_name is NULL in database",
 *   "hint": "Upload the file first using POST /api/assets/upload"
 * }
 */
router.get('/download/:entityType/:entityId', optionalAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    // Only allow downloads for File entities
    if (entityType !== 'file') {
      return res.status(400).json(createErrorResponse(
        'Invalid entityType',
        'Download only available for File entities (entityType=file)',
        {
          hint: 'Use /api/media/stream/:entityType/:entityId for video streaming',
          received: entityType,
          expectedEntityType: 'file'
        }
      ));
    }

    console.log(`📥 Document download: User ${req.user?.id || 'undefined'}, Entity: ${entityType}/${entityId}`);
    console.log('🔍 req.user debug:', {
      userExists: !!req.user,
      userStructure: req.user ? Object.keys(req.user) : 'N/A',
      userId: req.user?.id,
      userUid: req.user?.uid,
      userData: req.user
    });

    // Get File entity
    const fileEntity = await FileModel.findByPk(entityId);

    if (!fileEntity) {
      return res.status(404).json(createErrorResponse(
        'File entity not found',
        `File entity ${entityId} not found in database`,
        { entityId, entityType }
      ));
    }

    // Check if file uploaded
    if (!fileEntity.file_name) {
      return res.status(404).json(createErrorResponse(
        'File not yet uploaded',
        'file_name is NULL in database',
        {
          hint: 'Upload the file first using POST /api/assets/upload',
          entityId,
          fileEntity: { id: fileEntity.id, file_name: fileEntity.file_name }
        }
      ));
    }

    // Handle unauthenticated requests (req.user might be null with optionalAuth)
    let hasAccess = false;
    if (req.user) {
      // Ensure req.user has consistent id property (from either uid or id)
      if (!req.user.id && req.user.uid) {
        req.user.id = req.user.uid;
      }
      // Check access control for authenticated users
      hasAccess = await checkUserAccess(req.user, fileEntity);
    }
    const isPreviewRequest = req.query.preview === 'true';

    // DEBUG: Log access control decisions
    console.log('🔍 Access Control Debug:', {
      userId: req.user?.id || 'unauthenticated',
      userEmail: req.user?.email || 'none',
      userRole: req.user?.role || 'none',
      fileId: entityId,
      fileName: fileEntity.file_name,
      fileCreatorId: fileEntity.is_asset_only ? 'N/A (asset-only)' : (fileEntity.creator_user_id || 'N/A'),
      allowPreview: fileEntity.allow_preview,
      addCopyrightsFooter: fileEntity.add_copyrights_footer,
      hasAccess,
      isPreviewRequest,
      isAssetOnly: fileEntity.is_asset_only
    });

    // Implement user's access control requirements:
    // 1. Unauthenticated users can access files only if allow_preview is true (with watermarks)
    // 2. If file product doesn't have allow_preview AND user has no access → return error
    // 3. If allow_preview is true AND user has no access → return file WITH watermarks
    // 4. If user has access → return file WITHOUT watermarks

    if (!hasAccess) {
      if (!fileEntity.allow_preview) {
        // Case 2: No preview allowed and user has no access → deny access
        return res.status(403).json(createErrorResponse(
          'Access denied',
          'You do not have permission to download this file',
          {
            hint: 'Purchase the product or contact the creator for access',
            allowPreview: false,
            entityId,
            userId: req.user?.id || null
          }
        ));
      } else {
        // Case 3: Preview is allowed and user has no access → continue with watermarks
        console.log(`🔍 Preview mode granted for ${req.user ? 'authenticated' : 'unauthenticated'} user ${req.user?.id || 'none'}, file ${entityId}`);
      }
    } else {
      // Case 4: User has access → continue without watermarks
      console.log(`🔍 Full access granted for user ${req.user?.id}, file ${entityId}`);
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, 'document', fileEntity.file_name);

    // Check if PDF processing is needed
    const isPdf = fileEntity.file_type === 'pdf' || fileEntity.file_name.toLowerCase().endsWith('.pdf');
    const needsPdfProcessing = isPdf && (fileEntity.add_copyrights_footer || (!hasAccess && fileEntity.allow_preview));

    try {
      // Get file metadata first to check existence
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

      if (!metadataResult.success) {
        return res.status(404).json(createErrorResponse(
          'File not found in storage',
          'File exists in database but not found in S3',
          { s3Key, entityId, fileName: fileEntity.file_name }
        ));
      }

      if (needsPdfProcessing) {
        // PDF processing needed
        console.log(`📄 PDF processing needed for: ${fileEntity.file_name}`);

        // Fetch settings and download PDF
        const [settings, pdfBuffer] = await Promise.all([
          Settings.findOne(),
          fileService.downloadToBuffer(s3Key)
        ]);

        // Process PDF with unified function
        const skipFooter = req.query.skipFooter === 'true';
        const finalPdfBuffer = await processPdf(pdfBuffer, fileEntity, hasAccess, settings, skipFooter);

        // Set headers - inline for preview mode, attachment for download
        const isPreviewMode = !hasAccess && fileEntity.allow_preview;
        const disposition = isPreviewMode ? 'inline' : 'attachment';
        res.setHeader('Content-Disposition', encodeContentDisposition(disposition, fileEntity.file_name));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', finalPdfBuffer.length);

        // Send processed PDF
        res.send(finalPdfBuffer);

        console.log(`✅ PDF processing completed: ${fileEntity.file_name}`);
      } else {
        // Stream file directly without modification
        const stream = await fileService.createS3Stream(s3Key);

        // Set headers for download
        res.setHeader('Content-Disposition', encodeContentDisposition('attachment', fileEntity.file_name));
        res.setHeader('Content-Type', metadataResult.data.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', metadataResult.data.size);

        // Pipe stream to response
        stream.pipe(res);

        // Handle stream errors
        stream.on('error', (error) => {
          console.error('❌ Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json(createErrorResponse(
              'Stream error',
              'Failed to stream file from storage',
              { s3Key, error: error.message }
            ));
          }
        });

        console.log(`✅ Download started: ${fileEntity.file_name}`);
      }

    } catch (s3Error) {
      console.error('❌ S3 download error:', s3Error);
      return res.status(404).json(createErrorResponse(
        'File not found in storage',
        'Failed to retrieve file from S3',
        { s3Key, details: s3Error.message }
      ));
    }

  } catch (error) {
    console.error('❌ Document download error:', error);

    if (!res.headersSent) {
      res.status(500).json(createErrorResponse(
        'Download failed',
        'Failed to process download request',
        { details: error.message }
      ));
    }
  }
});

/**
 * Delete Asset
 *
 * Deletes an asset from S3 storage with transaction safety.
 * For documents on File entities, sets file_name to NULL in database.
 * Uses transactions to ensure atomicity between S3 deletion and database update.
 *
 * @route DELETE /api/assets/:entityType/:entityId
 * @access Private (requires authentication)
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @queryparam {string} assetType - Type of asset (marketing-video, content-video, document)
 * @queryparam {string} [filename] - Filename (required for documents, optional for videos)
 *
 * @returns {200} Asset deleted successfully
 * @returns {404} Asset not found
 * @returns {400} Bad request (missing params)
 * @returns {401} Unauthorized
 * @returns {500} Server error
 *
 * @example Delete Marketing Video
 * DELETE /api/assets/workshop/abc123?assetType=marketing-video
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "entityType": "workshop",
 *   "entityId": "abc123",
 *   "assetType": "marketing-video",
 *   "s3Key": "development/public/marketing-video/workshop/abc123/video.mp4",
 *   "message": "Asset deleted successfully"
 * }
 *
 * @example Delete Document (File entity)
 * DELETE /api/assets/file/test_file_001?assetType=document
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "s3Key": "development/private/document/file/test_file_001/sample.pdf",
 *   "databaseUpdated": true,
 *   "message": "Asset deleted successfully and file_name set to NULL"
 * }
 */
router.delete('/:entityType/:entityId', authenticateToken, async (req, res) => {
  // Create enhanced logger for this operation
  const logger = createFileLogger('Asset Deletion', req.user, {
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    assetType: req.query.assetType,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  try {
    const { entityType, entityId } = req.params;
    const { assetType, filename } = req.query;

    // Start operation logging
    logger.start({
      entityType,
      entityId,
      assetType,
      filename,
      method: 'DELETE',
      url: req.originalUrl
    });

    // Validate required parameters
    if (!assetType) {
      const errorResponse = createErrorResponse(
        'Missing required parameter',
        'assetType is required as query parameter',
        {
          hint: 'Example: DELETE /api/assets/file/test_file_001?assetType=document',
          received: { entityType, entityId, filename }
        },
        logger.requestId
      );

      logger.error(new Error('Missing assetType parameter'), { provided: req.query });
      return res.status(400).json(errorResponse);
    }

    // Determine filename
    let targetFilename = filename;

    if (assetType === 'marketing-video' || assetType === 'content-video') {
      targetFilename = 'video.mp4';
      logger.info('Using standard video filename', { filename: targetFilename });
    } else if (assetType === 'image') {
      // For images, use standard filename for predictable paths
      targetFilename = 'image.jpg';
      logger.info('Using standard image filename', { filename: targetFilename });
    } else if (assetType === 'document' && entityType === 'file') {
      // For documents on File entities, get filename from database
      logger.info('Fetching document filename from database', { entityId });

      const fileEntity = await FileModel.findByPk(entityId);
      logger.dbOperation('find', 'File', entityId, { found: !!fileEntity });

      if (!fileEntity) {
        const errorResponse = createErrorResponse(
          'File entity not found',
          `File entity ${entityId} not found in database`,
          { entityId },
          logger.requestId
        );

        logger.error(new Error(`File entity ${entityId} not found`), { entityId });
        return res.status(404).json(errorResponse);
      }

      if (!fileEntity.file_name) {
        const errorResponse = createErrorResponse(
          'No file to delete',
          'file_name is NULL in database (file not uploaded)',
          { entityId, fileEntity: { id: fileEntity.id, file_name: fileEntity.file_name } },
          logger.requestId
        );

        logger.warn('File entity has no uploaded file', { entityId, file_name: fileEntity.file_name });
        return res.status(404).json(errorResponse);
      }

      targetFilename = fileEntity.file_name;
      logger.info('Retrieved filename from database', { filename: targetFilename });
    } else if (!targetFilename) {
      const errorResponse = createErrorResponse(
        'Missing filename',
        'filename query parameter is required for this asset type',
        {
          hint: 'Example: ?assetType=document&filename=sample.pdf',
          assetType,
          received: req.query
        },
        logger.requestId
      );

      logger.error(new Error('Missing filename parameter'), { assetType, query: req.query });
      return res.status(400).json(errorResponse);
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, assetType, targetFilename);
    logger.info('Constructed S3 path', { s3Key, components: { entityType, entityId, assetType, targetFilename } });

    // Create verifier for consistency checks
    const verifier = createFileVerifier();

    // Pre-deletion verification - check for multiple references and file existence
    logger.info('Performing pre-deletion verification');
    const preDeleteCheck = await verifier.checkPreDeletion(s3Key, logger);

    if (!preDeleteCheck.success) {
      const errorResponse = createErrorResponse(
        'Pre-deletion check failed',
        'Unable to verify file safety for deletion',
        { preDeleteCheck, s3Key },
        logger.requestId
      );

      logger.error(new Error('Pre-deletion verification failed'), preDeleteCheck);
      return res.status(500).json(errorResponse);
    }

    // Log pre-deletion check results
    if (preDeleteCheck.warnings && preDeleteCheck.warnings.length > 0) {
      for (const warning of preDeleteCheck.warnings) {
        logger.warn(warning, preDeleteCheck.checks);
      }
    }

    // Use transaction to ensure atomicity between database update and S3 deletion
    const transaction = await sequelize.transaction();
    logger.transaction('start', { s3Key, preDeleteChecks: preDeleteCheck.checks });

    let dbUpdateCompleted = false;

    try {
      // Use consolidated FileService deleteAsset method for unified deletion
      logger.info('Starting consolidated asset deletion', { s3Key, assetType });
      const deleteResult = await fileService.deleteAsset({
        entityType,
        entityId,
        assetType,
        userId: req.user.id,
        transaction,
        logger
      });

      if (!deleteResult.success) {
        throw new Error(`Asset deletion failed: ${deleteResult.error || deleteResult.reason}`);
      }

      // Get metadata for response consistency
      const databaseUpdated = deleteResult.databaseUpdated;

      // Both operations succeeded - commit transaction
      await transaction.commit();
      logger.transaction('commit', { s3Key: deleteResult.s3Key, databaseUpdated });

      // Post-deletion verification - ensure deletion was successful and no dangling references
      logger.info('Performing post-deletion verification');
      const postDeleteCheck = await verifier.verifyDeletion(deleteResult.s3Key, logger);

      // Prepare success response with verification results
      const successResponse = createSuccessResponse({
        ...deleteResult, // Include all deleteResult properties (s3Key, filename, entityType, etc.)
        verification: {
          preDelete: preDeleteCheck.checks,
          postDelete: postDeleteCheck.success ? postDeleteCheck.verified : { error: postDeleteCheck.error }
        },
        message: deleteResult.databaseUpdated
          ? 'Asset deleted successfully and file_name set to NULL'
          : 'Asset deleted successfully'
      }, logger.requestId);

      // Log warnings if post-deletion verification has issues
      if (!postDeleteCheck.success || postDeleteCheck.warning) {
        logger.warn('Post-deletion verification warnings detected', {
          success: postDeleteCheck.success,
          error: postDeleteCheck.error,
          warning: postDeleteCheck.warning
        });
      }

      logger.success({
        ...deleteResult, // Include all deleteResult properties
        operations: ['unified_delete'],
        verification: {
          preDeleteSafe: preDeleteCheck.checks.safeToDelete,
          postDeleteClean: postDeleteCheck.success
        }
      });

      res.json(successResponse);

    } catch (deleteError) {
      // Rollback transaction on any error
      await transaction.rollback();
      logger.transaction('rollback', { reason: 'Operation failed', error: deleteError.message });

      // Handle specific S3 errors
      if (deleteError.code === 'NoSuchKey') {
        const errorResponse = createErrorResponse(
          'Asset not found',
          'Asset not found in storage',
          {
            s3Key,
            hint: 'File may have been already deleted or never existed',
            errorCode: deleteError.code
          },
          logger.requestId
        );

        logger.error(deleteError, { s3Key, errorCode: deleteError.code });
        return res.status(404).json(errorResponse);
      }

      const errorResponse = createErrorResponse(
        'Delete failed',
        'Failed to delete asset (transaction rolled back)',
        {
          details: deleteError.message,
          s3Key,
          errorCode: deleteError.code
        },
        logger.requestId
      );

      logger.error(deleteError, { s3Key, dbUpdateCompleted });
      return res.status(500).json(errorResponse);
    }

  } catch (error) {
    const errorResponse = createErrorResponse(
      'Delete failed',
      'Failed to process delete request',
      { details: error.message },
      logger.requestId
    );

    logger.error(error, { stage: 'request_processing' });
    res.status(500).json(errorResponse);
  }
});

/**
 * Verify File Integrity
 *
 * Verifies the integrity of an uploaded file by comparing its calculated checksum
 * with an expected SHA-256 checksum. This endpoint is used to ensure file integrity
 * and detect corruption during upload or storage.
 *
 * @route POST /api/assets/verify/:entityType/:entityId
 * @access Private (requires authentication)
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @queryparam {string} assetType - Type of asset (document, image, marketing-video, content-video)
 * @body {string} expectedSha256 - Expected SHA-256 checksum to verify against
 *
 * @returns {200} Verification result with integrity status
 * @returns {400} Bad request (missing params)
 * @returns {401} Unauthorized
 * @returns {404} Asset not found
 * @returns {500} Server error
 *
 * @example Verify Document Integrity
 * POST /api/assets/verify/file/test_file_001?assetType=document
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "expectedSha256": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "verified": true,
 *   "s3Key": "development/private/document/file/test_file_001/sample.pdf",
 *   "filename": "sample.pdf",
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "expected": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
 *   "calculated": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
 *   "fileSize": 1048576,
 *   "verifiedAt": "2025-10-30T15:45:00.000Z"
 * }
 *
 * @example Verification Failed
 * {
 *   "success": true,
 *   "verified": false,
 *   "expected": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
 *   "calculated": "b776e9c9e5a54f5c4e8d7f5e4e6d5c4b3a2f1e0d9c8b7a6958473625f1e4d3c2b",
 *   "message": "File integrity verification failed - checksums do not match"
 * }
 */
router.post('/verify/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { assetType } = req.query;
    const { expectedSha256 } = req.body;

    // Validate required parameters
    if (!assetType) {
      return res.status(400).json(createErrorResponse(
        'Missing required parameter',
        'assetType is required as query parameter',
        {
          hint: 'Example: POST /api/assets/verify/file/test_file_001?assetType=document',
          received: { entityType, entityId }
        }
      ));
    }

    if (!expectedSha256) {
      return res.status(400).json(createErrorResponse(
        'Missing expected checksum',
        'expectedSha256 is required in request body',
        {
          hint: 'Include SHA-256 checksum in request body: {"expectedSha256": "abc123..."}',
          received: req.body
        }
      ));
    }

    // Validate SHA-256 format (64 hex characters)
    if (!/^[a-fA-F0-9]{64}$/.test(expectedSha256)) {
      return res.status(400).json(createErrorResponse(
        'Invalid checksum format',
        'expectedSha256 must be a valid SHA-256 hash (64 hex characters)',
        {
          received: expectedSha256,
          format: 'Expected: 64 hex characters (0-9, a-f, A-F)'
        }
      ));
    }

    console.log(`🔍 File integrity verification: User ${req.user.id}, Entity: ${entityType}/${entityId}, Asset: ${assetType}`);

    // Create logger for this operation
    const logger = createFileLogger('File Integrity Verification', req.user, {
      entityType,
      entityId,
      assetType,
      expectedSha256: expectedSha256.substring(0, 16) + '...',
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    logger.start({
      entityType,
      entityId,
      assetType,
      expectedSha256: expectedSha256.substring(0, 16) + '...',
      method: 'POST',
      url: req.originalUrl
    });

    try {
      // Use FileService integrity verification
      const verificationResult = await fileService.verifyFileIntegrity({
        entityType,
        entityId,
        assetType,
        expectedSha256,
        logger
      });

      if (!verificationResult.success) {
        if (verificationResult.error.includes('not found')) {
          logger.warn('Asset not found for verification', { entityType, entityId, assetType });
          return res.status(404).json(createErrorResponse(
            'Asset not found',
            verificationResult.error,
            {
              entityType,
              entityId,
              assetType
            },
            logger.requestId
          ));
        }

        logger.error(new Error('Verification failed'), verificationResult);
        return res.status(500).json(createErrorResponse(
          'Verification failed',
          verificationResult.error,
          { entityType, entityId, assetType },
          logger.requestId
        ));
      }

      const responseData = createSuccessResponse(verificationResult, logger.requestId);

      // Log verification result
      if (verificationResult.verified) {
        logger.success({
          ...verificationResult,
          expectedHash: verificationResult.expected.substring(0, 16) + '...',
          calculatedHash: verificationResult.calculated.substring(0, 16) + '...',
          verification: 'passed'
        });
      } else {
        logger.warn('File integrity verification failed', {
          ...verificationResult,
          expectedHash: verificationResult.expected.substring(0, 16) + '...',
          calculatedHash: verificationResult.calculated.substring(0, 16) + '...',
          verification: 'failed'
        });
      }

      res.json(responseData);

    } catch (verificationError) {
      logger.error(verificationError, { stage: 'integrity_verification' });
      return res.status(500).json(createErrorResponse(
        'Verification error',
        'Failed to perform file integrity verification',
        {
          details: verificationError.message,
          entityType,
          entityId,
          assetType
        },
        logger.requestId
      ));
    }

  } catch (error) {
    console.error('❌ File integrity verification error:', error);
    res.status(500).json(createErrorResponse(
      'Verification failed',
      'Failed to process integrity verification request',
      { details: error.message }
    ));
  }
});

/**
 * Get File Metadata
 *
 * Retrieves comprehensive metadata for an uploaded file including checksums,
 * content analysis, and S3 storage information. This endpoint provides detailed
 * information about uploaded assets for debugging and analysis purposes.
 *
 * @route GET /api/assets/metadata/:entityType/:entityId
 * @access Private (requires authentication)
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @queryparam {string} assetType - Type of asset (document, image, marketing-video, content-video)
 *
 * @returns {200} Comprehensive file metadata
 * @returns {400} Bad request (missing params)
 * @returns {401} Unauthorized
 * @returns {404} Asset not found
 * @returns {500} Server error
 *
 * @example Get Document Metadata
 * GET /api/assets/metadata/file/test_file_001?assetType=document
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "s3Key": "development/private/document/file/test_file_001/sample.pdf",
 *   "filename": "sample.pdf",
 *   "entityType": "file",
 *   "entityId": "test_file_001",
 *   "assetType": "document",
 *   "s3Metadata": {
 *     "size": 1048576,
 *     "contentType": "application/pdf",
 *     "lastModified": "2025-10-30T15:45:00.000Z",
 *     "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
 *   },
 *   "enhancedAnalysis": {
 *     "basic": {
 *       "fileName": "sample.pdf",
 *       "mimeType": "application/pdf",
 *       "size": 1048576,
 *       "assetType": "document"
 *     },
 *     "integrity": {
 *       "sha256": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
 *       "md5": "5d41402abc4b2a76b9719d911017c592",
 *       "verified": true,
 *       "calculatedAt": "2025-10-30T15:45:00.000Z"
 *     },
 *     "content": {
 *       "type": "document",
 *       "metadata": {
 *         "format": "application/pdf",
 *         "extension": "pdf"
 *       }
 *     }
 *   },
 *   "retrievedAt": "2025-10-30T15:45:00.000Z"
 * }
 *
 * @example Large File (No Enhanced Analysis)
 * {
 *   "success": true,
 *   "s3Metadata": { ... },
 *   "enhancedAnalysis": null,
 *   "note": "Enhanced analysis skipped for files larger than 50MB"
 * }
 */
router.get('/metadata/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { assetType } = req.query;

    // Validate required parameters
    if (!assetType) {
      return res.status(400).json(createErrorResponse(
        'Missing required parameter',
        'assetType is required as query parameter',
        {
          hint: 'Example: GET /api/assets/metadata/file/test_file_001?assetType=document',
          received: { entityType, entityId }
        }
      ));
    }

    console.log(`📊 File metadata request: User ${req.user.id}, Entity: ${entityType}/${entityId}, Asset: ${assetType}`);

    // Create logger for this operation
    const logger = createFileLogger('File Metadata Retrieval', req.user, {
      entityType,
      entityId,
      assetType,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    logger.start({
      entityType,
      entityId,
      assetType,
      method: 'GET',
      url: req.originalUrl
    });

    try {
      // Use FileService metadata retrieval
      const metadataResult = await fileService.getFileMetadata({
        entityType,
        entityId,
        assetType,
        logger
      });

      if (!metadataResult.success) {
        if (metadataResult.error.includes('not found')) {
          logger.warn('Asset not found for metadata retrieval', { entityType, entityId, assetType });
          return res.status(404).json(createErrorResponse(
            'Asset not found',
            metadataResult.error,
            {
              entityType,
              entityId,
              assetType
            },
            logger.requestId
          ));
        }

        logger.error(new Error('Metadata retrieval failed'), metadataResult);
        return res.status(500).json(createErrorResponse(
          'Metadata retrieval failed',
          metadataResult.error,
          { entityType, entityId, assetType },
          logger.requestId
        ));
      }

      const responseData = createSuccessResponse(metadataResult, logger.requestId);

      // Log successful metadata retrieval
      logger.success({
        s3Key: metadataResult.s3Key,
        filename: metadataResult.filename,
        entityType: metadataResult.entityType,
        entityId: metadataResult.entityId,
        assetType: metadataResult.assetType,
        fileSize: metadataResult.s3Metadata?.size,
        hasEnhancedAnalysis: !!metadataResult.enhancedAnalysis,
        checksumAvailable: !!metadataResult.enhancedAnalysis?.integrity?.sha256
      });

      res.json(responseData);

    } catch (metadataError) {
      logger.error(metadataError, { stage: 'metadata_retrieval' });
      return res.status(500).json(createErrorResponse(
        'Metadata error',
        'Failed to retrieve file metadata',
        {
          details: metadataError.message,
          entityType,
          entityId,
          assetType
        },
        logger.requestId
      ));
    }

  } catch (error) {
    console.error('❌ File metadata error:', error);
    res.status(500).json(createErrorResponse(
      'Metadata failed',
      'Failed to process metadata request',
      { details: error.message }
    ));
  }
});

// REMOVED: PPTX conversion endpoint - replaced with SVG slide system

// Error handling middleware for multer errors
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(createErrorResponse(
        'File too large',
        'File exceeds the maximum allowed size (5GB)',
        {
          maxSize: '5GB',
          errorCode: error.code,
          field: error.field
        }
      ));
    }
  }

  next(error);
});

// Export utility functions for use in other modules
export { deleteAllFileAssets, checkUserAccess, processPdf };

export default router;
