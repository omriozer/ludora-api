import models from '../models/index.js';
import { Op } from 'sequelize';
import { luderror } from '../lib/ludlog.js';
import { calcSubscriptionPlanPrice } from '../utils/purchasePricing.js';

/**
 * SubscriptionService - Handles subscription lifecycle management
 */
class SubscriptionService {
  /**
   * Validate subscription creation constraints
   * @param {string} userId - User ID
   * @param {string} subscriptionPlanId - Subscription plan ID
   * @returns {Promise<Object>} Validation result with valid flag and details
   */
  static async validateSubscriptionCreation(userId, subscriptionPlanId) {
    try {
      // Run all queries in parallel with Promise.all for 70-80% performance improvement
      const [activeSubscription, pendingSubscriptions, subscriptionPlan] = await Promise.all([
        // Query 1: Active subscription (includes subscription plan data via JOIN)
        models.Subscription.findOne({
          where: {
            user_id: userId,
            status: ['active', 'pending']
          },
          include: [{
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          }],
          order: [['created_at', 'DESC']]
        }),

        // Query 2: All pending subscriptions
        models.Subscription.findAll({
          where: {
            user_id: userId,
            status: 'pending'
          },
          attributes: ['id', 'subscription_plan_id', 'status', 'created_at']
        }),

        // Query 3: Target subscription plan
        models.SubscriptionPlan.findByPk(subscriptionPlanId)
      ]);

      // Validate plan exists and is active
      if (!subscriptionPlan || !subscriptionPlan.is_active) {
        return {
          valid: false,
          error: 'Subscription plan not found or inactive'
        };
      }

      if (activeSubscription) {
        // Check if trying to create same subscription plan
        if (activeSubscription.subscription_plan_id === subscriptionPlanId) {
          return {
            valid: false,
            error: 'User already has an active subscription for this plan',
            existingSubscription: activeSubscription,
            canUpgrade: false
          };
        }

        // Check if user has a pending subscription for the same plan
        const samePlanPending = pendingSubscriptions.find(sub =>
          sub.subscription_plan_id === subscriptionPlanId
        );

        if (samePlanPending) {
          return {
            valid: false,
            error: 'User already has a pending subscription for this plan',
            existingSubscription: samePlanPending,
            canUpgrade: false
          };
        }

        // If different plan, this could be an upgrade/downgrade (lay groundwork)
        return {
          valid: true,
          isUpgrade: true,
          existingSubscription: activeSubscription,
          subscriptionPlan,
          message: 'This will replace the current active subscription'
        };
      }

      if (pendingSubscriptions.length > 0) {
        // Check if any pending subscription is for the same plan
        const samePlanPending = pendingSubscriptions.find(sub =>
          sub.subscription_plan_id === subscriptionPlanId
        );

        if (samePlanPending) {
          return {
            valid: false,
            error: 'User already has a pending subscription for this plan',
            existingSubscription: samePlanPending,
            canUpgrade: false
          };
        }

        // Multiple pending subscriptions - this shouldn't happen, but handle it
        return {
          valid: false,
          error: 'User has pending subscriptions. Please complete or cancel them first.',
          existingSubscriptions: pendingSubscriptions,
          canUpgrade: false
        };
      }

      return {
        valid: true,
        subscriptionPlan,
        message: 'Subscription can be created'
      };

    } catch (error) {
      luderror.payment('SubscriptionService: Error validating subscription creation:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new subscription for a user
   * @param {Object} options - Subscription creation options
   * @param {string} options.userId - User ID
   * @param {string} options.subscriptionPlanId - Subscription plan ID
   * @param {string} options.transactionId - Transaction ID (optional)
   * @param {Object} options.metadata - Additional metadata
   * @param {Object} options.subscriptionPlan - Pre-fetched subscription plan object (optional)
   * @param {boolean} options.skipValidation - Skip validation constraints (optional)
   * @returns {Promise<Object>} Created subscription object
   */
  static async createSubscription(options = {}) {
    const {
      userId,
      subscriptionPlanId,
      transactionId = null,
      metadata = {},
      subscriptionPlan = null,
      skipValidation = false
    } = options;

    try {
      // Get subscription plan details
      let planObject = subscriptionPlan;

      if (!planObject) {
        // If no plan object provided, validate and fetch it
        if (!skipValidation) {
          const validation = await this.validateSubscriptionCreation(userId, subscriptionPlanId);
          if (!validation.valid) {
            throw new Error(validation.error);
          }
          planObject = validation.subscriptionPlan;
        } else {
          // If skipping validation, just fetch the plan directly
          planObject = await models.SubscriptionPlan.findByPk(subscriptionPlanId);
          if (!planObject || !planObject.is_active) {
            throw new Error('Subscription plan not found or inactive');
          }
        }
      }

      // Calculate pricing with discounts
      const pricingInfo = calcSubscriptionPlanPrice(planObject);
      const finalPrice = pricingInfo.finalPrice;

      // Generate subscription ID
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Calculate subscription dates
      const startDate = new Date();
      let nextBillingDate = null;

      // Only set billing date for paid subscriptions
      if (finalPrice > 0) {
        nextBillingDate = this.calculateNextBillingDate(startDate, planObject.billing_period);
      }

      // Create subscription record
      const subscriptionData = {
        id: subscriptionId,
        user_id: userId,
        subscription_plan_id: subscriptionPlanId,
        transaction_id: transactionId,
        status: finalPrice === 0 ? 'active' : 'pending', // Free plans are immediately active
        start_date: startDate,
        next_billing_date: nextBillingDate,
        monthly_price: finalPrice, // Use discounted price for billing
        original_price: pricingInfo.originalPrice,
        discount_amount: pricingInfo.discountAmount,
        billing_period: planObject.billing_period || 'monthly',
        metadata: {
          planSnapshot: {
            name: planObject.name,
            description: planObject.description,
            benefits: planObject.benefits,
            originalPrice: pricingInfo.originalPrice,
            discountInfo: pricingInfo.isDiscounted ? {
              type: pricingInfo.discountType,
              value: pricingInfo.discountValue,
              amount: pricingInfo.discountAmount
            } : null
          },
          pricingSnapshot: pricingInfo,
          createdAt: new Date().toISOString(),
          ...metadata
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      const subscription = await models.Subscription.create(subscriptionData);

      return subscription;

    } catch (error) {
      luderror.payment('SubscriptionService: Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's active subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active subscription or null
   */
  static async getUserActiveSubscription(userId) {
    try {
      const subscription = await models.Subscription.findOne({
        where: {
          user_id: userId,
          status: ['active', 'pending']
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return subscription;
    } catch (error) {
      luderror.payment('SubscriptionService: Error getting user active subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's subscription history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of subscriptions
   */
  static async getUserSubscriptionHistory(userId, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;

      const subscriptions = await models.Subscription.findAll({
        where: {
          user_id: userId
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          },
          {
            model: models.Transaction,
            as: 'transaction'
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      return subscriptions;
    } catch (error) {
      luderror.payment('SubscriptionService: Error getting user subscription history:', error);
      throw error;
    }
  }

  /**
   * Activate a pending subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} options - Activation options
   * @returns {Promise<Object>} Updated subscription
   */
  static async activateSubscription(subscriptionId, options = {}) {
    try {
      const subscription = await models.Subscription.findByPk(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (subscription.status !== 'pending') {
        throw new Error(`Cannot activate subscription with status: ${subscription.status}`);
      }

      const activatedSubscription = await subscription.activate(options);

      return activatedSubscription;

    } catch (error) {
      luderror.payment('SubscriptionService: Error activating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Updated subscription
   */
  static async cancelSubscription(subscriptionId, options = {}) {
    try {
      const subscription = await models.Subscription.findByPk(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (!subscription.canBeCancelled()) {
        throw new Error(`Cannot cancel subscription with status: ${subscription.status}`);
      }

      const cancelledSubscription = await subscription.cancel({
        keepActiveUntilEndDate: true, // Keep subscription active until end date
        reason: options.reason || 'user_cancelled',
        ...options
      });

      return cancelledSubscription;

    } catch (error) {
      luderror.payment('SubscriptionService: Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription from PayPlus webhook
   * @param {string} payplusSubscriptionUid - PayPlus subscription UID
   * @param {Object} payplusData - PayPlus webhook data
   * @returns {Promise<Object>} Updated subscription
   */
  static async updateSubscriptionFromPayPlus(payplusSubscriptionUid, payplusData) {
    try {
      const subscription = await models.Subscription.findOne({
        where: {
          payplus_subscription_uid: payplusSubscriptionUid
        }
      });

      if (!subscription) {
        luderror.payment('SubscriptionService: Subscription not found for PayPlus UID', {
          payplusSubscriptionUid
        });
        throw new Error(`Subscription not found for PayPlus UID: ${payplusSubscriptionUid}`);
      }

      const updatedSubscription = await subscription.updateFromPayPlus(payplusData);

      return updatedSubscription;

    } catch (error) {
      luderror.payment('SubscriptionService: Error updating subscription from PayPlus:', error);
      throw error;
    }
  }

  /**
   * Check and process expired subscriptions
   * @returns {Promise<Array>} Array of processed subscription IDs
   */
  static async processExpiredSubscriptions() {
    try {
      const expiredSubscriptions = await models.Subscription.findAll({
        where: {
          status: 'active',
          end_date: {
            [Op.lte]: new Date()
          }
        }
      });

      const processedIds = [];

      for (const subscription of expiredSubscriptions) {
        try {
          await subscription.update({
            status: 'expired',
            updated_at: new Date()
          });
          processedIds.push(subscription.id);
        } catch (err) {
          luderror.payment('SubscriptionService: Error marking subscription as expired:', err, {
            subscriptionId: subscription.id
          });
        }
      }

      return processedIds;

    } catch (error) {
      luderror.payment('SubscriptionService: Error processing expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Calculate next billing date
   * @param {Date} fromDate - Starting date
   * @param {string} billingPeriod - Billing period ('monthly' or 'yearly')
   * @returns {Date} Next billing date
   */
  static calculateNextBillingDate(fromDate, billingPeriod) {
    const nextBilling = new Date(fromDate);

    switch (billingPeriod) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      default:
        // Default to monthly if billing period is invalid
        nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    return nextBilling;
  }

  /**
   * Get subscription by ID with related data
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Subscription with related data
   */
  static async getSubscriptionById(subscriptionId) {
    try {
      const subscription = await models.Subscription.findByPk(subscriptionId, {
        include: [
          {
            model: models.User,
            as: 'user'
          },
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          },
          {
            model: models.Transaction,
            as: 'transaction'
          }
        ]
      });

      return subscription;
    } catch (error) {
      luderror.payment('SubscriptionService: Error getting subscription by ID:', error);
      throw error;
    }
  }

  /**
   * Update subscription PayPlus UID
   * @param {string} subscriptionId - Subscription ID
   * @param {string} payplusSubscriptionUid - PayPlus subscription UID
   * @returns {Promise<Object>} Updated subscription
   */
  static async updateSubscriptionPayPlusUid(subscriptionId, payplusSubscriptionUid) {
    try {
      const subscription = await models.Subscription.findByPk(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const updatedSubscription = await subscription.update({
        payplus_subscription_uid: payplusSubscriptionUid,
        updated_at: new Date()
      });

      return updatedSubscription;

    } catch (error) {
      luderror.payment('SubscriptionService: Error updating subscription PayPlus UID:', error);
      throw error;
    }
  }

  /**
   * Get user's pending subscription for a specific plan (for retry payments)
   * @param {string} userId - User ID
   * @param {string} subscriptionPlanId - Subscription plan ID
   * @returns {Promise<Object|null>} Pending subscription or null
   */
  static async getUserPendingSubscription(userId, subscriptionPlanId) {
    try {
      const subscription = await models.Subscription.findOne({
        where: {
          user_id: userId,
          subscription_plan_id: subscriptionPlanId,
          status: 'pending'
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          },
          {
            model: models.Transaction,
            as: 'transaction'
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return subscription;
    } catch (error) {
      luderror.payment('SubscriptionService: Error getting user pending subscription:', error);
      throw error;
    }
  }

  /**
   * Validate retry payment for pending subscription
   * @param {string} userId - User ID
   * @param {string} subscriptionPlanId - Subscription plan ID
   * @returns {Promise<Object>} Validation result with pending subscription info
   */
  static async validateRetryPayment(userId, subscriptionPlanId) {
    try {
      // Check for pending subscription
      const pendingSubscription = await this.getUserPendingSubscription(userId, subscriptionPlanId);

      if (!pendingSubscription) {
        return {
          valid: false,
          error: 'No pending subscription found for this plan',
          canCreateNew: true
        };
      }

      // Check if subscription plan exists and is active
      const subscriptionPlan = await models.SubscriptionPlan.findByPk(subscriptionPlanId);
      if (!subscriptionPlan || !subscriptionPlan.is_active) {
        return {
          valid: false,
          error: 'Subscription plan not found or inactive'
        };
      }

      return {
        valid: true,
        pendingSubscription,
        subscriptionPlan,
        message: 'Retry payment can proceed'
      };

    } catch (error) {
      luderror.payment('SubscriptionService: Error validating retry payment:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Change user's subscription plan (for direct changes like downgrades or free plans)
   * @param {Object} options - Plan change options
   * @param {string} options.userId - User ID
   * @param {string} options.subscriptionPlanId - New subscription plan ID
   * @param {string} options.actionType - Type of action (downgrade, upgrade, etc.)
   * @param {string} options.fromPlanId - Previous plan ID (optional)
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Change result with subscription details
   */
  static async changePlan(options = {}) {
    const {
      userId,
      subscriptionPlanId,
      actionType,
      fromPlanId = null,
      metadata = {}
    } = options;

    try {
      // Get target plan
      const targetPlan = await models.SubscriptionPlan.findByPk(subscriptionPlanId);

      if (!targetPlan || !targetPlan.is_active) {
        throw new Error('Target subscription plan not found or inactive');
      }

      // Get current active subscription (if any)
      const currentSubscription = await this.getUserActiveSubscription(userId);

      // Handle CANCEL_PENDING_DOWNGRADE action type
      if (actionType === 'cancel_pending_downgrade') {
        // Cancel any pending subscriptions for the user
        const pendingSubscriptions = await models.Subscription.findAll({
          where: {
            user_id: userId,
            status: 'pending'
          }
        });

        // Cancel all pending subscriptions
        for (const pendingSub of pendingSubscriptions) {
          await pendingSub.update({
            status: 'cancelled',
            cancelled_at: new Date(),
            metadata: {
              ...pendingSub.metadata,
              cancellationReason: 'user_downgraded_to_free',
              cancelledAt: new Date().toISOString(),
              cancelledBy: 'change_plan_api'
            }
          });
        }
      }

      // For free plans, create immediate active subscription
      if (Number(targetPlan.price) === 0) {
        // Cancel ALL existing subscriptions (active and pending) for the user
        const allUserSubscriptions = await models.Subscription.findAll({
          where: {
            user_id: userId,
            status: ['active', 'pending']
          }
        });

        for (const subscription of allUserSubscriptions) {
          if (subscription.status === 'active') {
            await this.cancelSubscription(subscription.id, {
              reason: 'downgraded_to_free',
              immediate: true,
              metadata: {
                downgradedTo: subscriptionPlanId,
                downgradedAt: new Date().toISOString()
              }
            });
          } else if (subscription.status === 'pending') {
            // For pending subscriptions, cancel them directly
            await subscription.update({
              status: 'cancelled',
              cancelled_at: new Date(),
              metadata: {
                ...subscription.metadata,
                cancellationReason: 'downgraded_to_free_from_pending',
                cancelledAt: new Date().toISOString(),
                cancelledBy: 'change_plan_api'
              }
            });
          }
        }

        // Create new free subscription
        const newSubscription = await this.createSubscription({
          userId,
          subscriptionPlanId,
          subscriptionPlan: targetPlan,
          skipValidation: true,
          metadata: {
            ...metadata,
            actionType,
            fromPlanId,
            createdVia: 'change_plan_api',
            planChangeReason: actionType === 'cancel_pending_downgrade' ? 'cancelled_pending_and_downgraded' : 'direct_plan_change'
          }
        });

        return {
          success: true,
          subscription: newSubscription,
          message: 'Plan changed successfully to free plan',
          actionType
        };
      }

      // For paid plans, this method should not be used - they should go through payment flow
      throw new Error('Paid plan changes must go through payment flow');

    } catch (error) {
      luderror.payment('SubscriptionService: Error changing subscription plan:', error);
      throw error;
    }
  }
}

export default SubscriptionService;