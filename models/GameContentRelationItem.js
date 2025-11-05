import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const GameContentRelationItem = sequelize.define(
    'GameContentRelationItem',
    {
      relation_id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true, // Composite primary key
        references: {
          model: 'game_content_relation',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      content_id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true, // Composite primary key
        references: {
          model: 'gamecontent',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      role: {
        type: DataTypes.ENUM(
          'source',
          'target',
          'question',
          'answer',
          'distractor',
          'pair_a',   // For memory cards - first item in pair
          'pair_b'    // For memory cards - second item in pair
        ),
        allowNull: true,
        comment: 'Optional label describing the content\'s function within the relation'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'game_content_relation_items',
      timestamps: false, // Only created_at, no updated_at
      indexes: [
        {
          fields: ['relation_id']
        },
        {
          fields: ['content_id']
        },
        {
          fields: ['role']
        },
        {
          unique: true,
          fields: ['relation_id', 'content_id']
        }
      ]
    }
  );

  // Instance methods
  GameContentRelationItem.prototype.isPairA = function() {
    return this.role === 'pair_a';
  };

  GameContentRelationItem.prototype.isPairB = function() {
    return this.role === 'pair_b';
  };

  GameContentRelationItem.prototype.isQuestion = function() {
    return this.role === 'question';
  };

  GameContentRelationItem.prototype.isAnswer = function() {
    return this.role === 'answer';
  };

  // Class methods
  GameContentRelationItem.findByRelation = function(relationId, options = {}) {
    return this.findAll({
      where: {
        relation_id: relationId,
        ...options.where
      },
      ...options
    });
  };

  GameContentRelationItem.findByContent = function(contentId, options = {}) {
    return this.findAll({
      where: {
        content_id: contentId,
        ...options.where
      },
      ...options
    });
  };

  GameContentRelationItem.findByRole = function(role, options = {}) {
    return this.findAll({
      where: {
        role: role,
        ...options.where
      },
      ...options
    });
  };

  GameContentRelationItem.findMemoryPairs = function(relationId, options = {}) {
    return this.findAll({
      where: {
        relation_id: relationId,
        role: ['pair_a', 'pair_b'],
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  GameContentRelationItem.associate = function(models) {
    // Belongs to relation
    GameContentRelationItem.belongsTo(models.GameContentRelation, {
      foreignKey: 'relation_id',
      as: 'relation'
    });

    // Belongs to content
    GameContentRelationItem.belongsTo(models.GameContent, {
      foreignKey: 'content_id',
      as: 'content'
    });
  };

  return GameContentRelationItem;
}