import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Word = sequelize.define('Word', {
    ...baseFields,
    vocalized: { type: DataTypes.STRING, allowNull: true },
    word: { type: DataTypes.STRING, allowNull: true },
    root: { type: DataTypes.STRING, allowNull: true },
    context: { type: DataTypes.STRING, allowNull: true },
    difficulty: { type: DataTypes.DECIMAL, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'word',
    indexes: [
      {
        fields: ['difficulty'],
      },
      {
        fields: ['is_approved'],
      },
    ],
  });

  Word.associate = function(models) {
    // Words can be referenced in ContentRelationship
    Word.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'Word' } });
    Word.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'Word' } });
    Word.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'Word' } });
  };

  return Word;
}