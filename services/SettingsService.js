import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

class SettingsService {
  constructor() {
    this.cache = {
      settings: null,
      lastFetch: null,
      cacheValidDuration: 5 * 60 * 1000 // 5 minutes in milliseconds
    };
  }

  /**
   * Get current settings built from Settings records with caching
   * @returns {Promise<Object>} Settings object (identical to ConfigurationService)
   */
  async getSettings() {
    const now = Date.now();

    // Return cached settings if still valid
    if (this.cache.settings &&
        this.cache.lastFetch &&
        (now - this.cache.lastFetch) < this.cache.cacheValidDuration) {
      return this.cache.settings;
    }

    // Fetch fresh settings from settings records
    await this.refreshCache();
    return this.cache.settings;
  }

  /**
   * Refresh settings cache from Settings records
   * @returns {Promise<Object>} Fresh settings object
   */
  async refreshCache() {
    try {
      // Fetch all settings records
      const settingsRecords = await models.Settings.findAll({
        order: [['key', 'ASC']]
      });

      if (!settingsRecords || settingsRecords.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await this.createDefaultSettings();
        this.cache.settings = defaultSettings;
      } else {
        // Build Settings-like object from Settings records
        this.cache.settings = models.Settings.buildSettingsObject(settingsRecords);
        // Add an id for compatibility
        this.cache.settings.id = 1;
      }

      this.cache.lastFetch = Date.now();
      return this.cache.settings;
    } catch (error) {
      console.error('Error refreshing settings cache:', error);
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
      { id: generateId(), key: 'students_access', value: 'all', value_type: 'string', description: 'Student portal access mode' },
      { id: generateId(), key: 'maintenance_mode', value: false, value_type: 'boolean', description: 'System maintenance mode' }
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
      console.error(`Error getting setting '${key}':`, error);
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
        (settings.students_access || 'all');
    } catch (error) {
      console.error('Error getting students access mode:', error);
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
      console.error('Error checking students access status:', error);
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
        !!settings.maintenance_mode;
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      return false;
    }
  }

  /**
   * Force cache invalidation (useful for testing or after settings updates)
   */
  clearCache() {
    this.cache.settings = null;
    this.cache.lastFetch = null;
  }

  /**
   * Update settings and refresh cache
   * @param {Object} updates - Settings fields to update
   * @returns {Promise<Object>} Updated settings object
   */
  async updateSettings(updates) {
    const transaction = await models.sequelize.transaction();

    try {
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
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Get cache status (useful for debugging)
   * @returns {Object} Cache status information
   */
  getCacheStatus() {
    const now = Date.now();
    const isValid = this.cache.settings &&
                   this.cache.lastFetch &&
                   (now - this.cache.lastFetch) < this.cache.cacheValidDuration;

    return {
      hasCache: !!this.cache.settings,
      lastFetch: this.cache.lastFetch,
      isValid,
      ageMs: this.cache.lastFetch ? (now - this.cache.lastFetch) : null,
      cacheValidDuration: this.cache.cacheValidDuration
    };
  }
}

// Export singleton instance
export default new SettingsService();