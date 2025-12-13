/**
 * Pre-Upload Validator
 *
 * Provides comprehensive validation before file uploads to prevent bad uploads,
 * orphaned files, and system inconsistencies. Validates file types, sizes,
 * entity existence, permissions, and content requirements.
 */

import db from '../models/index.js';
import { createErrorResponse } from './fileOperationLogger.js';
import { haveAdminAccess } from '../constants/adminAccess.js';

/**
 * File type mappings and validation rules
 */
const ASSET_TYPE_RULES = {
  'marketing-video': {
    allowedMimeTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
    allowedExtensions: ['.mp4', '.mpeg', '.mov', '.avi'],
    maxSize: 500 * 1024 * 1024, // 500MB
    minSize: 1024, // 1KB
    description: 'Marketing video files'
  },
  'content-video': {
    allowedMimeTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
    allowedExtensions: ['.mp4', '.mpeg', '.mov', '.avi'],
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    minSize: 1024, // 1KB
    description: 'Private content video files'
  },
  'document': {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx'],
    maxSize: 100 * 1024 * 1024, // 100MB
    minSize: 100, // 100 bytes
    description: 'Document files (PDF, Word, Excel, Text)'
  },
  'image': {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    minSize: 100, // 100 bytes
    description: 'Image files (JPEG, PNG, GIF, WebP)'
  }
};

/**
 * Entity type validation rules
 */
const ENTITY_TYPE_RULES = {
  'workshop': {
    allowedAssetTypes: ['marketing-video', 'content-video', 'image'],
    requiresProduct: true,
    modelName: 'Workshop'
  },
  'course': {
    allowedAssetTypes: ['marketing-video', 'content-video', 'image'],
    requiresProduct: true,
    modelName: 'Course'
  },
  'file': {
    allowedAssetTypes: ['document', 'marketing-video', 'image'],
    requiresProduct: false, // Files can exist without products
    modelName: 'File'
  },
  'tool': {
    allowedAssetTypes: ['marketing-video', 'content-video', 'image'],
    requiresProduct: true,
    modelName: 'Tool'
  },
  'lesson_plan': {
    allowedAssetTypes: ['marketing-video', 'content-video', 'image'],
    requiresProduct: true,
    modelName: 'LessonPlan'
  }
};

/**
 * Pre-Upload Validator Class
 */
class PreUploadValidator {
  constructor(logger = null) {
    this.logger = logger;
  }

  /**
   * Validate file against asset type requirements
   * @param {Object} file - Multer file object
   * @param {string} assetType - Type of asset being uploaded
   * @returns {Object} Validation result
   */
  validateFileType(file, assetType) {
    const rules = ASSET_TYPE_RULES[assetType];

    if (!rules) {
      return {
        valid: false,
        error: createErrorResponse(
          'Invalid asset type',
          `Asset type '${assetType}' is not supported`,
          {
            assetType,
            supportedTypes: Object.keys(ASSET_TYPE_RULES)
          }
        )
      };
    }

    // Check MIME type
    if (!rules.allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: createErrorResponse(
          'Invalid file type',
          `File type '${file.mimetype}' not allowed for ${rules.description}`,
          {
            receivedType: file.mimetype,
            allowedTypes: rules.allowedMimeTypes,
            assetType,
            fileName: file.originalname
          }
        )
      };
    }

    // Check file extension
    const fileExtension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (fileExtension && !rules.allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: createErrorResponse(
          'Invalid file extension',
          `File extension '${fileExtension}' not allowed for ${rules.description}`,
          {
            receivedExtension: fileExtension,
            allowedExtensions: rules.allowedExtensions,
            assetType,
            fileName: file.originalname
          }
        )
      };
    }

    // Check file size
    if (file.size > rules.maxSize) {
      return {
        valid: false,
        error: createErrorResponse(
          'File too large',
          `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size`,
          {
            fileSize: file.size,
            fileSizeMB: Math.round(file.size / 1024 / 1024),
            maxSize: rules.maxSize,
            maxSizeMB: Math.round(rules.maxSize / 1024 / 1024),
            assetType,
            fileName: file.originalname
          }
        )
      };
    }

    if (file.size < rules.minSize) {
      return {
        valid: false,
        error: createErrorResponse(
          'File too small',
          `File size (${file.size} bytes) is below minimum required size`,
          {
            fileSize: file.size,
            minSize: rules.minSize,
            assetType,
            fileName: file.originalname
          }
        )
      };
    }

    this.logger?.info('File type validation passed', {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      assetType
    });

    return { valid: true };
  }

  /**
   * Validate entity type and asset type compatibility
   * @param {string} entityType - Type of entity
   * @param {string} assetType - Type of asset
   * @returns {Object} Validation result
   */
  validateEntityAssetCompatibility(entityType, assetType) {
    const entityRules = ENTITY_TYPE_RULES[entityType];

    if (!entityRules) {
      return {
        valid: false,
        error: createErrorResponse(
          'Invalid entity type',
          `Entity type '${entityType}' is not supported`,
          {
            entityType,
            supportedTypes: Object.keys(ENTITY_TYPE_RULES)
          }
        )
      };
    }

    if (!entityRules.allowedAssetTypes.includes(assetType)) {
      return {
        valid: false,
        error: createErrorResponse(
          'Incompatible asset type',
          `Asset type '${assetType}' not allowed for entity type '${entityType}'`,
          {
            entityType,
            assetType,
            allowedAssetTypes: entityRules.allowedAssetTypes
          }
        )
      };
    }

    this.logger?.info('Entity-asset compatibility validated', {
      entityType,
      assetType,
      allowedAssetTypes: entityRules.allowedAssetTypes
    });

    return { valid: true };
  }

  /**
   * Validate entity exists in database
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of entity
   * @param {string} assetType - Type of asset (used to determine if this is a marketing asset)
   * @returns {Promise<Object>} Validation result with entity data
   */
  async validateEntityExists(entityType, entityId, assetType = null) {
    const entityRules = ENTITY_TYPE_RULES[entityType];

    if (!entityRules) {
      return {
        valid: false,
        error: createErrorResponse(
          'Invalid entity type',
          `Entity type '${entityType}' is not supported`,
          { entityType, entityId }
        )
      };
    }

    try {
      // FIXED: For marketing assets (image, marketing-video), validate Product entity instead of content entity
      // This implements the 3-layer file architecture: Marketing assets belong to Product entity
      const isMarketingAsset = assetType && ['image', 'marketing-video'].includes(assetType);

      if (isMarketingAsset) {
        // For marketing assets, find the Product entity instead of the content entity
        this.logger?.info('Marketing asset detected - validating Product entity', {
          entityType,
          entityId,
          assetType,
          originalModelName: entityRules.modelName
        });

        const product = await db.Product.findByPk(entityId);

        if (!product) {
          return {
            valid: false,
            error: createErrorResponse(
              'Product not found',
              `Product with ID '${entityId}' not found in database`,
              {
                entityType,
                entityId,
                assetType,
                hint: 'Marketing assets require a valid Product entity'
              }
            )
          };
        }

        // Verify that the product type matches the entity type for consistency
        if (product.product_type !== entityType) {
          this.logger?.warn('Product type mismatch', {
            entityType,
            productType: product.product_type,
            entityId,
            assetType
          });
        }

        this.logger?.info('Product entity validated for marketing asset', {
          entityType,
          entityId,
          assetType,
          productType: product.product_type,
          productId: product.id
        });

        return {
          valid: true,
          entity: product,
          entityModel: 'Product'
        };
      } else {
        // For content and system assets, use the original content entity validation
        const model = db[entityRules.modelName];
        const entity = await model.findByPk(entityId);

        if (!entity) {
          return {
            valid: false,
            error: createErrorResponse(
              'Entity not found',
              `${entityRules.modelName} with ID '${entityId}' not found in database`,
              {
                entityType,
                entityId,
                modelName: entityRules.modelName,
                assetType
              }
            )
          };
        }

        this.logger?.info('Content/System entity validated', {
          entityType,
          entityId,
          modelName: entityRules.modelName,
          assetType,
          entityFound: true
        });

        return {
          valid: true,
          entity,
          entityModel: entityRules.modelName
        };
      }
    } catch (error) {
      this.logger?.error(error, { stage: 'entity_validation', entityType, entityId, assetType });

      return {
        valid: false,
        error: createErrorResponse(
          'Entity validation failed',
          'Failed to validate entity existence',
          {
            entityType,
            entityId,
            assetType,
            details: error.message
          }
        )
      };
    }
  }

  /**
   * Validate user has permission to upload to entity
   * @param {Object} user - User object
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of entity
   * @param {Object} entity - Entity object (optional, will fetch if not provided)
   * @returns {Promise<Object>} Validation result
   */
  async validateUploadPermission(user, entityType, entityId, entity = null) {
    try {
      // Admin users can upload to anything
      if (haveAdminAccess(user.role, 'upload_permission')) {
        this.logger?.info('Admin upload permission granted', {
          userId: user.id,
          userRole: user.role,
          entityType,
          entityId
        });
        return { valid: true, reason: 'admin_access' };
      }

      // Get entity if not provided
      if (!entity) {
        const entityValidation = await this.validateEntityExists(entityType, entityId, 'permission_check');
        if (!entityValidation.valid) {
          return entityValidation;
        }
        entity = entityValidation.entity;
      }

      // Check if user is the creator
      const creatorField = entity.creator_user_id || entity.user_id || entity.owner_id;
      if (creatorField === user.id) {
        this.logger?.info('Creator upload permission granted', {
          userId: user.id,
          entityType,
          entityId,
          creatorField
        });
        return { valid: true, reason: 'creator_access' };
      }

      // For now, deny access to non-creators/non-admins
      // TODO: Add more sophisticated permission system (collaborators, etc.)
      return {
        valid: false,
        error: createErrorResponse(
          'Upload permission denied',
          'You do not have permission to upload files to this entity',
          {
            userId: user.id,
            entityType,
            entityId,
            hint: 'Only the creator or admin users can upload files'
          }
        )
      };

    } catch (error) {
      this.logger?.error(error, { stage: 'permission_validation', userId: user.id, entityType, entityId });

      return {
        valid: false,
        error: createErrorResponse(
          'Permission validation failed',
          'Failed to validate upload permissions',
          {
            userId: user.id,
            entityType,
            entityId,
            details: error.message
          }
        )
      };
    }
  }

  /**
   * Validate existing file replacement safety
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of entity
   * @param {string} assetType - Type of asset
   * @param {string} filename - Filename (for documents)
   * @returns {Promise<Object>} Validation result
   */
  async validateFileReplacementSafety(entityType, entityId, assetType, filename = null) {
    try {
      // For documents on File entities, check if replacing will cause issues
      if (assetType === 'document' && entityType === 'file') {
        const fileEntity = await db.File.findByPk(entityId);

        if (fileEntity && fileEntity.file_name) {
          this.logger?.warn('Replacing existing document file', {
            entityId,
            existingFileName: fileEntity.file_name,
            newFileName: filename,
            warning: 'Existing file will be replaced'
          });

          return {
            valid: true,
            warning: {
              type: 'file_replacement',
              message: `Existing file '${fileEntity.file_name}' will be replaced`,
              existingFile: fileEntity.file_name,
              newFile: filename
            }
          };
        }
      }

      // For videos, replacement is normal (always use video.mp4)
      if (assetType === 'marketing-video' || assetType === 'content-video') {
        this.logger?.info('Video replacement is normal operation', {
          entityType,
          entityId,
          assetType
        });
      }

      return { valid: true };

    } catch (error) {
      this.logger?.error(error, { stage: 'replacement_safety_check', entityType, entityId, assetType });

      return {
        valid: false,
        error: createErrorResponse(
          'File replacement validation failed',
          'Failed to validate file replacement safety',
          {
            entityType,
            entityId,
            assetType,
            details: error.message
          }
        )
      };
    }
  }

  /**
   * Comprehensive pre-upload validation
   * @param {Object} params - Validation parameters
   * @param {Object} params.file - Multer file object
   * @param {Object} params.user - User object
   * @param {string} params.entityType - Type of entity
   * @param {string} params.entityId - ID of entity
   * @param {string} params.assetType - Type of asset
   * @param {string} params.filename - Optional filename override
   * @returns {Promise<Object>} Comprehensive validation result
   */
  async validateUpload({ file, user, entityType, entityId, assetType, filename = null }) {
    this.logger?.info('Starting comprehensive pre-upload validation', {
      fileName: file?.originalname,
      fileSize: file?.size,
      entityType,
      entityId,
      assetType,
      userId: user?.id
    });

    const validationResults = {
      valid: true,
      warnings: [],
      entity: null,
      validations: {}
    };

    try {
      // 1. Validate entity-asset compatibility
      const compatibilityResult = this.validateEntityAssetCompatibility(entityType, assetType);
      validationResults.validations.compatibility = compatibilityResult;

      if (!compatibilityResult.valid) {
        return { ...validationResults, valid: false, error: compatibilityResult.error };
      }

      // 2. Validate entity exists
      const entityResult = await this.validateEntityExists(entityType, entityId, assetType);
      validationResults.validations.entityExists = entityResult;

      if (!entityResult.valid) {
        return { ...validationResults, valid: false, error: entityResult.error };
      }

      validationResults.entity = entityResult.entity;

      // 3. Validate upload permissions
      const permissionResult = await this.validateUploadPermission(user, entityType, entityId, entityResult.entity);
      validationResults.validations.permissions = permissionResult;

      if (!permissionResult.valid) {
        return { ...validationResults, valid: false, error: permissionResult.error };
      }

      // 4. Validate file type and constraints
      const fileTypeResult = this.validateFileType(file, assetType);
      validationResults.validations.fileType = fileTypeResult;

      if (!fileTypeResult.valid) {
        return { ...validationResults, valid: false, error: fileTypeResult.error };
      }

      // 5. Validate file replacement safety
      const replacementResult = await this.validateFileReplacementSafety(entityType, entityId, assetType, filename);
      validationResults.validations.replacementSafety = replacementResult;

      if (!replacementResult.valid) {
        return { ...validationResults, valid: false, error: replacementResult.error };
      }

      if (replacementResult.warning) {
        validationResults.warnings.push(replacementResult.warning);
      }

      this.logger?.info('Pre-upload validation completed successfully', {
        entityType,
        entityId,
        assetType,
        fileName: file.originalname,
        warnings: validationResults.warnings.length
      });

      return validationResults;

    } catch (error) {
      this.logger?.error(error, { stage: 'comprehensive_validation', entityType, entityId, assetType });

      return {
        ...validationResults,
        valid: false,
        error: createErrorResponse(
          'Pre-upload validation failed',
          'Failed to complete pre-upload validation',
          {
            entityType,
            entityId,
            assetType,
            details: error.message
          }
        )
      };
    }
  }
}

/**
 * Factory function to create pre-upload validator
 * @param {Object} logger - Optional logger instance
 * @returns {PreUploadValidator} Validator instance
 */
export function createPreUploadValidator(logger = null) {
  return new PreUploadValidator(logger);
}

/**
 * Quick validation helper for common use cases
 * @param {Object} params - Validation parameters
 * @returns {Promise<Object>} Validation result
 */
export async function quickValidateUpload(params) {
  const validator = createPreUploadValidator();
  return await validator.validateUpload(params);
}

export default PreUploadValidator;