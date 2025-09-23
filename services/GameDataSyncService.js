import { MemoryPairingRule, ManualMemoryPair, Game } from '../models/index.js';

/**
 * Game Data Sync Service
 *
 * Handles synchronization between the game_settings JSONB column and structured tables.
 * Maintains data consistency and provides efficient querying capabilities.
 */
export class GameDataSyncService {
  /**
   * Sync game data to structured tables based on plugin schema definitions
   * @param {string} gameId - The game ID
   * @param {object} gameData - Complete game data
   * @param {object} plugin - The game plugin instance
   * @returns {Promise<object>} - Sync result
   */
  static async syncToStructuredTables(gameId, gameData, plugin) {
    if (!plugin || !plugin.getSchemaDefinition) {
      return { success: true, message: 'No plugin schema definition' };
    }

    const schemaDefinition = plugin.getSchemaDefinition();
    const extractedData = plugin.extractStructuredData(gameData);

    const results = {};

    try {
      // Process each structured table
      for (const tableName of schemaDefinition.structuredTables) {
        const tableData = extractedData[tableName];

        if (tableData) {
          switch (tableName) {
            case 'memory_pairing_rules':
              results[tableName] = await this.syncMemoryPairingRules(gameId, tableData);
              break;
            // Add other table handlers here as needed
            default:
              console.warn(`Unknown structured table: ${tableName}`);
          }
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error syncing to structured tables:', error);
      throw error;
    }
  }

  /**
   * Load structured data and merge back into game data
   * @param {object} gameData - Game data from database
   * @param {object} plugin - The game plugin instance
   * @returns {Promise<object>} - Enhanced game data
   */
  static async loadStructuredData(gameData, plugin) {
    if (!plugin || !plugin.getSchemaDefinition) {
      return gameData;
    }

    const schemaDefinition = plugin.getSchemaDefinition();
    const structuredData = {};

    try {
      // Load data from each structured table
      for (const tableName of schemaDefinition.structuredTables) {
        switch (tableName) {
          case 'memory_pairing_rules':
            structuredData[tableName] = await this.loadMemoryPairingRules(gameData.id);
            break;
          // Add other table loaders here as needed
          default:
            console.warn(`Unknown structured table: ${tableName}`);
        }
      }

      // Merge structured data back into game data
      return plugin.mergeStructuredData(gameData, structuredData);
    } catch (error) {
      console.error('Error loading structured data:', error);
      return gameData;
    }
  }

  /**
   * Validate consistency between JSONB and structured data
   * @param {object} gameData - Game data with JSONB settings
   * @param {object} plugin - The game plugin instance
   * @returns {Promise<object>} - Validation result
   */
  static async validateConsistency(gameData, plugin) {
    if (!plugin || !plugin.validateStructuredDataConsistency) {
      return { isValid: true, errors: [] };
    }

    try {
      const structuredData = {};
      const schemaDefinition = plugin.getSchemaDefinition();

      // Load current structured data
      for (const tableName of schemaDefinition.structuredTables) {
        switch (tableName) {
          case 'memory_pairing_rules':
            structuredData[tableName] = await this.loadMemoryPairingRules(gameData.id);
            break;
        }
      }

      return plugin.validateStructuredDataConsistency(gameData.game_settings, structuredData);
    } catch (error) {
      console.error('Error validating consistency:', error);
      return { isValid: false, errors: [`Validation error: ${error.message}`] };
    }
  }

  /**
   * Sync memory pairing rules to structured tables
   * @param {string} gameId - The game ID
   * @param {Array} pairingRules - Array of pairing rule data
   * @returns {Promise<Array>} - Created rules
   */
  static async syncMemoryPairingRules(gameId, pairingRules) {
    return await MemoryPairingRule.createFromGameSettings(gameId, pairingRules);
  }

  /**
   * Load memory pairing rules from structured tables
   * @param {string} gameId - The game ID
   * @returns {Promise<Array>} - Array of pairing rules with manual pairs
   */
  static async loadMemoryPairingRules(gameId) {
    const rules = await MemoryPairingRule.findByGameId(gameId);

    return rules.map(rule => ({
      id: rule.id,
      rule_type: rule.rule_type,
      content_type_a: rule.content_type_a,
      content_type_b: rule.content_type_b,
      attribute_name: rule.attribute_name,
      pair_config: rule.pair_config,
      priority: rule.priority,
      is_active: rule.is_active,
      manual_pairs: rule.manual_pairs ? rule.manual_pairs.map(pair => pair.toGameSettings()) : []
    }));
  }

  /**
   * Clean up structured data for a deleted game
   * @param {string} gameId - The game ID
   * @returns {Promise<object>} - Cleanup result
   */
  static async cleanupStructuredData(gameId) {
    try {
      const results = {};

      // Clean up memory pairing rules (cascades to manual pairs)
      const deletedRules = await MemoryPairingRule.destroy({
        where: { game_id: gameId }
      });
      results.memory_pairing_rules = deletedRules;

      return { success: true, deleted: results };
    } catch (error) {
      console.error('Error cleaning up structured data:', error);
      throw error;
    }
  }

  /**
   * Get analytics data from structured tables
   * @param {object} filters - Query filters
   * @returns {Promise<object>} - Analytics data
   */
  static async getAnalytics(filters = {}) {
    try {
      const analytics = {};

      // Memory game analytics
      if (!filters.gameType || filters.gameType === 'memory_game') {
        analytics.memory_games = await this.getMemoryGameAnalytics(filters);
      }

      return analytics;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  /**
   * Get memory game specific analytics
   * @param {object} filters - Query filters
   * @returns {Promise<object>} - Memory game analytics
   */
  static async getMemoryGameAnalytics(filters = {}) {
    const { Op } = await import('sequelize');
    const { default: sequelize } = await import('../config/database.js');

    // Get pairing rule distribution
    const pairingRuleStats = await MemoryPairingRule.findAll({
      attributes: [
        'rule_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['rule_type'],
      raw: true
    });

    // Get content type pair combinations
    const contentTypePairs = await MemoryPairingRule.findAll({
      attributes: [
        'content_type_a',
        'content_type_b',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        content_type_a: { [Op.ne]: null },
        content_type_b: { [Op.ne]: null }
      },
      group: ['content_type_a', 'content_type_b'],
      raw: true
    });

    // Get games with complex pairing rules (more than 1 rule)
    const complexGames = await sequelize.query(`
      SELECT g.id, g.title, COUNT(mpr.id) as rule_count
      FROM game g
      JOIN memory_pairing_rules mpr ON g.id = mpr.game_id
      WHERE g.game_type = 'memory_game'
      GROUP BY g.id, g.title
      HAVING COUNT(mpr.id) > 1
      ORDER BY rule_count DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    return {
      pairing_rule_distribution: pairingRuleStats,
      content_type_combinations: contentTypePairs,
      complex_games: complexGames,
      total_rules: pairingRuleStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
    };
  }
}

export default GameDataSyncService;