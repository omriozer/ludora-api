import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import fileService from '../services/FileService.js';
import SettingsService from '../services/SettingsService.js';
import db from '../models/index.js';
import { sequelize } from '../models/index.js';
import { mergePdfTemplate } from '../utils/pdfTemplateMerge.js';
// Removed getPreviewTemplate import - no longer applying automatic preview watermarks
import { resolveBrandingSettingsWithFallback } from '../utils/brandingSettingsHelper.js';
import { substituteVariables } from '../utils/variableSubstitution.js';
// Removed PdfPageReplacementService import - now using unified mergePdfTemplate
import { mergeSvgTemplate } from '../utils/svgTemplateMerge.js';
import AccessControlService from '../services/AccessControlService.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import { generateIsraeliCacheHeaders, applyIsraeliCaching } from '../middleware/israeliCaching.js';
import { generateHebrewContentDisposition } from '../utils/hebrewFilenameUtils.js';
import { createFileLogger, createErrorResponse, createSuccessResponse } from '../utils/fileOperationLogger.js';
import { createFileVerifier } from '../utils/fileOperationVerifier.js';
import { createPreUploadValidator } from '../utils/preUploadValidator.js';
import { clog, cerror } from '../lib/utils.js';
// Import pptx2html library - try using dynamic import to handle the UMD build correctly
let renderPptx;

const router = express.Router();
const { File: FileModel, User, Purchase } = db;

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
 * Helper: Process PDF with template-based watermarks and selective access control
 *
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} fileEntity - File entity from database
 * @param {boolean} hasAccess - Whether user has access
 * @param {Object} settings - System settings
 * @param {boolean} skipBranding - Whether to skip branding processing
 * @param {boolean} skipWatermarks - Whether to skip watermark processing
 * @param {Object} user - User object for variables (optional)
 * @returns {Promise<Buffer>} Processed PDF buffer
 */
async function processPdf(pdfBuffer, fileEntity, hasAccess, settings, skipBranding = false, skipWatermarks = false, user = null, userEmail = null, previewOptions = {}) {
  try {

    // Determine access mode and processing requirements
    const isPreviewMode = !hasAccess && fileEntity.allow_preview;
    const needsSelectiveAccess = isPreviewMode && fileEntity.accessible_pages;

    // Branding rules: Applied when add_branding=true for BOTH full access AND preview mode
    const shouldMergeBranding = fileEntity.add_branding && !skipBranding;

    // Watermark rules: Applied ONLY in preview mode (when user doesn't own the file)
    const needsWatermarks = isPreviewMode && !skipWatermarks;

    // Check if we should use template-based watermarks (instead of legacy hardcoded ones)
    const shouldUseTemplateWatermarks = needsWatermarks && (
      fileEntity.watermark_template_id ||  // Has specific watermark template
      // OR if there's a default watermark template available (we'll check this in processing)
      true // Always try to use template system for consistency
    );

    // Use unified template processing for selective access, watermarks, AND/OR branding templates
    if (needsSelectiveAccess || shouldUseTemplateWatermarks || shouldMergeBranding) {

      // Prepare variables for template substitution
      const variables = {
        filename: fileEntity.file_name,
        user: userEmail || user?.email || user?.name || 'User', // Prioritize userEmail parameter
        userObj: user, // Pass the full user object for nested property access
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      };

      // Build unified template settings combining watermarks and branding
      let unifiedTemplate = { elements: {} };

      // 1. Add watermark elements if needed
      if (needsWatermarks) {
        try {
          const { SystemTemplate } = db;
          let watermarkTemplate = null;

          // Try to get the configured watermark template
          if (fileEntity.watermark_template_id) {
            const template = await SystemTemplate.findOne({
              where: {
                id: fileEntity.watermark_template_id,
                template_type: 'watermark'
              }
            });
            if (template) {
              watermarkTemplate = template.template_data;
            }
          }

          // If no configured template, try to get default watermark template
          if (!watermarkTemplate) {
            const defaultTemplate = await SystemTemplate.findOne({
              where: {
                template_type: 'watermark',
                target_format: fileEntity.target_format || 'pdf-a4-portrait',
                is_default: true
              }
            });
            if (defaultTemplate) {
              watermarkTemplate = defaultTemplate.template_data;
            }
          }

          // Override with custom watermark settings if available
          if (fileEntity.watermark_settings) {
            watermarkTemplate = fileEntity.watermark_settings;
          }

          // Add watermark elements to unified template
          if (watermarkTemplate && watermarkTemplate.elements) {
            // Merge element arrays by type
            for (const [elementType, elementArray] of Object.entries(watermarkTemplate.elements)) {
              if (Array.isArray(elementArray)) {
                if (!unifiedTemplate.elements[elementType]) {
                  unifiedTemplate.elements[elementType] = [];
                }
                unifiedTemplate.elements[elementType].push(...elementArray);
              }
            }
          }
        } catch (templateError) {
          // Template error - continue without watermark elements
        }
      }

      // 2. Add branding elements if needed
      if (shouldMergeBranding) {
        try {
          const brandingSettings = await resolveBrandingSettingsWithFallback(fileEntity, settings);
          if (brandingSettings && brandingSettings.elements) {
            // Merge element arrays by type
            for (const [elementType, elementArray] of Object.entries(brandingSettings.elements)) {
              if (Array.isArray(elementArray)) {
                if (!unifiedTemplate.elements[elementType]) {
                  unifiedTemplate.elements[elementType] = [];
                }
                unifiedTemplate.elements[elementType].push(...elementArray);
              }
            }
          }
        } catch (brandingError) {
          // Branding error - continue without branding elements
        }
      }

      // 3. Apply unified template with optional page replacement
      const options = {};
      if (needsSelectiveAccess) {
        options.accessiblePages = fileEntity.accessible_pages;
      }

      // Use unified mergePdfTemplate for all processing
      const processedBuffer = await mergePdfTemplate(pdfBuffer, unifiedTemplate, variables, options);
      return processedBuffer;
    }

    // Fall back to legacy processing for backward compatibility
    const shouldAddWatermarks = !hasAccess && fileEntity.allow_preview;
    let finalPdfBuffer = pdfBuffer;

    // Build complete branding settings using template-based helper function
    let brandingSettings = null;
    if (shouldMergeBranding) {
      brandingSettings = await resolveBrandingSettingsWithFallback(fileEntity, settings);
    }

    // Prepare variables for template substitution (same as enhanced processing)
    const variables = {
      filename: fileEntity.file_name,
      user: userEmail || user?.email || user?.name || 'User', // Prioritize userEmail parameter
      userObj: user, // Pass the full user object for nested property access
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };


    // Step 1: Apply branding if needed
    if (shouldMergeBranding && brandingSettings) {
      try {
        finalPdfBuffer = await mergePdfTemplate(finalPdfBuffer, brandingSettings, variables);
      } catch (error) {
        // Branding error - continue without branding
      }
    }

    // Step 2: Watermarks are now handled only through user's template system
    // No automatic preview watermarks applied - user controls all watermarks via templates

    return finalPdfBuffer;

  } catch (error) {
    // FALLBACK MECHANISM: Handle PDF corruption and unprocessable files
    return await handlePdfProcessingFailure(error, pdfBuffer, fileEntity, hasAccess, settings, user);
  }
}

/**
 * Fallback mechanism for when all PDF processing fails
 * @param {Error} originalError - The error that caused processing to fail
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} fileEntity - File entity from database
 * @param {boolean} hasAccess - Whether user has access
 * @param {Object} settings - System settings
 * @param {Object} user - User object
 * @returns {Promise<Buffer|Error>} - Either the original PDF or throws error
 */
async function handlePdfProcessingFailure(originalError, pdfBuffer, fileEntity, hasAccess, settings, user) {

  // Check if this is a PDF corruption error (sizeInBytes, invalid PDF, etc.)
  const isCorruptionError = originalError.message.includes('sizeInBytes') ||
                           originalError.message.includes('PDF corruption detected') ||
                           originalError.message.includes('Invalid PDF') ||
                           originalError.message.includes('Failed to parse') ||
                           originalError.message.includes('Unexpected token') ||
                           originalError.constructor.name === 'PDFError';

  if (isCorruptionError) {

    // Log the corruption issue for monitoring
    try {
      await db.Logs.create({
        source_type: 'pdf_processing',
        log_type: 'error',
        message: `PDF corruption detected: ${JSON.stringify({
          fileName: fileEntity.file_name,
          fileId: fileEntity.id,
          error: originalError.message,
          errorType: originalError.constructor.name,
          userId: user?.id,
          userAgent: 'server-side',
          timestamp: new Date().toISOString()
        })}`,
        created_at: new Date()
      });
    } catch (logError) {
      // Log error - corruption logging failed
    }

    // For corrupted PDFs, we should NOT serve them as they could be malicious or cause client issues
    throw new Error(`PDF file appears to be corrupted and cannot be processed safely. Please re-upload the file. Technical details: ${originalError.message}`);
  }

  // Check if user has full access - if so, we can potentially serve the original PDF
  if (hasAccess) {

    // Validate that the PDF buffer is at least minimally valid
    try {
      // Basic PDF header check
      const pdfHeader = pdfBuffer.slice(0, 8).toString('ascii');
      if (!pdfHeader.startsWith('%PDF-')) {
        throw new Error('Invalid PDF header - file is not a valid PDF');
      }

      return pdfBuffer;
    } catch (validationError) {
      throw new Error(`PDF file is invalid and cannot be served. Please re-upload a valid PDF file. Technical details: ${validationError.message}`);
    }
  }

  // For users without full access, we cannot safely serve unprocessed PDFs

  // Log this access denial for monitoring
  try {
    await db.Logs.create({
      source_type: 'access_control',
      log_type: 'warn',
      message: `PDF access denied due to processing failure: ${JSON.stringify({
        fileName: fileEntity.file_name,
        fileId: fileEntity.id,
        hasAccess,
        allowPreview: fileEntity.allow_preview,
        processingError: originalError.message,
        userId: user?.id,
        accessDeniedReason: 'processing_failed_without_full_access',
        timestamp: new Date().toISOString()
      })}`,
      created_at: new Date()
    });
  } catch (logError) {
    // Access denial logging failed
  }

  throw new Error(`Unable to process PDF for preview. This file requires full access to view. Processing failed with: ${originalError.message}`);
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
      } catch (error) {
        results.document.error = error.message;
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
    } catch (error) {
      // Marketing video might not exist, which is okay
      if (error.message?.includes('not found') || error.message?.includes('already deleted')) {
        results.marketingVideo.deleted = true; // Treat as success if already deleted
      } else {
        results.marketingVideo.error = error.message;
      }
    }

    return results;
  } catch (error) {
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
    clog('🔍 Asset-only file detected, checking lesson plan access for user:', user.id);

    // Asset-only files are internal to lesson plans, so we grant access if user has access
    // to any lesson plan that references this file. This is handled by the presentation
    // endpoint's access control, so if we reached here, access should be granted.

    // For security, we could add additional checks here in the future
    clog('🔍 Access granted: Asset-only file in lesson plan context');
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
    clog('🔍 No product found for file entity:', fileEntity.id);
    return false;
  }

  if (product.creator_user_id === user.id) {
    clog('🔍 Access granted: User is creator of file');
    return true;
  }

  // Use AccessControlService to check if user has purchased access
  try {
    const accessResult = await AccessControlService.checkAccess(user.id, 'file', fileEntity.id);

    clog('🔍 Access control result:', {
      userId: user.id,
      fileId: fileEntity.id,
      hasAccess: accessResult.hasAccess,
      isLifetime: accessResult.isLifetimeAccess,
      expiresAt: accessResult.expiresAt
    });

    return accessResult.hasAccess;
  } catch (error) {
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
      } else if (entityType === 'file') {
        // FIXED: For marketing images on File products, the entityId is actually the Product ID
        // We need to check if this entityId is a Product ID first, then fall back to File entity lookup

        // First try: Check if entityId is a Product ID (for marketing images)
        let product = await db.Product.findByPk(entityId);

        if (product && product.product_type === 'file') {
          // This is a marketing image request for a File product
          entityData = product;
          shouldHaveImage = product.has_image === true ||
                           (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');

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

          } else {
            // No product found for this file entity
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
          }
        }

        if (product) {
          entityData = product; // Use product data for image validation
          shouldHaveImage = product.has_image === true ||
                           (product.has_image === undefined && product.image_url && product.image_url.trim().length > 0 && product.image_url !== 'HAS_IMAGE');

        } else {
          // Check if the content entity exists (for logging purposes)
          const entityModel = db[entityType.charAt(0).toUpperCase() + entityType.slice(1)];
          if (entityModel) {
            const entity = await entityModel.findByPk(entityId);
            if (entity) {
              // Entity exists but no product found - cannot serve marketing image
            } else {
              // Entity not found in database
            }
          }
        }
      }
    } catch (dbError) {
      // If database check fails, don't serve the image for security
      return res.status(500).json(createErrorResponse(
        'Database validation failed',
        'Unable to verify if image should exist',
        { entityType, entityId, filename }
      ));
    }

    // If entity doesn't exist in database, don't serve any images
    if (!entityData) {

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


          // Check if this looks like a recent upload (file is less than 30 seconds old)
          const fileAge = new Date() - new Date(metadataResult.data.lastModified);
          const isRecentUpload = fileAge < 30000; // 30 seconds

          if (isRecentUpload) {
            // This appears to be an upload in progress - wait briefly and retry database check

            // Wait 1 second for database transaction to potentially commit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Retry database check
            let retryEntityData = null;
            let retryShouldHaveImage = false;

            try {
              if (entityType === 'file') {
                // Same logic as above: try Product ID first, then File entity ID
                let retryProduct = await db.Product.findByPk(entityId);

                if (retryProduct && retryProduct.product_type === 'file') {
                  // This is a marketing image request for a File product
                  retryEntityData = retryProduct;
                  retryShouldHaveImage = retryProduct.has_image === true ||
                                       (retryProduct.has_image === undefined && retryProduct.image_url && retryProduct.image_url.trim().length > 0 && retryProduct.image_url !== 'HAS_IMAGE');
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
                entityData = retryEntityData;
                shouldHaveImage = true;
                // Continue to image serving logic below
              } else {
                // Still shows has_image=false after retry - this might be a genuine orphan

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
              // Fall through to treat as orphaned file
            }
          } else {
            // File is older than 30 seconds and still has has_image=false - likely orphaned

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
        // If metadata check failed, return 404
        // Image should exist but doesn't - log this inconsistency

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

      // Stream image from S3 using the active S3 key (could be original or legacy path)
      const stream = await fileService.createS3Stream(activeS3Key);

      // Generate Israeli-optimized cache headers for static assets (images)
      const israeliCacheHeaders = generateIsraeliCacheHeaders('static');

      // Set appropriate headers
      res.setHeader('Content-Type', metadataResult.data.contentType || 'image/jpeg');
      res.setHeader('Content-Length', metadataResult.data.size);

      // Apply Israeli-optimized caching
      Object.entries(israeliCacheHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Pipe stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error) => {
        if (!res.headersSent) {
          res.status(500).json(createErrorResponse(
            'Stream error',
            'Failed to stream image from storage',
            { s3Key: activeS3Key, error: error.message }
          ));
        }
      });


    } catch (s3Error) {
      return res.status(404).json(createErrorResponse(
        'Image not found',
        'Failed to retrieve image from S3',
        { s3Key: s3Error.s3Key || s3Key, details: s3Error.message }
      ));
    }

  } catch (error) {
    res.status(500).json(createErrorResponse(
      'Image serve failed',
      'Failed to process image request',
      { details: error.message }
    ));
  }
});

/**
 * Download Lesson Plan Slide with Selective Access Control
 *
 * Downloads a specific SVG slide from a lesson plan with access control and watermarking.
 * Supports selective slide access, template-based watermarks, and placeholder serving.
 *
 * @route GET /api/assets/download/lesson-plan-slide/:lessonPlanId/:slideId
 * @access Optional Auth (supports both authenticated and unauthenticated access with different capabilities)
 *
 * @param {string} lessonPlanId - ID of the lesson plan
 * @param {string} slideId - ID of the slide within the lesson plan
 *
 * @returns {200} SVG file binary data (original, watermarked, or placeholder)
 * @returns {403} Access denied (slide not accessible and no preview allowed)
 * @returns {404} Lesson plan or slide not found
 * @returns {500} Server error
 *
 * @example Download Accessible Slide
 * GET /api/assets/download/lesson-plan-slide/abc123/slide_123456_xyz
 * Authorization: Bearer <token>
 *
 * Response:
 * Content-Disposition: inline; filename="slide-1.svg"
 * Content-Type: image/svg+xml
 * [Original or watermarked SVG data]
 *
 * @example Download Restricted Slide (Preview Mode)
 * GET /api/assets/download/lesson-plan-slide/abc123/slide_789_restricted
 *
 * Response:
 * Content-Disposition: inline; filename="preview-not-available.svg"
 * Content-Type: image/svg+xml
 * [Placeholder SVG data]
 */
router.get('/download/lesson-plan-slide/:lessonPlanId/:slideId', optionalAuth, async (req, res) => {
  try {
    const { lessonPlanId, slideId } = req.params;


    // Get lesson plan with all necessary fields
    const lessonPlan = await db.LessonPlan.findByPk(lessonPlanId);
    if (!lessonPlan) {
      return res.status(404).json(createErrorResponse(
        'Lesson plan not found',
        `Lesson plan ${lessonPlanId} not found in database`,
        { lessonPlanId }
      ));
    }

    // Check lesson plan access control if user is authenticated
    let hasAccess = false;
    if (req.user) {
      // Ensure consistent user ID property
      if (!req.user.id && req.user.id) {
        req.user.id = req.user.id;
      }

      // Check if user has access to the lesson plan
      try {
        const product = await db.Product.findOne({
          where: {
            product_type: 'lesson_plan',
            entity_id: lessonPlanId
          }
        });

        if (product) {
          if (product.creator_user_id === req.user.id) {
            hasAccess = true;
          } else {
            // Use AccessControlService to check purchase access
            const accessResult = await AccessControlService.checkAccess(req.user.id, 'lesson_plan', lessonPlanId);
            hasAccess = accessResult.hasAccess;
            clog('🔍 Access control result:', {
              userId: req.user.id,
              lessonPlanId,
              hasAccess: accessResult.hasAccess,
              isLifetime: accessResult.isLifetimeAccess
            });
          }
        }
      } catch (accessError) {
      }
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

    // Check selective slide access
    const needsSelectiveAccess = !hasAccess && lessonPlan.allow_slide_preview && lessonPlan.accessible_slides;
    const isSlideAccessible = !needsSelectiveAccess || lessonPlan.accessible_slides.includes(slideId);
    const shouldApplyWatermarks = !hasAccess && lessonPlan.allow_slide_preview && isSlideAccessible;


    // Handle inaccessible slides
    if (!isSlideAccessible) {
      if (!lessonPlan.allow_slide_preview) {
        // No preview allowed - deny access
        return res.status(403).json(createErrorResponse(
          'Access denied',
          'You do not have permission to view this slide',
          {
            hint: 'Purchase the lesson plan or contact the creator for access',
            allowPreview: false,
            slideId,
            lessonPlanId
          }
        ));
      } else {
        // Serve placeholder for restricted slide

        const placeholderPath = path.join(process.cwd(), 'assets', 'placeholders', 'preview-not-available.svg');

        try {
          if (fs.existsSync(placeholderPath)) {
            const placeholderContent = fs.readFileSync(placeholderPath, 'utf8');

            // Set headers for placeholder
            res.setHeader('Content-Disposition', generateHebrewContentDisposition('inline', 'preview-not-available.svg'));
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-cache');

            res.send(placeholderContent);
            return;
          } else {
            return res.status(403).json(createErrorResponse(
              'Slide not accessible',
              'This slide is not available in preview mode',
              { slideId, lessonPlanId }
            ));
          }
        } catch (placeholderError) {
          return res.status(500).json(createErrorResponse(
            'Error serving placeholder',
            'Failed to serve placeholder slide',
            { details: placeholderError.message }
          ));
        }
      }
    }

    // Serve accessible slide (original or with watermarks)

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

      // Download SVG content
      const svgBuffer = await fileService.downloadToBuffer(slide.s3_key);
      let svgContent = svgBuffer.toString('utf8');

      // Apply watermarks if needed
      if (shouldApplyWatermarks) {
        try {
          // Get watermark template if configured
          let watermarkTemplate = null;
          if (lessonPlan.watermark_template_id) {
            const { SystemTemplate } = db;
            const template = await SystemTemplate.findOne({
              where: {
                id: lessonPlan.watermark_template_id,
                template_type: 'watermark',
                is_active: true
              }
            });

            if (template) {
              watermarkTemplate = template.template_data;
            } else {
            }
          }

          // Use unified template processing for SVG (same approach as PDF)
          if (watermarkTemplate) {
            // Prepare variables for template substitution
            const variables = {
              filename: slide.filename,
              slideId: slideId,
              lessonPlan: lessonPlan.title || lessonPlan.name || 'Lesson Plan',
              user: req.user?.email || req.user?.name || 'User',
              date: new Date().toLocaleDateString(),
              time: new Date().toLocaleTimeString()
            };

            // Build unified template settings combining watermarks and potential branding
            let unifiedTemplate = { elements: [] };

            // Add watermark elements
            if (watermarkTemplate && watermarkTemplate.elements) {
              unifiedTemplate.elements.push(...watermarkTemplate.elements);
            }

            // Future: Add branding elements if lesson plans support branding
            // if (shouldMergeBranding) {
            //   const brandingSettings = await resolveBrandingSettingsWithFallback(lessonPlan, settings);
            //   if (brandingSettings && brandingSettings.elements) {
            //     unifiedTemplate.elements.push(...brandingSettings.elements);
            //   }
            // }

            // Apply unified template using new SVG template system
            svgContent = await mergeSvgTemplate(svgContent, unifiedTemplate, variables);
          }
        } catch (watermarkError) {
        }
      }

      // Generate Israeli-optimized cache headers based on access level
      let israeliCacheHeaders;
      if (hasAccess) {
        // Full access - use static asset caching
        israeliCacheHeaders = generateIsraeliCacheHeaders('static');
      } else {
        // Preview only - generate no-cache headers with Israeli timezone info for debugging
        israeliCacheHeaders = generateIsraeliCacheHeaders('user-data', { skipTimeOptimization: true });
        israeliCacheHeaders['Cache-Control'] = 'no-cache'; // Override for previews
      }

      // Set headers for slide download
      const disposition = hasAccess ? 'attachment' : 'inline'; // Attachment for full access, inline for preview
      res.setHeader('Content-Disposition', generateHebrewContentDisposition(disposition, slide.filename));
      res.setHeader('Content-Type', 'image/svg+xml');

      // Apply Israeli-optimized caching
      Object.entries(israeliCacheHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Send processed SVG content
      res.send(svgContent);


    } catch (s3Error) {
      return res.status(404).json(createErrorResponse(
        'Slide file not found in storage',
        'Failed to retrieve slide from S3',
        { s3Key: slide.s3_key, details: s3Error.message }
      ));
    }

  } catch (error) {

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
router.get('/download/:entityType/:entityId', authenticateToken, async (req, res) => {
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

    // Validate entityId format to prevent unnecessary database queries
    if (!entityId || typeof entityId !== 'string') {
      return res.status(400).json(createErrorResponse(
        'Invalid file ID format',
        'File ID must be a valid string',
        { received: entityId }
      ));
    }

    // Check if ID is suspiciously short (likely not a valid file ID)
    if (entityId.length <= 4) {
      clog('Assets: Rejecting very short file ID:', entityId);
      return res.status(400).json(createErrorResponse(
        'Invalid file ID format',
        'File ID appears to be too short',
        {
          received: entityId,
          hint: 'File IDs should be longer than 4 characters'
        }
      ));
    }


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
      if (!req.user.id && req.user.id) {
        req.user.id = req.user.id;
      }
      // Check access control for authenticated users
      hasAccess = await checkUserAccess(req.user, fileEntity);
    }
    const isPreviewRequest = req.query.preview === 'true';


    // UPDATED access control requirements:
    // 1. ALL file downloads require authentication - enforced by authenticateToken middleware
    // 2. If user is authenticated but has no access to paid content → allow preview if enabled
    // 3. If user is authenticated and has access → return full file
    // Note: req.user is guaranteed to exist due to authenticateToken middleware

    // Determine access type for authenticated user
    let accessType = 'denied';
    let isPreviewMode = false;

    if (hasAccess) {
      // User owns the content - full access
      accessType = 'full';
    } else if (fileEntity.allow_preview) {
      // User doesn't own content but preview is allowed for authenticated users
      accessType = 'preview';
      isPreviewMode = true;
    } else {
      // User doesn't own content and preview is not allowed
      return res.status(403).json(createErrorResponse(
        'Access denied',
        'You do not have permission to download this file',
        {
          hint: 'Purchase the product or contact the creator for access',
          allowPreview: fileEntity.allow_preview,
          entityId,
          userId: req.user.id
        }
      ));
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, 'document', fileEntity.file_name);

    // Check if PDF processing is needed
    const isPdf = fileEntity.file_type === 'pdf' || fileEntity.file_name.toLowerCase().endsWith('.pdf');

    // PDF processing needed if:
    // 1. It's a PDF file AND branding should be applied (full access or preview with add_branding)
    // 2. OR it's preview mode with accessible_pages restrictions
    // 3. OR it's preview mode and watermarks should be applied
    const needsBranding = isPdf && fileEntity.add_branding;
    const needsPageRestriction = isPdf && isPreviewMode && fileEntity.accessible_pages && fileEntity.accessible_pages.length > 0;
    const needsWatermarks = isPdf && isPreviewMode && req.query.skipWatermarks !== 'true';
    const needsPdfProcessing = needsBranding || needsPageRestriction || needsWatermarks;

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

        // Fetch settings and download PDF
        const [settings, pdfBuffer] = await Promise.all([
          SettingsService.getSettings(),
          fileService.downloadToBuffer(s3Key)
        ]);

        // Process PDF with unified function
        const skipBranding = req.query.skipBranding === 'true';
        const skipWatermarks = req.query.skipWatermarks === 'true';
        const userEmail = req.query.userEmail || req.query.user_email; // Support both camelCase and snake_case

        const finalPdfBuffer = await processPdf(pdfBuffer, fileEntity, hasAccess, settings, skipBranding, skipWatermarks, req.user, userEmail, {
          isPreviewMode,
          accessType,
          restrictToPages: isPreviewMode ? fileEntity.accessible_pages : null
        });

        // Set headers - attachment for download (no preview mode since authentication is required)
        const disposition = 'attachment';
        res.setHeader('Content-Disposition', generateHebrewContentDisposition(disposition, fileEntity.file_name));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', finalPdfBuffer.length);

        // Send processed PDF
        res.send(finalPdfBuffer);

      } else {
        // Stream file directly without modification
        const stream = await fileService.createS3Stream(s3Key);

        // Set headers for download
        res.setHeader('Content-Disposition', generateHebrewContentDisposition('attachment', fileEntity.file_name));
        res.setHeader('Content-Type', metadataResult.data.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', metadataResult.data.size);

        // Pipe stream to response
        stream.pipe(res);

        // Handle stream errors
        stream.on('error', (error) => {
          if (!res.headersSent) {
            res.status(500).json(createErrorResponse(
              'Stream error',
              'Failed to stream file from storage',
              { s3Key, error: error.message }
            ));
          }
        });

      }

    } catch (s3Error) {
      return res.status(404).json(createErrorResponse(
        'File not found in storage',
        'Failed to retrieve file from S3',
        { s3Key, details: s3Error.message }
      ));
    }

  } catch (error) {

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
    res.status(500).json(createErrorResponse(
      'Metadata failed',
      'Failed to process metadata request',
      { details: error.message }
    ));
  }
});

// REMOVED: PPTX conversion endpoint - replaced with SVG slide system

/**
 * Serve Placeholder Assets
 *
 * Serves static placeholder files (PDF, SVG, etc.) for preview and template modes.
 * These are publicly accessible placeholder assets used when actual content
 * is not available or in template creation mode.
 *
 * @route GET /api/assets/placeholders/:filename
 * @access Public (no authentication required)
 *
 * @param {string} filename - Name of the placeholder file to serve
 *
 * @returns {200} Binary file stream with appropriate content type
 * @returns {404} Placeholder file not found
 * @returns {500} Server error
 *
 * @example Get Placeholder PDF
 * GET /api/assets/placeholders/preview-not-available.pdf
 *
 * Response:
 * Content-Type: application/pdf
 * [Binary PDF data]
 *
 * @example Get Placeholder SVG
 * GET /api/assets/placeholders/preview-not-available.svg
 *
 * Response:
 * Content-Type: image/svg+xml
 * [SVG content]
 */
router.get('/placeholders/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: Only allow specific filename patterns to prevent directory traversal
    if (!/^[a-zA-Z0-9._-]+\.(pdf|svg|png|jpg|jpeg)$/i.test(filename)) {
      return res.status(400).json(createErrorResponse(
        'Invalid filename',
        'Only placeholder files with safe names and extensions are allowed',
        {
          filename,
          allowedExtensions: ['pdf', 'svg', 'png', 'jpg', 'jpeg'],
          pattern: 'alphanumeric with dots, hyphens, underscores only'
        }
      ));
    }

    const placeholderPath = path.join(process.cwd(), 'assets', 'placeholders', filename);

    // Check if file exists
    if (!fs.existsSync(placeholderPath)) {
      return res.status(404).json(createErrorResponse(
        'Placeholder not found',
        `Placeholder file ${filename} not found`,
        {
          filename,
          path: 'assets/placeholders/' + filename
        }
      ));
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
    }

    // Set headers for caching (placeholders change rarely)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);


    // Stream the file
    const stream = fs.createReadStream(placeholderPath);
    stream.pipe(res);

    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).json(createErrorResponse(
          'Stream error',
          'Failed to stream placeholder file',
          { filename, error: error.message }
        ));
      }
    });

  } catch (error) {
    res.status(500).json(createErrorResponse(
      'Failed to serve placeholder',
      'Error serving placeholder file',
      { details: error.message }
    ));
  }
});

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

/**
 * Get resolved template content for visual editor
 * Returns template content with variable substitution applied, matching what appears in PDF output
 *
 * @route GET /api/assets/template-preview/:fileId
 */
router.get('/template-preview/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const user = req.user;

    // Get file entity
    const fileEntity = await FileModel.findByPk(fileId);
    if (!fileEntity) {
      return res.status(404).json(createErrorResponse('FILE_NOT_FOUND', 'File not found'));
    }

    // Get system settings
    const settings = await SettingsService.getSettings() || {};

    // Prepare variables exactly as done in PDF processing
    const variables = {
      filename: fileEntity.file_name,
      user: user?.email || user?.name || 'User',
      userObj: user,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://ludora.app'
    };

    // Get branding settings exactly as done in PDF processing
    const brandingSettings = await resolveBrandingSettingsWithFallback(fileEntity, settings);

    // Apply variable substitution to each element content
    const resolvedTemplate = { ...brandingSettings };

    // Process text elements
    if (resolvedTemplate.text && resolvedTemplate.text.content) {
      resolvedTemplate.text.content = substituteVariables(
        resolvedTemplate.text.content,
        variables,
        { supportSystemTemplates: true, enableLogging: false }
      );
    }

    // Process URL elements
    if (resolvedTemplate.url && (resolvedTemplate.url.href || resolvedTemplate.url.content)) {
      const urlContent = resolvedTemplate.url.href || resolvedTemplate.url.content || '';
      resolvedTemplate.url.resolvedHref = substituteVariables(
        urlContent,
        variables,
        { supportSystemTemplates: true, enableLogging: false }
      );
    }

    // Process custom elements
    if (resolvedTemplate.customElements) {
      for (const [elementId, element] of Object.entries(resolvedTemplate.customElements)) {
        if (element.type === 'user-info' && !element.content) {
          // Apply same default content logic as PDF processing
          element.content = 'קובץ זה נוצר עבור {{user.email}}';
        }

        if (element.content) {
          element.resolvedContent = substituteVariables(
            element.content,
            variables,
            { supportSystemTemplates: true, enableLogging: false }
          );
        }

        if (element.href) {
          element.resolvedHref = substituteVariables(
            element.href,
            variables,
            { supportSystemTemplates: true, enableLogging: false }
          );
        }
      }
    }

    res.json(createSuccessResponse({
      fileId,
      resolvedTemplate,
      variables: {
        user: variables.user,
        date: variables.date,
        time: variables.time,
        filename: variables.filename,
        FRONTEND_URL: variables.FRONTEND_URL
      }
    }));

  } catch (error) {
    cerror('❌ Error getting template preview:', error);
    res.status(500).json(createErrorResponse('TEMPLATE_PREVIEW_ERROR', 'Failed to generate template preview'));
  }
});

// Export utility functions for use in other modules
export { deleteAllFileAssets, checkUserAccess, processPdf };

export default router;
