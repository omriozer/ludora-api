import models from '../models/index.js';

class SettingsService {
  constructor() {
    this.cache = {
      settings: null,
      lastFetch: null,
      cacheValidDuration: 5 * 60 * 1000 // 5 minutes in milliseconds
    };
  }

  /**
   * Get current settings with caching
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    const now = Date.now();

    // Return cached settings if still valid
    if (this.cache.settings &&
        this.cache.lastFetch &&
        (now - this.cache.lastFetch) < this.cache.cacheValidDuration) {
      return this.cache.settings;
    }

    // Fetch fresh settings from database
    await this.refreshCache();
    return this.cache.settings;
  }

  /**
   * Refresh settings cache from database
   * @returns {Promise<Object>} Fresh settings object
   */
  async refreshCache() {
    try {
      const settingsArray = await models.Settings.findAll();

      if (!settingsArray || settingsArray.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await models.Settings.create({
          students_access: 'all',
          maintenance_mode: false
        });
        this.cache.settings = defaultSettings;
      } else {
        // Use first (and typically only) settings record
        this.cache.settings = settingsArray[0];
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
    try {
      const settings = await this.getSettings();

      // Update the settings record
      await settings.update(updates);

      // Refresh cache with updated data
      await this.refreshCache();

      return this.cache.settings;
    } catch (error) {
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