const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Game Query Builder
 *
 * Provides optimized queries for game data using both JSONB and structured tables.
 * Handles complex analytics and reporting queries with proper indexing.
 */
class GameQueryBuilder {
  /**
   * Find games by settings criteria
   * @param {object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of games matching criteria
   */
  static async findBySettings(criteria = {}) {
    const {
      gameType,
      pairsCount,
      matchTimeLimit,
      difficultyProgression,
      gridSize,
      wordsPerLevel,
      limit = 50,
      offset = 0
    } = criteria;

    let whereClause = {};
    let settingsWhere = [];

    // Base game type filter
    if (gameType) {
      whereClause.game_type = gameType;
    }

    // Memory game specific filters
    if (pairsCount) {
      if (typeof pairsCount === 'object') {
        // Range query: { min: 6, max: 12 }
        settingsWhere.push(
          `(game_settings->>'pairs_count')::int BETWEEN ${pairsCount.min} AND ${pairsCount.max}`
        );
      } else {
        settingsWhere.push(`(game_settings->>'pairs_count')::int = ${pairsCount}`);
      }
    }

    if (matchTimeLimit !== undefined) {
      if (matchTimeLimit === null) {
        settingsWhere.push(`game_settings->>'match_time_limit' IS NULL`);
      } else {
        settingsWhere.push(`(game_settings->>'match_time_limit')::int = ${matchTimeLimit}`);
      }
    }

    if (difficultyProgression !== undefined) {
      settingsWhere.push(
        `game_settings->'difficulty_progression'->>'enabled' = '${difficultyProgression}'`
      );
    }

    // Scatter game specific filters
    if (gridSize) {
      if (typeof gridSize === 'object') {
        settingsWhere.push(
          `(game_settings->>'grid_size')::int BETWEEN ${gridSize.min} AND ${gridSize.max}`
        );
      } else {
        settingsWhere.push(`(game_settings->>'grid_size')::int = ${gridSize}`);
      }
    }

    if (wordsPerLevel) {
      settingsWhere.push(`(game_settings->>'words_per_level')::int = ${wordsPerLevel}`);
    }

    // Build the query
    let query = `
      SELECT
        id,
        title,
        short_description,
        game_type,
        is_published,
        game_settings,
        created_at,
        updated_at
      FROM game
      WHERE 1=1
    `;

    if (Object.keys(whereClause).length > 0) {
      Object.entries(whereClause).forEach(([key, value]) => {
        query += ` AND ${key} = '${value}'`;
      });
    }

    if (settingsWhere.length > 0) {
      query += ` AND ${settingsWhere.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    return await sequelize.query(query, { type: QueryTypes.SELECT });
  }

  /**
   * Get game complexity analytics
   * @param {object} filters - Analytics filters
   * @returns {Promise<object>} - Analytics data
   */
  static async getComplexityAnalytics(filters = {}) {
    const { gameType, dateRange } = filters;

    let dateFilter = '';
    if (dateRange) {
      dateFilter = `AND created_at >= '${dateRange.start}' AND created_at <= '${dateRange.end}'`;
    }

    const query = `
      WITH game_complexity AS (
        SELECT
          g.id,
          g.title,
          g.game_type,
          g.created_at,
          CASE g.game_type
            WHEN 'memory_game' THEN
              COALESCE((g.game_settings->>'pairs_count')::int, 6) *
              CASE
                WHEN g.game_settings->>'match_time_limit' IS NULL THEN 1
                ELSE GREATEST(1, 30 / NULLIF((g.game_settings->>'match_time_limit')::int, 0))
              END
            WHEN 'scatter_game' THEN
              COALESCE((g.game_settings->>'grid_size')::int, 15) *
              COALESCE((g.game_settings->>'words_per_level')::int, 8) / 100.0
            ELSE 1
          END as complexity_score,
          COALESCE(jsonb_array_length(g.game_settings->'content_stages'), 0) as stage_count
        FROM game g
        WHERE g.is_published = true
          ${gameType ? `AND g.game_type = '${gameType}'` : ''}
          ${dateFilter}
      )
      SELECT
        game_type,
        COUNT(*) as total_games,
        ROUND(AVG(complexity_score), 2) as avg_complexity,
        ROUND(STDDEV(complexity_score), 2) as complexity_stddev,
        MIN(complexity_score) as min_complexity,
        MAX(complexity_score) as max_complexity,
        ROUND(AVG(stage_count), 1) as avg_stages,
        COUNT(CASE WHEN complexity_score > 20 THEN 1 END) as high_complexity_count,
        COUNT(CASE WHEN complexity_score BETWEEN 10 AND 20 THEN 1 END) as medium_complexity_count,
        COUNT(CASE WHEN complexity_score < 10 THEN 1 END) as low_complexity_count
      FROM game_complexity
      GROUP BY game_type
      ORDER BY avg_complexity DESC;
    `;

    return await sequelize.query(query, { type: QueryTypes.SELECT });
  }

  /**
   * Find games with advanced pairing rules
   * @param {object} criteria - Search criteria for pairing rules
   * @returns {Promise<Array>} - Games with complex pairing setups
   */
  static async findGamesWithAdvancedPairing(criteria = {}) {
    const { minRules = 2, ruleTypes = [], contentTypes = [] } = criteria;

    let ruleTypeFilter = '';
    if (ruleTypes.length > 0) {
      ruleTypeFilter = `AND mpr.rule_type IN (${ruleTypes.map(t => `'${t}'`).join(',')})`;
    }

    let contentTypeFilter = '';
    if (contentTypes.length > 0) {
      contentTypeFilter = `AND (
        mpr.content_type_a IN (${contentTypes.map(t => `'${t}'`).join(',')}) OR
        mpr.content_type_b IN (${contentTypes.map(t => `'${t}'`).join(',')})
      )`;
    }

    const query = `
      SELECT
        g.id,
        g.title,
        g.game_settings->'pairs_count' as total_pairs,
        COUNT(DISTINCT mpr.id) as rule_count,
        COUNT(DISTINCT mmp.id) as manual_pair_count,
        array_agg(DISTINCT mpr.rule_type) as rule_types,
        array_agg(DISTINCT CONCAT(mpr.content_type_a, '->', mpr.content_type_b))
          FILTER (WHERE mpr.content_type_a IS NOT NULL) as content_type_pairs,
        MAX(mpr.priority) as max_priority,
        g.created_at
      FROM game g
      JOIN memory_pairing_rules mpr ON g.id = mpr.game_id
      LEFT JOIN manual_memory_pairs mmp ON mpr.id = mmp.pairing_rule_id
      WHERE g.game_type = 'memory_game'
        AND g.is_published = true
        AND mpr.is_active = true
        ${ruleTypeFilter}
        ${contentTypeFilter}
      GROUP BY g.id, g.title, g.game_settings->'pairs_count', g.created_at
      HAVING COUNT(DISTINCT mpr.id) >= ${minRules}
      ORDER BY rule_count DESC, manual_pair_count DESC, g.created_at DESC;
    `;

    return await sequelize.query(query, { type: QueryTypes.SELECT });
  }

  /**
   * Get content usage statistics across games
   * @param {object} filters - Content analysis filters
   * @returns {Promise<Array>} - Content usage statistics
   */
  static async getContentUsageStats(filters = {}) {
    const { gameType, minGames = 3 } = filters;

    const gameTypeFilter = gameType ? `AND g.game_type = '${gameType}'` : '';

    const query = `
      WITH content_usage AS (
        SELECT
          g.id as game_id,
          g.game_type,
          stage_data->>'title' as stage_title,
          content_data->>'type' as content_type,
          content_data->>'id' as content_id,
          jsonb_array_length(content_data->'items') as item_count
        FROM game g
        CROSS JOIN jsonb_array_elements(g.game_settings->'content_stages') as stage(stage_data)
        CROSS JOIN jsonb_array_elements(stage_data->'contentConnection'->'content') as content(content_data)
        WHERE g.is_published = true
          ${gameTypeFilter}
          AND stage_data->'contentConnection'->'content' IS NOT NULL
      ),
      usage_stats AS (
        SELECT
          content_type,
          COUNT(DISTINCT game_id) as games_using,
          COUNT(*) as total_usages,
          AVG(item_count) as avg_items_per_usage,
          MIN(item_count) as min_items,
          MAX(item_count) as max_items,
          array_agg(DISTINCT game_type) as game_types_using
        FROM content_usage
        WHERE item_count > 0
        GROUP BY content_type
        HAVING COUNT(DISTINCT game_id) >= ${minGames}
      )
      SELECT
        content_type,
        games_using,
        total_usages,
        ROUND(avg_items_per_usage, 1) as avg_items_per_usage,
        min_items,
        max_items,
        game_types_using,
        ROUND(games_using::numeric / (SELECT COUNT(DISTINCT id) FROM game WHERE is_published = true${gameTypeFilter}) * 100, 1) as usage_percentage
      FROM usage_stats
      ORDER BY games_using DESC, total_usages DESC;
    `;

    return await sequelize.query(query, { type: QueryTypes.SELECT });
  }

  /**
   * Performance monitoring query for JSONB operations
   * @returns {Promise<Array>} - Performance metrics
   */
  static async getPerformanceMetrics() {
    const query = `
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_blks_read,
        idx_blks_hit,
        CASE
          WHEN idx_blks_read + idx_blks_hit = 0 THEN 0
          ELSE ROUND(idx_blks_hit::numeric / (idx_blks_read + idx_blks_hit) * 100, 2)
        END as hit_ratio
      FROM pg_stat_user_indexes
      WHERE tablename = 'game'
        AND indexname LIKE '%game_settings%'
      ORDER BY hit_ratio DESC;
    `;

    return await sequelize.query(query, { type: QueryTypes.SELECT });
  }

  /**
   * Explain query plan for optimization
   * @param {string} query - The query to analyze
   * @returns {Promise<Array>} - Query plan explanation
   */
  static async explainQuery(query) {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await sequelize.query(explainQuery, { type: QueryTypes.SELECT });
    return result[0]['QUERY PLAN'];
  }
}

module.exports = GameQueryBuilder;