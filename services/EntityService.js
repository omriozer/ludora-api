import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { Op } from 'sequelize';
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
      'sitetext': 'SiteText',
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
      const entitiesWithCreators = ['product', 'workshop', 'course', 'file', 'tool'];
      if (entitiesWithCreators.includes(entityType)) {
        queryOptions.include = [{
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        }];
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
      const entity = await Model.findByPk(id);

      if (!entity) {
        throw new NotFoundError(`${this.toPascalCase(entityType)} with ID ${id} not found`);
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

      // Add audit fields
      const entityData = {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
        // For entities with creator_user_id field, use that instead of created_by
        ...(createdBy && ['product', 'workshop', 'course', 'file', 'tool'].includes(entityType)
          ? { creator_user_id: createdBy }
          : { created_by: createdBy, created_by_id: createdBy }
        )
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
      delete updateData.created_by;
      delete updateData.created_by_id;

      await entity.update(updateData);
      return entity;
    } catch (error) {
      console.error(`Error updating ${entityType}:`, error);
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

      // Handle file cleanup for File entities before deletion
      if (entityType === 'file') {
        try {
          // Import the file deletion helper from media routes
          const { deleteFileFromStorage } = await import('../routes/media.js');
          const fileDeleted = await deleteFileFromStorage(id, entity.creator_user_id);
          if (fileDeleted) {
            console.log(`Successfully deleted file storage for entity ${id}`);
          }
        } catch (fileError) {
          console.error(`Error deleting file storage for entity ${id}:`, fileError);
          // Don't fail the entity deletion if file cleanup fails
        }
      }

      await entity.destroy();
      return { id, deleted: true };
    } catch (error) {
      console.error(`Error deleting ${entityType}:`, error);
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
        // For entities with creator_user_id field, use that instead of created_by
        ...(createdBy && ['product', 'workshop', 'course', 'file', 'tool'].includes(entityType)
          ? { creator_user_id: createdBy } 
          : { created_by: createdBy, created_by_id: createdBy }
        )
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
      if (["is_published", "is_active", "is_lifetime_access"].includes(key)) {
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
        created_by: createdBy,
        created_by_id: createdBy
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
      delete updateData.created_by;
      delete updateData.created_by_id;

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

}

export default new EntityService();