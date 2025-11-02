import { constructS3Path } from '../utils/s3PathUtils.js';
import fileService from './FileService.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

/**
 * File Reference Service
 *
 * Centralizes all file reference logic to eliminate inconsistencies across
 * the codebase. Provides a single source of truth for file URL generation,
 * existence checking, and S3 key construction.
 *
 * This service addresses the 7 major inconsistencies identified in the
 * file reference audit:
 * 1. Multiple fields for same concept
 * 2. Inconsistent URL vs filename storage
 * 3. Magic string "HAS_IMAGE" placeholder
 * 4. S3 path logic duplication in frontend
 * 5. Multiple representations of file existence
 * 6. Complex marketing video type system
 * 7. Footer settings duplication
 */
class FileReferenceService {

  /**
   * Asset Type Definitions
   *
   * Maps entity types to their supported asset types and access levels
   */
  static ASSET_DEFINITIONS = {
    file: {
      document: { access: 'private', standardFilename: null } // Preserves original name
    },
    product: {
      image: { access: 'public', standardFilename: 'image.jpg' },
      'marketing-video': { access: 'public', standardFilename: 'video.mp4' }
    },
    course: {
      image: { access: 'public', standardFilename: 'image.jpg' },
      'content-video': { access: 'private', standardFilename: 'video.mp4' }
    },
    workshop: {
      image: { access: 'public', standardFilename: 'image.jpg' },
      'content-video': { access: 'private', standardFilename: 'video.mp4' }
    },
    tool: {
      image: { access: 'public', standardFilename: 'image.jpg' },
      'marketing-video': { access: 'public', standardFilename: 'video.mp4' }
    },
    school: {
      logo: { access: 'public', standardFilename: 'logo.png' }
    }
  };

  /**
   * Get Standardized Asset Information
   *
   * Returns comprehensive asset information including existence, URLs, and metadata
   */
  static async getAssetInfo(entity, entityType, assetType) {
    try {
      // Validate asset type is supported for entity
      const assetDef = this.ASSET_DEFINITIONS[entityType]?.[assetType];
      if (!assetDef) {
        return {
          exists: false,
          supported: false,
          error: `Asset type '${assetType}' not supported for entity type '${entityType}'`
        };
      }

      // Get filename from entity using standardized field mapping
      const filename = this.getFilenameFromEntity(entity, entityType, assetType);

      if (!filename) {
        return {
          exists: false,
          supported: true,
          assetType,
          entityType,
          entityId: entity.id,
          reason: 'Asset not uploaded'
        };
      }

      // Construct S3 key
      const s3Key = constructS3Path(
        entityType,
        entity.id,
        assetType,
        filename
      );

      // Check if file exists in S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

      if (metadataResult.success) {
        return {
          exists: true,
          supported: true,
          assetType,
          entityType,
          entityId: entity.id,
          filename,
          s3Key,
          size: metadataResult.data.size,
          contentType: metadataResult.data.contentType,
          lastModified: metadataResult.data.lastModified,
          accessLevel: assetDef.access,
          downloadUrl: this.getDownloadUrl(entityType, entity.id, assetType),
          streamUrl: this.getStreamUrl(entityType, entity.id, assetType)
        };
      } else {
        return {
          exists: false,
          supported: true,
          assetType,
          entityType,
          entityId: entity.id,
          filename,
          s3Key,
          reason: 'File not found in storage'
        };
      }

    } catch (error) {
      return {
        exists: false,
        supported: true,
        error: error.message
      };
    }
  }

  /**
   * Get Filename from Entity
   *
   * Extracts filename from entity using standardized field mapping
   * Handles all the different storage patterns across entities
   */
  static getFilenameFromEntity(entity, entityType, assetType) {
    // Handle File entity - stores actual filename
    if (entityType === 'file' && assetType === 'document') {
      return entity.file_name; // NULL if not uploaded
    }

    // Handle Product entity images - has "HAS_IMAGE" placeholder issue
    if (entityType === 'product' && assetType === 'image') {
      return this.resolveProductImageFilename(entity);
    }

    // Handle Product entity marketing videos
    if (entityType === 'product' && assetType === 'marketing-video') {
      return this.resolveProductMarketingVideoFilename(entity);
    }

    // Handle Workshop/Course/Tool entities - use standard filenames
    if ((entityType === 'workshop' || entityType === 'course' || entityType === 'tool')) {
      if (assetType === 'image') {
        // Check if entity has image (different field names across entities)
        const hasImage = entity.has_image || entity.image_url || entity.image_filename;
        return hasImage ? 'image.jpg' : null;
      }

      if (assetType === 'content-video') {
        // Check if entity has video (different field names across entities)
        const hasVideo = entity.video_file_url || entity.recording_url || entity.video_filename;

        // Warn about conflicting video field usage
        if (entity.video_file_url && entity.recording_url) {
          DeprecationWarnings.warnVideoFieldConflict(entityType, {
            entityId: entity.id,
            video_file_url: entity.video_file_url,
            recording_url: entity.recording_url,
            location: 'FileReferenceService.getFilenameFromEntity'
          });
        }

        return hasVideo ? 'video.mp4' : null;
      }
    }

    // Handle School entity logo
    if (entityType === 'school' && assetType === 'logo') {
      if (entity.logo_url && (entity.logo_url.startsWith('http') || entity.logo_url.includes('/'))) {
        DeprecationWarnings.warnDirectUrlStorage('school', 'logo_url', {
          entityId: entity.id,
          logo_url: entity.logo_url,
          location: 'FileReferenceService.getFilenameFromEntity'
        });
      }
      return entity.logo_url ? 'logo.png' : null;
    }

    // Default: use standard filename if indicated
    const assetDef = this.ASSET_DEFINITIONS[entityType]?.[assetType];
    if (assetDef?.standardFilename) {
      // Check if entity has some indication this asset exists
      const hasAsset = this.checkEntityHasAsset(entity, assetType);
      return hasAsset ? assetDef.standardFilename : null;
    }

    return null;
  }

  /**
   * Resolve Product Image Filename
   *
   * Handles the "HAS_IMAGE" placeholder issue in Product entity
   */
  static resolveProductImageFilename(product) {
    if (!product.image_url) {
      return null; // No image
    }

    // Handle magic "HAS_IMAGE" placeholder
    if (product.image_url === 'HAS_IMAGE') {
      DeprecationWarnings.warnHasImageUsage({
        productId: product.id,
        productType: product.product_type,
        imageUrl: product.image_url,
        location: 'FileReferenceService.resolveProductImageFilename'
      });
      return 'image.jpg'; // Standard filename for new uploads
    }

    // Handle empty string (legacy)
    if (product.image_url === '') {
      return null; // No image
    }

    // Handle legacy full URLs - extract filename
    if (product.image_url.startsWith('http') || product.image_url.includes('/')) {
      const parts = product.image_url.split('/');
      const filename = parts[parts.length - 1];
      return filename || 'image.jpg'; // Fallback to standard
    }

    // If it's already a filename, return it
    return product.image_url;
  }

  /**
   * Resolve Product Marketing Video Filename
   *
   * Handles the complex marketing video type system
   */
  static resolveProductMarketingVideoFilename(product) {
    if (product.marketing_video_type === 'uploaded') {
      // Uploaded videos always use standard filename
      return 'video.mp4';
    }

    // YouTube videos don't have files in our storage
    if (product.marketing_video_type === 'youtube') {
      return null;
    }

    // Legacy: check if there's any video indication
    if (product.marketing_video_id || product.marketing_video_url) {
      return 'video.mp4'; // Assume uploaded
    }

    return null; // No marketing video
  }

  /**
   * Check if Entity Has Asset
   *
   * Generic check for asset existence across different entity patterns
   */
  static checkEntityHasAsset(entity, assetType) {
    switch (assetType) {
      case 'image':
        return !!(entity.has_image ||
                 entity.image_url ||
                 entity.image_filename ||
                 (entity.image_url === 'HAS_IMAGE'));

      case 'marketing-video':
        return !!(entity.marketing_video_type === 'uploaded' ||
                 entity.marketing_video_url ||
                 entity.marketing_video_filename);

      case 'content-video':
        return !!(entity.video_file_url ||
                 entity.recording_url ||
                 entity.content_video_url ||
                 entity.video_filename);

      case 'document':
        return !!(entity.file_name ||
                 entity.document_url ||
                 entity.document_filename);

      case 'logo':
        return !!(entity.logo_url ||
                 entity.logo_filename);

      default:
        return false;
    }
  }

  /**
   * Get Download URL
   *
   * Returns appropriate download URL for the asset type
   */
  static getDownloadUrl(entityType, entityId, assetType) {
    const assetDef = this.ASSET_DEFINITIONS[entityType]?.[assetType];
    if (!assetDef) return null;

    if (assetType === 'document') {
      return `/api/assets/download/${entityType}/${entityId}`;
    }

    if (assetType === 'image') {
      return `/api/assets/image/${entityType}/${entityId}/image.jpg`;
    }

    // For videos, use stream URL
    return this.getStreamUrl(entityType, entityId, assetType);
  }

  /**
   * Get Stream URL
   *
   * Returns appropriate streaming URL for media assets
   */
  static getStreamUrl(entityType, entityId, assetType) {
    if (assetType.includes('video')) {
      return `/api/media/stream/${entityType}/${entityId}`;
    }

    // For non-video assets, return download URL
    return this.getDownloadUrl(entityType, entityId, assetType);
  }

  /**
   * Get S3 Key
   *
   * Returns the S3 key for an asset
   */
  static getS3Key(entity, entityType, assetType) {
    const filename = this.getFilenameFromEntity(entity, entityType, assetType);
    if (!filename) return null;

    return constructS3Path(entityType, entity.id, assetType, filename);
  }

  /**
   * Get YouTube URL
   *
   * Handles YouTube video URL generation for Product entities
   */
  static getYouTubeUrl(product) {
    if (product.marketing_video_type === 'youtube' && product.marketing_video_id) {
      return `https://www.youtube.com/embed/${product.marketing_video_id}`;
    }
    return null;
  }

  /**
   * Get Marketing Video Info
   *
   * Unified method to get marketing video information (YouTube or uploaded)
   */
  static getMarketingVideoInfo(product) {
    if (product.marketing_video_type === 'youtube') {
      return {
        type: 'youtube',
        source: product.marketing_video_id,
        url: this.getYouTubeUrl(product),
        title: product.marketing_video_title,
        duration: product.marketing_video_duration
      };
    }

    if (product.marketing_video_type === 'uploaded') {
      return {
        type: 'uploaded',
        source: 'video.mp4',
        url: this.getStreamUrl('product', product.id, 'marketing-video'),
        title: product.marketing_video_title,
        duration: product.marketing_video_duration
      };
    }

    return {
      type: null,
      source: null,
      url: null,
      title: null,
      duration: null
    };
  }

  /**
   * Standardize Entity File References
   *
   * Helper method to migrate entity to standardized file reference format
   */
  static standardizeEntityReferences(entity, entityType) {
    const standardized = { ...entity };
    const changes = [];

    // Handle Product image_url "HAS_IMAGE" → image_filename migration
    if (entityType === 'product' && entity.image_url === 'HAS_IMAGE') {
      standardized.image_filename = 'image.jpg';
      standardized.has_image = true;
      delete standardized.image_url; // Remove placeholder
      changes.push('Migrated image_url HAS_IMAGE → image_filename');
    }

    // Handle Workshop video_file_url → video_filename migration
    if (entityType === 'workshop' && entity.video_file_url) {
      standardized.video_filename = 'video.mp4';
      standardized.has_video = true;
      delete standardized.video_file_url; // Remove URL storage
      changes.push('Migrated video_file_url → video_filename');
    }

    // Handle Course/Workshop recording_url → video_filename migration
    if ((entityType === 'course' || entityType === 'workshop') && entity.recording_url) {
      standardized.video_filename = 'video.mp4';
      standardized.has_video = true;
      delete standardized.recording_url; // Remove URL storage
      changes.push('Migrated recording_url → video_filename');
    }

    return {
      entity: standardized,
      changes
    };
  }

  /**
   * Get All Assets for Entity
   *
   * Returns comprehensive information about all assets for an entity
   */
  static async getAllAssets(entity, entityType) {
    const supportedAssets = this.ASSET_DEFINITIONS[entityType] || {};
    const assets = {};

    for (const [assetType, definition] of Object.entries(supportedAssets)) {
      try {
        assets[assetType] = await this.getAssetInfo(entity, entityType, assetType);
      } catch (error) {
        assets[assetType] = {
          exists: false,
          supported: true,
          error: error.message
        };
      }
    }

    return {
      entityType,
      entityId: entity.id,
      assets,
      summary: {
        total: Object.keys(supportedAssets).length,
        existing: Object.values(assets).filter(asset => asset.exists).length,
        missing: Object.values(assets).filter(asset => !asset.exists && asset.supported).length
      }
    };
  }
}

export default FileReferenceService;