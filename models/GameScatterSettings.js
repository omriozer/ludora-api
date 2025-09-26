import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameScatterSettings = sequelize.define('GameScatterSettings', {
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
    board_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 5,
        max: 20
      }
    },
    max_words: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
      validate: {
        min: 3,
        max: 50
      }
    },
    time_limit_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    word_directions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['horizontal', 'vertical']
    },
    hint_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    highlight_found_words: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    case_sensitive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    ...baseOptions,
    tableName: 'game_scatter_settings',
    indexes: [
      {
        fields: ['game_id'],
        unique: true
      },
      {
        fields: ['board_size']
      }
    ]
  });

  // Define associations
  GameScatterSettings.associate = function(models) {
    GameScatterSettings.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE'
    });
  };

  return GameScatterSettings;
}