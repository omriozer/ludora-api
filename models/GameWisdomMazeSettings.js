import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameWisdomMazeSettings = sequelize.define('GameWisdomMazeSettings', {
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
    maze_complexity: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'medium',
      validate: {
        isIn: [['easy', 'medium', 'hard', 'expert']]
      }
    },
    question_frequency: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: {
        min: 1,
        max: 10
      }
    },
    hint_system_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    max_hints_per_question: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 2,
      validate: {
        min: 0,
        max: 5
      }
    },
    time_pressure_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    time_limit_per_question: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 10
      }
    },
    branching_paths_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 2,
        max: 5
      }
    },
    success_threshold_percentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
      validate: {
        min: 50,
        max: 100
      }
    },
    adaptive_difficulty: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    ...baseOptions,
    tableName: 'game_wisdom_maze_settings',
    indexes: [
      {
        fields: ['game_id'],
        unique: true
      },
      {
        fields: ['maze_complexity']
      },
      {
        fields: ['adaptive_difficulty']
      }
    ]
  });

  // Define associations
  GameWisdomMazeSettings.associate = function(models) {
    GameWisdomMazeSettings.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE'
    });
  };

  return GameWisdomMazeSettings;
}