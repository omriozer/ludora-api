import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const GameContentRuleInstance = sequelize.define('GameContentRuleInstance', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: generateId
    },
    game_usage_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game_content_usage',
        key: 'id'
      }
    },
    rule_type: {
      type: DataTypes.ENUM('attribute_based', 'content_list', 'complex_attribute', 'relation_based'),
      allowNull: false,
      comment: 'Type of content selection rule'
    },
    rule_config: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'JSON configuration for the rule based on rule_type'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Rule execution priority (higher number = higher priority)',
      validate: {
        min: 0,
        max: 1000
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
    tableName: 'game_content_rule_instance',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['game_usage_id']
      },
      {
        fields: ['rule_type']
      },
      {
        fields: ['priority']
      }
    ]
  });

  // Define associations
  GameContentRuleInstance.associate = function(models) {
    // Belongs to GameContentUsage
    GameContentRuleInstance.belongsTo(models.GameContentUsage, {
      foreignKey: 'game_usage_id',
      as: 'usage',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  GameContentRuleInstance.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Ensure rule_config is always an object
    if (typeof values.rule_config === 'string') {
      try {
        values.rule_config = JSON.parse(values.rule_config);
      } catch {
        values.rule_config = {};
      }
    }

    return values;
  };

  // Class methods
  GameContentRuleInstance.getByUsage = async function(gameUsageId) {
    return await this.findAll({
      where: { game_usage_id: gameUsageId },
      order: [['priority', 'DESC'], ['created_at', 'ASC']]
    });
  };

  return GameContentRuleInstance;
}