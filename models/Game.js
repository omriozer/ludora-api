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
          'sharp_and_smooth',
          'memory_game',
          'ar_up_there'
        ]]
      }
    },
    digital: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'true = דיגיטלי, false = גרסה להדפסה'
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
    content_query: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'JSON object defining how to query content for this game'
    },
  }, {
    ...baseOptions,
    tableName: 'game',
    indexes: [
      {
        fields: ['game_type']
      },
      {
        fields: ['digital']
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

  Game.prototype.isDigital = function() {
    return this.digital === true;
  };

  Game.prototype.isPrintVersion = function() {
    return this.digital === false;
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



  Game.findByFormat = function(isDigital, options = {}) {
    return this.findAll({
      where: {
        digital: isDigital,
        ...options.where
      },
      ...options
    });
  };

  Game.findDigitalGames = function(options = {}) {
    return this.findByFormat(true, options);
  };

  Game.findPrintGames = function(options = {}) {
    return this.findByFormat(false, options);
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

    // Has many content links (flexible links to content or relations)
    Game.hasMany(models.GameContentLink, {
      foreignKey: 'game_id',
      as: 'contentLinks'
    });

    // Many-to-many with GameContent through GameContentLink
    Game.belongsToMany(models.GameContent, {
      through: models.GameContentLink,
      foreignKey: 'game_id',
      otherKey: 'target_id',
      as: 'linkedContent'
    });

    // Many-to-many with GameContentRelation through GameContentLink
    Game.belongsToMany(models.GameContentRelation, {
      through: models.GameContentLink,
      foreignKey: 'game_id',
      otherKey: 'target_id',
      as: 'linkedRelations'
    });

    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };


  return Game;
}