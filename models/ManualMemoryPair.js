import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const ManualMemoryPair = sequelize.define('ManualMemoryPair', {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false
    },
    pairing_rule_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: 'memory_pairing_rules',
        key: 'id'
      }
    },
    content_a_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'ID of first content item in the pair'
    },
    content_a_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of first content item'
    },
    content_b_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'ID of second content item in the pair'
    },
    content_b_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of second content item'
    },
    pair_metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about this specific pair'
    }
  }, {
    tableName: 'manual_memory_pairs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['pairing_rule_id'] },
      { fields: ['content_a_id', 'content_a_type'] },
      { fields: ['content_b_id', 'content_b_type'] }
    ]
  });

  // Define associations
  ManualMemoryPair.associate = function(models) {
    // Association with MemoryPairingRule
    ManualMemoryPair.belongsTo(models.MemoryPairingRule, {
      foreignKey: 'pairing_rule_id',
      as: 'pairing_rule',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  ManualMemoryPair.prototype.toGameSettings = function() {
    return {
      id: this.id,
      content_a_id: this.content_a_id,
      content_a_type: this.content_a_type,
      content_b_id: this.content_b_id,
      content_b_type: this.content_b_type,
      pair_metadata: this.pair_metadata
    };
  };

  // Class methods
  ManualMemoryPair.findByPairingRuleId = async function(pairingRuleId) {
    return await this.findAll({
      where: { pairing_rule_id: pairingRuleId },
      order: [['created_at', 'ASC']]
    });
  };

  ManualMemoryPair.findByGameId = async function(gameId) {
    return await this.findAll({
      include: [{
        model: sequelize.models.MemoryPairingRule,
        as: 'pairing_rule',
        where: { game_id: gameId },
        attributes: ['id', 'rule_type', 'priority']
      }],
      order: [
        [{ model: sequelize.models.MemoryPairingRule, as: 'pairing_rule' }, 'priority', 'DESC'],
        ['created_at', 'ASC']
      ]
    });
  };

  return ManualMemoryPair;
}