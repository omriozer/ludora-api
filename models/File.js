import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const File = sequelize.define('File', {
    ...baseFields,
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Core file-specific fields only
    file_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Original filename of uploaded document (e.g., "my-document.pdf"). NULL if not uploaded yet.'
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['pdf', 'ppt', 'docx', 'zip', 'other']]
      }
    },
    allow_preview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    add_copyrights_footer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    footer_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Footer configuration (positions, styles, visibility). Text content comes from settings.'
    },
  }, {
    ...baseOptions,
    tableName: 'file',
    indexes: [
      {
        fields: ['file_type'],
      },
    ],
  });

  File.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  return File;
}