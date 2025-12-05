import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Settings = sequelize.define('Settings', {
    ...baseFields,
    key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Configuration key (e.g., subscription_system_enabled, contact_email)'
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuration value stored as JSON (supports strings, numbers, booleans, objects, arrays)'
    },
    value_type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'object', 'array'),
      allowNull: false,
      defaultValue: 'string',
      comment: 'Type hint for value casting'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Human-readable description of this configuration setting'
    }
  }, {
    ...baseOptions,
    tableName: 'settings',
    indexes: [
      {
        fields: ['key'],
        unique: true,
        name: 'idx_settings_key'
      },
      {
        fields: ['value_type'],
        name: 'idx_settings_value_type'
      },
      {
        fields: ['created_at'],
        name: 'idx_settings_created_at'
      }
    ]
  });

  // Static method to build Settings-like object from key-value pairs
  Settings.buildSettingsObject = function(configRecords) {
    const settings = {};

    for (const config of configRecords) {
      let value = config.value;

      // Cast values based on type hint, but preserve null values
      if (value !== null && value !== undefined) {
        switch (config.value_type) {
          case 'boolean':
            value = Boolean(value);
            break;
          case 'number':
            value = Number(value);
            break;
          case 'string':
            value = String(value);
            break;
          case 'object':
          case 'array':
            // JSONB already parsed, use as-is
            break;
          default:
            // Keep original value
            break;
        }
      }
      // If value is null or undefined, keep it as-is (don't cast to string)

      settings[config.key] = value;
    }

    // Add all the prototype methods that Settings has
    return Settings.addSettingsPrototypeMethods(settings);
  };

  // Add all Settings prototype methods to the built object
  Settings.addSettingsPrototypeMethods = function(settings) {
    // Logo reference standardization methods
    settings.hasLogoAsset = function() {
      if (this.has_logo !== undefined) {
        return this.has_logo;
      }
      // Legacy fallback
      return !!(this.logo_url && this.logo_url !== '');
    };

    settings.getLogoFilename = function() {
      if (this.logo_filename) {
        return this.logo_filename;
      }
      // Legacy fallback - extract filename from URL
      if (this.logo_url && this.logo_url.includes('/')) {
        const parts = this.logo_url.split('/');
        return parts[parts.length - 1] || 'logo.svg';
      }
      return null;
    };

    settings.getLogoUrl = function() {
      if (this.hasLogoAsset()) {
        const filename = this.getLogoFilename();
        if (filename) {
          // Return the standardized path structure
          return `/api/assets/image/settings/${this.id || 1}/${filename}`;
        }
      }
      return null;
    };

    settings.getLegacyLogoUrl = function() {
      return this.getLogoUrl();
    };

    // Settings-specific utility methods
    settings.isMaintenanceMode = function() {
      return !!this.maintenance_mode;
    };

    settings.isTeacherOnboardingEnabled = function() {
      // Default to true if setting doesn't exist
      if (this.teacher_onboarding_enabled === undefined || this.teacher_onboarding_enabled === null) {
        return true;
      }
      return !!this.teacher_onboarding_enabled;
    };

    settings.getStudentsAccessMode = function() {
      return this.students_access || 'all';
    };

    settings.isStudentsAccessEnabled = function() {
      const mode = this.getStudentsAccessMode();
      return mode === 'all' || mode === 'invite_only' || mode === 'authed_only';
    };

    settings.getContactInfo = function() {
      return {
        email: this.contact_email,
        phone: this.contact_phone,
        siteName: this.site_name,
        description: this.site_description
      };
    };

    // Add toJSON method for consistency with Sequelize models
    settings.toJSON = function() {
      const obj = { ...this };
      // Remove prototype methods from JSON output
      delete obj.hasLogoAsset;
      delete obj.getLogoFilename;
      delete obj.getLogoUrl;
      delete obj.getLegacyLogoUrl;
      delete obj.isMaintenanceMode;
      delete obj.isTeacherOnboardingEnabled;
      delete obj.getStudentsAccessMode;
      delete obj.isStudentsAccessEnabled;
      delete obj.getContactInfo;
      delete obj.toJSON;
      return obj;
    };

    return settings;
  };

  return Settings;
}