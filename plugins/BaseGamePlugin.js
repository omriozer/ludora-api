/**
 * Base Game Plugin Interface - API Version
 *
 * Defines the contract that all game type plugins must implement on the server side.
 * Focuses on data transformation and validation rather than UI components.
 */

export class BaseGamePlugin {
  constructor(gameType) {
    this.gameType = gameType;
  }

  /**
   * Returns the default settings for this game type
   * @returns {object}
   */
  getDefaultSettings() {
    return {};
  }

  /**
   * Validates game settings for this type
   * @param {object} settings - The settings to validate
   * @returns {object} - { isValid: boolean, errors: string[] }
   */
  validateSettings(settings) {
    return { isValid: true, errors: [] };
  }

  /**
   * Transforms game data before saving to match this game type's schema
   * @param {object} gameData - The raw game data from the wizard
   * @returns {object} - Transformed data ready for database
   */
  transformForSave(gameData) {
    return gameData;
  }

  /**
   * Transforms loaded game data for use in the wizard
   * @param {object} gameData - The game data from database
   * @returns {object} - Transformed data for wizard
   */
  transformForEdit(gameData) {
    return gameData;
  }

  /**
   * Define structured database schema requirements for this game type
   * @returns {object} Schema definition
   */
  getSchemaDefinition() {
    return {
      structuredTables: [],
      extractedSettings: [],
      jsonbIndexes: []
    };
  }

  /**
   * Extract structured data from game settings for storage in auxiliary tables
   * @param {object} gameData - Complete game data including settings
   * @returns {object} - { tableName: dataArray } mapping
   */
  extractStructuredData(gameData) {
    return {};
  }

  /**
   * Merge structured data back into game settings for editing
   * @param {object} gameData - Game data from database
   * @param {object} structuredData - Data from auxiliary tables
   * @returns {object} - Enhanced game data for wizard
   */
  mergeStructuredData(gameData, structuredData) {
    return gameData;
  }

  /**
   * Validate consistency between JSONB and structured data
   * @param {object} gameSettings - Settings from JSONB column
   * @param {object} structuredData - Data from auxiliary tables
   * @returns {object} - { isValid: boolean, errors: string[] }
   */
  validateStructuredDataConsistency(gameSettings, structuredData) {
    return { isValid: true, errors: [] };
  }
}

export default BaseGamePlugin;