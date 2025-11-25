import crypto from 'crypto';
import models from '../models/index.js';
import { error as logger } from '../lib/errorLogger.js';

/**
 * CouponCodeGenerator - Generate unique coupon codes with custom patterns
 * Supports patterns like "STUDENT2024-XXXX", "VIP-XXXXX", "HOLIDAY-XX-XX"
 * where X represents random characters
 */
class CouponCodeGenerator {
  constructor() {
    this.models = models;
    // Character sets for different types of random generation
    this.charSets = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numeric: '0123456789',
      hex: '0123456789ABCDEF'
    };
  }

  /**
   * Generate a single coupon code based on a pattern
   * @param {string} pattern - Pattern like "STUDENT2024-XXXX" or "VIP-XXXXX"
   * @param {string} charSet - Type of characters to use ('alphanumeric', 'alphabetic', 'numeric', 'hex')
   * @returns {string} Generated coupon code
   */
  generateSingleCode(pattern, charSet = 'alphanumeric') {
    if (!pattern) {
      throw new Error('Pattern is required');
    }

    const characters = this.charSets[charSet] || this.charSets.alphanumeric;

    // Replace 'X' characters with random characters
    return pattern.replace(/X/g, () => {
      const randomIndex = crypto.randomInt(0, characters.length);
      return characters[randomIndex];
    });
  }

  /**
   * Generate multiple unique coupon codes
   * @param {Object} options - Generation options
   * @param {string} options.pattern - Pattern template
   * @param {number} options.count - Number of codes to generate
   * @param {string} options.charSet - Character set to use
   * @param {number} options.maxAttempts - Maximum attempts to generate unique codes
   * @returns {Promise<Array<string>>} Array of unique coupon codes
   */
  async generateMultipleCodes({ pattern, count = 1, charSet = 'alphanumeric', maxAttempts = 1000 }) {
    if (!pattern) {
      throw new Error('Pattern is required');
    }

    if (count <= 0) {
      throw new Error('Count must be positive');
    }

    if (count > 10000) {
      throw new Error('Cannot generate more than 10,000 codes at once');
    }

    const generatedCodes = new Set();
    let attempts = 0;

    while (generatedCodes.size < count && attempts < maxAttempts) {
      const code = this.generateSingleCode(pattern, charSet);

      // Check if code already exists in database
      const existingCoupon = await this.models.Coupon.findOne({
        where: { code: code }
      });

      if (!existingCoupon) {
        generatedCodes.add(code);
      }

      attempts++;
    }

    if (generatedCodes.size < count) {
      throw new Error(`Could only generate ${generatedCodes.size} unique codes out of ${count} requested. Try a different pattern or fewer codes.`);
    }

    return Array.from(generatedCodes);
  }

  /**
   * Generate coupon codes and create coupon records in database
   * @param {Object} options - Coupon creation options
   * @param {string} options.pattern - Pattern template
   * @param {number} options.count - Number of coupons to create
   * @param {Object} options.couponData - Base coupon data to use for all generated coupons
   * @param {string} options.charSet - Character set for random parts
   * @returns {Promise<Object>} Result with created coupons
   */
  async generateAndCreateCoupons({ pattern, count = 1, couponData = {}, charSet = 'alphanumeric' }) {
    try {
      // Generate unique codes
      const codes = await this.generateMultipleCodes({ pattern, count, charSet });

      // Prepare coupon data for bulk creation
      const couponsToCreate = codes.map(code => ({
        id: this.generateId(),
        code: code,
        code_pattern: pattern,
        auto_generated: true,
        created_at: new Date(),
        updated_at: new Date(),
        ...couponData // Merge with provided coupon data
      }));

      // Bulk create coupons
      const createdCoupons = await this.models.Coupon.bulkCreate(couponsToCreate);

      return {
        success: true,
        data: {
          pattern: pattern,
          codes_generated: codes.length,
          coupons_created: createdCoupons.length,
          codes: codes,
          coupon_ids: createdCoupons.map(c => c.id)
        }
      };
    } catch (error) {
      logger.payment('Error generating and creating coupons:', error);
      throw error;
    }
  }

  /**
   * Validate a coupon code pattern
   * @param {string} pattern - Pattern to validate
   * @returns {Object} Validation result with suggestions
   */
  validatePattern(pattern) {
    if (!pattern) {
      return {
        valid: false,
        error: 'Pattern is required'
      };
    }

    if (pattern.length > 50) {
      return {
        valid: false,
        error: 'Pattern too long (max 50 characters)'
      };
    }

    if (pattern.length < 3) {
      return {
        valid: false,
        error: 'Pattern too short (min 3 characters)'
      };
    }

    // Count X placeholders
    const xCount = (pattern.match(/X/g) || []).length;

    if (xCount === 0) {
      return {
        valid: false,
        error: 'Pattern must contain at least one X placeholder for random characters'
      };
    }

    if (xCount > 20) {
      return {
        valid: false,
        error: 'Too many X placeholders (max 20 for performance)'
      };
    }

    // Check for valid characters (letters, numbers, hyphens, underscores, X)
    const validPattern = /^[A-Za-z0-9\-_X]+$/;
    if (!validPattern.test(pattern)) {
      return {
        valid: false,
        error: 'Pattern can only contain letters, numbers, hyphens, underscores, and X placeholders'
      };
    }

    // Calculate possible combinations
    const possibleCombinations = Math.pow(36, xCount); // 36 = alphanumeric characters

    return {
      valid: true,
      info: {
        pattern: pattern,
        random_positions: xCount,
        possible_combinations: possibleCombinations,
        example: this.generateSingleCode(pattern),
        recommended_max_codes: Math.min(possibleCombinations * 0.8, 50000) // 80% of possibilities, max 50k
      }
    };
  }

  /**
   * Generate preset patterns for common use cases
   * @param {string} type - Type of preset ('student', 'vip', 'holiday', 'general', 'referral')
   * @param {string} suffix - Optional suffix to add
   * @returns {string} Generated pattern
   */
  generatePresetPattern(type, suffix = '') {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const presets = {
      student: `STUDENT${year}-XXXX`,
      vip: `VIP-XXXXX`,
      holiday: `HOLIDAY${year}-XXX`,
      general: `SAVE-XXXX`,
      referral: `REF-XXXXXX`,
      welcome: `WELCOME-XXXX`,
      flashsale: `FLASH${month}${year}-XXX`,
      earlybird: `EARLY-XXXXX`,
      loyalty: `LOYAL${year}-XXXX`,
      creator: `CREATOR-XXXXX`
    };

    let pattern = presets[type.toLowerCase()] || `COUPON-XXXX`;

    if (suffix) {
      // Insert suffix before the random part
      const randomPart = pattern.match(/X+$/);
      if (randomPart) {
        pattern = pattern.replace(/X+$/, `${suffix.toUpperCase()}-${randomPart[0]}`);
      } else {
        pattern += `-${suffix.toUpperCase()}`;
      }
    }

    return pattern;
  }

  /**
   * Get usage statistics for generated coupons
   * @param {string} pattern - Pattern to analyze
   * @returns {Promise<Object>} Usage statistics
   */
  async getPatternStatistics(pattern) {
    try {
      const coupons = await this.models.Coupon.findAll({
        where: { code_pattern: pattern },
        attributes: [
          'id',
          'code',
          'usage_count',
          'usage_limit',
          'is_active',
          'created_at'
        ]
      });

      const totalGenerated = coupons.length;
      const totalUsed = coupons.filter(c => c.usage_count > 0).length;
      const totalActive = coupons.filter(c => c.is_active).length;
      const totalUsageCount = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);

      return {
        pattern: pattern,
        total_generated: totalGenerated,
        total_used: totalUsed,
        total_active: totalActive,
        total_usage_count: totalUsageCount,
        usage_rate: totalGenerated > 0 ? (totalUsed / totalGenerated * 100).toFixed(2) : 0,
        average_uses_per_coupon: totalGenerated > 0 ? (totalUsageCount / totalGenerated).toFixed(2) : 0
      };
    } catch (error) {
      logger.payment('Error getting pattern statistics:', error);
      throw error;
    }
  }

  /**
   * Generate a unique ID for coupons
   * @returns {string} Unique ID
   */
  generateId() {
    return `coup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Bulk deactivate coupons by pattern
   * @param {string} pattern - Pattern to deactivate
   * @returns {Promise<Object>} Deactivation result
   */
  async deactivateCouponsByPattern(pattern) {
    try {
      const [affectedRows] = await this.models.Coupon.update(
        { is_active: false, updated_at: new Date() },
        { where: { code_pattern: pattern, is_active: true } }
      );

      return {
        success: true,
        data: {
          pattern: pattern,
          deactivated_count: affectedRows
        }
      };
    } catch (error) {
      logger.payment('Error deactivating coupons by pattern:', error);
      throw error;
    }
  }
}

export default new CouponCodeGenerator();