/**
 * EduContentService - Service for managing educational content
 *
 * Handles EduContent CRUD operations with FileService integration
 * for file uploads, streaming, and cleanup following established patterns.
 */

import models from '../models/index.js';
import FileService from './FileService.js';
import { luderror } from '../lib/ludlog.js';
import { generateId } from '../models/baseModel.js';

const { EduContent } = models;

class EduContentService {
  /**
   * Create new educational content with optional file upload
   * @param {Object} contentData - Content data
   * @param {string} contentData.element_type - Type: 'data', 'playing_card_complete', 'playing_card_bg'
   * @param {string} contentData.content - Content text/description
   * @param {Object} contentData.content_metadata - Additional metadata
   * @param {Object} file - Multer file object (optional)
   * @param {string} userId - Creator user ID
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Created EduContent with fileUrl if file uploaded
   */
  static async createContent({
    element_type,
    content,
    content_metadata = {},
    file = null,
    userId,
    transaction = null
  }) {
    try {

      // Generate ID for content
      const contentId = generateId('content');

      // Create EduContent record
      const eduContent = await EduContent.create({
        id: contentId,
        element_type,
        content,
        content_metadata
      }, { transaction });

      // If file provided, upload via FileService
      if (file) {

        const uploadResult = await FileService.uploadAsset({
          file: file,
          entityType: 'edu_content',
          entityId: contentId,
          assetType: 'content_asset',
          userId: userId,
          transaction: transaction,
          preserveOriginalName: true
        });

        // Update content with file metadata
        const updatedMetadata = {
          ...content_metadata,
          file_info: {
            s3_key: uploadResult.s3Key,
            original_filename: file.originalname,
            storage_filename: file.originalname,
            mime_type: file.mimetype,
            file_size: file.size,
            upload_date: new Date().toISOString()
          }
        };

        await eduContent.update({
          content_metadata: updatedMetadata
        }, { transaction });

        // Return with file URL
        const result = eduContent.toJSON();
        result.fileUrl = `/api/edu-content/${contentId}/file`;
        return result;
      }

      return eduContent;

    } catch (error) {
      luderror.api('Error creating EduContent:', error);
      throw error;
    }
  }

  /**
   * Find content with pagination and search
   * @param {Object} options - Query options
   * @param {string} options.search - Search term
   * @param {string} options.element_type - Filter by element type
   * @param {number} options.limit - Results per page
   * @param {number} options.offset - Results offset
   * @returns {Object} Paginated content results with fileUrls
   */
  static async findContent(options = {}) {
    try {
      const {
        search = '',
        element_type = null,
        limit = 20,
        offset = 0
      } = options;

      const where = {};

      // Add search filter
      if (search) {
        where.content = {
          [models.Sequelize.Op.iLike]: `%${search}%`
        };
      }

      // Add element type filter
      if (element_type) {
        where.element_type = element_type;
      }

      const { count, rows } = await EduContent.findAndCountAll({
        where,
        limit: Math.min(limit, 100), // Max 100 items per page
        offset,
        order: [['created_at', 'DESC']]
      });

      // Add fileUrl to results
      const contentWithUrls = rows.map(content => {
        const result = content.toJSON();
        if (content.content_metadata?.file_info?.s3_key) {
          result.fileUrl = `/api/edu-content/${content.id}/file`;
        }
        return result;
      });

      return {
        data: contentWithUrls,
        pagination: {
          total: count,
          limit,
          offset,
          pages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      luderror.api('Error finding EduContent:', error);
      throw error;
    }
  }

  /**
   * Find single content by ID
   * @param {string} contentId - Content ID
   * @returns {Object} Content with fileUrl if file exists
   */
  static async findById(contentId) {
    try {
      const content = await EduContent.findByPk(contentId);

      if (!content) {
        return null;
      }

      const result = content.toJSON();
      if (content.content_metadata?.file_info?.s3_key) {
        result.fileUrl = `/api/edu-content/${contentId}/file`;
      }

      return result;

    } catch (error) {
      luderror.api(`Error finding EduContent ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Stream file for content (follows media.js patterns)
   * @param {string} contentId - Content ID
   * @param {Object} res - Express response object
   */
  static async streamContentFile(contentId, res) {
    try {
      const content = await EduContent.findByPk(contentId);

      if (!content) {
        throw new Error('Content not found');
      }

      if (!content.content_metadata?.file_info?.s3_key) {
        throw new Error('File not found');
      }

      let s3Key = content.content_metadata.file_info.s3_key;
      const metadata = content.content_metadata.file_info;

      // Handle corrupted s3_key data (objects instead of strings from old bug)
      if (typeof s3Key === 'object' && s3Key.s3Key) {

        s3Key = s3Key.s3Key; // Extract the actual string from the object
      } else if (typeof s3Key !== 'string') {
        throw new Error(`Invalid s3Key format for content ${contentId}: expected string, got ${typeof s3Key}`);
      }

      // Create S3 stream using FileService
      const stream = await FileService.createS3Stream(s3Key);

      // Set response headers (following media.js pattern)
      res.set({
        'Content-Type': metadata.mime_type,
        'Content-Length': metadata.file_size,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type': 'edu-content-asset'
      });

      // Pipe S3 stream to response
      stream.pipe(res);

    } catch (error) {
      luderror.api(`Error streaming file for content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete content with S3 cleanup
   * @param {string} contentId - Content ID
   * @param {Object} transaction - Database transaction (optional)
   */
  static async deleteContent(contentId, transaction = null) {
    try {
      const content = await EduContent.findByPk(contentId);

      if (!content) {
        throw new Error('Content not found');
      }

      // If content has file, delete from S3 first
      if (content.content_metadata?.file_info?.s3_key) {
        let s3Key = content.content_metadata.file_info.s3_key;

        // Handle corrupted s3_key data (objects instead of strings from old bug)
        if (typeof s3Key === 'object' && s3Key.s3Key) {

          s3Key = s3Key.s3Key; // Extract the actual string from the object
        }

        if (typeof s3Key === 'string') {

          await FileService.deleteS3Object(s3Key);
        } else {

        }
      }

      // Delete content record
      await content.destroy({ transaction });

    } catch (error) {
      luderror.api(`Error deleting EduContent ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Update content metadata (not file)
   * @param {string} contentId - Content ID
   * @param {Object} updates - Updates to apply
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Updated content with fileUrl
   */
  static async updateContent(contentId, updates, transaction = null) {
    try {
      const content = await EduContent.findByPk(contentId);

      if (!content) {
        throw new Error('Content not found');
      }

      // Only allow updating certain fields (not file_info)
      const allowedUpdates = {
        content: updates.content,
        content_metadata: {
          ...content.content_metadata,
          ...updates.content_metadata,
          // Preserve file_info if it exists
          file_info: content.content_metadata?.file_info
        }
      };

      await content.update(allowedUpdates, { transaction });

      const result = content.toJSON();
      if (content.content_metadata?.file_info?.s3_key) {
        result.fileUrl = `/api/edu-content/${contentId}/file`;
      }

      return result;

    } catch (error) {
      luderror.api(`Error updating EduContent ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Check if content has associated file
   * @param {string} contentId - Content ID
   * @returns {boolean} True if content has file
   */
  static async hasFile(contentId) {
    try {
      const content = await EduContent.findByPk(contentId);
      return Boolean(content?.content_metadata?.file_info?.s3_key);
    } catch (error) {
      luderror.api(`Error checking file for content ${contentId}:`, error);
      return false;
    }
  }

  /**
   * Get content usage statistics
   * @param {string} contentId - Content ID
   * @returns {Object} Usage statistics
   */
  static async getContentUsage(contentId) {
    try {
      const usage = await models.EduContentUse.findAndCountAll({
        where: {
          contents: {
            [models.Sequelize.Op.contains]: [contentId]
          }
        },
        include: [{
          model: models.Game,
          as: 'game',
          attributes: ['id', 'game_type']
        }]
      });

      return {
        total_uses: usage.count,
        games: usage.rows.map(use => ({
          game_id: use.game_id,
          use_type: use.use_type,
          game_type: use.game?.game_type || 'unknown'
        }))
      };

    } catch (error) {
      luderror.api(`Error getting usage for content ${contentId}:`, error);
      return { total_uses: 0, games: [] };
    }
  }
}

export default EduContentService;