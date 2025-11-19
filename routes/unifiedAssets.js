/**
 * Unified Assets API Router
 *
 * Implements the new unified REST API structure for file management operations.
 * Consolidates all upload, download, and management endpoints into a coherent, RESTful design.
 *
 * API Structure:
 * /api/assets/:entityType/:entityId/            - Entity-level operations
 * /api/assets/:entityType/:entityId/:assetType  - Asset-specific operations
 * /api/assets/batch/*                           - Batch operations
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import fileService from '../services/FileService.js';
import { sequelize } from '../models/index.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import { createFileLogger, createErrorResponse, createSuccessResponse } from '../utils/fileOperationLogger.js';
import { createPreUploadValidator } from '../utils/preUploadValidator.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  }
});

/**
 * ENTITY-LEVEL OPERATIONS
 */

/**
 * Check All Assets for Entity
 *
 * GET /api/assets/:entityType/:entityId
 *
 * Returns comprehensive information about all assets associated with an entity.
 * Shows which assets exist, their metadata, and access URLs.
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @returns {Object} Asset inventory with metadata
 */
router.get('/:entityType/:entityId', authenticateToken, async (req, res) => {
  const logger = createFileLogger('Entity Asset Check', req.user, {
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  try {
    const { entityType, entityId } = req.params;

    logger.start({
      entityType,
      entityId,
      method: 'GET',
      url: req.originalUrl
    });

    // Validate entity type and existence
    const validator = createPreUploadValidator(logger);
    const entityValidation = await validator.validateEntityExists(entityType, entityId);

    if (!entityValidation.valid) {
      logger.error(new Error('Entity validation failed'), entityValidation.error);
      return res.status(404).json(entityValidation.error);
    }

    const entity = entityValidation.entity;

    // Define possible asset types for this entity type
    const assetTypeDefinitions = {
      workshop: ['marketing-video', 'content-video', 'image'],
      course: ['marketing-video', 'content-video', 'image'],
      file: ['document', 'marketing-video', 'image'],
      tool: ['marketing-video', 'content-video', 'image']
    };

    const possibleAssetTypes = assetTypeDefinitions[entityType] || [];
    const assets = {};

    // Check each possible asset type
    for (const assetType of possibleAssetTypes) {
      try {
        let filename;
        let s3Key;

        // Determine filename and construct S3 path
        if (assetType === 'marketing-video' || assetType === 'content-video') {
          filename = 'video.mp4';
          s3Key = constructS3Path(entityType, entityId, assetType, filename);
        } else if (assetType === 'image') {
          filename = 'image.jpg';
          s3Key = constructS3Path(entityType, entityId, assetType, filename);
        } else if (assetType === 'document' && entityType === 'file') {
          // For documents, check database for filename
          if (entity.file_name) {
            filename = entity.file_name;
            s3Key = constructS3Path(entityType, entityId, assetType, filename);
          } else {
            assets[assetType] = {
              exists: false,
              reason: 'Not uploaded (file_name is NULL in database)',
              canUpload: true
            };
            continue;
          }
        } else {
          // Skip unsupported combinations
          continue;
        }

        // Check if asset exists in S3
        const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

        if (metadataResult.success) {
          const metadata = metadataResult.data;
          assets[assetType] = {
            exists: true,
            filename,
            size: metadata.size,
            sizeFormatted: `${Math.round(metadata.size / 1024 / 1024 * 10) / 10}MB`,
            contentType: metadata.contentType,
            lastModified: metadata.lastModified,
            url: `/api/assets/${entityType}/${entityId}/${assetType}`,
            canReplace: true
          };
        } else {
          assets[assetType] = {
            exists: false,
            reason: 'Not found in storage',
            canUpload: true,
            uploadUrl: `/api/assets/${entityType}/${entityId}/${assetType}`
          };
        }

      } catch (assetError) {
        logger.warn(`Error checking asset ${assetType}`, { assetType, error: assetError.message });
        assets[assetType] = {
          exists: false,
          reason: 'Error checking asset',
          error: assetError.message
        };
      }
    }

    const responseData = createSuccessResponse({
      entityType,
      entityId,
      entity: {
        id: entity.id,
        type: entityType
      },
      assets,
      summary: {
        total: possibleAssetTypes.length,
        existing: Object.values(assets).filter(asset => asset.exists).length,
        missing: Object.values(assets).filter(asset => !asset.exists).length
      }
    }, logger.requestId);

    logger.success({
      entityType,
      entityId,
      assetsChecked: possibleAssetTypes.length,
      assetsFound: Object.values(assets).filter(asset => asset.exists).length
    });

    res.json(responseData);

  } catch (error) {
    const errorResponse = createErrorResponse(
      'Asset check failed',
      'Failed to check entity assets',
      { details: error.message },
      logger.requestId
    );

    logger.error(error, { stage: 'entity_asset_check' });
    res.status(500).json(errorResponse);
  }
});

/**
 * Delete All Assets for Entity
 *
 * DELETE /api/assets/:entityType/:entityId
 *
 * Deletes ALL assets associated with an entity. Use with caution.
 * This is typically used when deleting an entity completely.
 *
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity
 * @returns {Object} Deletion results for each asset type
 */
router.delete('/:entityType/:entityId', authenticateToken, async (req, res) => {
  const logger = createFileLogger('Entity Cascade Delete', req.user, {
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  try {
    const { entityType, entityId } = req.params;

    logger.start({
      entityType,
      entityId,
      method: 'DELETE',
      url: req.originalUrl,
      operation: 'cascade_delete'
    });

    // Validate entity existence and permissions
    const validator = createPreUploadValidator(logger);
    const entityValidation = await validator.validateEntityExists(entityType, entityId);

    if (!entityValidation.valid) {
      logger.error(new Error('Entity validation failed'), entityValidation.error);
      return res.status(404).json(entityValidation.error);
    }

    // Check deletion permissions
    const permissionValidation = await validator.validateUploadPermission(
      req.user, entityType, entityId, entityValidation.entity
    );

    if (!permissionValidation.valid) {
      logger.error(new Error('Permission validation failed'), permissionValidation.error);
      return res.status(403).json(permissionValidation.error);
    }

    // Use transaction for atomic deletion
    const transaction = await sequelize.transaction();
    logger.transaction('start', { operation: 'cascade_delete' });

    const deletionResults = {};
    let totalDeleted = 0;
    let totalErrors = 0;

    try {
      // Define asset types to delete
      const assetTypesToDelete = {
        workshop: ['marketing-video', 'content-video', 'image'],
        course: ['marketing-video', 'content-video', 'image'],
        file: ['document', 'marketing-video', 'image'],
        tool: ['marketing-video', 'content-video', 'image']
      };

      const assetTypes = assetTypesToDelete[entityType] || [];

      // Delete each asset type
      for (const assetType of assetTypes) {
        try {
          let filename;
          let s3Key;

          if (assetType === 'marketing-video' || assetType === 'content-video') {
            filename = 'video.mp4';
            s3Key = constructS3Path(entityType, entityId, assetType, filename);
          } else if (assetType === 'image') {
            filename = 'image.jpg';
            s3Key = constructS3Path(entityType, entityId, assetType, filename);
          } else {
            continue; // Skip unsupported combinations
          }

          // Delete using unified asset deletion method
          const deleteResult = await fileService.deleteAsset({
            entityType,
            entityId,
            assetType,
            userId: 'system', // System cascade deletion
            transaction,
            logger
          });

          if (deleteResult.success) {
            deletionResults[assetType] = {
              deleted: true,
              s3Key: deleteResult.s3Key,
              filename: deleteResult.filename,
              databaseUpdated: deleteResult.databaseUpdated
            };
            totalDeleted++;
          } else {
            deletionResults[assetType] = {
              deleted: false,
              reason: deleteResult.reason || 'Asset deletion failed',
              error: deleteResult.error,
              s3Key
            };
            totalErrors++;
          }

        } catch (assetError) {
          logger.error(assetError, { stage: 'asset_deletion', assetType });
          deletionResults[assetType] = {
            deleted: false,
            reason: 'Deletion error',
            error: assetError.message
          };
          totalErrors++;
        }
      }

      // Commit transaction if we had any successful operations
      await transaction.commit();
      logger.transaction('commit', { totalDeleted, totalErrors });

      const responseData = createSuccessResponse({
        entityType,
        entityId,
        deletionResults,
        summary: {
          totalAssets: assetTypes.length,
          deleted: totalDeleted,
          errors: totalErrors,
          success: totalErrors === 0
        },
        message: totalErrors === 0
          ? 'All assets deleted successfully'
          : `${totalDeleted} assets deleted, ${totalErrors} errors occurred`
      }, logger.requestId);

      logger.success({
        entityType,
        entityId,
        totalDeleted,
        totalErrors,
        operations: Object.keys(deletionResults)
      });

      res.json(responseData);

    } catch (transactionError) {
      await transaction.rollback();
      logger.transaction('rollback', { reason: 'Cascade deletion failed', error: transactionError.message });

      const errorResponse = createErrorResponse(
        'Cascade deletion failed',
        'Failed to delete entity assets (transaction rolled back)',
        {
          details: transactionError.message,
          entityType,
          entityId,
          partialResults: deletionResults
        },
        logger.requestId
      );

      logger.error(transactionError, { stage: 'cascade_deletion_transaction' });
      return res.status(500).json(errorResponse);
    }

  } catch (error) {
    const errorResponse = createErrorResponse(
      'Cascade deletion failed',
      'Failed to process cascade deletion request',
      { details: error.message },
      logger.requestId
    );

    logger.error(error, { stage: 'request_processing' });
    res.status(500).json(errorResponse);
  }
});

/**
 * ASSET-SPECIFIC OPERATIONS
 */

/**
 * Download/Serve Specific Asset
 *
 * GET /api/assets/:entityType/:entityId/:assetType
 *
 * Content negotiation based on asset type:
 * - Documents: Download with access control and PDF processing
 * - Images: Serve inline with caching
 * - Videos: Stream with range support and access control
 */
router.get('/:entityType/:entityId/:assetType', optionalAuth, async (req, res) => {
  // Implementation will be similar to existing download/serve endpoints
  // but unified under single pattern with content negotiation

  // TODO: Implement unified asset serving
  res.status(501).json({
    error: 'Not implemented',
    message: 'Unified asset serving endpoint coming soon',
    useInstead: 'Current endpoints: /download, /image, /media/stream'
  });
});

/**
 * Upload/Replace Specific Asset
 *
 * POST /api/assets/:entityType/:entityId/:assetType
 * PUT /api/assets/:entityType/:entityId/:assetType
 *
 * Unified upload endpoint replacing multiple specialized endpoints.
 * Handles all asset types with appropriate validation and processing.
 */
router.post('/:entityType/:entityId/:assetType', authenticateToken, upload.single('file'), async (req, res) => {
  // Implementation will consolidate existing upload endpoints
  // with unified validation and processing

  // TODO: Implement unified upload endpoint
  res.status(501).json({
    error: 'Not implemented',
    message: 'Unified upload endpoint coming soon',
    useInstead: 'Current endpoints: /upload, /upload/video/public, /upload/video/private'
  });
});

// PUT method for semantic clarity (replace vs create)
router.put('/:entityType/:entityId/:assetType', authenticateToken, upload.single('file'), async (req, res) => {
  // Same implementation as POST
  req.method = 'POST'; // Internally treat as POST
  return router.handle(req, res);
});

/**
 * Delete Specific Asset
 *
 * DELETE /api/assets/:entityType/:entityId/:assetType
 *
 * Deletes a specific asset type while keeping other assets.
 */
router.delete('/:entityType/:entityId/:assetType', authenticateToken, async (req, res) => {
  // Implementation will be similar to existing delete endpoint
  // but scoped to specific asset type

  // TODO: Implement unified asset deletion
  res.status(501).json({
    error: 'Not implemented',
    message: 'Unified asset deletion endpoint coming soon',
    useInstead: 'Current endpoint: DELETE /:entityType/:entityId'
  });
});

/**
 * BATCH OPERATIONS
 */

/**
 * Batch Asset Validation
 *
 * POST /api/assets/batch/validate
 *
 * Validates multiple files before upload without actually uploading.
 * Useful for frontend to show validation results before user commits to upload.
 */
router.post('/batch/validate', authenticateToken, async (req, res) => {
  // TODO: Implement batch validation
  res.status(501).json({
    error: 'Not implemented',
    message: 'Batch validation endpoint coming soon'
  });
});

/**
 * Batch Asset Upload
 *
 * POST /api/assets/batch/upload
 *
 * Uploads multiple assets in a single atomic transaction.
 */
router.post('/batch/upload', authenticateToken, upload.array('files'), async (req, res) => {
  // TODO: Implement batch upload
  res.status(501).json({
    error: 'Not implemented',
    message: 'Batch upload endpoint coming soon'
  });
});

/**
 * Batch Asset Deletion
 *
 * DELETE /api/assets/batch
 *
 * Deletes multiple assets atomically.
 */
router.delete('/batch', authenticateToken, async (req, res) => {
  // TODO: Implement batch deletion
  res.status(501).json({
    error: 'Not implemented',
    message: 'Batch deletion endpoint coming soon'
  });
});

/**
 * Error handling middleware for multer errors
 */
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

export default router;