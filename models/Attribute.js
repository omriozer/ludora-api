import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Attribute = sequelize.define('Attribute', {
    ...baseFields,
    type: { type: DataTypes.STRING, allowNull: true },
    value: { type: DataTypes.STRING, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'attribute',
  });

  Attribute.associate = function(models) {
    // Attributes can be referenced in ContentRelationship
    Attribute.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'Attribute' } });
    Attribute.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'Attribute' } });
    Attribute.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'Attribute' } });
  };

  return Attribute;
}