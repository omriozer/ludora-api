import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ContentList = sequelize.define('ContentList', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'contentlist',
  });

  ContentList.associate = function(models) {
    // ContentList can be referenced in ContentRelationship
    ContentList.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'ContentList' } });
    ContentList.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'ContentList' } });
    ContentList.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'ContentList' } });
  };

  return ContentList;
}