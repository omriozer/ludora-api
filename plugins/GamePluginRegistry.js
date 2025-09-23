/**
 * Game Plugin Registry - API Version
 *
 * Central registry for all game type plugins on the server side.
 * Provides a unified interface for registering, retrieving, and managing game type plugins.
 */

class GamePluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.initialize();
  }

  /**
   * Initialize the registry with default plugins
   */
  async initialize() {
    try {
      // Register core game plugins
      const { MemoryGamePlugin } = await import('./MemoryGamePlugin.js');
      this.register(new MemoryGamePlugin());

      console.debug('GamePluginRegistry initialized with plugins:', this.getRegisteredGameTypes());
    } catch (error) {
      console.error('Error initializing GamePluginRegistry:', error);
    }
  }

  /**
   * Register a game plugin
   * @param {object} plugin - The plugin instance to register
   */
  register(plugin) {
    if (!plugin.gameType) {
      throw new Error('Plugin must have a gameType property');
    }

    if (this.plugins.has(plugin.gameType)) {
      console.warn(`Plugin for game type '${plugin.gameType}' is already registered. Overwriting.`);
    }

    this.plugins.set(plugin.gameType, plugin);
    console.debug(`Registered plugin for game type: ${plugin.gameType}`);
  }

  /**
   * Get a plugin by game type
   * @param {string} gameType - The game type
   * @returns {object|null} - The plugin instance or null if not found
   */
  getPlugin(gameType) {
    return this.plugins.get(gameType) || null;
  }

  /**
   * Check if a plugin is registered for a game type
   * @param {string} gameType - The game type
   * @returns {boolean}
   */
  hasPlugin(gameType) {
    return this.plugins.has(gameType);
  }

  /**
   * Get all registered game types
   * @returns {string[]} - Array of registered game type keys
   */
  getRegisteredGameTypes() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Transform game data for saving using the appropriate plugin
   * @param {string} gameType - The game type
   * @param {object} gameData - The game data to transform
   * @returns {object} - Transformed game data
   */
  transformForSave(gameType, gameData) {
    const plugin = this.getPlugin(gameType);
    if (!plugin || typeof plugin.transformForSave !== 'function') {
      return gameData;
    }

    return plugin.transformForSave(gameData);
  }

  /**
   * Transform loaded game data for editing using the appropriate plugin
   * @param {string} gameType - The game type
   * @param {object} gameData - The loaded game data
   * @param {object} structuredData - Data from auxiliary tables (optional)
   * @returns {object} - Transformed game data for editing
   */
  transformForEdit(gameType, gameData, structuredData = null) {
    const plugin = this.getPlugin(gameType);
    if (!plugin || typeof plugin.transformForEdit !== 'function') {
      return gameData;
    }

    let transformed = plugin.transformForEdit(gameData);

    // Merge structured data if available and plugin supports it
    if (structuredData && typeof plugin.mergeStructuredData === 'function') {
      transformed = plugin.mergeStructuredData(transformed, structuredData);
    }

    return transformed;
  }

  /**
   * Validate game data using the appropriate plugin
   * @param {string} gameType - The game type
   * @param {object} gameData - The game data to validate
   * @returns {object} - { isValid: boolean, errors: string[] }
   */
  validateGameData(gameType, gameData) {
    const plugin = this.getPlugin(gameType);
    if (!plugin) {
      return {
        isValid: false,
        errors: [`No plugin found for game type: ${gameType}`]
      };
    }

    if (typeof plugin.validateSettings === 'function') {
      return plugin.validateSettings(gameData.game_settings || {});
    }

    return { isValid: true, errors: [] };
  }
}

// Create and export a singleton instance
const gamePluginRegistry = new GamePluginRegistry();

export { GamePluginRegistry };
export default gamePluginRegistry;