/**
 * GameDetailsService - Extensible service for calculating game-specific details
 *
 * This service provides game type-specific detail calculations that can be
 * included in product details API responses when requested. Each game type
 * has its own calculation method for optimal performance and flexibility.
 */

import models from '../models/index.js';

class GameDetailsService {
  /**
   * Get game details for any game type
   * @param {string} gameId - The game entity ID
   * @param {string} gameType - The game type (memory_game, quiz, puzzle, etc.)
   * @returns {Object} Game-specific details object
   */
  static async getGameDetails(gameId, gameType) {
    if (!gameId || !gameType) {
      return null;
    }

    try {
      // Route to appropriate game type calculator
      switch (gameType) {
        case 'memory_game':
          return await this.getMemoryGameDetails(gameId);

        case 'quiz_game':
          return await this.getQuizGameDetails(gameId);

        case 'puzzle_game':
          return await this.getPuzzleGameDetails(gameId);

        default:
          console.warn(`Unknown game type for details calculation: ${gameType}`);
          return {
            game_type: gameType,
            details: {}
          };
      }
    } catch (error) {
      console.error(`Error calculating game details for ${gameType} game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Calculate memory game specific details
   * @param {string} gameId - The game entity ID
   * @returns {Object} Memory game details including pair count and content types
   */
  static async getMemoryGameDetails(gameId) {
    try {
      // Query to get memory pairs and their content information
      const queryResult = await models.sequelize.query(
        `
        SELECT
          COUNT(DISTINCT gcr.id) as pair_count,
          gcri.role,
          gc.semantic_type,
          COUNT(gc.id) as content_count
        FROM game_content_link gcl
        JOIN game_content_relation gcr ON gcl.target_id = gcr.id
        JOIN game_content_relation_items gcri ON gcr.id = gcri.relation_id
        JOIN gamecontent gc ON gcri.content_id = gc.id
        WHERE gcl.game_id = :gameId
          AND gcl.link_type = 'relation'
          AND gcri.role IN ('pair_a', 'pair_b')
        GROUP BY gcri.role, gc.semantic_type
        ORDER BY gcri.role, gc.semantic_type
        `,
        {
          replacements: { gameId },
          type: models.sequelize.QueryTypes.SELECT
        }
      );

      const results = Array.isArray(queryResult) ? queryResult : queryResult[0] || [];

      if (!results || results.length === 0) {
        return {
          game_type: 'memory_game',
          details: {
            pair_count: 0,
            content_types: [],
            content_type_combinations: []
          }
        };
      }

      // Calculate total unique pairs
      const pairCount = Math.max(...results.map(r => parseInt(r.pair_count)));

      // Extract unique content types
      const contentTypes = [...new Set(results.map(r => r.semantic_type))];

      // Analyze content type combinations for pairs
      const combinationsMap = new Map();

      // Group by pair to analyze combinations
      const pairCombinationsResult = await models.sequelize.query(
        `
        SELECT
          gcr.id as relation_id,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'role', gcri.role,
              'semantic_type', gc.semantic_type,
              'data_type', gc.data_type
            ) ORDER BY gcri.role
          ) as pair_content
        FROM game_content_link gcl
        JOIN game_content_relation gcr ON gcl.target_id = gcr.id
        JOIN game_content_relation_items gcri ON gcr.id = gcri.relation_id
        JOIN gamecontent gc ON gcri.content_id = gc.id
        WHERE gcl.game_id = :gameId
          AND gcl.link_type = 'relation'
          AND gcri.role IN ('pair_a', 'pair_b')
        GROUP BY gcr.id
        `,
        {
          replacements: { gameId },
          type: models.sequelize.QueryTypes.SELECT
        }
      );

      const pairCombinations = Array.isArray(pairCombinationsResult) ? pairCombinationsResult : pairCombinationsResult[0] || [];

      // Analyze combinations
      pairCombinations.forEach(pair => {
        const content = pair.pair_content || [];
        if (content.length === 2) {
          const typeA = content.find(c => c.role === 'pair_a')?.semantic_type;
          const typeB = content.find(c => c.role === 'pair_b')?.semantic_type;

          if (typeA && typeB) {
            // Normalize combination key (alphabetical order for consistency)
            const combinationKey = [typeA, typeB].sort().join('-');
            const existing = combinationsMap.get(combinationKey);

            if (existing) {
              existing.count++;
            } else {
              combinationsMap.set(combinationKey, {
                type_a: typeA,
                type_b: typeB,
                count: 1
              });
            }
          }
        }
      });

      const contentTypeCombinations = Array.from(combinationsMap.values());

      return {
        game_type: 'memory_game',
        details: {
          pair_count: pairCount,
          content_types: contentTypes,
          content_type_combinations: contentTypeCombinations,
          total_content_items: results.reduce((sum, r) => sum + parseInt(r.content_count), 0)
        }
      };

    } catch (error) {
      console.error('Error calculating memory game details:', error);
      throw error;
    }
  }

  /**
   * Calculate quiz game specific details (placeholder for future implementation)
   * @param {string} gameId - The game entity ID
   * @returns {Object} Quiz game details
   */
  static async getQuizGameDetails(gameId) {
    // TODO: Implement quiz game details calculation
    return {
      game_type: 'quiz_game',
      details: {
        question_count: 0,
        difficulty_levels: [],
        categories: []
      }
    };
  }

  /**
   * Calculate puzzle game specific details (placeholder for future implementation)
   * @param {string} gameId - The game entity ID
   * @returns {Object} Puzzle game details
   */
  static async getPuzzleGameDetails(gameId) {
    // TODO: Implement puzzle game details calculation
    return {
      game_type: 'puzzle_game',
      details: {
        piece_count: 0,
        puzzle_size: null,
        difficulty: null
      }
    };
  }

  /**
   * Get human-readable content type labels in Hebrew
   * @param {string} semanticType - The semantic type key
   * @returns {string} Hebrew label for the content type
   */
  static getContentTypeLabel(semanticType) {
    const labels = {
      word: 'מילים',
      question: 'שאלות',
      answer: 'תשובות',
      name: 'שמות',
      place: 'מקומות',
      text: 'טקסט',
      image: 'תמונות',
      audio: 'קול',
      video: 'וידאו',
      game_card_bg: 'רקעי קלפים'
    };

    return labels[semanticType] || semanticType;
  }

  /**
   * Get content type combination labels in Hebrew
   * @param {string} typeA - First content type
   * @param {string} typeB - Second content type
   * @returns {string} Hebrew label for the combination
   */
  static getContentCombinationLabel(typeA, typeB) {
    const labelA = this.getContentTypeLabel(typeA);
    const labelB = this.getContentTypeLabel(typeB);

    if (typeA === typeB) {
      return labelA;
    }

    return `${labelA} - ${labelB}`;
  }
}

export default GameDetailsService;