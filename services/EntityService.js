import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { Op } from 'sequelize';
import { PRODUCT_TYPES_WITH_CREATORS, NORMALIZED_PRODUCT_TYPES } from '../constants/productTypes.js';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import fileService from './FileService.js';

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
  // Force restart

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

  // Helper method to extract S3 key from URL
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
      'lessonplan': 'LessonPlan'
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

  // Handle entity includes for specific entity types
  handleEntityIncludes(entityType, include, queryOptions) {
    const includeValue = Array.isArray(include) ? include : [include];



    return false; // Include parameter not handled
  }

  // Find entities with query filtering
  async find(entityType, query = {}, options = {}) {
    try {
      const Model = this.getModel(entityType);

      // Extract special parameters from query
      const { sort, include, ...whereQuery } = query;

      // Build where clause from query parameters (excluding special params)
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

      // Handle include parameter for entity associations
      if (include && this.handleEntityIncludes(entityType, include, queryOptions)) {
        // Include was handled by handleEntityIncludes
      }

      // Include creator information for entities that have creator relationships
      const entitiesWithCreators = PRODUCT_TYPES_WITH_CREATORS;
      // Exclude curriculum entities as they use teacher_user_id instead of creator_user_id
      if (entitiesWithCreators.includes(entityType) && !['curriculum', 'curriculumitem'].includes(entityType)) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }

        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        });

        // Include ContentTopic for products that have content topic associations
        if (entityType === 'product') {
          queryOptions.include.push({
            model: this.models.ContentTopic,
            as: 'contentTopic',
            attributes: ['id', 'name', 'description'],
            required: false // LEFT JOIN to include products even without content topics
          });
        }

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
      if (entitiesWithCreators.includes(entityType) && !['curriculum', 'curriculumitem'].includes(entityType)) {
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
      throw new Error(`Failed to find ${entityType}: ${error.message}`);
    }
  }

  // Find single entity by ID
  async findById(entityType, id, include = null) {
    if (entityType === 'game') {
      return await this.findGameById(id);
    }


    try {
      const Model = this.getModel(entityType);

      // Build query options with creator include for entities that have creators
      const queryOptions = { where: { id } };
      const entitiesWithCreators = PRODUCT_TYPES_WITH_CREATORS;

      // Handle include parameter for entity associations
      if (include && this.handleEntityIncludes(entityType, include, queryOptions)) {
        // Include was handled by handleEntityIncludes
      }

      // Exclude curriculum entities as they use teacher_user_id instead of creator_user_id
      if (entitiesWithCreators.includes(entityType) && !['curriculum', 'curriculumitem'].includes(entityType)) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }
        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include entities even without creators
        });

        // Include ContentTopic for products that have content topic associations
        if (entityType === 'product') {
          queryOptions.include.push({
            model: this.models.ContentTopic,
            as: 'contentTopic',
            attributes: ['id', 'name', 'description'],
            required: false // LEFT JOIN to include products even without content topics
          });
        }
      }

      const entity = await Model.findOne(queryOptions);

      if (!entity) {
        throw new NotFoundError(`${this.toPascalCase(entityType)} with ID ${id} not found`);
      }

      // Post-process to add default creator name when creator is null
      if (entitiesWithCreators.includes(entityType) && !['curriculum', 'curriculumitem'].includes(entityType)) {
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
        // Only Product and Game entities should have creator_user_id
        ...(createdBy && (entityType === 'product' || entityType === 'game') && { creator_user_id: createdBy })
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

      // Handle game-specific logic
      if (entityType === 'game') {
        return await this.updateGame(id, data, updatedBy);
      }

      // Handle normalized product types - need to update both Product and Entity
      if (NORMALIZED_PRODUCT_TYPES.includes(entityType)) {
        return await this.updateProductTypeEntity(entityType, id, data, updatedBy);
      }

      // Special handling for Product updates that reference normalized entities
      if (entityType === 'product') {
        // Find the product to check its type
        const product = await Model.findByPk(id);
        if (!product) {
          throw new Error('Product not found');
        }

        // If this product references a normalized entity type, route to updateProductTypeEntity
        if (NORMALIZED_PRODUCT_TYPES.includes(product.product_type)) {
          return await this.updateProductTypeEntity(product.product_type, product.entity_id, data, updatedBy);
        }
        // Otherwise, fall through to regular product update
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
      // Note: creator_user_id is allowed to be updated for admin users (handled in routes)


      await entity.update(updateData);
      return entity;
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
        updated_at: new Date(),
        // Only Product and Game entities should have creator_user_id
        ...(createdBy && (entityType === 'product' || entityType === 'game') && { creator_user_id: createdBy })
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

      // Handle File entity S3 cleanup before database deletion
      if (entityType === 'file') {
        // Import cleanup function
        const { deleteAllFileAssets } = await import('../routes/assets.js');

        // Clean up S3 assets for each file
        for (const fileId of ids) {
          try {
            await deleteAllFileAssets(fileId);
          } catch (cleanupError) {
            // Continue with other files even if one cleanup fails
          }
        }
      }

      // Handle marketing video cleanup for Workshop, Course, Game, Tool entities
      if (['workshop', 'course', 'game', 'tool'].includes(entityType)) {
        for (const entityId of ids) {
          try {
            const marketingVideoKey = constructS3Path(entityType, entityId, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            // Marketing video might not exist, which is okay
            // Continue with other entities even if one video cleanup fails
          }
        }
      }

      // Handle AudioFile S3 cleanup for bulk delete
      if (entityType === 'audiofile') {
        // Get all audio file entities first to extract their file_urls
        const audioFiles = await Model.findAll({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          attributes: ['id', 'file_url'],
          transaction
        });

        for (const audioFile of audioFiles) {
          try {
            if (audioFile.file_url) {
              // Extract S3 key from file_url (could be full URL or just the key)
              const s3Key = this.extractS3KeyFromUrl(audioFile.file_url);
              if (s3Key) {
                await fileService.deleteS3Object(s3Key);
              }
            }
          } catch (audioError) {
            // Audio file might not exist in S3, which is okay
            // Continue with other audio files even if one cleanup fails
          }
        }
      }

      // Handle LessonPlan file cascade cleanup for bulk delete
      if (entityType === 'lesson_plan') {
        // Get all lesson plan entities first to extract their file_configs
        const lessonPlans = await Model.findAll({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          attributes: ['id', 'file_configs'],
          transaction
        });

        const allFileIds = new Set(); // Use Set to avoid duplicates across lesson plans

        // Collect all file IDs from all lesson plans
        for (const lessonPlan of lessonPlans) {
          const fileConfigs = lessonPlan.file_configs || {};
          const files = fileConfigs.files || [];
          const fileIds = files.map(file => file.file_id).filter(Boolean);
          fileIds.forEach(fileId => allFileIds.add(fileId));
        }

        if (allFileIds.size > 0) {

          // Delete each referenced File entity (this will trigger their S3 cleanup)
          for (const fileId of allFileIds) {
            try {
              const FileModel = this.getModel('file');
              const fileEntity = await FileModel.findByPk(fileId, { transaction });

              if (fileEntity) {
                // Delete File entity's S3 assets first
                const { deleteAllFileAssets } = await import('../routes/assets.js');
                await deleteAllFileAssets(fileId);

                // Then delete the File entity
                await fileEntity.destroy({ transaction });
              }
            } catch (fileError) {
              // Continue with other files even if one fails
            }
          }
        }
      }

      // Handle normalized product types - delete associated products
      if (NORMALIZED_PRODUCT_TYPES.includes(entityType)) {
        // Delete products that reference these entities
        await this.models.Product.destroy({
          where: {
            product_type: entityType,
            entity_id: {
              [Op.in]: ids
            }
          },
          transaction
        });
      }

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
      'word': ['word', 'vocalized', 'context'],
      'worden': ['word'],
      'wordEn': ['word'],
      'wordEN': ['word'],
      'qa': ['question_text'],
      'contentlist': ['name', 'description'],
      'image': ['name', 'description'],
      'attribute': ['type', 'value'],
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
    const availableTypes = Object.keys(this.models);
    return availableTypes;
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

        // Skip type settings creation for drafts or if method doesn't exist
        if (typeof game.createTypeSettings === 'function') {
          try {
            await game.createTypeSettings(typeSettings);
          } catch (typeError) {
            // Continue without type settings for drafts
          }
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
          // Rollback error - transaction may already be rolled back
        }
      }
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
        id: generateId(), // Generate unique ID for the entity
        created_at: new Date(),
        updated_at: new Date()
      };

      // Sanitize numeric fields for lesson_plan - convert empty strings to null
      if (entityType === 'lesson_plan') {
        const numericFields = ['estimated_duration', 'total_slides'];
        numericFields.forEach(field => {
          if (entityFields[field] === '' || entityFields[field] === undefined) {
            entityFields[field] = null;
          } else if (entityFields[field] !== null && !isNaN(entityFields[field])) {
            entityFields[field] = parseInt(entityFields[field]);
          }
        });
      }

      // Remove fields that are definitely Product-only and don't belong in entity tables
      const productOnlyFields = ['product_type', 'is_sample', 'is_published', 'price', 'category', 'image_url', 'has_image', 'image_filename', 'youtube_video_id', 'youtube_video_title', 'tags', 'target_audience', 'access_days'];
      productOnlyFields.forEach(field => delete entityFields[field]);

      // For specific entity types, remove fields that they don't have in their schema
      if (entityType === 'workshop') {
        // Workshop doesn't have title, it uses workshop-specific fields
        delete entityFields.title;
      } else if (entityType === 'course') {
        // Course doesn't have title in the same way
        delete entityFields.title;
      } else if (entityType === 'game') {
        // Game doesn't have these Product-level fields
        delete entityFields.title;
        delete entityFields.description;
        delete entityFields.short_description;
        delete entityFields.image_is_private;
        delete entityFields.subject;
        delete entityFields.skills;
        delete entityFields.age_range;
        delete entityFields.grade_range;
        delete entityFields.estimated_duration;
      }
      // File keeps title, description, and other shared fields since File model has them

      // Create the type-specific entity first
      const entity = await EntityModel.create(entityFields, { transaction });

      // Extract fields that belong to the Product table
      const productFields = {
        id: data.id || generateId(), // Use provided ID or generate new one
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
        access_days: parseInt(data.access_days) ? parseInt(data.access_days) : null,
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
      throw new Error(`Failed to create ${entityType}: ${error.message}`);
    }
  }

  // Update product-type entities with proper Product + Entity handling
  async updateProductTypeEntity(entityType, entityId, data, updatedBy = null) {
    const transaction = await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel(entityType);

      // Find existing entity
      const entity = await EntityModel.findByPk(entityId, { transaction });
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Find the product that references this entity
      const product = await this.models.Product.findOne({
        where: {
          product_type: entityType,
          entity_id: entityId
        },
        transaction
      });

      if (!product) {
        throw new Error(`Product not found for ${entityType} ${entityId}`);
      }

      // Separate fields that belong to Product vs Entity
      const productFields = {
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        price: data.price,
        is_published: data.is_published,
        image_url: data.image_url,
        has_image: data.has_image,
        image_filename: data.image_filename,
        marketing_video_type: data.marketing_video_type,
        marketing_video_id: data.marketing_video_id,
        marketing_video_title: data.marketing_video_title,
        marketing_video_duration: data.marketing_video_duration,
        tags: data.tags,
        target_audience: data.target_audience,
        type_attributes: data.type_attributes,
        access_days: parseInt(data.access_days) ? parseInt(data.access_days) : null,
        content_topic_id: data.content_topic_id,
        creator_user_id: data.creator_user_id,
        updated_at: new Date(),
        ...(updatedBy && { updated_by: updatedBy })
      };


      // Remove undefined fields from product update
      Object.keys(productFields).forEach(key => {
        if (productFields[key] === undefined) {
          delete productFields[key];
        }
      });

      // Don't allow updating certain Product fields
      delete productFields.id;
      delete productFields.created_at;
      delete productFields.product_type;
      delete productFields.entity_id;

      // Prepare entity update data (everything except Product fields)
      const entityFields = { ...data };
      const productOnlyFields = [
        'title', 'short_description', 'description', 'category', 'product_type',
        'price', 'is_published', 'image_url', 'has_image', 'image_filename',
        'marketing_video_type', 'marketing_video_id', 'marketing_video_title', 'marketing_video_duration',
        'tags', 'target_audience', 'type_attributes', 'access_days', 'content_topic_id', 'creator_user_id'
      ];

      productOnlyFields.forEach(field => delete entityFields[field]);

      // Sanitize numeric fields for lesson_plan - convert empty strings to null
      if (entityType === 'lesson_plan') {
        const numericFields = ['estimated_duration', 'total_slides'];
        numericFields.forEach(field => {
          if (entityFields[field] === '' || entityFields[field] === undefined) {
            entityFields[field] = null;
          } else if (entityFields[field] !== null && !isNaN(entityFields[field])) {
            entityFields[field] = parseInt(entityFields[field]);
          }
        });
      }

      entityFields.updated_at = new Date();
      if (updatedBy) entityFields.updated_by = updatedBy;

      // Don't allow updating certain entity fields
      delete entityFields.id;
      delete entityFields.created_at;


      // Update both Product and Entity
      await product.update(productFields, { transaction });

      // Update entity
      await entity.update(entityFields, { transaction });

      await transaction.commit();

      // Return combined result
      return {
        ...product.toJSON(),
        [entityType]: entity.toJSON()
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
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
            await deleteAllFileAssets(id);
          } catch (fileError) {
            // Continue with deletion even if file cleanup fails
          }
        }

        // Handle marketing video cleanup for Workshop, Course, Game, Tool entities
        if (['workshop', 'course', 'game', 'tool'].includes(entityType)) {
          try {
            const marketingVideoKey = constructS3Path(entityType, id, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            // Marketing video might not exist, which is okay
          }
        }

        // Handle AudioFile S3 cleanup
        if (entityType === 'audiofile') {
          try {
            // Get the audio file entity to extract S3 key from file_url
            if (entity.file_url) {
              // Extract S3 key from file_url (could be full URL or just the key)
              const s3Key = this.extractS3KeyFromUrl(entity.file_url);
              if (s3Key) {
                await fileService.deleteS3Object(s3Key);
              }
            }
          } catch (audioError) {
            // Audio file might not exist in S3, which is okay
          }
        }

        // Handle LessonPlan file cascade cleanup
        if (entityType === 'lesson_plan') {
          try {
            // Get all file IDs referenced in the lesson plan's file_configs
            const fileConfigs = entity.file_configs || {};
            const files = fileConfigs.files || [];
            const fileIds = files.map(file => file.file_id).filter(Boolean);

            if (fileIds.length > 0) {

              // Delete each referenced File entity (this will trigger their S3 cleanup)
              for (const fileId of fileIds) {
                try {
                  const FileModel = this.getModel('file');
                  const fileEntity = await FileModel.findByPk(fileId, { transaction });

                  if (fileEntity) {
                    // Delete File entity's S3 assets first
                    const { deleteAllFileAssets } = await import('../routes/assets.js');
                    await deleteAllFileAssets(fileId);

                    // Then delete the File entity
                    await fileEntity.destroy({ transaction });
                  }
                } catch (fileError) {
                  // Continue with other files even if one fails
                }
              }
            }
          } catch (lessonPlanError) {
            // Continue with entity deletion even if file cleanup fails
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
          await deleteFileFromStorage(id, entity.creator_user_id);
        } catch (fileError) {
          // Continue with entity deletion even if file storage cleanup fails
        }
      }

      await entity.destroy();
      return { id, deleted: true };
    } catch (error) {
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