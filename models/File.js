import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

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
      comment: 'DEPRECATED: Use footer_overrides instead. Complete footer config now in Settings. Kept for backward compatibility.'
    },
    footer_overrides: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File-specific footer overrides (positioning, styling). Content comes from Settings.'
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
      {
        fields: ['footer_overrides'],
        name: 'idx_file_footer_overrides'
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

  // Footer settings standardization methods
  File.prototype.hasFooterOverrides = function() {
    return !!(this.footer_overrides && Object.keys(this.footer_overrides).length > 0);
  };

  File.prototype.getFooterOverrides = function() {
    // Use standardized field if available
    if (this.footer_overrides) {
      return this.footer_overrides;
    }
    return null;
  };

  File.prototype.shouldAddFooter = function() {
    // Check the add_copyrights_footer flag
    return this.add_copyrights_footer === true;
  };

  // Legacy compatibility method with deprecation warning
  File.prototype.getLegacyFooterSettings = function() {
    if (this.footer_settings) {
      DeprecationWarnings.warnDirectUsage('file', 'footer_settings', {
        fileId: this.id,
        location: 'File.getLegacyFooterSettings',
        message: 'Use footer_overrides with Settings.footer_settings merge instead'
      });
    }
    return this.footer_settings;
  };

  // Footer merge helper (for use with Settings footer_settings)
  File.prototype.mergeWithSystemFooterSettings = function(systemFooterSettings) {
    if (!systemFooterSettings) {
      return this.footer_overrides || {};
    }

    if (!this.hasFooterOverrides()) {
      return systemFooterSettings;
    }

    // Deep merge system settings with file overrides
    const merged = JSON.parse(JSON.stringify(systemFooterSettings));
    const overrides = this.footer_overrides;

    if (overrides.logo) {
      merged.logo = { ...merged.logo, ...overrides.logo };
    }
    if (overrides.text) {
      merged.text = { ...merged.text, ...overrides.text };
    }
    if (overrides.url) {
      merged.url = { ...merged.url, ...overrides.url };
    }
    if (overrides.customElements) {
      merged.customElements = { ...merged.customElements, ...overrides.customElements };
    }

    return merged;
  };

  return File;
}