import models from '../models/index.js';
import { error as logger } from '../lib/errorLogger.js';

/**
 * PaymentService - Handles payment completion and transaction management
 */
class PaymentService {
  /**
   * Complete a purchase (for free products or successful payments)
   * @param {string} purchaseId - The purchase ID to complete
   * @param {Object} options - Additional options
   * @param {string} options.paymentMethod - Payment method used ('free', 'payplus', etc.)
   * @param {Object} options.transactionData - Additional transaction data
   * @returns {Promise<Object>} Updated purchase object
   */
  static async completePurchase(purchaseId, options = {}) {
    const { paymentMethod = 'free', transactionData = {} } = options;

    try {
      // Find the purchase
      const purchase = await models.Purchase.findByPk(purchaseId);
      if (!purchase) {
        throw new Error(`Purchase ${purchaseId} not found`);
      }

      // Validate that the purchase can be completed
      if (purchase.payment_status === 'completed') {
        return purchase;
      }

      if (!['cart', 'pending'].includes(purchase.payment_status)) {
        throw new Error(`Cannot complete purchase with status: ${purchase.payment_status}`);
      }

      // Create transaction record if one doesn't exist
      let transactionId = purchase.transaction_id;
      if (!transactionId) {
        const transaction = await models.Transaction.create({
          id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          user_id: purchase.buyer_user_id,
          amount: purchase.payment_amount,
          currency: 'ILS',
          payment_method: paymentMethod,
          payment_status: 'completed',
          metadata: {
            description: `Purchase completion for ${purchase.purchasable_type} ${purchase.purchasable_id}`,
            purchaseId: purchaseId,
            completedAt: new Date().toISOString(),
            originalPrice: purchase.original_price,
            discountAmount: purchase.discount_amount,
            couponCode: purchase.coupon_code,
            ...transactionData
          },
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
          created_at: new Date(),
          updated_at: new Date()
        });
        transactionId = transaction.id;
      }

      // Update the purchase
      const updatedPurchase = await purchase.update({
        payment_status: 'completed',
        payment_method: paymentMethod,
        transaction_id: transactionId,
        updated_at: new Date()
      });

      return updatedPurchase;

    } catch (error) {
      logger.payment('PaymentService: Error completing purchase:', error);
      throw error;
    }
  }

  /**
   * Check if a product/subscription has zero price (is free)
   * @param {string} purchasableType - Type of purchasable item
   * @param {string} purchasableId - ID of purchasable item
   * @returns {Promise<boolean>} True if the item is free
   */
  static async isProductFree(purchasableType, purchasableId) {
    try {
      let item = null;

      // Find the product based on type
      switch (purchasableType) {
        case 'workshop':
          item = await models.Workshop.findByPk(purchasableId);
          break;
        case 'course':
          item = await models.Course.findByPk(purchasableId);
          break;
        case 'file':
          item = await models.File.findByPk(purchasableId);
          break;
        case 'lesson_plan':
          item = await models.LessonPlan.findByPk(purchasableId);
          break;
        case 'tool':
          item = await models.Tool.findByPk(purchasableId);
          break;
        case 'game':
          item = await models.Game.findByPk(purchasableId);
          break;
        case 'subscription':
          item = await models.SubscriptionPlan.findByPk(purchasableId);
          break;
        default:
          throw new Error(`Unknown purchasable type: ${purchasableType}`);
      }

      if (!item) {
        throw new Error(`${purchasableType} ${purchasableId} not found`);
      }

      const price = parseFloat(item.price || 0);
      return price === 0;

    } catch (error) {
      logger.payment('PaymentService: Error checking if product is free:', error);
      throw error;
    }
  }

  /**
   * Validate purchase creation constraints
   * @param {string} userId - User ID
   * @param {string} purchasableType - Type of purchasable item
   * @param {string} purchasableId - ID of purchasable item
   * @returns {Promise<Object>} Validation result with existing purchase if any
   */
  static async validatePurchaseCreation(userId, purchasableType, purchasableId) {
    try {
      // Check for existing cart purchase with same product
      const existingPurchase = await models.Purchase.findOne({
        where: {
          buyer_user_id: userId,
          purchasable_type: purchasableType,
          purchasable_id: purchasableId,
          payment_status: 'cart'
        }
      });

      if (existingPurchase) {
        return {
          valid: false,
          error: 'Item already in cart',
          existingPurchase
        };
      }

      // For subscriptions, check if there's already a subscription in cart
      if (purchasableType === 'subscription') {
        const existingSubscriptionInCart = await models.Purchase.findOne({
          where: {
            buyer_user_id: userId,
            purchasable_type: 'subscription',
            payment_status: 'cart'
          }
        });

        if (existingSubscriptionInCart) {
          return {
            valid: false,
            error: 'Subscription already in cart',
            existingPurchase: existingSubscriptionInCart,
            canUpdate: true // Special flag for subscription updates
          };
        }
      }

      return { valid: true };

    } catch (error) {
      logger.payment('PaymentService: Error validating purchase creation:', error);
      throw error;
    }
  }

  /**
   * Create or update a transaction for PayPlus payment
   * @param {Object} options - Transaction creation options
   * @param {string} options.userId - User ID
   * @param {number} options.amount - Total amount
   * @param {string} options.pageRequestUid - PayPlus page request UID
   * @param {string} options.paymentPageLink - PayPlus payment page link
   * @param {Array} options.purchaseItems - Array of purchase items to analyze and link
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Created or updated transaction object
   */
  static async createPayPlusTransaction(options = {}) {
    const {
      userId,
      amount,
      pageRequestUid,
      paymentPageLink,
      purchaseItems = [],
      metadata = {}
    } = options;

    try {
      // Auto-detect environment for database storage
      const nodeEnv = process.env.NODE_ENV || 'development';
      const dbEnvironment = nodeEnv === 'production' ? 'production' : 'staging';

      // Determine transaction type based on purchase items
      const hasSubscriptions = purchaseItems.some(item => item.purchasable_type === 'subscription');
      const transactionType = hasSubscriptions ? 'recurring' : 'one-time';

      // Check for existing pending transaction of the same type for this user
      const existingTransaction = await models.Transaction.findOne({
        where: {
          user_id: userId,
          payment_status: 'pending',
          'metadata.transaction_type': transactionType
        },
        order: [['created_at', 'DESC']]
      });

      let transaction;
      const purchaseIds = purchaseItems.map(item => item.id);

      if (existingTransaction) {
        // Update existing transaction with new PayPlus data
        transaction = await existingTransaction.update({
          amount: amount,
          environment: dbEnvironment,
          payment_page_request_uid: pageRequestUid,
          payment_page_link: paymentPageLink,
          metadata: {
            transaction_type: transactionType,
            purchaseIds: purchaseIds,
            updatedAt: new Date().toISOString(),
            createdAt: existingTransaction.metadata.createdAt || new Date().toISOString(),
            ...metadata
          },
          updated_at: new Date()
        });

      } else {
        // Create new transaction
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        transaction = await models.Transaction.create({
          id: transactionId,
          user_id: userId,
          amount: amount,
          currency: 'ILS',
          payment_method: 'payplus',
          payment_status: 'pending',
          environment: dbEnvironment,
          payment_page_request_uid: pageRequestUid,
          payment_page_link: paymentPageLink,
          metadata: {
            transaction_type: transactionType,
            purchaseIds: purchaseIds,
            createdAt: new Date().toISOString(),
            ...metadata
          },
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // Update all purchases with this transaction ID
      if (purchaseIds.length > 0) {
        await models.Purchase.update(
          {
            transaction_id: transaction.id,
            updated_at: new Date()
          },
          {
            where: {
              id: purchaseIds,
              buyer_user_id: userId,
              payment_status: 'cart' // Only update cart purchases
            }
          }
        );
      }

      return transaction;

    } catch (error) {
      logger.payment('PaymentService: Error creating/updating PayPlus transaction:', error);
      throw error;
    }
  }

  /**
   * Get purchases with their associated product/subscription data populated
   * @param {Array} purchases - Array of purchase objects
   * @returns {Promise<Array>} Purchases with populated product data
   */
  static async populatePurchasesWithProducts(purchases) {
    const populatedPurchases = [];

    for (const purchase of purchases) {
      try {
        let product = null;

        // Fetch the associated product based on purchasable_type
        switch (purchase.purchasable_type) {
          case 'workshop':
            product = await models.Workshop.findByPk(purchase.purchasable_id);
            break;
          case 'course':
            product = await models.Course.findByPk(purchase.purchasable_id);
            break;
          case 'file':
            product = await models.File.findByPk(purchase.purchasable_id);
            break;
          case 'lesson_plan':
            product = await models.LessonPlan.findByPk(purchase.purchasable_id);
            break;
          case 'tool':
            product = await models.Tool.findByPk(purchase.purchasable_id);
            break;
          case 'game':
            product = await models.Game.findByPk(purchase.purchasable_id);
            break;
          case 'subscription':
            product = await models.SubscriptionPlan.findByPk(purchase.purchasable_id);
            break;
          default:

        }

        // Add the product data to the purchase
        const populatedPurchase = {
          ...purchase.toJSON ? purchase.toJSON() : purchase,
          product: product ? (product.toJSON ? product.toJSON() : product) : null
        };

        populatedPurchases.push(populatedPurchase);

        if (!product) {

        }

      } catch (error) {
        logger.payment(`PaymentService: Error fetching product for purchase ${purchase.id}:`, error);
        // Add purchase without product data as fallback
        populatedPurchases.push(purchase.toJSON ? purchase.toJSON() : purchase);
      }
    }

    return populatedPurchases;
  }

  /**
   * Get PayPlus credentials based on NODE_ENV
   * @returns {Object} PayPlus configuration object
   */
  static getPayPlusCredentials() {
    try {
      // Auto-detect environment based on NODE_ENV
      // Development and staging use PayPlus test environment
      // Production uses PayPlus production environment
      const nodeEnv = process.env.NODE_ENV || 'development';
      const isProd = nodeEnv === 'production';
      const normalizedEnv = isProd ? 'production' : 'staging';

      const credentials = {
        payplusUrl: isProd
          ? 'https://restapi.payplus.co.il/api/v1.0/'
          : 'https://restapidev.payplus.co.il/api/v1.0/',
        payment_page_uid: isProd
          ? process.env.PAYPLUS_PAYMENT_PAGE_UID
          : process.env.PAYPLUS_STAGING_PAYMENT_PAGE_UID,
        payment_api_key: isProd
          ? process.env.PAYPLUS_API_KEY
          : process.env.PAYPLUS_STAGING_API_KEY,
        payment_secret_key: isProd
          ? process.env.PAYPLUS_SECRET_KEY
          : process.env.PAYPLUS_STAGING_SECRET_KEY,
        environment: normalizedEnv
      };

      // Validate required credentials
      const requiredFields = ['payment_page_uid', 'payment_api_key', 'payment_secret_key'];
      const missingFields = requiredFields.filter(field => !credentials[field]);

      if (missingFields.length > 0) {
        const envPrefix = isProd ? 'PAYPLUS_PRODUCTION' : 'PAYPLUS_STAGING';
        const missingEnvVars = missingFields.map(field => {
          switch(field) {
            case 'payment_page_uid': return `${envPrefix}_PAYMENT_PAGE_UID`;
            case 'payment_api_key': return `${envPrefix}_API_KEY`;
            case 'payment_secret_key': return `${envPrefix}_SECRET_KEY`;
            default: return field;
          }
        });

        throw new Error(`Missing PayPlus ${normalizedEnv} credentials: ${missingEnvVars.join(', ')}`);
      }

      return credentials;

    } catch (error) {
      logger.auth('PaymentService: Error getting PayPlus credentials:', error);
      throw error;
    }
  }
}

export default PaymentService;