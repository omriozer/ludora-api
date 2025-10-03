import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import fileService from '../services/FileService.js';
import db from '../models/index.js';
import { mergePdfFooter } from '../utils/pdfFooterMerge.js';
import { addPdfWatermarks } from '../utils/pdfWatermark.js';
import { mergeFooterSettings } from '../utils/footerSettingsHelper.js';
import AccessControlService from '../services/AccessControlService.js';
import { constructS3Path } from '../utils/s3PathUtils.js';

const router = express.Router();
const { File: FileModel, User, Purchase, Settings } = db;

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
    console.log('⚠️ Watermarks temporarily disabled for footer positioning debugging');
    // Temporarily disabled to focus on footer positioning issue
    // try {
    //   // Always use the backend logo file
    //   const logoUrl = path.join(process.cwd(), 'assets', 'images', 'logo.png');

    //   console.log('🔍 PDF Watermark: Logo URL resolution:', {
    //     originalUrl: settings?.footer_settings?.logo?.url || settings?.logo_url,
    //     resolvedUrl: logoUrl,
    //     fileExists: logoUrl ? fs.existsSync(logoUrl) : false
    //   });
    //   finalPdfBuffer = await addPdfWatermarks(finalPdfBuffer, logoUrl);
    //   console.log(`✅ Watermarks added successfully`);
    // } catch (error) {
    //   console.error('❌ Watermark addition failed, continuing without watermarks:', error);
    // }
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
        const s3Key = constructS3Path('file', fileEntityId, 'document', fileEntity.file_name);
        await fileService.deleteS3Object(s3Key);
        results.document.deleted = true;
        console.log(`✅ Deleted document asset for File ${fileEntityId}`);
      } catch (error) {
        results.document.error = error.message;
        console.error(`❌ Failed to delete document for File ${fileEntityId}:`, error);
      }
    }

    // Delete marketing video if it exists
    try {
      const marketingVideoKey = constructS3Path('file', fileEntityId, 'marketing-video', 'video.mp4');
      await fileService.deleteS3Object(marketingVideoKey);
      results.marketingVideo.deleted = true;
      console.log(`✅ Deleted marketing video for File ${fileEntityId}`);
    } catch (error) {
      // Marketing video might not exist, which is okay
      if (error.code !== 'NoSuchKey' && error.code !== 'NotFound') {
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
  // Creator has access to their own content
  if (fileEntity.creator_user_id === user.id) {
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
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType, entityId, and assetType are required as query parameters',
        hint: 'Example: /api/assets/upload?entityType=file&entityId=test_file_001&assetType=document'
      });
    }

    // Validate assetType
    const validAssetTypes = ['marketing-video', 'content-video', 'document'];
    if (!validAssetTypes.includes(assetType)) {
      return res.status(400).json({
        error: 'Invalid assetType',
        message: `assetType must be one of: ${validAssetTypes.join(', ')}`,
        received: assetType
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    console.log(`📤 Asset upload: User ${req.user.id}, Type: ${assetType}, Entity: ${entityType}/${entityId}, File: ${req.file.originalname}`);

    // Determine filename based on asset type
    let filename;
    if (assetType === 'marketing-video' || assetType === 'content-video') {
      filename = 'video.mp4'; // Standard video filename
    } else {
      filename = req.file.originalname; // Preserve original filename for documents
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, assetType, filename);

    try {
      // Upload to S3
      const uploadResult = await fileService.uploadToS3({
        buffer: req.file.buffer,
        key: s3Key,
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: req.user.id,
          entityType,
          entityId,
          assetType,
          originalName: req.file.originalname
        }
      });

      if (!uploadResult.success) {
        throw new Error('S3 upload failed');
      }

      // For documents on File entities, update file_name in database
      if (assetType === 'document' && entityType === 'file') {
        const fileEntity = await FileModel.findByPk(entityId);

        if (fileEntity) {
          await fileEntity.update({ file_name: filename });
          console.log(`✅ Updated File entity ${entityId} with file_name: ${filename}`);
        } else {
          console.warn(`⚠️ File entity ${entityId} not found in database - file uploaded but entity not updated`);
        }
      }

      res.json({
        success: true,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      });

    } catch (uploadError) {
      console.error('❌ S3 upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'Failed to upload file to storage',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('❌ Asset upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process asset upload request'
    });
  }
});

/**
 * Upload Public Marketing Video
 *
 * Dedicated endpoint for uploading public marketing videos.
 * Videos are stored at: {env}/public/marketing-video/{entityType}/{entityId}/video.mp4
 *
 * @route POST /api/assets/upload/video/public
 * @access Private (requires authentication)
 *
 * @queryparam {string} entityType - Type of entity (workshop, course, file, tool)
 * @queryparam {string} entityId - ID of the entity
 * @formparam {File} file - Video file (multipart upload)
 *
 * @returns {200} Success with S3 key and metadata
 * @returns {400} Bad request (missing params, invalid file)
 * @returns {401} Unauthorized
 * @returns {500} Server error
 */
router.post('/upload/video/public', authenticateToken, assetUpload.single('file'), async (req, res) => {
  try {
    const { entityType, entityId } = req.query;

    // Validate required parameters
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a video file to upload'
      });
    }

    // Validate video file type
    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only video files are allowed',
        receivedType: req.file.mimetype
      });
    }

    console.log(`🎬 Public video upload: User ${req.user.id}, Entity: ${entityType}/${entityId}`);

    const filename = 'video.mp4'; // Standard video filename
    const s3Key = constructS3Path(entityType, entityId, 'marketing-video', filename);

    try {
      // Upload to S3
      const uploadResult = await fileService.uploadToS3({
        buffer: req.file.buffer,
        key: s3Key,
        contentType: 'video/mp4',
        metadata: {
          uploadedBy: req.user.id,
          entityType,
          entityId,
          assetType: 'marketing-video',
          originalName: req.file.originalname
        }
      });

      if (!uploadResult.success) {
        throw new Error('S3 upload failed');
      }

      res.json({
        success: true,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType: 'marketing-video',
        size: req.file.size,
        mimeType: 'video/mp4',
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      });

    } catch (uploadError) {
      console.error('❌ S3 upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'Failed to upload video to storage',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('❌ Public video upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process video upload request'
    });
  }
});

/**
 * Upload Private Content Video
 *
 * Dedicated endpoint for uploading private content videos.
 * Videos are stored at: {env}/private/content-video/{entityType}/{entityId}/video.mp4
 *
 * @route POST /api/assets/upload/video/private
 * @access Private (requires authentication)
 *
 * @queryparam {string} entityType - Type of entity (workshop, course, file, tool)
 * @queryparam {string} entityId - ID of the entity
 * @formparam {File} file - Video file (multipart upload)
 *
 * @returns {200} Success with S3 key and metadata
 * @returns {400} Bad request (missing params, invalid file)
 * @returns {401} Unauthorized
 * @returns {500} Server error
 */
router.post('/upload/video/private', authenticateToken, assetUpload.single('file'), async (req, res) => {
  try {
    const { entityType, entityId } = req.query;

    // Validate required parameters
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a video file to upload'
      });
    }

    // Validate video file type
    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only video files are allowed',
        receivedType: req.file.mimetype
      });
    }

    console.log(`🎬 Private video upload: User ${req.user.id}, Entity: ${entityType}/${entityId}`);

    const filename = 'video.mp4'; // Standard video filename
    const s3Key = constructS3Path(entityType, entityId, 'content-video', filename);

    try {
      // Upload to S3
      const uploadResult = await fileService.uploadToS3({
        buffer: req.file.buffer,
        key: s3Key,
        contentType: 'video/mp4',
        metadata: {
          uploadedBy: req.user.id,
          entityType,
          entityId,
          assetType: 'content-video',
          originalName: req.file.originalname
        }
      });

      if (!uploadResult.success) {
        throw new Error('S3 upload failed');
      }

      res.json({
        success: true,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType: 'content-video',
        size: req.file.size,
        mimeType: 'video/mp4',
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      });

    } catch (uploadError) {
      console.error('❌ S3 upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'Failed to upload video to storage',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('❌ Private video upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process video upload request'
    });
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
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'assetType is required as query parameter',
        hint: 'Example: /api/assets/check/file/test_file_001?assetType=document'
      });
    }

    console.log(`🔍 Asset check: User ${req.user.id}, Type: ${assetType}, Entity: ${entityType}/${entityId}`);

    // Determine filename
    let targetFilename = filename;

    if (assetType === 'marketing-video' || assetType === 'content-video') {
      targetFilename = 'video.mp4';
    } else if (assetType === 'document' && entityType === 'file') {
      // For documents on File entities, get filename from database
      const fileEntity = await FileModel.findByPk(entityId);

      if (!fileEntity) {
        return res.status(404).json({
          error: 'File entity not found',
          message: `File entity ${entityId} not found in database`
        });
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
      return res.status(400).json({
        error: 'Missing filename',
        message: 'filename query parameter is required for this asset type',
        hint: 'Example: ?assetType=document&filename=sample.pdf'
      });
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
    res.status(500).json({
      error: 'Check failed',
      message: 'Failed to check asset existence'
    });
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
      return res.status(400).json({
        error: 'Invalid entityType',
        message: 'Download only available for File entities (entityType=file)',
        hint: 'Use /api/media/stream/:entityType/:entityId for video streaming',
        received: entityType
      });
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
      return res.status(404).json({
        error: 'File entity not found',
        message: `File entity ${entityId} not found in database`
      });
    }

    // Check if file uploaded
    if (!fileEntity.file_name) {
      return res.status(404).json({
        error: 'File not yet uploaded',
        message: 'file_name is NULL in database',
        hint: 'Upload the file first using POST /api/assets/upload'
      });
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
      fileCreatorId: fileEntity.creator_user_id,
      allowPreview: fileEntity.allow_preview,
      addCopyrightsFooter: fileEntity.add_copyrights_footer,
      hasAccess,
      isPreviewRequest
    });

    // Implement user's access control requirements:
    // 1. Unauthenticated users can access files only if allow_preview is true (with watermarks)
    // 2. If file product doesn't have allow_preview AND user has no access → return error
    // 3. If allow_preview is true AND user has no access → return file WITH watermarks
    // 4. If user has access → return file WITHOUT watermarks

    if (!hasAccess) {
      if (!fileEntity.allow_preview) {
        // Case 2: No preview allowed and user has no access → deny access
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to download this file',
          hint: 'Purchase the product or contact the creator for access',
          allowPreview: false
        });
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
        return res.status(404).json({
          error: 'File not found in storage',
          message: 'File exists in database but not found in S3',
          s3Key
        });
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
        res.setHeader('Content-Disposition', `${disposition}; filename="${fileEntity.file_name}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', finalPdfBuffer.length);

        // Send processed PDF
        res.send(finalPdfBuffer);

        console.log(`✅ PDF processing completed: ${fileEntity.file_name}`);
      } else {
        // Stream file directly without modification
        const stream = await fileService.createS3Stream(s3Key);

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${fileEntity.file_name}"`);
        res.setHeader('Content-Type', metadataResult.data.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', metadataResult.data.size);

        // Pipe stream to response
        stream.pipe(res);

        // Handle stream errors
        stream.on('error', (error) => {
          console.error('❌ Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Stream error',
              message: 'Failed to stream file from storage'
            });
          }
        });

        console.log(`✅ Download started: ${fileEntity.file_name}`);
      }

    } catch (s3Error) {
      console.error('❌ S3 download error:', s3Error);
      return res.status(404).json({
        error: 'File not found in storage',
        message: 'Failed to retrieve file from S3',
        details: s3Error.message
      });
    }

  } catch (error) {
    console.error('❌ Document download error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Download failed',
        message: 'Failed to process download request'
      });
    }
  }
});

/**
 * Delete Asset
 *
 * Deletes an asset from S3 storage.
 * For documents on File entities, sets file_name to NULL in database.
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
  try {
    const { entityType, entityId } = req.params;
    const { assetType, filename } = req.query;

    // Validate required parameters
    if (!assetType) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'assetType is required as query parameter',
        hint: 'Example: DELETE /api/assets/file/test_file_001?assetType=document'
      });
    }

    console.log(`🗑️ Asset delete: User ${req.user.id}, Type: ${assetType}, Entity: ${entityType}/${entityId}`);

    // Determine filename
    let targetFilename = filename;

    if (assetType === 'marketing-video' || assetType === 'content-video') {
      targetFilename = 'video.mp4';
    } else if (assetType === 'document' && entityType === 'file') {
      // For documents on File entities, get filename from database
      const fileEntity = await FileModel.findByPk(entityId);

      if (!fileEntity) {
        return res.status(404).json({
          error: 'File entity not found',
          message: `File entity ${entityId} not found in database`
        });
      }

      if (!fileEntity.file_name) {
        return res.status(404).json({
          error: 'No file to delete',
          message: 'file_name is NULL in database (file not uploaded)'
        });
      }

      targetFilename = fileEntity.file_name;
    } else if (!targetFilename) {
      return res.status(400).json({
        error: 'Missing filename',
        message: 'filename query parameter is required for this asset type',
        hint: 'Example: ?assetType=document&filename=sample.pdf'
      });
    }

    // Construct S3 path
    const s3Key = constructS3Path(entityType, entityId, assetType, targetFilename);

    try {
      // Delete from S3
      const deleteResult = await fileService.deleteS3Object(s3Key);

      if (!deleteResult.success) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'Asset not found in storage or already deleted',
          s3Key
        });
      }

      // For documents on File entities, set file_name to NULL
      let databaseUpdated = false;
      if (assetType === 'document' && entityType === 'file') {
        const fileEntity = await FileModel.findByPk(entityId);

        if (fileEntity) {
          await fileEntity.update({ file_name: null });
          databaseUpdated = true;
          console.log(`✅ Set file_name to NULL for File entity ${entityId}`);
        }
      }

      res.json({
        success: true,
        entityType,
        entityId,
        assetType,
        s3Key,
        databaseUpdated,
        message: databaseUpdated
          ? 'Asset deleted successfully and file_name set to NULL'
          : 'Asset deleted successfully'
      });

    } catch (s3Error) {
      console.error('❌ S3 delete error:', s3Error);

      if (s3Error.code === 'NoSuchKey') {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'Asset not found in storage',
          s3Key
        });
      }

      return res.status(500).json({
        error: 'Delete failed',
        message: 'Failed to delete asset from storage',
        details: s3Error.message
      });
    }

  } catch (error) {
    console.error('❌ Asset delete error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: 'Failed to process delete request'
    });
  }
});

// Error handling middleware for multer errors
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'File exceeds the maximum allowed size (5GB)'
      });
    }
  }

  next(error);
});

// Export utility functions for use in other modules
export { deleteAllFileAssets };

export default router;
