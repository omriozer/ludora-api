import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { Op } from 'sequelize';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { ludlog } from '../lib/ludlog.js';
import { haveAdminAccess } from '../constants/adminAccess.js';

/**
 * BaseProductService - Shared CRUD patterns for all product types
 *
 * Provides common functionality for all domain-specific product services:
 * - Model access and validation
 * - Generic CRUD operations
 * - Transaction management
 * - Query building and sorting
 * - Product-Entity coordination patterns
 */
class BaseProductService {
  constructor(productType, EntityModel = null) {
    this.productType = productType;
    this.EntityModel = EntityModel;
    // Lazy load models to avoid circular dependency issues
    this._models = null;
  }

  // Lazy load models to avoid circular dependency issues
  get models() {
    if (!this._models) {
      this._models = models;
    }
    return this._models;
  }

  // Get model by name (case-insensitive)
  getModel(entityType = null) {
    const targetType = entityType || this.productType;
    // Convert to PascalCase to match model names
    const modelName = this.toPascalCase(targetType);
    const model = this.models[modelName];

    if (!model) {
      throw new BadRequestError(`Invalid entity type: ${targetType}`, {
        entityType: targetType,
        availableTypes: this.getAvailableEntityTypes()
      });
    }

    return model;
  }

  // Convert string to PascalCase with special mappings for compound words
  toPascalCase(str) {
    // Special mappings for compound words that don't follow standard camelCase
    const specialMappings = {
      'emailtemplate': 'EmailTemplate',
      'emaillog': 'EmailLog',
      'supportmessage': 'SupportMessage',
      'audiofile': 'AudioFile',
      'gameaudiosettings': 'GameAudioSettings',
      'worden': 'WordEN',
      'qa': 'QA',
      'contentlist': 'ContentList',
      'contentrelationship': 'ContentRelationship',
      'subscriptionplan': 'SubscriptionPlan',
      'subscriptionhistory': 'SubscriptionHistory',
      'gamesession': 'GameSession',
      'gamecontenttag': 'GameContentTag',
      'contenttag': 'ContentTag',
      'contenttopic': 'ContentTopic',
      'studentinvitation': 'StudentInvitation',
      'classroommembership': 'ClassroomMembership',
      'curriculumitem': 'CurriculumItem',
      'curriculumproduct': 'CurriculumProduct',
      'lessonplan': 'LessonPlan',
    };

    // Check for special mappings first
    const lowerStr = str.toLowerCase();
    if (specialMappings[lowerStr]) {
      return specialMappings[lowerStr];
    }

    // Standard PascalCase conversion
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[a-z]/, char => char.toUpperCase());
  }

  // Process sort parameter to convert to Sequelize order format
  processSortParameter(sort) {
    try {
      // If sort is already an array (like from options), use it directly
      if (Array.isArray(sort)) {
        return sort;
      }

      // If sort is a string, try to parse it
      if (typeof sort === 'string') {
        try {
          const parsed = JSON.parse(sort);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          // If parsing fails, treat as simple column name
          return [[sort, 'ASC']];
        }
      }

      // If sort is an object, convert to array format
      if (typeof sort === 'object' && sort !== null) {
        if (sort.field && sort.direction) {
          return [[sort.field, sort.direction.toUpperCase()]];
        }
      }

      // Default fallback
      return [['created_at', 'DESC']];
    } catch (error) {
      return [['created_at', 'DESC']];
    }
  }

  // Build where clause from query parameters
  buildWhereClause(query, entityType = null) {
    const where = {};
    const targetType = entityType || this.productType;

    Object.entries(query).forEach(([key, value]) => {
      // Skip special parameters that are handled separately
      if (["limit", "offset", "order", "sort", "include"].includes(key)) {
        return;
      }

      // Handle special search parameter
      if (key === 'search') {
        // Skip empty search parameters
        if (!value || value.trim() === '') {
          return;
        }

        const searchFields = this.getSearchFields(targetType);
        if (searchFields.length > 0) {
          where[Op.or] = searchFields.map(field => ({
            [field]: {
              [Op.iLike]: `%${value}%`
            }
          }));
        }
        return;
      }

      // Force strict boolean for known boolean fields
      if (["is_published", "is_active"].includes(key)) {
        if (typeof value === "string") {
          if (value === "true") value = true;
          else if (value === "false") value = false;
        }
        if (typeof value === "boolean") {
          where[key] = value;
          return;
        }
      }

      // Handle different query types
      if (typeof value === "string") {
        // String contains search
        where[key] = {
          [Op.iLike]: `%${value}%`
        };
      } else if (typeof value === "boolean") {
        where[key] = value;
      } else if (Array.isArray(value)) {
        // Array - exact match for any value
        where[key] = {
          [Op.in]: value
        };
      } else {
        // Exact match
        where[key] = value;
      }
    });

    return where;
  }

  // Get searchable fields for each entity type
  getSearchFields(entityType = null) {
    const targetType = entityType || this.productType;

    const searchFieldMap = {
      'word': ['word', 'vocalized', 'context'],
      'worden': ['word'],
      'wordEn': ['word'],
      'wordEN': ['word'],
      'qa': ['question_text'],
      'contentlist': ['name', 'description'],
      'image': ['name', 'description'],
      'attribute': ['type', 'value'],
    };

    return searchFieldMap[targetType.toLowerCase()] || ['name', 'title', 'description'];
  }

  // Get all available entity types
  getAvailableEntityTypes() {
    return Object.keys(this.models);
  }

  // Validate ownership for entities
  async validateOwnership(entityId, userId, userRole) {
    try {
      const entity = await this.findById(entityId);

      // Check if user owns this entity via Product table
      if (entity.creator_user_id === userId) {
        return true;
      }

      // Admin users can access all entities
      if (haveAdminAccess(userRole, 'entity_ownership_bypass')) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Transaction wrapper for operations requiring atomicity
  async withTransaction(callback) {
    const transaction = await this.models.sequelize.transaction();

    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Generic find method with standardized includes and associations
  async find(query = {}, options = {}) {
    try {
      const Model = this.getModel();

      // Extract special parameters from query
      const { sort, include, ...whereQuery } = query;

      // Build where clause from query parameters
      const where = this.buildWhereClause(whereQuery);

      // Handle sort parameter
      let order = [['created_at', 'DESC']]; // Default ordering
      if (sort) {
        order = this.processSortParameter(sort);
      }

      // Build options for Sequelize query
      const queryOptions = {
        where,
        order,
        ...options
      };

      // Include creator information if this is a product entity type
      if (await this.shouldIncludeCreator()) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }

        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        });
      }

      // Allow options to override the order if explicitly provided
      if (options.order) {
        queryOptions.order = options.order;
      }

      // Handle pagination
      if (options.limit) {
        queryOptions.limit = parseInt(options.limit);
      }
      if (options.offset) {
        queryOptions.offset = parseInt(options.offset);
      }

      const results = await Model.findAll(queryOptions);

      // Post-process results to add default creator name when creator is null
      if (await this.shouldIncludeCreator()) {
        results.forEach(entity => {
          if (!entity.creator) {
            entity.dataValues.creator = {
              id: null,
              full_name: 'Ludora',
              email: null
            };
          }
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to find ${this.productType}: ${error.message}`);
    }
  }

  // Generic findById with standardized includes
  async findById(id, include = null) {
    try {
      const Model = this.getModel();

      const queryOptions = { where: { id } };

      // Include creator information if this is a product entity type
      if (await this.shouldIncludeCreator()) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }

        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        });
      }

      const entity = await Model.findOne(queryOptions);

      if (!entity) {
        throw new NotFoundError(`${this.toPascalCase(this.productType)} with ID ${id} not found`);
      }

      // Post-process to add default creator name when creator is null
      if (await this.shouldIncludeCreator()) {
        if (!entity.creator) {
          entity.dataValues.creator = {
            id: null,
            full_name: 'Ludora',
            email: null
          };
        }
      }

      return entity;
    } catch (error) {
      throw error;
    }
  }

  // Count entities with query filtering
  async count(query = {}) {
    try {
      const Model = this.getModel();
      const where = this.buildWhereClause(query);

      return await Model.count({ where });
    } catch (error) {
      throw new Error(`Failed to count ${this.productType}: ${error.message}`);
    }
  }

  // Helper method to determine if this entity type should include creator
  async shouldIncludeCreator() {
    try {
      // Dynamic import to avoid circular dependencies
      const { PRODUCT_TYPES_WITH_CREATORS } = await import('../constants/productTypes.js');

      const entitiesWithCreators = PRODUCT_TYPES_WITH_CREATORS;
      // Exclude curriculum entities as they use teacher_user_id instead of creator_user_id
      return entitiesWithCreators.includes(this.productType) &&
             !['curriculum', 'curriculumitem'].includes(this.productType);
    } catch (error) {
      // Fallback: assume product types with creators
      const defaultProductTypesWithCreators = ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle'];
      return defaultProductTypesWithCreators.includes(this.productType) &&
             !['curriculum', 'curriculumitem'].includes(this.productType);
    }
  }

  // Helper method to extract S3 key from URL (shared across services)
  extractS3KeyFromUrl(fileUrl) {
    if (!fileUrl) return null;

    // If it's already just an S3 key (doesn't start with http), return as-is
    if (!fileUrl.startsWith('http')) {
      return fileUrl;
    }

    try {
      // Parse full S3 URL to extract the key
      const url = new URL(fileUrl);

      // Handle different S3 URL formats:
      // Format 1: https://s3.amazonaws.com/bucket-name/path/file.ext
      // Format 2: https://bucket-name.s3.amazonaws.com/path/file.ext
      // Format 3: https://bucket-name.s3.region.amazonaws.com/path/file.ext

      let s3Key = null;

      if (url.hostname === 's3.amazonaws.com') {
        // Format 1: Remove leading slash and bucket name
        const pathParts = url.pathname.split('/').filter(part => part);
        if (pathParts.length > 1) {
          s3Key = pathParts.slice(1).join('/'); // Skip bucket name, join rest
        }
      } else if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
        // Format 2 & 3: Path is the S3 key (minus leading slash)
        s3Key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      }

      return s3Key;
    } catch (error) {
      return null;
    }
  }

  // Subclasses should override these methods for domain-specific logic

  // Create entity - override in subclasses for type-specific logic
  async create(data, createdBy = null) {
    throw new Error(`create() method must be implemented by ${this.constructor.name} subclass`);
  }

  // Update entity - override in subclasses for type-specific logic
  async update(id, data, updatedBy = null) {
    throw new Error(`update() method must be implemented by ${this.constructor.name} subclass`);
  }

  // Delete entity - override in subclasses for type-specific cleanup
  async delete(id) {
    throw new Error(`delete() method must be implemented by ${this.constructor.name} subclass`);
  }

  // Bulk create - override in subclasses if needed
  async bulkCreate(dataArray, createdBy = null) {
    throw new Error(`bulkCreate() method must be implemented by ${this.constructor.name} subclass`);
  }

  // Bulk delete - override in subclasses for type-specific cleanup
  async bulkDelete(ids) {
    throw new Error(`bulkDelete() method must be implemented by ${this.constructor.name} subclass`);
  }
}

export default BaseProductService;