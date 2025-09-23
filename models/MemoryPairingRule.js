import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const MemoryPairingRule = sequelize.define('MemoryPairingRule', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false
    },
    game_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      }
    },
    rule_type: {
      type: DataTypes.ENUM('manual_pairs', 'attribute_match', 'content_type_match', 'semantic_match'),
      allowNull: false,
      comment: 'Type of pairing rule logic'
    },
    content_type_a: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'First content type in the pair (e.g., Word, Image)'
    },
    content_type_b: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Second content type in the pair (e.g., Word, Image)'
    },
    attribute_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Attribute name for attribute-based matching'
    },
    pair_config: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Configuration specific to this pairing rule'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Rule execution priority (higher = first)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this rule is currently active'
    }
  }, {
    tableName: 'memory_pairing_rules',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['game_id'] },
      { fields: ['rule_type'] },
      { fields: ['content_type_a', 'content_type_b'] },
      { fields: ['attribute_name'] },
      { fields: ['is_active'] }
    ]
  });

  // Define associations
  MemoryPairingRule.associate = function(models) {
    // Association with Game
    MemoryPairingRule.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Association with ManualMemoryPairs
    MemoryPairingRule.hasMany(models.ManualMemoryPair, {
      foreignKey: 'pairing_rule_id',
      as: 'manual_pairs',
      onDelete: 'CASCADE'
    });
  };

  // Instance methods
  MemoryPairingRule.prototype.toGameSettings = function() {
    return {
      id: this.id,
      rule_type: this.rule_type,
      content_type_a: this.content_type_a,
      content_type_b: this.content_type_b,
      attribute_name: this.attribute_name,
      pair_config: this.pair_config,
      priority: this.priority,
      is_active: this.is_active
    };
  };

  // Class methods
  MemoryPairingRule.findByGameId = async function(gameId) {
    return await this.findAll({
      where: { game_id: gameId },
      order: [['priority', 'DESC'], ['created_at', 'ASC']],
      include: [{
        model: sequelize.models.ManualMemoryPair,
        as: 'manual_pairs'
      }]
    });
  };

  MemoryPairingRule.createFromGameSettings = async function(gameId, pairingRulesArray) {
    const transaction = await sequelize.transaction();

    try {
      // First, remove existing rules for this game
      await this.destroy({
        where: { game_id: gameId },
        transaction
      });

      // Create new rules
      const rules = [];
      for (const ruleData of pairingRulesArray) {
        const rule = await this.create({
          id: ruleData.id || `rule_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          game_id: gameId,
          rule_type: ruleData.rule_type,
          content_type_a: ruleData.content_type_a,
          content_type_b: ruleData.content_type_b,
          attribute_name: ruleData.attribute_name,
          pair_config: ruleData.pair_config || {},
          priority: ruleData.priority || 0,
          is_active: ruleData.is_active !== undefined ? ruleData.is_active : true
        }, { transaction });

        rules.push(rule);

        // Create manual pairs if this is a manual_pairs rule
        if (ruleData.rule_type === 'manual_pairs' && ruleData.manual_pairs) {
          for (const pairData of ruleData.manual_pairs) {
            await sequelize.models.ManualMemoryPair.create({
              id: pairData.id || `pair_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              pairing_rule_id: rule.id,
              content_a_id: pairData.content_a_id,
              content_a_type: pairData.content_a_type,
              content_b_id: pairData.content_b_id,
              content_b_type: pairData.content_b_type,
              pair_metadata: pairData.pair_metadata || {}
            }, { transaction });
          }
        }
      }

      await transaction.commit();
      return rules;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  return MemoryPairingRule;
}