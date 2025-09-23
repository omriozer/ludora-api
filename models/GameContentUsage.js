import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const GameContentUsage = sequelize.define('GameContentUsage', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: generateId
    },
    game_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      }
    },
    template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'game_content_usage_template',
        key: 'id'
      },
      comment: 'Original template this usage was copied from (can be null for custom)'
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
    content_types: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of content types this usage handles'
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
    tableName: 'game_content_usage',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['game_id']
      },
      {
        fields: ['template_id']
      }
    ]
  });

  // Define associations
  GameContentUsage.associate = function(models) {
    // Belongs to Game
    GameContentUsage.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Belongs to Template (optional)
    GameContentUsage.belongsTo(models.GameContentUsageTemplate, {
      foreignKey: 'template_id',
      as: 'template',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Has many rule instances
    GameContentUsage.hasMany(models.GameContentRuleInstance, {
      foreignKey: 'game_usage_id',
      as: 'rules',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  GameContentUsage.prototype.toJSON = function() {
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
  GameContentUsage.getByGame = async function(gameId) {
    return await this.findAll({
      where: { game_id: gameId },
      include: [{
        model: sequelize.models.GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }, {
        model: sequelize.models.GameContentUsageTemplate,
        as: 'template'
      }],
      order: [['created_at', 'ASC']]
    });
  };

  return GameContentUsage;
}