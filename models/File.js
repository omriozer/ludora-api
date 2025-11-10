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
    add_branding: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    branding_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'DEPRECATED: Use branding_overrides instead. Complete branding config now in Settings. Kept for backward compatibility.'
    },
    branding_overrides: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File-specific branding overrides (positioning, styling). Content comes from SystemTemplate.'
    },
    branding_template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference to system_templates for branding configuration'
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
    watermark_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Custom watermark settings in JSONB format, overrides watermark template when present'
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
        fields: ['branding_overrides'],
        name: 'idx_file_branding_overrides'
      },
      {
        fields: ['branding_template_id'],
        name: 'idx_file_branding_template_id'
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

    // SystemTemplate association for branding configuration
    File.belongsTo(models.SystemTemplate, {
      foreignKey: 'branding_template_id',
      as: 'brandingTemplate'
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

  // Branding settings standardization methods
  File.prototype.hasBrandingOverrides = function() {
    return !!(this.branding_overrides && Object.keys(this.branding_overrides).length > 0);
  };

  File.prototype.getBrandingOverrides = function() {
    // Use standardized field if available
    if (this.branding_overrides) {
      return this.branding_overrides;
    }
    return null;
  };

  File.prototype.shouldAddBranding = function() {
    // Check the add_branding flag
    return this.add_branding === true;
  };

  // Legacy method names for backward compatibility
  File.prototype.hasFooterOverrides = function() {
    return this.hasBrandingOverrides();
  };

  File.prototype.getFooterOverrides = function() {
    return this.getBrandingOverrides();
  };

  File.prototype.shouldAddFooter = function() {
    return this.shouldAddBranding();
  };

  // Legacy compatibility method with deprecation warning
  File.prototype.getLegacyBrandingSettings = function() {
    if (this.branding_settings) {
      DeprecationWarnings.warnDirectUsage('file', 'branding_settings', {
        fileId: this.id,
        location: 'File.getLegacyBrandingSettings',
        message: 'Use branding_overrides with Settings.branding_settings merge instead'
      });
    }
    return this.branding_settings;
  };

  File.prototype.getLegacyFooterSettings = function() {
    return this.getLegacyBrandingSettings();
  };

  // Branding merge helper (for use with Settings branding_settings)
  File.prototype.mergeWithSystemBrandingSettings = function(systemBrandingSettings) {
    if (!systemBrandingSettings) {
      return this.branding_overrides || {};
    }

    if (!this.hasBrandingOverrides()) {
      return systemBrandingSettings;
    }

    // Deep merge system settings with file overrides
    const merged = JSON.parse(JSON.stringify(systemBrandingSettings));
    const overrides = this.branding_overrides;

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

  // Legacy method for backward compatibility
  File.prototype.mergeWithSystemFooterSettings = function(systemFooterSettings) {
    return this.mergeWithSystemBrandingSettings(systemFooterSettings);
  };

  // SystemTemplate-related methods
  File.prototype.hasBrandingTemplate = function() {
    return !!(this.branding_template_id);
  };

  File.prototype.getBrandingTemplateId = function() {
    return this.branding_template_id;
  };

  // Legacy methods for backward compatibility
  File.prototype.hasFooterTemplate = function() {
    return this.hasBrandingTemplate();
  };

  File.prototype.getFooterTemplateId = function() {
    return this.getBrandingTemplateId();
  };

  // Enhanced branding merge helper for SystemTemplate integration
  File.prototype.mergeWithTemplateData = function(templateData) {
    if (!templateData) {
      return this.branding_overrides || {};
    }

    if (!this.hasBrandingOverrides()) {
      return templateData;
    }

    // Deep merge template data with file overrides
    const merged = JSON.parse(JSON.stringify(templateData));
    const overrides = this.branding_overrides;

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

  // Set branding template for this file
  File.prototype.setBrandingTemplate = function(templateId) {
    this.branding_template_id = templateId;
    return this.save();
  };

  // Clear branding template (will use default)
  File.prototype.clearBrandingTemplate = function() {
    this.branding_template_id = null;
    return this.save();
  };

  // Legacy methods for backward compatibility
  File.prototype.setFooterTemplate = function(templateId) {
    return this.setBrandingTemplate(templateId);
  };

  File.prototype.clearFooterTemplate = function() {
    return this.clearBrandingTemplate();
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

  // Watermark settings methods
  File.prototype.hasWatermarkSettings = function() {
    return !!(this.watermark_settings && Object.keys(this.watermark_settings).length > 0);
  };

  File.prototype.getWatermarkSettings = function() {
    return this.watermark_settings;
  };

  File.prototype.setWatermarkSettings = function(settings) {
    this.watermark_settings = settings;
    return this.save();
  };

  File.prototype.clearWatermarkSettings = function() {
    this.watermark_settings = null;
    return this.save();
  };

  // Combined watermark template/settings helper
  File.prototype.getEffectiveWatermarkConfig = function() {
    if (this.hasWatermarkSettings()) {
      return { type: 'custom', data: this.watermark_settings };
    } else if (this.hasWatermarkTemplate()) {
      return { type: 'template', templateId: this.watermark_template_id };
    } else {
      return { type: 'default', data: null };
    }
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
      watermarkTemplateId: this.getWatermarkTemplateId(),
      hasWatermarkSettings: this.hasWatermarkSettings(),
      watermarkConfig: this.getEffectiveWatermarkConfig()
    };
  };

  return File;
}