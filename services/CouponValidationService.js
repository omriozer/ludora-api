import models from '../models/index.js';
import { Op, col } from 'sequelize';
import { error as logger } from '../lib/errorLogger.js';

/**
 * CouponValidationService - Advanced coupon validation and recommendation engine
 * Handles complex coupon logic including targeting, stacking, conflicts, and auto-suggestions
 */
class CouponValidationService {
  constructor() {
    this.models = models;
  }

  /**
   * Find all applicable public coupons for a cart
   * Used for auto-suggestion feature
   */
  async getApplicablePublicCoupons({ userId, cartItems, cartTotal }) {
    try {
      // Get user for segment targeting
      const user = userId ? await this.models.User.findByPk(userId) : null;
      const userSegments = user ? this.getUserSegments(user) : [];

      // Get cart details
      const cartDetails = this.getCartDetails(cartItems);

      // Find all active public coupons
      const publicCoupons = await this.models.Coupon.findAll({
        where: {
          is_active: true,
          visibility: ['public', 'auto_suggest'],
          [Op.or]: [
            { valid_until: null },
            { valid_until: { [Op.gt]: new Date() } }
          ],
          [Op.or]: [
            { usage_limit: null },
            { usage_count: { [Op.lt]: col('usage_limit') } }
          ]
        },
        order: [['priority_level', 'ASC'], ['discount_value', 'DESC']]
      });

      // Filter coupons that apply to this cart
      const applicableCoupons = [];
      for (const coupon of publicCoupons) {
        try {
          const isApplicable = await this.isCouponApplicableToCart(coupon, user, cartDetails, cartTotal);
          if (isApplicable) {
            // Calculate what the discount would be
            const discountInfo = this.calculatePotentialDiscount(coupon, cartDetails, cartTotal);

            applicableCoupons.push({
              id: coupon.id,
              code: coupon.code,
              name: coupon.name,
              description: coupon.description,
              discount_type: coupon.discount_type,
              discount_value: coupon.discount_value,
              priority_level: coupon.priority_level,
              potential_discount: discountInfo.discountAmount,
              final_amount: discountInfo.finalAmount,
              targeting_type: coupon.targeting_type,
              applicable_items: discountInfo.applicableItems
            });
          }
        } catch (error) {
          // Skip coupons that don't apply
          continue;
        }
      }

      // Sort by best value for customer (highest discount first)
      applicableCoupons.sort((a, b) => b.potential_discount - a.potential_discount);

      return {
        success: true,
        data: {
          applicable_coupons: applicableCoupons,
          cart_total: cartTotal,
          suggestions_count: applicableCoupons.length
        }
      };
    } catch (error) {
      logger.payment('Error finding applicable public coupons:', error);
      throw error;
    }
  }

  /**
   * Validate multiple coupons for stacking
   * Returns the best combination considering priorities and stacking rules
   */
  async validateCouponStacking({ couponCodes, userId, cartItems, cartTotal }) {
    try {
      if (!couponCodes || couponCodes.length === 0) {
        throw new Error('No coupon codes provided');
      }

      // Get all coupons
      const coupons = await this.models.Coupon.findAll({
        where: {
          code: { [Op.in]: couponCodes },
          is_active: true
        }
      });

      if (coupons.length !== couponCodes.length) {
        const foundCodes = coupons.map(c => c.code);
        const missingCodes = couponCodes.filter(code => !foundCodes.includes(code));
        throw new Error(`Invalid coupon codes: ${missingCodes.join(', ')}`);
      }

      // Check if any coupons don't allow stacking
      const nonStackableCoupons = coupons.filter(c => !c.allow_stacking);
      if (nonStackableCoupons.length > 0 && coupons.length > 1) {
        throw new Error(`These coupons cannot be combined: ${nonStackableCoupons.map(c => c.code).join(', ')}`);
      }

      // Validate specific stacking rules
      await this.validateStackingRules(coupons);

      // Get user and cart details
      const user = userId ? await this.models.User.findByPk(userId) : null;
      const cartDetails = this.getCartDetails(cartItems);

      // Validate each coupon individually
      const validationResults = [];
      for (const coupon of coupons) {
        try {
          const isValid = await this.isCouponApplicableToCart(coupon, user, cartDetails, cartTotal);
          if (isValid) {
            validationResults.push({
              coupon,
              valid: true,
              priority: coupon.priority_level
            });
          }
        } catch (error) {
          validationResults.push({
            coupon,
            valid: false,
            error: error.message
          });
        }
      }

      // Filter out invalid coupons
      const validCoupons = validationResults.filter(r => r.valid).map(r => r.coupon);

      if (validCoupons.length === 0) {
        throw new Error('No valid coupons found for this cart');
      }

      // Calculate combined discount
      const combinedDiscount = this.calculateStackedDiscount(validCoupons, cartDetails, cartTotal);

      return {
        success: true,
        data: {
          applied_coupons: validCoupons.map(c => ({
            code: c.code,
            name: c.name,
            priority: c.priority_level
          })),
          total_discount: combinedDiscount.totalDiscount,
          original_amount: cartTotal,
          final_amount: combinedDiscount.finalAmount,
          stacking_applied: validCoupons.length > 1
        }
      };
    } catch (error) {
      logger.payment('Error validating coupon stacking:', error);
      throw error;
    }
  }

  /**
   * Get the best single coupon for a cart
   * Considers all applicable coupons and returns the one with highest value
   */
  async getBestCouponForCart({ userId, cartItems, cartTotal }) {
    try {
      const applicableCoupons = await this.getApplicablePublicCoupons({ userId, cartItems, cartTotal });

      if (applicableCoupons.data.applicable_coupons.length === 0) {
        return {
          success: true,
          data: {
            best_coupon: null,
            message: 'No applicable coupons found for this cart'
          }
        };
      }

      // The first coupon is already the best (sorted by discount amount)
      const bestCoupon = applicableCoupons.data.applicable_coupons[0];

      return {
        success: true,
        data: {
          best_coupon: bestCoupon,
          savings: bestCoupon.potential_discount,
          message: `Save ₪${bestCoupon.potential_discount.toFixed(2)} with coupon ${bestCoupon.code}`
        }
      };
    } catch (error) {
      logger.payment('Error finding best coupon:', error);
      throw error;
    }
  }

  /**
   * Check if a coupon is applicable to a specific cart
   */
  async isCouponApplicableToCart(coupon, user, cartDetails, cartTotal) {
    // Basic validation
    this.validateCouponBasics(coupon);

    // Check minimum amount
    if (coupon.minimum_amount && cartTotal < coupon.minimum_amount) {
      return false;
    }

    // Check minimum quantity
    if (coupon.minimum_quantity && cartDetails.totalQuantity < coupon.minimum_quantity) {
      return false;
    }

    // Check product targeting
    if (coupon.targeting_type === 'product_type' && coupon.target_product_types?.length > 0) {
      const hasMatchingType = cartDetails.productTypes.some(type =>
        coupon.target_product_types.includes(type)
      );
      if (!hasMatchingType) {
        return false;
      }
    }

    if (coupon.targeting_type === 'product_id' && coupon.target_product_ids?.length > 0) {
      const hasMatchingId = cartDetails.productIds.some(id =>
        coupon.target_product_ids.includes(id)
      );
      if (!hasMatchingId) {
        return false;
      }
    }

    // Check user segment targeting
    if (coupon.targeting_type === 'user_segment' && coupon.user_segments?.length > 0) {
      if (!user) {
        return false;
      }

      const userSegments = this.getUserSegments(user);
      const hasMatchingSegment = coupon.user_segments.some(segment =>
        userSegments.includes(segment)
      );

      if (!hasMatchingSegment) {
        return false;
      }
    }

    return true;
  }

  /**
   * Basic coupon validation (expiry, usage limits)
   */
  validateCouponBasics(coupon) {
    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new Error('Coupon usage limit exceeded');
    }

    // Check expiry
    if (coupon.valid_until) {
      const expiryDate = new Date(coupon.valid_until);
      if (expiryDate < new Date()) {
        throw new Error('Coupon has expired');
      }
    }
  }

  /**
   * Validate stacking rules between coupons
   */
  async validateStackingRules(coupons) {
    // Check if any coupons have specific stacking restrictions
    for (const coupon of coupons) {
      if (coupon.stackable_with && coupon.stackable_with.length > 0) {
        // This coupon only stacks with specific other coupons
        const otherCoupons = coupons.filter(c => c.id !== coupon.id);
        const allowedToStackWith = otherCoupons.every(other =>
          coupon.stackable_with.includes(other.code)
        );

        if (!allowedToStackWith) {
          throw new Error(`Coupon ${coupon.code} can only be stacked with: ${coupon.stackable_with.join(', ')}`);
        }
      }
    }
  }

  /**
   * Calculate discount for stacked coupons
   */
  calculateStackedDiscount(coupons, cartDetails, cartTotal) {
    // Sort by priority (lower number = higher priority)
    const sortedCoupons = [...coupons].sort((a, b) => a.priority_level - b.priority_level);

    let remainingAmount = cartTotal;
    let totalDiscount = 0;

    for (const coupon of sortedCoupons) {
      let couponDiscount = 0;

      if (coupon.discount_type === 'percentage') {
        couponDiscount = (remainingAmount * coupon.discount_value) / 100;
      } else if (coupon.discount_type === 'fixed') {
        couponDiscount = coupon.discount_value;
      }

      // Apply maximum discount cap if set
      if (coupon.max_discount_cap && couponDiscount > coupon.max_discount_cap) {
        couponDiscount = coupon.max_discount_cap;
      }

      // Ensure discount doesn't exceed remaining amount
      couponDiscount = Math.min(couponDiscount, remainingAmount);

      totalDiscount += couponDiscount;
      remainingAmount -= couponDiscount;

      // Stop if remaining amount is 0
      if (remainingAmount <= 0) {
        break;
      }
    }

    return {
      totalDiscount,
      finalAmount: Math.max(0, cartTotal - totalDiscount)
    };
  }

  /**
   * Calculate potential discount for a single coupon (without applying)
   */
  calculatePotentialDiscount(coupon, cartDetails, cartTotal) {
    let discountAmount = 0;

    if (coupon.discount_type === 'percentage') {
      discountAmount = (cartTotal * coupon.discount_value) / 100;
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = coupon.discount_value;
    }

    // Apply maximum discount cap if set
    if (coupon.max_discount_cap && discountAmount > coupon.max_discount_cap) {
      discountAmount = coupon.max_discount_cap;
    }

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cartTotal);

    return {
      discountAmount,
      finalAmount: cartTotal - discountAmount,
      applicableItems: cartDetails.items.length // For now, assume all items
    };
  }

  /**
   * Get cart details for validation
   */
  getCartDetails(cartItems) {
    return {
      items: cartItems,
      totalQuantity: cartItems.length,
      productTypes: [...new Set(cartItems.map(item => item.purchasable_type))],
      productIds: cartItems.map(item => item.purchasable_id)
    };
  }

  /**
   * Get user segments for targeting
   */
  getUserSegments(user) {
    const segments = [];

    // Check if new user (registered within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (user.created_at > thirtyDaysAgo) {
      segments.push('new_user');
    }

    // Check content creator status
    if (user.content_creator_agreement_sign_date) {
      segments.push('content_creator');
    }

    // Check admin/VIP status
    if (user.role === 'admin' || user.role === 'sysadmin') {
      segments.push('vip', 'admin');
    }

    // Add other segments based on user properties
    if (user.role === 'student') {
      segments.push('student');
    }

    return segments;
  }
}

export default new CouponValidationService();