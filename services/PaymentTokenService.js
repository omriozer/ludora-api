import models from '../models/index.js';
import { clog, cerror } from '../lib/logger.js';

/**
 * PaymentTokenService - Handles PayPlus payment token extraction and storage
 * Automatically captures and saves payment tokens WITHOUT user permission
 * for future one-click purchasing capabilities
 */
class PaymentTokenService {
  /**
   * Extracts and automatically saves payment token WITHOUT user permission
   * @param {Object} payplusPayload - Raw PayPlus webhook response
   * @param {String} userId - User ID to save token for
   * @param {Object} transaction - Database transaction for atomicity
   * @returns {Object|null} Created PaymentMethod or null if no token found
   */
  static async extractAndSaveToken(payplusPayload, userId, transaction = null) {
    try {
      // TODO remove debug - token capture system
      clog('🔍 Extracting payment token from PayPlus response for user:', userId);

      // Multiple possible token locations based on PayPlus webhook format
      const token = this.extractToken(payplusPayload);

      if (!token) {
        // TODO remove debug - token capture system
        clog('⚠️ No payment token found in PayPlus response');
        return null;
      }

      // TODO remove debug - token capture system
      clog('✅ Payment token found:', this.maskToken(token));

      // Extract card metadata from PayPlus response
      const cardInfo = this.extractCardInfo(payplusPayload);

      // Check if token already exists for this user
      const existingMethod = await models.PaymentMethod.findOne({
        where: {
          user_id: userId,
          payplus_token: token,
          is_active: true
        },
        transaction
      });

      if (existingMethod) {
        // TODO remove debug - token capture system
        clog('ℹ️ Token already exists for user, returning existing method');
        return existingMethod;
      }

      // Check if user already has payment methods
      const existingMethodsCount = await models.PaymentMethod.count({
        where: {
          user_id: userId,
          is_active: true
        },
        transaction
      });

      const isFirstMethod = existingMethodsCount === 0;

      // Automatically save token WITHOUT asking permission
      const paymentMethod = await models.PaymentMethod.create({
        user_id: userId,
        payplus_token: token,
        card_last4: cardInfo.last4,
        card_brand: cardInfo.brand,
        card_expiry_month: cardInfo.expMonth,
        card_expiry_year: cardInfo.expYear,
        card_holder_name: cardInfo.holderName,
        is_default: isFirstMethod, // First method becomes default
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });

      // TODO: implement notifying user about new payment method
      // This should send an email/notification that a payment method was saved
      // for their convenience on future purchases

      // TODO remove debug - token capture system
      clog('💳 Payment method saved successfully:', {
        id: paymentMethod.id,
        last4: paymentMethod.card_last4,
        brand: paymentMethod.card_brand,
        isDefault: paymentMethod.is_default,
        maskedToken: paymentMethod.getMaskedToken()
      });

      return paymentMethod;

    } catch (error) {
      cerror('❌ Error extracting payment token:', error);
      return null;
    }
  }

  /**
   * Extracts payment token from various PayPlus webhook payload formats
   * @param {Object} payload - PayPlus webhook payload
   * @returns {string|null} Extracted token or null
   */
  static extractToken(payload) {
    // Multiple possible token locations based on PayPlus webhook structure
    // Check common locations where PayPlus might send the token
    return (
      payload?.payment_method?.token ||
      payload?.token ||
      payload?.transaction?.token ||
      payload?.transaction?.payment_method?.token ||
      payload?.card_token ||
      payload?.customer_token ||
      payload?.payment_token ||
      null
    );
  }

  /**
   * Extracts card information from various PayPlus payload formats
   * @param {Object} payload - PayPlus webhook payload
   * @returns {Object} Card information object
   */
  static extractCardInfo(payload) {
    // Look for card information in various payload structures
    const card = (
      payload?.payment_method?.card ||
      payload?.card ||
      payload?.transaction?.card ||
      payload?.transaction?.payment_method?.card ||
      {}
    );

    const customer = payload?.customer || payload?.transaction?.customer || {};

    return {
      last4: this.extractLast4(card, payload),
      brand: this.normalizeBrand(card.brand || card.type || card.card_brand),
      expMonth: card.exp_month || card.expiry_month || card.month,
      expYear: card.exp_year || card.expiry_year || card.year,
      holderName: (
        card.holder_name ||
        card.name ||
        card.cardholder_name ||
        customer.name ||
        customer.full_name ||
        null
      )
    };
  }

  /**
   * Extracts last 4 digits from various card data formats
   * @param {Object} card - Card data object
   * @param {Object} payload - Full payload for fallback
   * @returns {string} Last 4 digits or '0000' as fallback
   */
  static extractLast4(card, payload) {
    const last4 = (
      card?.last_4 ||
      card?.last4 ||
      card?.last_four ||
      payload?.card_last4 ||
      payload?.transaction?.card_last4 ||
      '0000'
    );

    // Ensure it's exactly 4 digits
    const cleaned = String(last4).replace(/\D/g, '');
    return cleaned.length >= 4 ? cleaned.slice(-4) : '0000';
  }

  /**
   * Normalizes card brand names to standard format
   * @param {string} brand - Raw brand name from PayPlus
   * @returns {string} Normalized brand name
   */
  static normalizeBrand(brand) {
    if (!brand) return 'unknown';

    const brandMap = {
      'visa': 'visa',
      'mastercard': 'mastercard',
      'master': 'mastercard',
      'mc': 'mastercard',
      'amex': 'amex',
      'american_express': 'amex',
      'american express': 'amex',
      'diners': 'diners',
      'discover': 'discover',
      'jcb': 'jcb'
    };

    const normalized = brand.toLowerCase().trim();
    return brandMap[normalized] || normalized;
  }

  /**
   * Masks token for secure logging
   * @param {string} token - Payment token
   * @returns {string} Masked token
   */
  static maskToken(token) {
    if (!token || token.length <= 8) return 'tok_****';

    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    return `${start}****${end}`;
  }

  /**
   * Gets user's default payment method
   * @param {string} userId - User ID
   * @param {Object} transaction - Database transaction
   * @returns {Promise<Object|null>} Default payment method or null
   */
  static async getUserDefaultPaymentMethod(userId, transaction = null) {
    return await models.PaymentMethod.findDefaultForUser(userId, { transaction });
  }

  /**
   * Gets all active payment methods for a user
   * @param {string} userId - User ID
   * @param {Object} transaction - Database transaction
   * @returns {Promise<Array>} Array of active payment methods
   */
  static async getUserPaymentMethods(userId, transaction = null) {
    return await models.PaymentMethod.findActiveForUser(userId, { transaction });
  }

  /**
   * Validates if a payment method belongs to a user
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} userId - User ID
   * @param {Object} transaction - Database transaction
   * @returns {Promise<Object|null>} Payment method if valid, null otherwise
   */
  static async validateUserOwnership(paymentMethodId, userId, transaction = null) {
    return await models.PaymentMethod.findOne({
      where: {
        id: paymentMethodId,
        user_id: userId,
        is_active: true
      },
      transaction
    });
  }

  /**
   * Sets a payment method as default for a user
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} userId - User ID
   * @param {Object} transaction - Database transaction
   * @returns {Promise<boolean>} Success status
   */
  static async setDefaultPaymentMethod(paymentMethodId, userId, transaction = null) {
    try {
      await models.PaymentMethod.setAsDefault(paymentMethodId, userId, { transaction });
      return true;
    } catch (error) {
      cerror('Error setting default payment method:', error);
      return false;
    }
  }

  /**
   * Soft deletes a payment method
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} userId - User ID for verification
   * @param {Object} transaction - Database transaction
   * @returns {Promise<boolean>} Success status
   */
  static async deletePaymentMethod(paymentMethodId, userId, transaction = null) {
    try {
      const paymentMethod = await models.PaymentMethod.findOne({
        where: {
          id: paymentMethodId,
          user_id: userId,
          is_active: true
        },
        transaction
      });

      if (!paymentMethod) {
        return false;
      }

      await paymentMethod.softDelete({ transaction });

      // If this was the default, set another one as default
      if (paymentMethod.is_default) {
        const remainingMethods = await models.PaymentMethod.findActiveForUser(userId, { transaction });
        if (remainingMethods.length > 0) {
          await this.setDefaultPaymentMethod(remainingMethods[0].id, userId, transaction);
        }
      }

      return true;
    } catch (error) {
      cerror('Error deleting payment method:', error);
      return false;
    }
  }
}

export default PaymentTokenService;