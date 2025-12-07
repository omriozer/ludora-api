import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { Op } from 'sequelize';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { ludlog } from '../lib/ludlog.js';

/**
 * EntityService - Handles CRUD operations for non-product entities
 *
 * This service has been refactored to focus only on non-product entities
 * such as User, Purchase, Subscription, Settings, etc.
 *
 * Product entities (file, game, bundle, lesson_plan, workshop, course, tool)
 * are now handled by domain-specific services via ProductServiceRouter.
 */
class EntityService {
  constructor() {
    // Don't import models in constructor - lazy load when needed
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
  getModel(entityType) {
    // Convert to PascalCase to match model names
    const modelName = this.toPascalCase(entityType);
    const model = this.models[modelName];

    if (!model) {
      throw new BadRequestError(`Invalid entity type: ${entityType}`, {
        entityType,
        availableTypes: this.getAvailableEntityTypes()
      });
    }

    return model;
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

  // Convert string to PascalCase with special mappings for compound words
  toPascalCase(str) {
    // Special mappings for compound words that don't follow standard camelCase
    const specialMappings = {
      'emailtemplate': 'EmailTemplate',
      'emaillog': 'EmailLog',
      'supportmessage': 'SupportMessage',
      'audiofile': 'AudioFile',
      'subscriptionplan': 'SubscriptionPlan',
      'subscriptionhistory': 'SubscriptionHistory',
      'subscriptionpurchase': 'SubscriptionPurchase',
      'gamesession': 'GameSession',
      'gamelobby': 'GameLobby',
      'contenttopic': 'ContentTopic',
      'studentinvitation': 'StudentInvitation',
      'classroommembership': 'ClassroomMembership',
      'curriculumitem': 'CurriculumItem',
      'curriculumproduct': 'CurriculumProduct',
      'refreshtoken': 'RefreshToken',
      'usersession': 'UserSession',
      'paymentmethod': 'PaymentMethod',
      'webhooklog': 'WebhookLog',
      'systemtemplate': 'SystemTemplate',
      'parentconsent': 'ParentConsent'
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

  // Find entities with query filtering
  async find(entityType, query = {}, options = {}) {
    try {
      const Model = this.getModel(entityType);

      // Extract special parameters from query
      const { sort, include, ...whereQuery } = query;

      // Build where clause from query parameters (excluding special params)
      const where = this.buildWhereClause(whereQuery, entityType);

      // Handle special product_id filtering for curriculum entities
      if (where._productIdFilter && ['curriculum', 'curriculumitem'].includes(entityType?.toLowerCase())) {
        const productId = where._productIdFilter;
        delete where._productIdFilter; // Remove the special marker

        if (entityType.toLowerCase() === 'curriculum') {
          // For curriculum, find curricula that have curriculum items linked to this product
          where.id = {
            [Op.in]: this.models.sequelize.literal(`(
              SELECT DISTINCT c.id
              FROM curriculum c
              JOIN curriculum_item ci ON ci.curriculum_id = c.id
              JOIN curriculum_product cp ON cp.curriculum_item_id = ci.id
              WHERE cp.product_id = '${productId}'
            )`)
          };
        } else if (entityType.toLowerCase() === 'curriculumitem') {
          // For curriculumitem, find curriculum items linked to this product
          where.id = {
            [Op.in]: this.models.sequelize.literal(`(
              SELECT DISTINCT ci.id
              FROM curriculum_item ci
              JOIN curriculum_product cp ON cp.curriculum_item_id = ci.id
              WHERE cp.product_id = '${productId}'
            )`)
          };
        }
      }

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
      return results;
    } catch (error) {
      throw new Error(`Failed to find ${entityType}: ${error.message}`);
    }
  }

  // Find single entity by ID
  async findById(entityType, id, include = null) {
    try {
      const Model = this.getModel(entityType);

      // Build query options
      const queryOptions = { where: { id } };

      const entity = await Model.findOne(queryOptions);

      if (!entity) {
        throw new NotFoundError(`${this.toPascalCase(entityType)} with ID ${id} not found`);
      }

      return entity;
    } catch (error) {
      throw error;
    }
  }

  // Create new entity
  async create(entityType, data, createdBy = null) {
    try {
      const Model = this.getModel(entityType);

      // Generate ID if not provided
      if (!data.id) {
        data.id = generateId();
      }

      // Handle Purchase-specific duplicate prevention
      if (entityType === 'purchase') {
        return await this.createPurchaseWithDuplicateCheck(data);
      }

      // Add audit fields
      const entityData = {
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      };

      const entity = await Model.create(entityData);
      return entity;
    } catch (error) {
      throw new Error(`Failed to create ${entityType}: ${error.message}`);
    }
  }

  // Update entity
  async update(entityType, id, data, updatedBy = null) {
    try {
      const Model = this.getModel(entityType);

      // Find existing entity
      const entity = await Model.findByPk(id);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Prepare update data
      const updateData = {
        ...data,
        updated_at: new Date(),
        ...(updatedBy && { updated_by: updatedBy })
      };

      // Don't allow updating certain fields
      delete updateData.id;
      delete updateData.created_at;

      await entity.update(updateData);
      return entity;
    } catch (error) {
      throw error;
    }
  }

  // Delete entity
  async delete(entityType, id) {
    try {
      const Model = this.getModel(entityType);

      const entity = await Model.findByPk(id);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      await entity.destroy();
      return { id, deleted: true };
    } catch (error) {
      throw error;
    }
  }

  // Bulk operations
  async bulkCreate(entityType, dataArray, createdBy = null) {
    try {
      const Model = this.getModel(entityType);

      const entities = dataArray.map(data => ({
        ...data,
        id: data.id || generateId(),
        created_at: new Date(),
        updated_at: new Date()
      }));

      const results = await Model.bulkCreate(entities);
      return results;
    } catch (error) {
      throw new Error(`Failed to bulk create ${entityType}: ${error.message}`);
    }
  }

  async bulkDelete(entityType, ids) {
    const transaction = await this.models.sequelize.transaction();

    try {
      const Model = this.getModel(entityType);

      // Delete the entities
      const deletedCount = await Model.destroy({
        where: {
          id: {
            [Op.in]: ids
          }
        },
        transaction
      });

      await transaction.commit();

      return {
        deletedCount,
        ids: ids.slice(0, deletedCount)
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to bulk delete ${entityType}: ${error.message}`);
    }
  }

  // Get searchable fields for each entity type
  getSearchFields(entityType) {
    const searchFieldMap = {
      'user': ['full_name', 'email', 'display_name'],
      'purchase': ['transaction_id'],
      'subscription': ['status'],
      'settings': ['key', 'value'],
      'category': ['name', 'description'],
      'classroom': ['name', 'description'],
      'curriculum': ['name', 'description'],
      'emailtemplate': ['name', 'subject'],
      'logs': ['message'],
    };

    return searchFieldMap[entityType.toLowerCase()] || ['name', 'title', 'description'];
  }

  // Build where clause from query parameters
  buildWhereClause(query, entityType = null) {
    const where = {};

    Object.entries(query).forEach(([key, value]) => {
      // Skip special parameters that are handled separately
      if (["limit", "offset", "order", "sort", "include"].includes(key)) {
        return;
      }

      // Special handling for entities with product_id filtering
      if (key === 'product_id') {
        if (['curriculum', 'curriculumitem'].includes(entityType?.toLowerCase())) {
          // For curriculum entities, product_id relationships exist through CurriculumProduct junction table
          // Store this for special handling in the find method
          where._productIdFilter = value;
          return;
        } else if (entityType?.toLowerCase() === 'purchase') {
          // For purchase entity, product_id should map to purchasable_id
          where.purchasable_id = value;
          return;
        } else if (entityType?.toLowerCase() === 'emaillog') {
          // For emaillog entity, product_id should map to related_product_id
          where.related_product_id = value;
          return;
        } else if (entityType?.toLowerCase() === 'coupon') {
          // For coupon entity, product_id should search in target_product_ids JSONB array
          where.target_product_ids = {
            [Op.contains]: [value]
          };
          return;
        }
      }

      // Handle special search parameter
      if (key === 'search') {
        // Skip empty search parameters
        if (!value || value.trim() === '') {
          return;
        }

        if (entityType) {
          const searchFields = this.getSearchFields(entityType);

          if (searchFields.length > 0) {
            where[Op.or] = searchFields.map(field => ({
              [field]: {
                [Op.iLike]: `%${value}%`
              }
            }));
          }
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

  // Get all available entity types (non-product entities only)
  getAvailableEntityTypes() {
    const allTypes = Object.keys(this.models);

    // Filter out product entity types that are handled by ProductServiceRouter
    const productEntityTypes = ['File', 'Game', 'LessonPlan', 'Workshop', 'Course', 'Tool'];

    return allTypes.filter(type => !productEntityTypes.includes(type));
  }

  // Count entities
  async count(entityType, query = {}) {
    try {
      const Model = this.getModel(entityType);
      const where = this.buildWhereClause(query, entityType);

      return await Model.count({ where });
    } catch (error) {
      throw new Error(`Failed to count ${entityType}: ${error.message}`);
    }
  }

  // Create Purchase with intelligent duplicate prevention
  async createPurchaseWithDuplicateCheck(data) {
    try {
      const PurchaseModel = this.getModel('purchase');

      // Only prevent rapid duplicate clicks (within last 30 seconds) for cart status
      // Allow multiple legitimate purchases of the same product
      if (data.buyer_user_id && data.purchasable_type && data.purchasable_id && data.payment_status === 'cart') {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

        const recentDuplicate = await PurchaseModel.findOne({
          where: {
            buyer_user_id: data.buyer_user_id,
            purchasable_type: data.purchasable_type,
            purchasable_id: data.purchasable_id,
            payment_status: 'cart',
            created_at: {
              [Op.gt]: thirtySecondsAgo
            }
          },
          order: [['created_at', 'DESC']]
        });

        if (recentDuplicate) {
          return recentDuplicate;
        }
      }

      // Generate ID if not provided
      if (!data.id) {
        data.id = generateId();
      }

      // Add audit fields
      const purchaseData = {
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      };

      const purchase = await PurchaseModel.create(purchaseData);
      return purchase;

    } catch (error) {
      throw new Error(`Failed to create purchase: ${error.message}`);
    }
  }

}

export default new EntityService();