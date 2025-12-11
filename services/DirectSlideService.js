import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import models from '../models/index.js';
import { luderror } from '../lib/ludlog.js';
import { getEnv } from '../src/utils/environment.js';

/**
 * DirectSlideService - Handle SVG slides without Files table
 *
 * This service provides direct storage of SVG slides in LessonPlan's file_configs
 * and S3, completely bypassing the Files table to avoid data model complexity.
 *
 * Features:
 * - Direct S3 upload with lesson-plan path structure
 * - Storage in LessonPlan file_configs.presentation array
 * - Transaction-safe operations
 * - Slide ordering and reordering
 * - Complete slide management (add, remove, update, get)
 */
class DirectSlideService {
  constructor() {
    this.s3 = null;
    this.bucketName = process.env.AWS_S3_BUCKET;
    this.initializeS3();
  }

  // Initialize AWS S3 with optimized configuration for cross-region uploads
  initializeS3() {
    try {
      // Create optimized HTTPS agent for better connection management
      const httpsAgent = new https.Agent({
        keepAlive: true,              // Reuse connections
        keepAliveMsecs: 30000,        // 30 seconds keep-alive
        maxSockets: 50,               // Max concurrent connections
        maxFreeSockets: 10,           // Keep connections in pool
        timeout: 60000,               // 60 second connection timeout
        scheduling: 'lifo'            // Last In First Out for better reuse
      });

      this.s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        maxAttempts: 3,               // Retry up to 3 times on failure
        requestHandler: new NodeHttpHandler({
          httpsAgent,
          connectionTimeout: 10000,   // 10 seconds to establish connection
          socketTimeout: 120000       // 2 minutes for data transfer (cross-region)
        })
      });
    } catch (error) {
      throw new Error('S3 initialization failed');
    }
  }

  /**
   * Upload SVG slide directly to LessonPlan without Files table
   *
   * @param {Object} params - Upload parameters
   * @param {Object} params.file - Multer file object (SVG file)
   * @param {string} params.lessonPlanId - ID of the lesson plan
   * @param {string} params.userId - ID of uploading user
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Upload result with slide metadata
   */
  async uploadSlide({
    file,
    lessonPlanId,
    userId,
    transaction = null,
    logger = null
  }) {
    try {
      // Validate SVG file
      this.validateSVGFile(file);
      logger?.info('SVG file validation passed', {
        fileName: file.originalname,
        size: file.size,
        lessonPlanId
      });

      // Generate unique slide ID and filename
      const slideId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filename = file.originalname;

      // Construct S3 path using lesson-plan structure
      const s3Key = `${getEnv() || 'development'}/private/lesson-plan/${lessonPlanId}/${filename}`;
      logger?.info('S3 path constructed for direct slide upload', { s3Key, slideId });

      // Upload to S3 with transaction coordination
      const s3Result = await this.uploadSlideToS3({
        buffer: file.buffer,
        key: s3Key,
        contentType: file.mimetype,
        metadata: {
          slideId,
          lessonPlanId,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          originalName: Buffer.from(file.originalname, 'utf8').toString('base64'),
          originalNameEncoding: 'base64'
        },
        transaction,
        logger
      });

      if (!s3Result.success) {
        throw new Error(`S3 upload failed: ${s3Result.error}`);
      }

      // Prepare slide metadata for LessonPlan file_configs
      const slideData = {
        id: slideId,
        filename: filename,
        s3_key: s3Key,
        title: file.originalname,
        file_size: file.size
      };

      // Add slide to LessonPlan using new direct methods
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
      if (!lessonPlan) {
        // Clean up S3 file if lesson plan not found
        await this.deleteSlideFromS3({ key: s3Key, logger });
        throw new Error(`Lesson plan not found: ${lessonPlanId}`);
      }

      const addedSlide = lessonPlan.addDirectPresentationSlide(slideData);
      await lessonPlan.save({ transaction });

      logger?.info('Direct slide upload completed successfully', {
        slideId,
        s3Key,
        slideOrder: addedSlide.slide_order
      });

      return {
        success: true,
        slide: addedSlide,
        s3Key,
        filename,
        originalName: file.originalname,
        lessonPlanId,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        url: s3Result.url,
        etag: s3Result.etag
      };

    } catch (error) {
      logger?.error('Direct slide upload failed', {
        lessonPlanId,
        fileName: file?.originalname,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload multiple SVG slides in batch with transaction safety
   *
   * @param {Object} params - Batch upload parameters
   * @param {Array} params.files - Array of multer file objects
   * @param {string} params.lessonPlanId - ID of the lesson plan
   * @param {string} params.userId - ID of uploading user
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Batch upload result
   */
  async uploadMultipleSlides({
    files,
    lessonPlanId,
    userId,
    transaction = null,
    logger = null
  }) {
    const uploadedSlides = [];
    const failedUploads = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await this.uploadSlide({
          file,
          lessonPlanId,
          userId,
          transaction,
          logger
        });
        uploadedSlides.push(result.slide);
      } catch (error) {
        logger?.error(`Failed to upload slide ${i + 1}`, {
          fileName: file.originalname,
          error: error.message
        });
        failedUploads.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    return {
      success: failedUploads.length === 0,
      uploadedSlides,
      failedUploads,
      totalUploaded: uploadedSlides.length,
      totalFailed: failedUploads.length,
      totalAttempted: files.length
    };
  }

  /**
   * Delete SVG slide from both S3 and LessonPlan file_configs
   *
   * @param {Object} params - Deletion parameters
   * @param {string} params.lessonPlanId - ID of the lesson plan
   * @param {string} params.slideId - ID of the slide to delete
   * @param {string} params.userId - ID of user performing deletion
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSlide({
    lessonPlanId,
    slideId,
    userId,
    transaction = null,
    logger = null
  }) {
    try {
      // Get lesson plan and slide details
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
      if (!lessonPlan) {
        throw new Error(`Lesson plan not found: ${lessonPlanId}`);
      }

      const slide = lessonPlan.getDirectPresentationSlide(slideId);
      if (!slide) {
        throw new Error(`Slide not found: ${slideId}`);
      }

      logger?.info('Starting direct slide deletion', {
        slideId,
        s3Key: slide.s3_key,
        lessonPlanId
      });

      // Delete from S3
      const s3Result = await this.deleteSlideFromS3({
        key: slide.s3_key,
        transaction,
        logger
      });

      if (!s3Result.success) {
        logger?.error('S3 deletion failed but continuing with database cleanup', {
          s3Key: slide.s3_key,
          error: s3Result.error
        });
      }

      // Remove from LessonPlan file_configs
      const removedSlide = lessonPlan.removeDirectPresentationSlide(slideId);
      await lessonPlan.save({ transaction });

      logger?.info('Direct slide deletion completed', {
        slideId,
        s3Deleted: s3Result.success,
        dbUpdated: true
      });

      return {
        success: true,
        deletedSlide: removedSlide,
        s3Key: slide.s3_key,
        s3Deleted: s3Result.success,
        deletedBy: userId,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      logger?.error('Direct slide deletion failed', {
        lessonPlanId,
        slideId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all slides for a lesson plan
   *
   * @param {string} lessonPlanId - ID of the lesson plan
   * @param {Object} options - Options
   * @param {boolean} options.includeContent - Whether to load SVG content from S3
   * @param {Object} options.transaction - Optional Sequelize transaction
   * @returns {Promise<Object>} Slides with metadata and optionally content
   */
  async getSlides(lessonPlanId, options = {}) {
    try {
      const { includeContent = false, transaction = null } = options;

      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
      if (!lessonPlan) {
        throw new Error(`Lesson plan not found: ${lessonPlanId}`);
      }

      const slides = lessonPlan.getDirectPresentationSlides();

      // Load SVG content from S3 if requested
      if (includeContent) {
        const slidesWithContent = await Promise.all(
          slides.map(async (slide) => {
            try {
              const content = await this.getSlideContent(slide.s3_key);
              return { ...slide, content };
            } catch (error) {
              return { ...slide, content: null };
            }
          })
        );

        return {
          success: true,
          slides: slidesWithContent,
          totalSlides: slides.length,
          lessonPlanId
        };
      }

      return {
        success: true,
        slides,
        totalSlides: slides.length,
        lessonPlanId
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get SVG content from S3 for a specific slide
   *
   * @param {string} s3Key - S3 key for the slide
   * @returns {Promise<string>} SVG content as string
   */
  async getSlideContent(s3Key) {
    try {
      if (!this.s3) {
        throw new Error('S3 not configured');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const result = await this.s3.send(command);
      return await result.Body.transformToString('utf-8');

    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new Error(`Slide content not found: ${s3Key}`);
      }
      throw new Error(`Failed to load slide content: ${error.message}`);
    }
  }

  /**
   * Reorder slides in a lesson plan
   *
   * @param {Object} params - Reorder parameters
   * @param {string} params.lessonPlanId - ID of the lesson plan
   * @param {Array} params.slideIds - Array of slide IDs in new order
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @returns {Promise<Object>} Reorder result
   */
  async reorderSlides({
    lessonPlanId,
    slideIds,
    transaction = null
  }) {
    try {
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
      if (!lessonPlan) {
        throw new Error(`Lesson plan not found: ${lessonPlanId}`);
      }

      lessonPlan.reorderDirectPresentationSlides(slideIds);
      await lessonPlan.save({ transaction });

      const updatedSlides = lessonPlan.getDirectPresentationSlides();

      return {
        success: true,
        slides: updatedSlides,
        newOrder: slideIds,
        lessonPlanId
      };

    } catch (error) {
      luderror.api('Error reordering slides:', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Validate SVG file
   */
  validateSVGFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File is empty');
    }

    // Check file type
    if (file.mimetype !== 'image/svg+xml') {
      throw new Error(`Invalid file type. Expected SVG, got: ${file.mimetype}`);
    }

    // Check file size (100MB limit for SVG slides)
    const maxSize = 100 * 1024 * 1024;
    if (file.buffer.length > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
    }

  }

  /**
   * Upload slide to S3 with transaction coordination
   */
  async uploadSlideToS3({
    buffer,
    key,
    contentType,
    metadata = {},
    transaction = null,
    logger = null
  }) {
    try {
      if (!this.s3) {
        throw new Error('S3 not configured');
      }

      // Convert metadata values to strings for S3
      const stringMetadata = {};
      Object.keys(metadata).forEach(k => {
        stringMetadata[k] = String(metadata[k]);
      });

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: stringMetadata
      });

      // Transaction coordination (same pattern as FileService)
      if (transaction) {
        if (typeof transaction.afterRollback === 'function') {
          transaction.afterRollback(async () => {
            logger?.warn('Transaction rolled back - cleaning up S3 slide upload', { key });
            try {
              await this.deleteSlideFromS3({ key, logger });
              logger?.info('S3 slide cleanup successful after rollback', { key });
            } catch (cleanupError) {
              logger?.error('S3 slide cleanup failed after rollback', {
                key,
                error: cleanupError.message
              });
            }
          });
        }
      }

      const result = await this.s3.send(command);

      logger?.info('S3 slide upload completed', {
        key: key,
        etag: result.ETag,
        size: buffer.length
      });

      return {
        success: true,
        url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
        key: key,
        etag: result.ETag,
        size: buffer.length
      };

    } catch (error) {
      logger?.error('S3 slide upload failed', {
        key,
        error: error.message,
        errorCode: error.name
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.name,
        key
      };
    }
  }

  /**
   * Delete slide from S3 with transaction coordination
   */
  async deleteSlideFromS3({
    key,
    transaction = null,
    logger = null
  }) {
    try {
      if (!this.s3) {
        throw new Error('S3 not configured');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3.send(command);
      logger?.info('S3 slide deletion completed', { key });

      return {
        success: true,
        key,
        message: 'Slide deleted from S3 successfully'
      };

    } catch (error) {
      // Handle "not found" errors gracefully
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        logger?.info('S3 slide not found - treating as successful deletion', { key });
        return {
          success: true,
          key,
          message: 'Slide not found (already deleted)',
          alreadyDeleted: true
        };
      }

      logger?.error('S3 slide deletion failed', {
        key,
        error: error.message,
        errorCode: error.name
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.name,
        key
      };
    }
  }
}

export default new DirectSlideService();