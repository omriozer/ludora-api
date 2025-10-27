import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Game = sequelize.define('Game', {
    ...baseFields,
    creator_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'User who created this game'
    },
    game_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [[
          'scatter_game',
          'wisdom_maze',
          'sharp_and_smooth',
          'memory_game',
          'ar_up_there'
        ]]
      }
    },
    device_compatibility: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'both',
      validate: {
        isIn: [['mobile_only', 'desktop_only', 'both']]
      }
    },
    game_settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        isValidSettings(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('game_settings must be a valid JSON object');
          }
        }
      }
    },
  }, {
    ...baseOptions,
    tableName: 'game',
    indexes: [
      {
        fields: ['game_type']
      },
      {
        fields: ['device_compatibility']
      },
      {
        fields: ['creator_user_id']
      },
    ]
  });

  // Instance methods
  Game.prototype.getSettings = function() {
    return typeof this.game_settings === 'string'
      ? JSON.parse(this.game_settings)
      : this.game_settings;
  };

  Game.prototype.updateSettings = function(newSettings) {
    this.game_settings = {
      ...this.getSettings(),
      ...newSettings
    };
    return this.save();
  };

  Game.prototype.isCompatibleWith = function(deviceType) {
    if (this.device_compatibility === 'both') return true;
    return this.device_compatibility === deviceType;
  };


  // Class methods

  Game.findByGameType = function(gameType, options = {}) {
    return this.findAll({
      where: {
        game_type: gameType,
        ...options.where
      },
      ...options
    });
  };



  Game.findCompatibleWith = function(deviceType, options = {}) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { device_compatibility: 'both' },
          { device_compatibility: deviceType }
        ],
        ...options.where
      },
      ...options
    });
  };

  Game.findByCreator = function(creatorUserId, options = {}) {
    return this.findAll({
      where: {
        creator_user_id: creatorUserId,
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  Game.associate = function(models) {
    // Creator association
    Game.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator'
    });

    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };


  return Game;
}