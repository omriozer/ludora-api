import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import {
  ACCESS_CONTROL_KEYS,
  SYSTEM_KEYS,
  CONTACT_INFO_KEYS,
  BRANDING_KEYS,
  NAVIGATION_KEYS,
  CONTENT_CREATOR_KEYS,
  ACCESS_DURATION_KEYS,
  ADVANCED_FEATURES_KEYS
} from '../constants/settingsKeys.js';
import { error } from '../lib/errorLogger.js';

class SettingsService {
  constructor() {
    this.cache = {
      settings: null,
      etag: null  // Store max updated_at as etag
    };

    // Create whitelist of allowed setting keys for security
    this.allowedSettingsKeys = new Set([
      ...Object.values(ACCESS_CONTROL_KEYS),
      ...Object.values(SYSTEM_KEYS),
      ...Object.values(CONTACT_INFO_KEYS),
      ...Object.values(BRANDING_KEYS),
      ...Object.values(NAVIGATION_KEYS),
      ...Object.values(CONTENT_CREATOR_KEYS),
      ...Object.values(ACCESS_DURATION_KEYS),
      ...Object.values(ADVANCED_FEATURES_KEYS)
    ]);
  }

  /**
   * Validate setting key and value for security
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @throws {Error} If validation fails
   */
  validateSetting(key, value) {
    // Validate key format
    if (!key || typeof key !== 'string') {
      throw new Error('Setting key must be a non-empty string');
    }

    // Validate key length
    if (key.length > 255) {
      throw new Error(`Setting key too long: ${key.substring(0, 50)}...`);
    }

    // Whitelist validation
    if (!this.allowedSettingsKeys.has(key)) {
      throw new Error(`Invalid setting key: ${key}`);
    }

    // Validate value constraints
    if (value !== null) {
      if (typeof value === 'string' && value.length > 10000) {
        throw new Error(`Setting value too long for key: ${key}`);
      }

      if (typeof value === 'object' && JSON.stringify(value).length > 50000) {
        throw new Error(`Setting object too large for key: ${key}`);
      }
    }
  }

  /**
   * Get current settings built from Settings records with data-driven caching
   * @returns {Promise<Object>} Settings object (identical to ConfigurationService)
   */
  async getSettings() {
    // Get current data version from database
    const currentEtag = await models.Settings.max('updated_at');

    // Return cached settings if data hasn't changed
    if (this.cache.settings && this.cache.etag &&
        String(this.cache.etag) === String(currentEtag)) {
      return this.cache.settings;
    }

    // Fetch fresh settings from settings records
    await this.refreshCache(currentEtag);
    return this.cache.settings;
  }

  /**
   * Refresh settings cache from Settings records
   * @param {Date|string} etag - Data version (max updated_at)
   * @returns {Promise<Object>} Fresh settings object
   */
  async refreshCache(etag = null) {
    try {
      // Fetch all settings records
      const settingsRecords = await models.Settings.findAll({
        order: [['key', 'ASC']]
      });

      if (!settingsRecords || settingsRecords.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await this.createDefaultSettings();
        this.cache.settings = defaultSettings;
        this.cache.etag = await models.Settings.max('updated_at'); // Get current etag
      } else {
        // Build Settings-like object from Settings records
        this.cache.settings = models.Settings.buildSettingsObject(settingsRecords);
        // Add an id for compatibility
        this.cache.settings.id = 1;
        this.cache.etag = etag || await models.Settings.max('updated_at'); // Store etag
      }

      return this.cache.settings;
    } catch (error) {
      error.api('Error refreshing settings cache:', error);
      // If cache exists, return it as fallback
      if (this.cache.settings) {
        return this.cache.settings;
      }
      throw error;
    }
  }

  /**
   * Create default settings records
   * @returns {Promise<Object>} Default settings object
   */
  async createDefaultSettings() {
    const defaultConfigs = [
      { id: generateId(), key: ACCESS_CONTROL_KEYS.STUDENTS_ACCESS, value: 'all', value_type: 'string', description: 'Student portal access mode' },
      { id: generateId(), key: SYSTEM_KEYS.MAINTENANCE_MODE, value: false, value_type: 'boolean', description: 'System maintenance mode' }
    ];

    const transaction = await models.sequelize.transaction();
    try {
      // Create default settings records
      await models.Settings.bulkCreate(defaultConfigs, { transaction });
      await transaction.commit();

      // Return built settings object
      return models.Settings.buildSettingsObject(defaultConfigs.map(config => ({
        key: config.key,
        value: config.value,
        value_type: config.value_type
      })));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a specific setting value by key
   * @param {string} key - Setting key to retrieve
   * @returns {Promise<any>} Setting value or null if not found
   */
  async get(key) {
    try {
      const settings = await this.getSettings();
      return settings[key] || null;
    } catch (error) {
      error.api(`Error getting setting '${key}':`, error);
      return null;
    }
  }

  /**
   * Get students access mode with fallback
   * @returns {Promise<string>} Access mode: 'invite_only', 'authed_only', or 'all'
   */
  async getStudentsAccessMode() {
    try {
      const settings = await this.getSettings();
      return settings.getStudentsAccessMode ?
        settings.getStudentsAccessMode() :
        (settings[ACCESS_CONTROL_KEYS.STUDENTS_ACCESS] || 'all');
    } catch (error) {
      error.api('Error getting students access mode:', error);
      // Safe fallback to 'all' to maintain current functionality
      return 'all';
    }
  }

  /**
   * Check if students access is enabled
   * @returns {Promise<boolean>} True if student access is enabled
   */
  async isStudentsAccessEnabled() {
    try {
      const settings = await this.getSettings();
      return settings.isStudentsAccessEnabled ?
        settings.isStudentsAccessEnabled() :
        true; // Default to enabled
    } catch (error) {
      error.api('Error checking students access status:', error);
      return true; // Safe fallback to enabled
    }
  }

  /**
   * Check if specific access mode is active
   * @param {string} mode - Access mode to check ('invite_only', 'authed_only', 'all')
   * @returns {Promise<boolean>} True if the specified mode is active
   */
  async isAccessMode(mode) {
    const currentMode = await this.getStudentsAccessMode();
    return currentMode === mode;
  }

  /**
   * Get maintenance mode status
   * @returns {Promise<boolean>} True if maintenance mode is active
   */
  async isMaintenanceMode() {
    try {
      const settings = await this.getSettings();
      return settings.isMaintenanceMode ?
        settings.isMaintenanceMode() :
        !!settings[SYSTEM_KEYS.MAINTENANCE_MODE];
    } catch (error) {
      error.api('Error checking maintenance mode:', error);
      return false;
    }
  }

  /**
   * Check if teacher onboarding feature is enabled
   * @returns {Promise<boolean>} True if teacher onboarding is enabled (default: true)
   */
  async isTeacherOnboardingEnabled() {
    try {
      const settings = await this.getSettings();
      // Default to true if setting doesn't exist
      if (settings[SYSTEM_KEYS.TEACHER_ONBOARDING_ENABLED] === undefined || settings[SYSTEM_KEYS.TEACHER_ONBOARDING_ENABLED] === null) {
        return true;
      }
      return !!settings[SYSTEM_KEYS.TEACHER_ONBOARDING_ENABLED];
    } catch (error) {
      error.api('Error checking teacher onboarding status:', error);
      // Default to enabled on error to not break onboarding flow
      return true;
    }
  }

  /**
   * Force cache invalidation (useful for testing or after settings updates)
   */
  clearCache() {
    this.cache.settings = null;
    this.cache.etag = null;
  }

  /**
   * Update settings and refresh cache
   * @param {Object} updates - Settings fields to update
   * @returns {Promise<Object>} Updated settings object
   */
  async updateSettings(updates) {
    const transaction = await models.sequelize.transaction();

    try {
      // Validate all settings before processing
      for (const [key, value] of Object.entries(updates)) {
        this.validateSetting(key, value);
      }

      // Convert empty strings and string "null" to actual null for string-type fields
      const processedUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'string' && (value === '' || value === 'null')) {
          processedUpdates[key] = null;  // Convert empty string or string "null" to null
        } else {
          processedUpdates[key] = value;
        }
      }

      // Update individual settings records
      for (const [key, value] of Object.entries(processedUpdates)) {
        if (value !== undefined) {
          // Determine value type
          let valueType = 'string';
          if (value === null) {
            // For null values, try to preserve existing value_type or default to string
            const existingRecord = await models.Settings.findOne({ where: { key }, transaction });
            valueType = existingRecord?.value_type || 'string';
          } else if (typeof value === 'boolean') {
            valueType = 'boolean';
          } else if (typeof value === 'number') {
            valueType = 'number';
          } else if (typeof value === 'object') {
            valueType = Array.isArray(value) ? 'array' : 'object';
          }

          // Update or create settings record using findOrCreate
          const [record, created] = await models.Settings.findOrCreate({
            where: { key: key },
            defaults: {
              id: generateId(), // Generate custom string ID
              key: key,
              value: value,
              value_type: valueType,
              description: `Updated settings for ${key}`
            },
            transaction
          });

          // If record already exists, update it
          if (!created) {
            await record.update({
              value: value,
              value_type: valueType
            }, { transaction });
          }
        }
      }

      await transaction.commit();

      // Refresh cache with updated data
      await this.refreshCache();

      return this.cache.settings;
    } catch (error) {
      await transaction.rollback();
      error.api('Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Get cache status (useful for debugging)
   * @returns {Object} Cache status information
   */
  async getCacheStatus() {
    const currentEtag = await models.Settings.max('updated_at');
    const isValid = this.cache.settings &&
                   this.cache.etag &&
                   String(this.cache.etag) === String(currentEtag);

    return {
      hasCache: !!this.cache.settings,
      etag: this.cache.etag,
      currentEtag: currentEtag,
      isValid,
      cachingStrategy: 'data-driven'
    };
  }
}

// Export singleton instance
export default new SettingsService();