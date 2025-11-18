/**
 * GameContentService - Service for managing game content relationships
 *
 * Handles EduContentUse CRUD operations for games, managing the relationship
 * between games and educational content through the EduContentUse table.
 */

import models from '../models/index.js';
import { clog, cerror } from '../lib/utils.js';
import { generateId } from '../models/baseModel.js';

const { Game, EduContent, EduContentUse } = models;

class GameContentService {
  /**
   * Get all content usage for a game with populated content
   * @param {string} gameId - Game ID
   * @param {Object} options - Query options
   * @param {string} options.use_type - Filter by use type ('pair', 'single_content', 'group')
   * @returns {Array} Content usage records with populated content and API streaming paths
   */
  static async getGameContents(gameId, options = {}) {
    try {
      const { use_type = null } = options;

      clog(`Getting content for game ${gameId}, use_type: ${use_type || 'all'}`);

      const where = { game_id: gameId };

      // Add use type filter if provided
      if (use_type) {
        where.use_type = use_type;
      }

      // Get content usage with populated content
      const contentUses = await EduContentUse.findAll({
        where,
        order: [['created_at', 'ASC']]
      });

      // Populate content items using the model's loadContent method
      const populatedUses = [];

      for (const use of contentUses) {
        // Load content using the model's mixed-source loadContent method
        const loadedContent = await use.loadContent();

        const contentItems = [];

        for (const content of loadedContent) {
          const contentData = content.toJSON();

          // Add source info for easier identification
          contentData._source = content.dataValues._source;

          // Handle different content sources
          if (content.dataValues._source === 'eduContent') {
            // Add streaming URL for EduContent items with files
            if (content.content_metadata?.file_info?.s3_key) {
              contentData.fileUrl = `/api/edu-content/${content.id}/file`;
            }
          } else if (content.dataValues._source === 'eduContentUse') {
            // This is a sub-pair, recursively load its content
            const subPairContent = await content.loadContent();

            contentData.contentItems = subPairContent.map(subContent => {
              const subContentData = subContent.toJSON();

              // Add streaming URL for nested EduContent items with files
              if (subContent.content_metadata?.file_info?.s3_key) {
                subContentData.fileUrl = `/api/edu-content/${subContent.id}/file`;
              }

              // Add source info (sub-pair content is always from eduContent)
              subContentData._source = 'eduContent';

              return subContentData;
            });
          }

          contentItems.push(contentData);
        }

        populatedUses.push({
          ...use.toJSON(),
          contentItems
        });
      }

      clog(`Found ${populatedUses.length} content uses for game ${gameId}`);
      return populatedUses;

    } catch (error) {
      cerror(`Error getting game contents for ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Helper method to convert content IDs to content objects format
   * @param {Array} contents - Array of content IDs or content objects
   * @returns {Array} Array of content objects with { id, source }
   */
  static normalizeContentFormat(contents) {
    if (!Array.isArray(contents)) {
      throw new Error('Contents must be an array');
    }

    return contents.map(item => {
      // If already object format, return as is
      if (typeof item === 'object' && item.id && item.source) {
        return item;
      }

      // If string ID, assume eduContent source for backward compatibility
      if (typeof item === 'string') {
        return { id: item, source: 'eduContent' };
      }

      throw new Error('Invalid content format. Expected object with {id, source} or string ID');
    });
  }

  /**
   * Create new content usage for a game
   * @param {string} gameId - Game ID
   * @param {Object} useData - Content usage data
   * @param {string} useData.use_type - Usage type: 'pair', 'single_content', 'group'
   * @param {Array} useData.contents - Array of content IDs or content objects
   * @param {string} userId - User ID for ownership validation
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Created content usage with populated content
   */
  static async createContentUse(gameId, useData, userId, transaction = null, userRole = null) {
    try {
      const { use_type, contents } = useData;

      clog(`Creating content use for game ${gameId}: ${use_type} with ${contents.length} items`);

      // Validate game ownership
      await this.validateGameOwnership(gameId, userId, userRole);

      // Normalize content format (support both old ID array and new object array)
      const contentObjects = this.normalizeContentFormat(contents);

      // Validate content usage data
      this.validateContentUse(use_type, contentObjects);

      // Validate that all content items exist
      await this.validateContentExists(contentObjects);

      // Generate ID for content use
      const useId = generateId('use');

      // Create content usage
      const contentUse = await EduContentUse.create({
        id: useId,
        game_id: gameId,
        use_type,
        contents_data: contentObjects
      }, { transaction });

      // Return with populated content using the model's loadContent method
      const result = contentUse.toJSON();
      const loadedContent = await contentUse.loadContent();

      result.contentItems = [];

      for (const content of loadedContent) {
        const contentData = content.toJSON();

        // Add source info for easier identification
        contentData._source = content.dataValues._source;

        // Handle different content sources
        if (content.dataValues._source === 'eduContent') {
          // Add streaming URL for EduContent items with files
          if (content.content_metadata?.file_info?.s3_key) {
            contentData.fileUrl = `/api/edu-content/${content.id}/file`;
          }
        } else if (content.dataValues._source === 'eduContentUse') {
          // This is a sub-pair, recursively load its content
          const subPairContent = await content.loadContent();

          contentData.contentItems = subPairContent.map(subContent => {
            const subContentData = subContent.toJSON();

            // Add streaming URL for nested EduContent items with files
            if (subContent.content_metadata?.file_info?.s3_key) {
              subContentData.fileUrl = `/api/edu-content/${subContent.id}/file`;
            }

            // Add source info (sub-pair content is always from eduContent)
            subContentData._source = 'eduContent';

            return subContentData;
          });
        }

        result.contentItems.push(contentData);
      }

      clog(`Created content use ${useId} for game ${gameId}`);
      return result;

    } catch (error) {
      cerror(`Error creating content use for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing content usage
   * @param {string} gameId - Game ID
   * @param {string} useId - Content usage ID
   * @param {Object} updates - Updates to apply
   * @param {Array} updates.contents - New content IDs or content objects
   * @param {string} userId - User ID for ownership validation
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Updated content usage with populated content
   */
  static async updateContentUse(gameId, useId, updates, userId, transaction = null, userRole = null) {
    try {
      const { contents } = updates;

      clog(`Updating content use ${useId} for game ${gameId}`);

      // Validate game ownership
      await this.validateGameOwnership(gameId, userId, userRole);

      // Find existing content use
      const contentUse = await EduContentUse.findOne({
        where: { id: useId, game_id: gameId }
      });

      if (!contentUse) {
        throw new Error('Content usage not found');
      }

      // Normalize content format (support both old ID array and new object array)
      const contentObjects = this.normalizeContentFormat(contents);

      // Validate content usage data
      this.validateContentUse(contentUse.use_type, contentObjects);

      // Validate that all content items exist
      await this.validateContentExists(contentObjects);

      // Update content usage
      await contentUse.update({ contents_data: contentObjects }, { transaction });

      // Return with populated content using the model's loadContent method
      const result = contentUse.toJSON();
      const loadedContent = await contentUse.loadContent();

      result.contentItems = [];

      for (const content of loadedContent) {
        const contentData = content.toJSON();

        // Add source info for easier identification
        contentData._source = content.dataValues._source;

        // Handle different content sources
        if (content.dataValues._source === 'eduContent') {
          // Add streaming URL for EduContent items with files
          if (content.content_metadata?.file_info?.s3_key) {
            contentData.fileUrl = `/api/edu-content/${content.id}/file`;
          }
        } else if (content.dataValues._source === 'eduContentUse') {
          // This is a sub-pair, recursively load its content
          const subPairContent = await content.loadContent();

          contentData.contentItems = subPairContent.map(subContent => {
            const subContentData = subContent.toJSON();

            // Add streaming URL for nested EduContent items with files
            if (subContent.content_metadata?.file_info?.s3_key) {
              subContentData.fileUrl = `/api/edu-content/${subContent.id}/file`;
            }

            // Add source info (sub-pair content is always from eduContent)
            subContentData._source = 'eduContent';

            return subContentData;
          });
        }

        result.contentItems.push(contentData);
      }

      clog(`Updated content use ${useId} for game ${gameId}`);
      return result;

    } catch (error) {
      cerror(`Error updating content use ${useId}:`, error);
      throw error;
    }
  }

  /**
   * Delete content usage
   * @param {string} gameId - Game ID
   * @param {string} useId - Content usage ID
   * @param {string} userId - User ID for ownership validation
   * @param {Object} transaction - Database transaction (optional)
   */
  static async deleteContentUse(gameId, useId, userId, transaction = null, userRole = null) {
    try {
      clog(`Deleting content use ${useId} from game ${gameId}`);

      // Validate game ownership
      await this.validateGameOwnership(gameId, userId, userRole);

      // Find and delete content use
      const contentUse = await EduContentUse.findOne({
        where: { id: useId, game_id: gameId }
      });

      if (!contentUse) {
        throw new Error('Content usage not found');
      }

      await contentUse.destroy({ transaction });

      clog(`Deleted content use ${useId} from game ${gameId}`);

    } catch (error) {
      cerror(`Error deleting content use ${useId}:`, error);
      throw error;
    }
  }

  /**
   * Get game content statistics
   * @param {string} gameId - Game ID
   * @returns {Object} Content statistics
   */
  static async getGameContentStats(gameId) {
    try {
      const contentUses = await EduContentUse.findAll({
        where: { game_id: gameId }
      });

      const stats = {
        total_content_uses: contentUses.length,
        use_types: {},
        total_unique_content: new Set(),
        content_type_breakdown: {}
      };

      // Count use types and unique content
      for (const use of contentUses) {
        // Count use types
        stats.use_types[use.use_type] = (stats.use_types[use.use_type] || 0) + 1;

        // Add content IDs to unique set
        for (const contentId of use.contents_data) {
          stats.total_unique_content.add(contentId);
        }
      }

      // Get content type breakdown
      const uniqueContentIds = Array.from(stats.total_unique_content);
      if (uniqueContentIds.length > 0) {
        const contents = await EduContent.findAll({
          where: { id: uniqueContentIds },
          attributes: ['id', 'element_type']
        });

        for (const content of contents) {
          const type = content.element_type;
          stats.content_type_breakdown[type] = (stats.content_type_breakdown[type] || 0) + 1;
        }
      }

      stats.total_unique_content = stats.total_unique_content.size;

      return stats;

    } catch (error) {
      cerror(`Error getting stats for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Validate content usage data
   * @param {string} use_type - Usage type
   * @param {Array} contentObjects - Array of content objects with { id, source }
   * @throws {Error} If validation fails
   */
  static validateContentUse(use_type, contentObjects) {
    if (!Array.isArray(contentObjects) || contentObjects.length === 0) {
      throw new Error('Content objects array is required and must not be empty');
    }

    // Validate based on use type
    switch (use_type) {
      case 'single_content':
        if (contentObjects.length !== 1) {
          throw new Error('single_content use_type must have exactly 1 content object');
        }
        break;

      case 'pair':
        if (contentObjects.length !== 2) {
          throw new Error('pair use_type must have exactly 2 content objects');
        }
        break;

      case 'mixed_edu_contents':
        if (contentObjects.length !== 2) {
          throw new Error('mixed_edu_contents use_type must have exactly 2 content objects');
        }
        break;

      case 'group':
        if (contentObjects.length < 2) {
          throw new Error('group use_type must have at least 2 content objects');
        }
        break;

      default:
        throw new Error(`Invalid use_type: ${use_type}`);
    }

    // Validate object structure
    for (const contentObj of contentObjects) {
      if (!contentObj.id || !contentObj.source) {
        throw new Error('Each content object must have id and source properties');
      }
      if (!['eduContent', 'eduContentUse'].includes(contentObj.source)) {
        throw new Error('Content object source must be eduContent or eduContentUse');
      }
    }

    // Check for duplicate content IDs
    const ids = contentObjects.map(obj => obj.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new Error('Duplicate content IDs are not allowed');
    }
  }

  /**
   * Validate that all content objects exist in their respective source tables
   * @param {Array} contentObjects - Array of objects with { id, source } structure
   * @throws {Error} If any content doesn't exist
   */
  static async validateContentExists(contentObjects) {
    if (!Array.isArray(contentObjects)) {
      throw new Error('Content objects must be an array');
    }

    // Group content objects by source for efficient batch queries
    const contentsBySource = {
      eduContent: [],
      eduContentUse: []
    };

    for (const contentObj of contentObjects) {
      if (!contentObj.id || !contentObj.source) {
        throw new Error('Each content object must have id and source properties');
      }

      if (contentsBySource[contentObj.source]) {
        contentsBySource[contentObj.source].push(contentObj.id);
      } else {
        throw new Error(`Invalid source: ${contentObj.source}. Must be eduContent or eduContentUse`);
      }
    }

    const missingIds = [];

    // Validate EduContent items
    if (contentsBySource.eduContent.length > 0) {
      const existingEduContents = await EduContent.findAll({
        where: { id: contentsBySource.eduContent },
        attributes: ['id']
      });
      const existingEduContentIds = existingEduContents.map(c => c.id);
      const missingEduContentIds = contentsBySource.eduContent.filter(id => !existingEduContentIds.includes(id));
      missingIds.push(...missingEduContentIds.map(id => `${id} (eduContent)`));
    }

    // Validate EduContentUse items (sub-pairs)
    if (contentsBySource.eduContentUse.length > 0) {
      const existingEduContentUses = await EduContentUse.findAll({
        where: { id: contentsBySource.eduContentUse },
        attributes: ['id']
      });
      const existingEduContentUseIds = existingEduContentUses.map(c => c.id);
      const missingEduContentUseIds = contentsBySource.eduContentUse.filter(id => !existingEduContentUseIds.includes(id));
      missingIds.push(...missingEduContentUseIds.map(id => `${id} (eduContentUse)`));
    }

    if (missingIds.length > 0) {
      throw new Error(`Content not found: ${missingIds.join(', ')}`);
    }
  }

  /**
   * Validate game ownership via Product table
   * @param {string} gameId - Game ID
   * @param {string} userId - User ID
   * @param {string} userRole - User role (for admin bypass)
   * @throws {Error} If user doesn't own game and is not admin
   */
  static async validateGameOwnership(gameId, userId, userRole = null) {
    const game = await Game.findByPk(gameId);

    if (!game) {
      throw new Error('Game not found');
    }

    // Admin users can access any game
    if (userRole === 'admin' || userRole === 'sysadmin') {
      clog(`Admin access granted: ${userRole} user ${userId} can access game ${gameId}`);
      return;
    }

    // Find the associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: gameId
      }
    });

    if (!product) {
      clog(`No product found for game ${gameId} - allowing access (Ludora-owned game)`);
      return; // Game without product belongs to Ludora, allow access
    }

    // If product has no creator_user_id, it belongs to Ludora (allow access)
    if (!product.creator_user_id) {
      clog(`Product for game ${gameId} has no creator - Ludora-owned, allowing access`);
      return;
    }

    // Check product ownership
    const productCreatorId = String(product.creator_user_id);
    const requestUserId = String(userId);

    clog(`Game ownership check via Product: gameId=${gameId}, userId=${userId}, product.creator_user_id=${productCreatorId}`);

    if (productCreatorId !== requestUserId) {
      cerror(`Access denied: User ${requestUserId} does not own game ${gameId} (owned by ${productCreatorId} via product ${product.id})`);
      throw new Error(`Access denied: You do not own this game`);
    }

    clog(`Game ownership validated: User ${requestUserId} owns game ${gameId} via product ${product.id}`);
  }
}

export default GameContentService;