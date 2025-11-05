import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function (sequelize) {
  const GameContentLink = sequelize.define(
    'GameContentLink',
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => generateId(),
        comment: 'Unique identifier for this link'
      },
      game_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'The game this link belongs to'
      },
      link_type: {
        type: DataTypes.ENUM('content', 'relation'),
        allowNull: false,
        comment: 'Defines whether the link points to a single content item or a content relation'
      },
      target_id: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'References either gamecontent.id or game_content_relation.id depending on link_type'
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Optional JSON data for storing additional info about the link'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'game_content_link',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['game_id']
        },
        {
          fields: ['link_type']
        },
        {
          fields: ['target_id']
        },
        {
          unique: true,
          fields: ['game_id', 'target_id', 'link_type']
        }
      ]
    }
  );

  // Instance methods
  GameContentLink.prototype.isContentLink = function() {
    return this.link_type === 'content';
  };

  GameContentLink.prototype.isRelationLink = function() {
    return this.link_type === 'relation';
  };

  // Class methods
  GameContentLink.findByGame = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        ...options.where
      },
      ...options
    });
  };

  GameContentLink.findByType = function(linkType, options = {}) {
    return this.findAll({
      where: {
        link_type: linkType,
        ...options.where
      },
      ...options
    });
  };

  GameContentLink.findContentLinks = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        link_type: 'content',
        ...options.where
      },
      ...options
    });
  };

  GameContentLink.findRelationLinks = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        link_type: 'relation',
        ...options.where
      },
      ...options
    });
  };

  // Memory game specific methods
  GameContentLink.findMemoryPairLinks = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        link_type: 'relation',
        ...options.where
      },
      include: [{
        model: sequelize.models.GameContentRelation,
        as: 'relation',
        where: {
          relation_type: 'memory_pair'
        },
        include: [{
          model: sequelize.models.GameContentRelationItem,
          as: 'items',
          include: [{
            model: sequelize.models.GameContent,
            as: 'content'
          }]
        }]
      }],
      ...options
    });
  };

  // Define associations
  GameContentLink.associate = function(models) {
    // Belongs to game
    GameContentLink.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game'
    });

    // Polymorphic association to content
    GameContentLink.belongsTo(models.GameContent, {
      foreignKey: 'target_id',
      as: 'content',
      constraints: false
    });

    // Polymorphic association to relation
    GameContentLink.belongsTo(models.GameContentRelation, {
      foreignKey: 'target_id',
      as: 'relation',
      constraints: false
    });
  };

  return GameContentLink;
}