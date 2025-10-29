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
    is_asset_only: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true = asset only (not standalone product), false = can be standalone product'
    },
  }, {
    ...baseOptions,
    tableName: 'file',
    indexes: [
      {
        fields: ['file_type'],
      },
      {
        fields: ['is_asset_only'],
      },
    ],
  });

  File.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  // Helper methods for asset/product distinction
  File.prototype.isAssetOnly = function() {
    return this.is_asset_only === true;
  };

  File.prototype.canBeProduct = function() {
    return this.is_asset_only === false;
  };

  File.prototype.toggleAssetOnly = function() {
    this.is_asset_only = !this.is_asset_only;
  };

  // Static methods for querying by asset status
  File.findProductFiles = function(options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        is_asset_only: false
      }
    });
  };

  File.findAssetOnlyFiles = function(options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        is_asset_only: true
      }
    });
  };

  return File;
}