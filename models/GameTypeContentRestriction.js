import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const GameTypeContentRestriction = sequelize.define('GameTypeContentRestriction', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: generateId
    },
    game_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'scatter_game, wisdom_maze, etc.',
      validate: {
        notEmpty: true,
        isIn: [['scatter_game', 'wisdom_maze', 'sharp_and_smooth', 'memory_game', 'ar_up_there']]
      }
    },
    allowed_content_types: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of allowed content types for this game type',
      validate: {
        isValidContentTypes(value) {
          if (!Array.isArray(value)) {
            throw new Error('allowed_content_types must be an array');
          }
          const validTypes = ['word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute'];
          for (const type of value) {
            if (!validTypes.includes(type)) {
              throw new Error(`Invalid content type: ${type}. Valid types: ${validTypes.join(', ')}`);
            }
          }
        }
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
    tableName: 'game_type_content_restriction',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['game_type']
      }
    ]
  });

  // Instance methods
  GameTypeContentRestriction.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Ensure allowed_content_types is always an array
    if (typeof values.allowed_content_types === 'string') {
      try {
        values.allowed_content_types = JSON.parse(values.allowed_content_types);
      } catch {
        values.allowed_content_types = [];
      }
    }

    return values;
  };

  // Instance method to check if content type is allowed
  GameTypeContentRestriction.prototype.isContentTypeAllowed = function(contentType) {
    const allowedTypes = this.allowed_content_types || [];
    return allowedTypes.includes(contentType);
  };

  // Instance method to check if multiple content types are allowed
  GameTypeContentRestriction.prototype.areContentTypesAllowed = function(contentTypes) {
    const allowedTypes = this.allowed_content_types || [];
    return contentTypes.every(type => allowedTypes.includes(type));
  };

  // Class methods
  GameTypeContentRestriction.getByGameType = async function(gameType) {
    return await this.findOne({
      where: { game_type: gameType }
    });
  };

  GameTypeContentRestriction.getAllowedContentTypes = async function(gameType) {
    const restriction = await this.getByGameType(gameType);
    return restriction ? restriction.allowed_content_types : [];
  };

  GameTypeContentRestriction.isContentTypeAllowedForGameType = async function(gameType, contentType) {
    const restriction = await this.getByGameType(gameType);
    return restriction ? restriction.isContentTypeAllowed(contentType) : false;
  };

  GameTypeContentRestriction.areContentTypesAllowedForGameType = async function(gameType, contentTypes) {
    const restriction = await this.getByGameType(gameType);
    return restriction ? restriction.areContentTypesAllowed(contentTypes) : false;
  };

  GameTypeContentRestriction.validateContentTypesForGameType = async function(gameType, contentTypes) {
    const allowedTypes = await this.getAllowedContentTypes(gameType);
    const invalidTypes = contentTypes.filter(type => !allowedTypes.includes(type));

    if (invalidTypes.length > 0) {
      throw new Error(`Content types not allowed for ${gameType}: ${invalidTypes.join(', ')}. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return true;
  };

  return GameTypeContentRestriction;
}