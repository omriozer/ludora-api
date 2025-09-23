import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Grammar = sequelize.define('Grammar', {
    ...baseFields,
    type: { type: DataTypes.STRING, allowNull: true },
    value: { type: DataTypes.STRING, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'grammar',
  });

  Grammar.associate = function(models) {
    // Grammar can be referenced in ContentRelationship
    Grammar.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'Grammar' } });
    Grammar.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'Grammar' } });
    Grammar.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'Grammar' } });
  };

  return Grammar;
}