import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameMemorySettings = sequelize.define('GameMemorySettings', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    game_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    pairs_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      validate: {
        min: 3,
        max: 20
      }
    },
    flip_time_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    match_time_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    allow_mismatched_types: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    shuffle_cards: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    reveal_duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2000,
      validate: {
        min: 500,
        max: 5000
      }
    },
    difficulty_progression: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    ...baseOptions,
    tableName: 'game_memory_settings',
    indexes: [
      {
        fields: ['game_id'],
        unique: true
      },
      {
        fields: ['pairs_count']
      }
    ]
  });

  // Define associations
  GameMemorySettings.associate = function(models) {
    GameMemorySettings.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE'
    });
  };

  return GameMemorySettings;
}