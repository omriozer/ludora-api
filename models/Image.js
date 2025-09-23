import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Image = sequelize.define('Image', {
    ...baseFields,
    file_url: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'image',
    indexes: [
      {
        fields: ['is_approved'],
      },
    ],
  });

  Image.associate = function(models) {
    // Images can be referenced in ContentRelationship
    Image.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'Image' } });
    Image.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'Image' } });
    Image.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'Image' } });
  };

  return Image;
}