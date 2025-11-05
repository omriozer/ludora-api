import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default function (sequelize) {
  const GameContentRelation = sequelize.define(
    'GameContentRelation',
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => generateId(),
      },
      relation_type: {
        type: DataTypes.ENUM(
          'translation',
          'antonym',
          'synonym',
          'similar_meaning',
          'question_answer',
          'answer_question',
          'distractor'
        ),
        allowNull: false,
        comment: 'Defines what kind of relationship this is (e.g., translation, synonym, memory_pair, etc.)'
      },
      is_bidirectional: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the relation applies in both directions (e.g., synonyms are bidirectional, Q/A are not)'
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Optional JSON for storing extra data (e.g., confidence score, source, difficulty level, etc.)'
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
      tableName: 'game_content_relation',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['relation_type']
        },
        {
          fields: ['is_bidirectional']
        },
        {
          fields: ['metadata'],
          using: 'gin'
        }
      ]
    }
  );

  // Instance methods
  GameContentRelation.prototype.isTranslation = function() {
    return this.relation_type === 'translation';
  };

  GameContentRelation.prototype.isQuestionAnswer = function() {
    return this.relation_type === 'question_answer';
  };

  GameContentRelation.prototype.isSynonym = function() {
    return this.relation_type === 'synonym';
  };

  GameContentRelation.prototype.isAntonym = function() {
    return this.relation_type === 'antonym';
  };

  // Class methods
  GameContentRelation.findByType = function(relationType, options = {}) {
    return this.findAll({
      where: {
        relation_type: relationType,
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  GameContentRelation.associate = function(models) {
    // Has many relation items
    GameContentRelation.hasMany(models.GameContentRelationItem, {
      foreignKey: 'relation_id',
      as: 'items'
    });

    // Many-to-many with Games through GameContentLink
    GameContentRelation.belongsToMany(models.Game, {
      through: models.GameContentLink,
      foreignKey: 'target_id',
      otherKey: 'game_id',
      as: 'games'
    });
  };

  return GameContentRelation;
}