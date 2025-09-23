import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const GameContentRule = sequelize.define('GameContentRule', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: generateId
    },
    template_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game_content_usage_template',
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
      comment: 'JSON configuration for the rule based on rule_type',
      validate: {
        isValidConfig(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('rule_config must be a valid JSON object');
          }

          // Validate based on rule_type
          const ruleType = this.rule_type;

          switch (ruleType) {
            case 'attribute_based':
              if (!value.attribute || !value.value || !value.operation) {
                throw new Error('attribute_based rules must have attribute, value, and operation fields');
              }
              if (!['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in'].includes(value.operation)) {
                throw new Error('Invalid operation for attribute_based rule');
              }
              break;

            case 'content_list':
              if (!value.content_list_id || !value.relation_type) {
                throw new Error('content_list rules must have content_list_id and relation_type fields');
              }
              if (!['direct', 'indirect', 'all_related'].includes(value.relation_type)) {
                throw new Error('Invalid relation_type for content_list rule');
              }
              break;

            case 'complex_attribute':
              if (!Array.isArray(value.rules) || !value.operation) {
                throw new Error('complex_attribute rules must have rules array and operation field');
              }
              if (!['AND', 'OR'].includes(value.operation)) {
                throw new Error('Invalid operation for complex_attribute rule');
              }
              break;

            case 'relation_based':
              if (!value.source_content_id || !value.relation_type) {
                throw new Error('relation_based rules must have source_content_id and relation_type fields');
              }
              break;

            default:
              throw new Error(`Unknown rule_type: ${ruleType}`);
          }
        }
      }
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
    tableName: 'game_content_rule',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['template_id']
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
  GameContentRule.associate = function(models) {
    // Belongs to Template
    GameContentRule.belongsTo(models.GameContentUsageTemplate, {
      foreignKey: 'template_id',
      as: 'template',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  GameContentRule.prototype.toJSON = function() {
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

  // Instance method to validate rule configuration
  GameContentRule.prototype.validateRuleConfig = function() {
    const { rule_type, rule_config } = this;

    // Basic validation - detailed validation is in the validator above
    if (!rule_config || typeof rule_config !== 'object') {
      throw new Error('Invalid rule configuration');
    }

    // Rule-specific validation
    switch (rule_type) {
      case 'attribute_based':
        return this.validateAttributeBasedRule(rule_config);
      case 'content_list':
        return this.validateContentListRule(rule_config);
      case 'complex_attribute':
        return this.validateComplexAttributeRule(rule_config);
      case 'relation_based':
        return this.validateRelationBasedRule(rule_config);
      default:
        throw new Error(`Unknown rule type: ${rule_type}`);
    }
  };

  // Rule validation methods
  GameContentRule.prototype.validateAttributeBasedRule = function(config) {
    const required = ['attribute', 'value', 'operation'];
    const validOperations = ['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in'];

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field for attribute_based rule: ${field}`);
      }
    }

    if (!validOperations.includes(config.operation)) {
      throw new Error(`Invalid operation: ${config.operation}. Valid operations: ${validOperations.join(', ')}`);
    }

    return true;
  };

  GameContentRule.prototype.validateContentListRule = function(config) {
    const required = ['content_list_id', 'relation_type'];
    const validRelationTypes = ['direct', 'indirect', 'all_related'];

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field for content_list rule: ${field}`);
      }
    }

    if (!validRelationTypes.includes(config.relation_type)) {
      throw new Error(`Invalid relation_type: ${config.relation_type}. Valid types: ${validRelationTypes.join(', ')}`);
    }

    return true;
  };

  GameContentRule.prototype.validateComplexAttributeRule = function(config) {
    if (!Array.isArray(config.rules) || config.rules.length === 0) {
      throw new Error('complex_attribute rule must have a non-empty rules array');
    }

    if (!['AND', 'OR'].includes(config.operation)) {
      throw new Error(`Invalid operation: ${config.operation}. Valid operations: AND, OR`);
    }

    // Validate each sub-rule
    for (const rule of config.rules) {
      if (!rule.attribute || !rule.value || !rule.operation) {
        throw new Error('Each rule in complex_attribute must have attribute, value, and operation');
      }
    }

    return true;
  };

  GameContentRule.prototype.validateRelationBasedRule = function(config) {
    const required = ['source_content_id', 'relation_type'];

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field for relation_based rule: ${field}`);
      }
    }

    return true;
  };

  // Class methods
  GameContentRule.getByTemplate = async function(templateId) {
    return await this.findAll({
      where: { template_id: templateId },
      order: [['priority', 'DESC'], ['created_at', 'ASC']]
    });
  };

  return GameContentRule;
}