import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const GameContentUsageTemplate = sequelize.define('GameContentUsageTemplate', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: generateId
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    game_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'scatter_game, wisdom_maze, etc.',
      validate: {
        notEmpty: true,
        isIn: [['scatter_game', 'wisdom_maze', 'sharp_and_smooth', 'memory_game', 'ar_up_there']]
      }
    },
    content_types: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of allowed content types: [word, worden, image, qa, etc.]',
      validate: {
        isValidContentTypes(value) {
          if (!Array.isArray(value)) {
            throw new Error('content_types must be an array');
          }
          const validTypes = ['word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute'];
          for (const type of value) {
            if (!validTypes.includes(type)) {
              throw new Error(`Invalid content type: ${type}. Valid types: ${validTypes.join(', ')}`);
            }
          }
        }
      }
    },
    is_global: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if template can be used across game types'
    },
    creator_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'game_content_usage_template',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['game_type']
      },
      {
        fields: ['is_global']
      },
      {
        fields: ['creator_user_id']
      }
    ]
  });

  // Define associations
  GameContentUsageTemplate.associate = function(models) {
    // Belongs to User (creator)
    GameContentUsageTemplate.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Has many rules
    GameContentUsageTemplate.hasMany(models.GameContentRule, {
      foreignKey: 'template_id',
      as: 'rules',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Has many game usages (instances that were copied from this template)
    GameContentUsageTemplate.hasMany(models.GameContentUsage, {
      foreignKey: 'template_id',
      as: 'usages',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  GameContentUsageTemplate.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Ensure content_types is always an array
    if (typeof values.content_types === 'string') {
      try {
        values.content_types = JSON.parse(values.content_types);
      } catch {
        values.content_types = [];
      }
    }

    return values;
  };

  // Class methods
  GameContentUsageTemplate.getTemplatesForGameType = async function(gameType, includeGlobal = true) {
    const whereConditions = includeGlobal
      ? {
          [sequelize.Op.or]: [
            { game_type: gameType },
            { is_global: true }
          ]
        }
      : { game_type: gameType };

    return await this.findAll({
      where: whereConditions,
      include: [{
        model: sequelize.models.User,
        as: 'creator',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: sequelize.models.GameContentRule,
        as: 'rules'
      }],
      order: [['created_at', 'DESC']]
    });
  };

  GameContentUsageTemplate.getGlobalTemplates = async function() {
    return await this.findAll({
      where: { is_global: true },
      include: [{
        model: sequelize.models.User,
        as: 'creator',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: sequelize.models.GameContentRule,
        as: 'rules'
      }],
      order: [['created_at', 'DESC']]
    });
  };

  return GameContentUsageTemplate;
}