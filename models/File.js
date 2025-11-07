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
      comment: 'File-specific footer overrides (positioning, styling). Content comes from SystemTemplate.'
    },
    footer_template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference to system_templates for footer configuration'
    },
    accessible_pages: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of page numbers accessible in preview mode: [1,3,5,7] or null for all pages'
    },
    watermark_template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference to system_templates for watermark configuration'
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
      {
        fields: ['footer_template_id'],
        name: 'idx_file_footer_template_id'
      },
      {
        fields: ['accessible_pages'],
        name: 'idx_file_accessible_pages'
      },
      {
        fields: ['watermark_template_id'],
        name: 'idx_file_watermark_template_id'
      },
    ],
  });

  File.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)

    // SystemTemplate association for footer configuration
    File.belongsTo(models.SystemTemplate, {
      foreignKey: 'footer_template_id',
      as: 'footerTemplate'
    });

    // SystemTemplate association for watermark configuration
    File.belongsTo(models.SystemTemplate, {
      foreignKey: 'watermark_template_id',
      as: 'watermarkTemplate'
    });
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

  // SystemTemplate-related methods
  File.prototype.hasFooterTemplate = function() {
    return !!(this.footer_template_id);
  };

  File.prototype.getFooterTemplateId = function() {
    return this.footer_template_id;
  };

  // Enhanced footer merge helper for SystemTemplate integration
  File.prototype.mergeWithTemplateData = function(templateData) {
    if (!templateData) {
      return this.footer_overrides || {};
    }

    if (!this.hasFooterOverrides()) {
      return templateData;
    }

    // Deep merge template data with file overrides
    const merged = JSON.parse(JSON.stringify(templateData));
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

  // Set footer template for this file
  File.prototype.setFooterTemplate = function(templateId) {
    this.footer_template_id = templateId;
    return this.save();
  };

  // Clear footer template (will use default)
  File.prototype.clearFooterTemplate = function() {
    this.footer_template_id = null;
    return this.save();
  };

  // Accessible pages management methods
  File.prototype.hasAccessiblePagesRestriction = function() {
    return !!(this.accessible_pages && Array.isArray(this.accessible_pages) && this.accessible_pages.length > 0);
  };

  File.prototype.getAccessiblePages = function() {
    return this.accessible_pages || null; // null means all pages are accessible
  };

  File.prototype.setAccessiblePages = function(pageNumbers) {
    if (pageNumbers === null || pageNumbers === undefined) {
      this.accessible_pages = null; // Clear restrictions, all pages accessible
    } else if (Array.isArray(pageNumbers)) {
      // Validate page numbers (must be positive integers)
      const validPages = pageNumbers.filter(page => Number.isInteger(page) && page > 0);
      this.accessible_pages = validPages.length > 0 ? [...new Set(validPages)].sort((a, b) => a - b) : null;
    } else {
      throw new Error('Accessible pages must be an array of positive integers or null');
    }
    return this.save();
  };

  File.prototype.isPageAccessible = function(pageNumber) {
    if (!this.hasAccessiblePagesRestriction()) {
      return true; // No restrictions, all pages accessible
    }

    return this.accessible_pages.includes(pageNumber);
  };

  File.prototype.addAccessiblePage = function(pageNumber) {
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
      throw new Error('Page number must be a positive integer');
    }

    if (!this.hasAccessiblePagesRestriction()) {
      this.accessible_pages = [pageNumber];
    } else if (!this.accessible_pages.includes(pageNumber)) {
      this.accessible_pages = [...this.accessible_pages, pageNumber].sort((a, b) => a - b);
    }

    return this.save();
  };

  File.prototype.removeAccessiblePage = function(pageNumber) {
    if (!this.hasAccessiblePagesRestriction()) {
      return this; // No restrictions to remove from
    }

    this.accessible_pages = this.accessible_pages.filter(page => page !== pageNumber);

    // If no pages left, set to null (unrestricted)
    if (this.accessible_pages.length === 0) {
      this.accessible_pages = null;
    }

    return this.save();
  };

  // Watermark template methods
  File.prototype.hasWatermarkTemplate = function() {
    return !!(this.watermark_template_id);
  };

  File.prototype.getWatermarkTemplateId = function() {
    return this.watermark_template_id;
  };

  File.prototype.setWatermarkTemplate = function(templateId) {
    this.watermark_template_id = templateId;
    return this.save();
  };

  File.prototype.clearWatermarkTemplate = function() {
    this.watermark_template_id = null;
    return this.save();
  };

  // Preview mode check combining allow_preview and accessible_pages
  File.prototype.supportsPreviewMode = function() {
    return this.allow_preview === true;
  };

  File.prototype.isPreviewModeRestricted = function() {
    return this.supportsPreviewMode() && this.hasAccessiblePagesRestriction();
  };

  File.prototype.getPreviewModeInfo = function() {
    return {
      supportsPreview: this.supportsPreviewMode(),
      hasPageRestrictions: this.hasAccessiblePagesRestriction(),
      accessiblePages: this.getAccessiblePages(),
      hasWatermarkTemplate: this.hasWatermarkTemplate(),
      watermarkTemplateId: this.getWatermarkTemplateId()
    };
  };

  return File;
}