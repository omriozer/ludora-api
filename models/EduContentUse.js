import { DataTypes, Op } from 'sequelize';
import { baseFields, baseOptions, generateId } from './baseModel.js';

export default function(sequelize) {
  const EduContentUse = sequelize.define('EduContentUse', {
    ...baseFields,
    game_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'Reference to the game using this content'
    },
    use_type: {
      type: DataTypes.ENUM('single_content', 'pair', 'group', 'mixed_edu_contents'),
      allowNull: false,
      comment: 'How the content is grouped/used in the game'
    },
    contents_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of content objects: [{ id: string, source: "eduContent"|"eduContentUse" }]',
      validate: {
        isValidContentsArray(value) {
          if (!Array.isArray(value)) {
            throw new Error('contents_data must be an array');
          }

          // Validate based on use_type
          if (this.use_type === 'single_content' && value.length !== 1) {
            throw new Error('single_content use_type must have exactly 1 content object');
          }
          if (this.use_type === 'pair' && value.length !== 2) {
            throw new Error('pair use_type must have exactly 2 content objects');
          }
          if (this.use_type === 'mixed_edu_contents' && value.length !== 2) {
            throw new Error('mixed_edu_contents use_type must have exactly 2 content objects');
          }
          if (this.use_type === 'group' && value.length < 2) {
            throw new Error('group use_type must have at least 2 content objects');
          }

          // Validate that all items are valid content objects
          for (const item of value) {
            if (typeof item !== 'object' || item === null) {
              throw new Error('All content items must be objects');
            }

            if (typeof item.id !== 'string' || item.id.length === 0) {
              throw new Error('All content objects must have a non-empty string id');
            }

            if (!['eduContent', 'eduContentUse'].includes(item.source)) {
              throw new Error('All content objects must have source as "eduContent" or "eduContentUse"');
            }
          }

          // Check for duplicate IDs
          const ids = value.map(item => item.id);
          if (new Set(ids).size !== ids.length) {
            throw new Error('contents_data cannot contain duplicate IDs');
          }
        }
      }
    },
    content_order: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Optional: array defining order when sequence matters',
      validate: {
        isValidOrder(value) {
          if (value !== null && value !== undefined) {
            if (!Array.isArray(value)) {
              throw new Error('content_order must be an array or null');
            }

            // If order is specified, it should match contents_data length
            if (this.contents_data && value.length !== this.contents_data.length) {
              throw new Error('content_order length must match contents_data length');
            }
          }
        }
      }
    },
    usage_metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional metadata about how content is used',
      validate: {
        isValidUsageMetadata(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('usage_metadata must be a valid JSON object');
          }
        }
      }
    }
  }, {
    ...baseOptions,
    tableName: 'edu_content_use',
    indexes: [
      {
        fields: ['game_id']
      },
      {
        fields: ['use_type']
      },
      {
        fields: ['contents_data'],
        using: 'gin'
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      beforeCreate: (eduContentUse) => {
        if (!eduContentUse.id) {
          eduContentUse.id = generateId();
        }
      },
      beforeValidate: (eduContentUse) => {
        // Ensure contents_data is an array
        if (typeof eduContentUse.contents_data === 'string') {
          try {
            eduContentUse.contents_data = JSON.parse(eduContentUse.contents_data);
          } catch (error) {
            throw new Error('Invalid JSON in contents_data');
          }
        }
      }
    }
  });

  // Instance methods
  EduContentUse.prototype.isSingleContent = function() {
    return this.use_type === 'single_content';
  };

  EduContentUse.prototype.isPair = function() {
    return this.use_type === 'pair';
  };

  EduContentUse.prototype.isGroup = function() {
    return this.use_type === 'group';
  };

  EduContentUse.prototype.isMixedEduContents = function() {
    return this.use_type === 'mixed_edu_contents';
  };

  EduContentUse.prototype.getContentObjects = function() {
    return Array.isArray(this.contents_data) ? this.contents_data : [];
  };

  EduContentUse.prototype.getContentIds = function() {
    return this.getContentObjects().map(item => item.id);
  };

  EduContentUse.prototype.getContentIdsBySource = function(source) {
    return this.getContentObjects()
      .filter(item => item.source === source)
      .map(item => item.id);
  };

  EduContentUse.prototype.hasContentId = function(contentId) {
    return this.getContentIds().includes(contentId);
  };

  EduContentUse.prototype.addContentObject = function(contentObject) {
    const currentObjects = this.getContentObjects();
    if (!currentObjects.find(obj => obj.id === contentObject.id)) {
      this.contents_data = [...currentObjects, contentObject];
    }
    return this.save();
  };

  EduContentUse.prototype.addContentId = function(contentId, source = 'eduContent') {
    return this.addContentObject({ id: contentId, source });
  };

  EduContentUse.prototype.removeContentId = function(contentId) {
    const currentObjects = this.getContentObjects();
    this.contents_data = currentObjects.filter(obj => obj.id !== contentId);
    return this.save();
  };

  EduContentUse.prototype.setContentObjects = function(contentObjects) {
    this.contents_data = Array.isArray(contentObjects) ? contentObjects : [];
    return this.save();
  };

  EduContentUse.prototype.setContentIds = function(contentIds) {
    // For backward compatibility, assume eduContent source
    const contentObjects = contentIds.map(id => ({ id, source: 'eduContent' }));
    return this.setContentObjects(contentObjects);
  };

  EduContentUse.prototype.getUsageMetadata = function() {
    return typeof this.usage_metadata === 'string'
      ? JSON.parse(this.usage_metadata)
      : this.usage_metadata;
  };

  EduContentUse.prototype.updateUsageMetadata = function(newMetadata) {
    this.usage_metadata = {
      ...this.getUsageMetadata(),
      ...newMetadata
    };
    return this.save();
  };

  EduContentUse.prototype.getContentOrder = function() {
    return this.content_order || this.getContentIds();
  };

  EduContentUse.prototype.setContentOrder = function(order) {
    this.content_order = Array.isArray(order) ? order : null;
    return this.save();
  };

  // Class methods
  EduContentUse.findByGame = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        ...options.where
      },
      ...options
    });
  };

  EduContentUse.findByUseType = function(useType, options = {}) {
    return this.findAll({
      where: {
        use_type: useType,
        ...options.where
      },
      ...options
    });
  };

  EduContentUse.findPairs = function(gameId = null, options = {}) {
    const whereCondition = {
      use_type: 'pair',
      ...options.where
    };

    if (gameId) {
      whereCondition.game_id = gameId;
    }

    return this.findAll({
      where: whereCondition,
      ...options
    });
  };

  EduContentUse.findGroups = function(gameId = null, options = {}) {
    const whereCondition = {
      use_type: 'group',
      ...options.where
    };

    if (gameId) {
      whereCondition.game_id = gameId;
    }

    return this.findAll({
      where: whereCondition,
      ...options
    });
  };

  EduContentUse.findByContentId = function(contentId, options = {}) {
    return this.findAll({
      where: {
        contents_data: {
          [Op.contains]: [contentId]
        },
        ...options.where
      },
      ...options
    });
  };

  EduContentUse.findMemoryPairs = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        use_type: 'pair',
        ...options.where
      },
      include: options.include || [],
      order: options.order || [['created_at', 'ASC']],
      ...options
    });
  };

  // Define associations
  EduContentUse.associate = function(models) {
    // Belongs to game
    EduContentUse.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE'
    });

    // Note: Association with EduContent is handled through JSONB array
    // We cannot create a direct Sequelize association due to the array structure
    // Content loading will be handled in application logic
  };

  // Helper method to load associated content from multiple sources
  EduContentUse.prototype.loadContent = async function() {
    const contentObjects = this.getContentObjects();
    if (!contentObjects.length) {
      return [];
    }

    const { EduContent } = sequelize.models;
    const { EduContentUse } = sequelize.models;

    if (!EduContent || !EduContentUse) {
      throw new Error('Required models not found');
    }

    const results = [];

    // Load EduContent items
    const eduContentIds = this.getContentIdsBySource('eduContent');
    if (eduContentIds.length > 0) {
      const eduContents = await EduContent.findAll({
        where: {
          id: {
            [Op.in]: eduContentIds
          }
        },
        order: [['created_at', 'ASC']]
      });
      results.push(...eduContents);
    }

    // Load EduContentUse items (sub-pairs)
    const eduContentUseIds = this.getContentIdsBySource('eduContentUse');
    if (eduContentUseIds.length > 0) {
      const eduContentUses = await EduContentUse.findAll({
        where: {
          id: {
            [Op.in]: eduContentUseIds
          }
        },
        order: [['created_at', 'ASC']]
      });
      results.push(...eduContentUses);
    }

    // Sort results to maintain order from contents_data
    const orderedResults = [];
    for (const contentObj of contentObjects) {
      const found = results.find(item => item.id === contentObj.id);
      if (found) {
        // Add source metadata to help identify the type
        found.dataValues._source = contentObj.source;
        orderedResults.push(found);
      }
    }

    return orderedResults;
  };

  return EduContentUse;
}