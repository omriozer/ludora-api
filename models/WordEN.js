import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const WordEN = sequelize.define('WordEN', {
    ...baseFields,
    word: { type: DataTypes.STRING, allowNull: true },
    difficulty: { type: DataTypes.DECIMAL, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'worden',
    indexes: [
      {
        fields: ['difficulty'],
      },
      {
        fields: ['is_approved'],
      },
    ],
  });

  WordEN.associate = function(models) {
    // WordEN can be referenced in ContentRelationship
    WordEN.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'WordEN' } });
    WordEN.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'WordEN' } });
    WordEN.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'WordEN' } });
  };

  return WordEN;
}