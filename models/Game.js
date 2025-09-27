import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Game = sequelize.define('Game', {
    ...baseFields,
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    price: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image_is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skills: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isArray(value) {
          if (value !== null && !Array.isArray(value)) {
            throw new Error('skills must be an array');
          }
        }
      }
    },
    age_range: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    grade_range: {
      type: DataTypes.STRING,
      allowNull: true,
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
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isArray(value) {
          if (value !== null && !Array.isArray(value)) {
            throw new Error('tags must be an array');
          }
        }
      }
    },
    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    creator_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      }
    }
  }, {
    ...baseOptions,
    tableName: 'game',
    indexes: [
      {
        fields: ['game_type']
      },
      {
        fields: ['is_published']
      },
      {
        fields: ['subject']
      },
      {
        fields: ['device_compatibility']
      },
      {
        fields: ['creator_user_id']
      }
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

  Game.prototype.hasSkill = function(skill) {
    return this.skills && this.skills.includes(skill);
  };

  Game.prototype.addSkill = function(skill) {
    if (!this.skills) this.skills = [];
    if (!this.skills.includes(skill)) {
      this.skills.push(skill);
    }
    return this.save();
  };

  Game.prototype.removeSkill = function(skill) {
    if (!this.skills) return this;
    this.skills = this.skills.filter(s => s !== skill);
    return this.save();
  };

  // Class methods
  Game.findPublished = function(options = {}) {
    return this.findAll({
      where: {
        is_published: true,
        ...options.where
      },
      ...options
    });
  };

  Game.findByGameType = function(gameType, options = {}) {
    return this.findAll({
      where: {
        game_type: gameType,
        ...options.where
      },
      ...options
    });
  };

  Game.findBySubject = function(subject, options = {}) {
    return this.findAll({
      where: {
        subject: subject,
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

  // Define associations
  Game.associate = function(models) {
    // Hybrid storage structured tables
    Game.hasMany(models.MemoryPairingRule, {
      foreignKey: 'game_id',
      as: 'memoryPairingRules',
      onDelete: 'CASCADE'
    });

    // Legacy game type specific settings associations
    Game.hasOne(models.GameScatterSettings, {
      foreignKey: 'game_id',
      as: 'scatterSettings',
      onDelete: 'CASCADE'
    });

    Game.hasOne(models.GameMemorySettings, {
      foreignKey: 'game_id',
      as: 'memorySettings',
      onDelete: 'CASCADE'
    });

    Game.hasOne(models.GameWisdomMazeSettings, {
      foreignKey: 'game_id',
      as: 'wisdomMazeSettings',
      onDelete: 'CASCADE'
    });

    // User associations
    Game.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator'
    });

    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)

    // Other existing associations can be added here
  };

  // Instance method to get game-type-specific settings
  Game.prototype.getTypeSettings = async function() {
    switch (this.game_type) {
      case 'scatter_game':
        return await this.getScatterSettings();
      case 'memory_game':
        return await this.getMemorySettings();
      case 'wisdom_maze':
        return await this.getWisdomMazeSettings();
      default:
        return null;
    }
  };

  // Instance method to create game-type-specific settings
  Game.prototype.createTypeSettings = async function(settings) {
    const models = sequelize.models;

    switch (this.game_type) {
      case 'scatter_game':
        return await models.GameScatterSettings.create({
          game_id: this.id,
          ...settings
        });
      case 'memory_game':
        return await models.GameMemorySettings.create({
          game_id: this.id,
          ...settings
        });
      case 'wisdom_maze':
        return await models.GameWisdomMazeSettings.create({
          game_id: this.id,
          ...settings
        });
      default:
        throw new Error(`Unknown game type: ${this.game_type}`);
    }
  };

  // Instance method to update game-type-specific settings
  Game.prototype.updateTypeSettings = async function(settings) {
    const typeSettings = await this.getTypeSettings();
    if (typeSettings) {
      return await typeSettings.update(settings);
    } else {
      return await this.createTypeSettings(settings);
    }
  };

  // Hybrid storage methods
  Game.prototype.syncStructuredData = async function(plugin) {
    const { default: GameDataSyncService } = await import('../services/GameDataSyncService.js');
    return await GameDataSyncService.syncToStructuredTables(this.id, this.toJSON(), plugin);
  };

  Game.prototype.loadWithStructuredData = async function(plugin) {
    const { default: GameDataSyncService } = await import('../services/GameDataSyncService.js');
    return await GameDataSyncService.loadStructuredData(this.toJSON(), plugin);
  };

  Game.prototype.validateDataConsistency = async function(plugin) {
    const { default: GameDataSyncService } = await import('../services/GameDataSyncService.js');
    return await GameDataSyncService.validateConsistency(this.toJSON(), plugin);
  };

  // Enhanced save method that handles hybrid storage
  Game.prototype.saveWithHybridStorage = async function(plugin) {
    const transaction = await sequelize.transaction();

    try {
      // Save the main game record
      await this.save({ transaction });

      // Sync to structured tables if plugin supports it
      if (plugin && typeof plugin.extractStructuredData === 'function') {
        await this.syncStructuredData(plugin);
      }

      await transaction.commit();
      return this;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Class method to find with structured data loaded
  Game.findWithStructuredData = async function(id, gameType) {
    const { default: gamePluginRegistry } = await import('../plugins/GamePluginRegistry.js');
    const plugin = gamePluginRegistry.getPlugin(gameType);

    const game = await this.findByPk(id);
    if (!game) return null;

    if (plugin) {
      return await game.loadWithStructuredData(plugin);
    }

    return game.toJSON();
  };

  // Class method for creating games with hybrid storage
  Game.createWithHybridStorage = async function(gameData, plugin) {
    const transaction = await sequelize.transaction();

    try {
      // Create the main game record
      const game = await this.create(gameData, { transaction });

      // Sync structured data if plugin supports it
      if (plugin && gameData._structuredData) {
        const { default: GameDataSyncService } = await import('../services/GameDataSyncService.js');
        await GameDataSyncService.syncToStructuredTables(
          game.id,
          gameData,
          plugin
        );
      }

      await transaction.commit();
      return game;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  return Game;
}