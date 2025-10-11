import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { Op } from 'sequelize';
import { PRODUCT_TYPES_WITH_CREATORS, NORMALIZED_PRODUCT_TYPES } from '../constants/productTypes.js';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';

class EntityService {
  constructor() {
    this.models = models;
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
      console.warn('Error processing sort parameter:', error);
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
      'gameaudiosettings': 'GameAudioSettings',
      'worden': 'WordEN',
      'qa': 'QA',
      'contentlist': 'ContentList',
      'contentrelationship': 'ContentRelationship',
      'subscriptionplan': 'SubscriptionPlan',
      'webhooklog': 'WebhookLog',
      'pendingsubscription': 'PendingSubscription',
      'subscriptionhistory': 'SubscriptionHistory',
      'gamesession': 'GameSession',
      'gamecontenttag': 'GameContentTag',
      'contenttag': 'ContentTag',
      'studentinvitation': 'StudentInvitation',
      'parentconsent': 'ParentConsent',
      'classroommembership': 'ClassroomMembership'
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

      // Extract sort parameter from query if it exists
      const { sort, ...whereQuery } = query;

      // Build where clause from query parameters (excluding sort)
      const where = this.buildWhereClause(whereQuery, entityType);

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
      
      // Include creator information for entities that have creator relationships
      const entitiesWithCreators = PRODUCT_TYPES_WITH_CREATORS;
      if (entitiesWithCreators.includes(entityType)) {
        queryOptions.include = [{
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        }];

        // Product entities use polymorphic associations via entity_id + product_type
        // No direct associations to include here

        // For specific entity types, we don't include product data here anymore
        // Product references entities via polymorphic association
        // Use separate methods to get product data when needed
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
      if (entitiesWithCreators.includes(entityType)) {
        results.forEach(entity => {
          // Show 'Ludora' as creator when:
          // 1. creator_user_id exists but user lookup failed
          // 2. creator_user_id is NULL (system/Ludora product)
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
      console.error(`Error finding ${entityType}:`, error);
      throw new Error(`Failed to find ${entityType}: ${error.message}`);
    }
  }

  // Find single entity by ID
  async findById(entityType, id) {
    if (entityType === 'game') {
      return await this.findGameById(id);
    }

    try {
      const Model = this.getModel(entityType);

      // Build query options with creator include for entities that have creators
      const queryOptions = { where: { id } };
      const entitiesWithCreators = PRODUCT_TYPES_WITH_CREATORS;

      if (entitiesWithCreators.includes(entityType)) {
        queryOptions.include = [{
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        }];
      }

      const entity = await Model.findOne(queryOptions);

      if (!entity) {
        throw new NotFoundError(`${this.toPascalCase(entityType)} with ID ${id} not found`);
      }

      // Post-process to add default creator name when creator is null
      if (entitiesWithCreators.includes(entityType)) {
        // Show 'Ludora' as creator when:
        // 1. creator_user_id exists but user lookup failed
        // 2. creator_user_id is NULL (system/Ludora product)
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
      console.error(`Error finding ${entityType} by ID:`, error);
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

      // Handle game-specific logic
      if (entityType === 'game') {
        return await this.createGame(data, createdBy);
      }

      // Handle normalized product structure
      if (NORMALIZED_PRODUCT_TYPES.includes(entityType)) {
        return await this.createProductTypeEntity(entityType, data, createdBy);
      }

      // Handle Purchase-specific duplicate prevention
      if (entityType === 'purchase') {
        return await this.createPurchaseWithDuplicateCheck(data);
      }

      // Add audit fields
      const entityData = {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
        // All entities now use creator_user_id standardized field
        ...(createdBy && { creator_user_id: createdBy })
      };

      const entity = await Model.create(entityData);
      return entity;
    } catch (error) {
      console.error(`Error creating ${entityType}:`, error);
      throw new Error(`Failed to create ${entityType}: ${error.message}`);
    }
  }

  // Update entity
  async update(entityType, id, data, updatedBy = null) {
    try {
      const Model = this.getModel(entityType);

      // Handle game-specific logic
      if (entityType === 'game') {
        return await this.updateGame(id, data, updatedBy);
      }

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
      // Remove creator field from update data (shouldn't be changed)
      delete updateData.creator_user_id;

      console.log(`📝 EntityService updating ${entityType} with data:`, updateData);
      console.log('📝 Video fields in EntityService:', {
        marketing_video_type: updateData.marketing_video_type,
        marketing_video_id: updateData.marketing_video_id,
        marketing_video_title: updateData.marketing_video_title,
        marketing_video_duration: updateData.marketing_video_duration,
        video_file_url: updateData.video_file_url
      });

      // Debug logging for product update issues
      if (entityType === 'product') {
        console.log('🔍 EntityService Product update debug:');
        console.log('   updateData.short_description:', updateData.short_description);
        console.log('   updateData.is_published:', updateData.is_published);
        console.log('   updateData.tags:', updateData.tags);
      }

      await entity.update(updateData);
      return entity;
    } catch (error) {
      console.error(`Error updating ${entityType}:`, error);
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
        updated_at: new Date(),
        // All entities now use creator_user_id standardized field
        ...(createdBy && { creator_user_id: createdBy })
      }));

      const results = await Model.bulkCreate(entities);
      return results;
    } catch (error) {
      console.error(`Error bulk creating ${entityType}:`, error);
      throw new Error(`Failed to bulk create ${entityType}: ${error.message}`);
    }
  }

  async bulkDelete(entityType, ids) {
    try {
      const Model = this.getModel(entityType);
      
      const deletedCount = await Model.destroy({
        where: {
          id: {
            [Op.in]: ids
          }
        }
      });

      return {
        deletedCount,
        ids: ids.slice(0, deletedCount)
      };
    } catch (error) {
      console.error(`Error bulk deleting ${entityType}:`, error);
      throw new Error(`Failed to bulk delete ${entityType}: ${error.message}`);
    }
  }

  // Get searchable fields for each entity type
  getSearchFields(entityType) {
    const searchFieldMap = {
      'word': ['word', 'vocalized', 'context'],
      'worden': ['word'],
      'wordEn': ['word'],
      'wordEN': ['word'],
      'qa': ['question_text'],
      'contentlist': ['name', 'description'],
      'image': ['name', 'description'],
      'attribute': ['type', 'value']
    };

    return searchFieldMap[entityType.toLowerCase()] || ['name', 'title', 'description'];
  }

  // Build where clause from query parameters
  buildWhereClause(query, entityType = null) {
    const where = {};

    Object.entries(query).forEach(([key, value]) => {
      // Skip pagination parameters
      if (["limit", "offset", "order"].includes(key)) {
        return;
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

  // Get all available entity types
  getAvailableEntityTypes() {
    return Object.keys(this.models);
  }

  // Count entities
  async count(entityType, query = {}) {
    try {
      const Model = this.getModel(entityType);
      const where = this.buildWhereClause(query, entityType);

      return await Model.count({ where });
    } catch (error) {
      console.error(`Error counting ${entityType}:`, error);
      throw new Error(`Failed to count ${entityType}: ${error.message}`);
    }
  }

  // Game-specific create method
  async createGame(data, createdBy = null) {
    const transaction = await this.models.sequelize.transaction();
    let isCommitted = false;

    try {
      const GameModel = this.getModel('game');

      // Extract game-type-specific settings
      const {
        scatter_settings,
        memory_settings,
        wisdom_maze_settings,
        ...gameData
      } = data;

      // Add audit fields to game data
      const entityData = {
        ...gameData,
        created_at: new Date(),
        updated_at: new Date(),
        creator_user_id: createdBy
      };

      // Create the main game record
      const game = await GameModel.create(entityData, { transaction });

      // Create game-type-specific settings if provided
      if (game.game_type && data[`${game.game_type.replace('_game', '')}_settings`]) {
        const typeSettings = data[`${game.game_type.replace('_game', '')}_settings`];
        console.log(`Attempting to create ${game.game_type} settings:`, typeSettings);

        // Skip type settings creation for drafts or if method doesn't exist
        if (typeof game.createTypeSettings === 'function') {
          try {
            await game.createTypeSettings(typeSettings);
          } catch (typeError) {
            console.warn(`Failed to create type settings, continuing without them:`, typeError.message);
            // Continue without type settings for drafts
          }
        } else {
          console.log('createTypeSettings method not found, skipping type settings');
        }
      }

      await transaction.commit();
      isCommitted = true;

      // Return the created game directly (avoid complex queries after transaction)
      return game;
    } catch (error) {
      // Only rollback if transaction hasn't been committed
      if (!isCommitted) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
      console.error('Error creating game:', error);
      throw new Error(`Failed to create game: ${error.message}`);
    }
  }

  // Game-specific update method
  async updateGame(id, data, updatedBy = null) {
    const transaction = await this.models.sequelize.transaction();

    try {
      const GameModel = this.getModel('game');

      // Find existing game
      const game = await GameModel.findByPk(id, { transaction });
      if (!game) {
        throw new Error('Game not found');
      }

      // Extract game-type-specific settings
      const {
        scatter_settings,
        memory_settings,
        wisdom_maze_settings,
        ...gameData
      } = data;

      // Prepare update data for main game record
      const updateData = {
        ...gameData,
        updated_at: new Date(),
        ...(updatedBy && { updated_by: updatedBy })
      };

      // Don't allow updating certain fields
      delete updateData.id;
      delete updateData.created_at;
      // Remove creator field from update data (shouldn't be changed)
      delete updateData.creator_user_id;

      // Update main game record
      await game.update(updateData, { transaction });

      // Update game-type-specific settings if provided
      if (game.game_type) {
        const settingsKey = `${game.game_type.replace('_game', '')}_settings`;
        if (data[settingsKey]) {
          await game.updateTypeSettings(data[settingsKey]);
        }
      }

      await transaction.commit();

      // Return updated game with type settings
      return await this.findById('game', id);
    } catch (error) {
      await transaction.rollback();
      console.error('Error updating game:', error);
      throw error;
    }
  }

  // Enhanced findById for games - temporarily disabled includes due to schema mismatch
  async findGameById(id) {
    try {
      const GameModel = this.getModel('game');

      // Temporarily disable includes until schema is fixed
      const game = await GameModel.findByPk(id);

      if (!game) {
        throw new Error('Game not found');
      }

      return game;
    } catch (error) {
      console.error('Error finding game by ID:', error);
      throw error;
    }
  }

  // Create product-type entities with proper Product relationship
  async createProductTypeEntity(entityType, data, createdBy = null) {
    const transaction = await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel(entityType);

      // Prepare the type-specific data (entity record)
      const entityFields = {
        ...data,
        creator_user_id: createdBy,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Remove fields that are definitely Product-only and don't belong in entity tables
      const productOnlyFields = ['product_type', 'is_sample', 'is_published', 'price', 'category', 'image_url', 'youtube_video_id', 'youtube_video_title', 'tags', 'target_audience', 'access_days'];
      productOnlyFields.forEach(field => delete entityFields[field]);

      // For specific entity types, remove fields that they don't have in their schema
      if (entityType === 'workshop') {
        // Workshop doesn't have title, it uses workshop-specific fields
        delete entityFields.title;
      } else if (entityType === 'course') {
        // Course doesn't have title in the same way
        delete entityFields.title;
      } else if (entityType === 'tool') {
        // Tool doesn't have title field
        delete entityFields.title;
      } else if (entityType === 'game') {
        // Game doesn't have title field
        delete entityFields.title;
      }
      // File keeps title, description, and other shared fields since File model has them

      // Create the type-specific entity first
      const entity = await EntityModel.create(entityFields, { transaction });

      // Extract fields that belong to the Product table
      const productFields = {
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        product_type: entityType,
        entity_id: entity.id, // Reference to the entity
        price: data.price || 0,
        is_published: data.is_published || false,
        image_url: data.image_url,
        youtube_video_id: data.youtube_video_id,
        youtube_video_title: data.youtube_video_title,
        tags: data.tags || [],
        target_audience: data.target_audience,
        access_days: data.access_days,
        is_sample: data.is_sample || false,
        creator_user_id: createdBy,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create the Product record with entity_id reference
      const product = await this.models.Product.create(productFields, { transaction });

      await transaction.commit();

      // Return combined data structure
      return {
        ...product.toJSON(),
        [entityType]: entity.toJSON()
      };

    } catch (error) {
      await transaction.rollback();
      console.error(`Error creating ${entityType} with product:`, error);
      throw new Error(`Failed to create ${entityType}: ${error.message}`);
    }
  }

  // Find entity with product data (polymorphic lookup)
  async findEntityWithProduct(entityType, entityId) {
    try {
      // Find the entity
      const EntityModel = this.getModel(entityType);
      const entity = await EntityModel.findByPk(entityId);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Find the product that references this entity
      const product = await this.models.Product.findOne({
        where: {
          product_type: entityType,
          entity_id: entityId
        }
      });

      if (!product) {
        // Entity exists but no product references it - return just the entity
        return entity.toJSON();
      }

      // Return combined structure
      return {
        ...product.toJSON(),
        [entityType]: entity.toJSON()
      };
    } catch (error) {
      console.error(`Error finding ${entityType} with product:`, error);
      throw error;
    }
  }

  // Delete product with cascade delete to entity
  async deleteProductWithEntity(productId) {
    const transaction = await this.models.sequelize.transaction();

    try {
      // Find the product
      const product = await this.models.Product.findByPk(productId, { transaction });
      if (!product) {
        throw new Error('Product not found');
      }

      const { product_type, entity_id } = product;

      // Delete the entity first
      const EntityModel = this.getModel(product_type);
      const entity = await EntityModel.findByPk(entity_id, { transaction });
      if (entity) {
        await entity.destroy({ transaction });
      }

      // Delete the product
      await product.destroy({ transaction });

      await transaction.commit();

      return { id: productId, deleted: true, entityDeleted: !!entity };
    } catch (error) {
      await transaction.rollback();
      console.error(`Error deleting product with cascade:`, error);
      throw error;
    }
  }

  // Override delete method to handle product cascade delete
  async delete(entityType, id) {
    // Check if this is a product deletion
    if (entityType === 'product') {
      return await this.deleteProductWithEntity(id);
    }

    // For entity deletion, also check if there's a product referencing it
    if (NORMALIZED_PRODUCT_TYPES.includes(entityType)) {
      const transaction = await this.models.sequelize.transaction();

      try {
        // Find entity
        const EntityModel = this.getModel(entityType);
        const entity = await EntityModel.findByPk(id, { transaction });
        if (!entity) {
          throw new Error(`${entityType} not found`);
        }

        // Find and delete any product referencing this entity
        const product = await this.models.Product.findOne({
          where: {
            product_type: entityType,
            entity_id: id
          },
          transaction
        });

        if (product) {
          await product.destroy({ transaction });
        }

        // Handle file cleanup for File entities before deletion
        if (entityType === 'file') {
          try {
            const { deleteAllFileAssets } = await import('../routes/assets.js');
            const result = await deleteAllFileAssets(id);
            console.log(`Successfully deleted file assets for entity ${id}:`, result);
          } catch (fileError) {
            console.error(`Error deleting file assets for entity ${id}:`, fileError);
          }
        }

        // Delete the entity
        await entity.destroy({ transaction });

        await transaction.commit();

        return { id, deleted: true, productDeleted: !!product };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    // For non-product entities, use original delete logic
    try {
      const Model = this.getModel(entityType);

      const entity = await Model.findByPk(id);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Handle file cleanup for File entities before deletion
      if (entityType === 'file') {
        try {
          const { deleteFileFromStorage } = await import('../routes/media.js');
          const fileDeleted = await deleteFileFromStorage(id, entity.creator_user_id);
          if (fileDeleted) {
            console.log(`Successfully deleted file storage for entity ${id}`);
          }
        } catch (fileError) {
          console.error(`Error deleting file storage for entity ${id}:`, fileError);
        }
      }

      await entity.destroy();
      return { id, deleted: true };
    } catch (error) {
      console.error(`Error deleting ${entityType}:`, error);
      throw error;
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
          console.log('🚫 Prevented rapid duplicate purchase (within 30s):', recentDuplicate.id);
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
      console.log('✅ Created new purchase:', purchase.id);
      return purchase;

    } catch (error) {
      console.error('Error creating purchase with duplicate check:', error);
      throw new Error(`Failed to create purchase: ${error.message}`);
    }
  }

}

export default new EntityService();