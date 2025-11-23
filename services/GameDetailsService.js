/**
 * GameDetailsService - Extensible service for calculating game-specific details
 *
 * This service provides game type-specific detail calculations that can be
 * included in product details API responses when requested. Each game type
 * has its own calculation method for optimal performance and flexibility.
 */

import models from '../models/index.js';
import { error } from '../lib/errorLogger.js';

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

          return {
            game_type: gameType,
            details: {}
          };
      }
    } catch (error) {
      error.api(`Error calculating game details for ${gameType} game ${gameId}:`, error);
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
      // TODO: Implement using new EduContent and EduContentUse system
      // This is a placeholder until new API endpoints are implemented
      // Will use EduContentUse.findByGame(gameId) with use_type: 'pair'

      return {
        game_type: 'memory_game',
        details: {
          pair_count: 0,
          content_types: [],
          content_type_combinations: [],
          total_content_items: 0
        }
      };

    } catch (error) {
      error.api('Error calculating memory game details:', error);
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