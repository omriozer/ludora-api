import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import SubscriptionProrationService from './SubscriptionProrationService.js';
import PayplusSubscriptionService from './PayplusSubscriptionService.js';
import PayPlusTokenChargeService from './PayPlusTokenChargeService.js';
import PaymentTokenService from './PaymentTokenService.js';

/**
 * SubscriptionPlanChangeService - Orchestrates subscription plan upgrades and downgrades
 * Handles complete flows for:
 * - Immediate upgrades with proration charging
 * - Scheduled downgrades for next billing cycle
 * - Canceling pending downgrades
 */
class SubscriptionPlanChangeService {
  /**
   * Upgrade user's subscription plan with immediate proration charge
   * Flow:
   * 1. Validate upgrade eligibility
   * 2. Calculate proration amount
   * 3. Charge prorated amount via saved payment token
   * 4. Update PayPlus subscription amount
   * 5. Update local subscription record
   * 6. Record history entry
   *
   * @param {Object} params - Upgrade parameters
   * @param {string} params.userId - User ID
   * @param {string} params.subscriptionId - Current subscription ID
   * @param {string} params.newPlanId - Target subscription plan ID
   * @param {string} params.paymentMethodId - Payment method ID for proration charge (optional, uses default if not provided)
   * @returns {Promise<Object>} Upgrade result
   */
  static async upgradeSubscription(params) {
    const {
      userId,
      subscriptionId,
      newPlanId,
      paymentMethodId = null
    } = params;

    // Start database transaction for atomicity
    const transaction = await models.sequelize.transaction();

    try {
      ludlog.payments('🚀 Starting subscription upgrade process:', {
        userId,
        subscriptionId,
        newPlanId
      });

      // Step 1: Get and validate current subscription
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId
        },
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }],
        transaction
      });

      if (!subscription) {
        throw new Error('Subscription not found or does not belong to user');
      }

      // Step 2: Get and validate target plan
      const newPlan = await models.SubscriptionPlan.findByPk(newPlanId, { transaction });
      if (!newPlan) {
        throw new Error(`Target subscription plan ${newPlanId} not found`);
      }

      // Step 3: Validate plan change eligibility
      const validation = await SubscriptionProrationService.validatePlanChange(subscription, newPlan);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.changeType !== 'upgrade') {
        throw new Error('This is not an upgrade. Use downgradeSubscription instead.');
      }

      // Step 4: Calculate proration
      const prorationResult = await SubscriptionProrationService.calculateUpgradeProration(subscription, newPlan);
      if (!prorationResult.success) {
        throw new Error(`Proration calculation failed: ${prorationResult.error}`);
      }

      const proratedAmount = prorationResult.calculation.proratedAmount;

      ludlog.payments('💰 Proration calculated:', {
        currentPlan: subscription.subscriptionPlan.name,
        newPlan: newPlan.name,
        proratedAmount,
        remainingDays: prorationResult.calculation.remainingDays
      });

      // Step 5: Get payment method for proration charge
      let paymentMethod;
      if (paymentMethodId) {
        // Use specified payment method
        paymentMethod = await PaymentTokenService.validateUserOwnership(paymentMethodId, userId, transaction);
        if (!paymentMethod) {
          throw new Error('Payment method not found or does not belong to user');
        }
      } else {
        // Use default payment method
        paymentMethod = await PaymentTokenService.getUserDefaultPaymentMethod(userId, transaction);
        if (!paymentMethod) {
          throw new Error('No payment method found. Please add a payment method first.');
        }
      }

      ludlog.payments('💳 Using payment method:', {
        paymentMethodId: paymentMethod.id,
        displayName: paymentMethod.getDisplayName()
      });

      // Step 6: Charge prorated amount via saved token
      const user = await models.User.findByPk(userId, { transaction });
      if (!user) {
        throw new Error('User not found');
      }

      const chargeResult = await PayPlusTokenChargeService.chargeToken({
        token: paymentMethod.payplus_token,
        amount: proratedAmount,
        currency: 'ILS',
        customerEmail: user.email,
        customerName: user.displayName || user.email,
        description: `שדרוג מנוי: ${subscription.subscriptionPlan.name} → ${newPlan.name} (${prorationResult.calculation.remainingDays} ימים)`,
        metadata: {
          subscription_id: subscriptionId,
          upgrade_from: subscription.subscription_plan_id,
          upgrade_to: newPlanId,
          proration_days: prorationResult.calculation.remainingDays,
          charge_type: 'proration_upgrade'
        }
      });

      if (!chargeResult.success) {
        throw new Error(`Proration charge failed: ${chargeResult.error}`);
      }

      ludlog.payments('✅ Proration charge successful:', {
        transactionId: chargeResult.transactionId,
        amount: proratedAmount
      });

      // Step 7: Update PayPlus subscription amount
      if (!subscription.payplus_subscription_uid) {
        throw new Error('Subscription missing PayPlus UID');
      }

      const payplusUpdateResult = await PayplusSubscriptionService.updateRecurringPayment({
        subscriptionUid: subscription.payplus_subscription_uid,
        newAmount: parseFloat(newPlan.price),
        reason: 'upgrade'
      });

      if (!payplusUpdateResult.success) {
        // CRITICAL: Charge succeeded but PayPlus update failed
        // We should refund the proration charge here
        luderror.payments('🚨 CRITICAL: PayPlus update failed after successful charge:', {
          chargeId: chargeResult.transactionId,
          error: payplusUpdateResult.error
        });
        throw new Error(`PayPlus update failed: ${payplusUpdateResult.error}. Proration charge needs manual review.`);
      }

      ludlog.payments('✅ PayPlus subscription updated to new amount:', {
        newAmount: newPlan.price
      });

      // Step 8: Update local subscription record
      await subscription.update({
        subscription_plan_id: newPlanId,
        billing_price: newPlan.price,
        original_price: newPlan.price,
        metadata: {
          ...subscription.metadata,
          last_plan_change: {
            type: 'upgrade',
            from_plan_id: subscription.subscription_plan_id,
            to_plan_id: newPlanId,
            proration_charged: proratedAmount,
            proration_transaction_id: chargeResult.transactionId,
            changed_at: new Date().toISOString(),
            effective_immediately: true
          },
          // Remove any pending downgrade
          pending_plan_change: null
        },
        updated_at: new Date()
      }, { transaction });

      // Step 9: Record subscription history
      await models.SubscriptionHistory.recordAction({
        userId,
        subscriptionPlanId: newPlanId,
        actionType: 'upgraded',
        subscriptionId: subscription.id,
        previousPlanId: subscription.subscription_plan_id,
        purchasedPrice: proratedAmount,
        payplusSubscriptionUid: subscription.payplus_subscription_uid,
        notes: `Upgraded from ${subscription.subscriptionPlan.name} to ${newPlan.name}. Prorated charge: ₪${proratedAmount}`,
        metadata: {
          proration_calculation: prorationResult.calculation,
          proration_transaction_id: chargeResult.transactionId,
          payment_method_id: paymentMethod.id,
          payplus_update_result: payplusUpdateResult
        }
      });

      // Commit transaction
      await transaction.commit();

      ludlog.payments('🎉 Subscription upgrade completed successfully:', {
        subscriptionId,
        fromPlan: subscription.subscriptionPlan.name,
        toPlan: newPlan.name,
        proratedCharge: proratedAmount
      });

      return {
        success: true,
        subscription: await models.Subscription.findByPk(subscriptionId, {
          include: [{ model: models.SubscriptionPlan, as: 'subscriptionPlan' }]
        }),
        upgrade: {
          fromPlan: subscription.subscriptionPlan.name,
          toPlan: newPlan.name,
          proratedCharge: proratedAmount,
          newRecurringAmount: newPlan.price,
          effectiveImmediately: true,
          transactionId: chargeResult.transactionId
        },
        message: `מנויך שודרג בהצלחה ל-${newPlan.name}! חויבת ב-₪${proratedAmount} עבור התקופה הנוכחית.`
      };

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();

      luderror.payments('SubscriptionPlanChangeService: Error upgrading subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Schedule subscription downgrade for next billing cycle
   * Flow:
   * 1. Validate downgrade eligibility
   * 2. Calculate effective date (next billing)
   * 3. Update PayPlus subscription amount for next cycle
   * 4. Store pending change in metadata
   * 5. Record history entry
   *
   * @param {Object} params - Downgrade parameters
   * @param {string} params.userId - User ID
   * @param {string} params.subscriptionId - Current subscription ID
   * @param {string} params.newPlanId - Target subscription plan ID
   * @returns {Promise<Object>} Downgrade result
   */
  static async downgradeSubscription(params) {
    const {
      userId,
      subscriptionId,
      newPlanId
    } = params;

    // Start database transaction
    const transaction = await models.sequelize.transaction();

    try {
      ludlog.payments('📉 Starting subscription downgrade scheduling:', {
        userId,
        subscriptionId,
        newPlanId
      });

      // Step 1: Get and validate current subscription
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId
        },
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }],
        transaction
      });

      if (!subscription) {
        throw new Error('Subscription not found or does not belong to user');
      }

      // Step 2: Get and validate target plan
      const newPlan = await models.SubscriptionPlan.findByPk(newPlanId, { transaction });
      if (!newPlan) {
        throw new Error(`Target subscription plan ${newPlanId} not found`);
      }

      // Step 3: Validate plan change eligibility
      const validation = await SubscriptionProrationService.validatePlanChange(subscription, newPlan);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.changeType !== 'downgrade') {
        throw new Error('This is not a downgrade. Use upgradeSubscription instead.');
      }

      // Step 4: Calculate downgrade scheduling
      const schedulingResult = await SubscriptionProrationService.calculateDowngradeScheduling(subscription, newPlan);
      if (!schedulingResult.success) {
        throw new Error(`Downgrade scheduling failed: ${schedulingResult.error}`);
      }

      const effectiveDate = schedulingResult.scheduling.effectiveDate;
      const daysRemaining = schedulingResult.scheduling.daysRemaining;

      ludlog.payments('📅 Downgrade scheduled:', {
        currentPlan: subscription.subscriptionPlan.name,
        newPlan: newPlan.name,
        effectiveDate,
        daysRemaining
      });

      // Step 5: Update PayPlus subscription for next billing cycle
      if (!subscription.payplus_subscription_uid) {
        throw new Error('Subscription missing PayPlus UID');
      }

      const payplusUpdateResult = await PayplusSubscriptionService.updateRecurringPayment({
        subscriptionUid: subscription.payplus_subscription_uid,
        newAmount: parseFloat(newPlan.price),
        reason: 'downgrade'
      });

      if (!payplusUpdateResult.success) {
        throw new Error(`PayPlus update failed: ${payplusUpdateResult.error}`);
      }

      ludlog.payments('✅ PayPlus subscription scheduled for downgrade:', {
        newAmount: newPlan.price,
        effectiveDate
      });

      // Step 6: Store pending downgrade in metadata
      await subscription.update({
        metadata: {
          ...subscription.metadata,
          pending_plan_change: {
            type: 'downgrade',
            from_plan_id: subscription.subscription_plan_id,
            to_plan_id: newPlanId,
            effective_date: effectiveDate,
            scheduled_at: new Date().toISOString(),
            new_recurring_amount: newPlan.price
          }
        },
        updated_at: new Date()
      }, { transaction });

      // Step 7: Record subscription history
      await models.SubscriptionHistory.recordAction({
        userId,
        subscriptionPlanId: newPlanId,
        actionType: 'downgraded',
        subscriptionId: subscription.id,
        previousPlanId: subscription.subscription_plan_id,
        payplusSubscriptionUid: subscription.payplus_subscription_uid,
        notes: `Scheduled downgrade from ${subscription.subscriptionPlan.name} to ${newPlan.name}. Effective: ${new Date(effectiveDate).toLocaleDateString('he-IL')}`,
        metadata: {
          downgrade_scheduling: schedulingResult.scheduling,
          payplus_update_result: payplusUpdateResult,
          effective_date: effectiveDate,
          days_until_effective: daysRemaining
        }
      });

      // Commit transaction
      await transaction.commit();

      ludlog.payments('🎉 Subscription downgrade scheduled successfully:', {
        subscriptionId,
        fromPlan: subscription.subscriptionPlan.name,
        toPlan: newPlan.name,
        effectiveDate
      });

      return {
        success: true,
        subscription: await models.Subscription.findByPk(subscriptionId, {
          include: [{ model: models.SubscriptionPlan, as: 'subscriptionPlan' }]
        }),
        downgrade: {
          fromPlan: subscription.subscriptionPlan.name,
          toPlan: newPlan.name,
          effectiveDate,
          daysRemaining,
          newRecurringAmount: newPlan.price,
          currentPlanContinuesUntil: effectiveDate
        },
        message: `מנויך ישודרג ל-${newPlan.name} ב-${new Date(effectiveDate).toLocaleDateString('he-IL')}. עד אז, תמשיך ליהנות מ-${subscription.subscriptionPlan.name}.`
      };

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();

      luderror.payments('SubscriptionPlanChangeService: Error scheduling downgrade:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a pending subscription downgrade
   * Flow:
   * 1. Validate subscription has pending downgrade
   * 2. Update PayPlus back to current plan amount
   * 3. Remove pending change from metadata
   * 4. Record history entry
   *
   * @param {Object} params - Cancellation parameters
   * @param {string} params.userId - User ID
   * @param {string} params.subscriptionId - Subscription ID
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelPendingDowngrade(params) {
    const {
      userId,
      subscriptionId
    } = params;

    // Start database transaction
    const transaction = await models.sequelize.transaction();

    try {
      ludlog.payments('❌ Canceling pending subscription downgrade:', {
        userId,
        subscriptionId
      });

      // Step 1: Get and validate subscription
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId
        },
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }],
        transaction
      });

      if (!subscription) {
        throw new Error('Subscription not found or does not belong to user');
      }

      // Step 2: Validate pending downgrade exists
      if (!subscription.metadata?.pending_plan_change) {
        throw new Error('No pending plan change found');
      }

      if (subscription.metadata.pending_plan_change.type !== 'downgrade') {
        throw new Error('Pending change is not a downgrade');
      }

      const pendingChange = subscription.metadata.pending_plan_change;

      ludlog.payments('📋 Found pending downgrade:', {
        fromPlan: pendingChange.from_plan_id,
        toPlan: pendingChange.to_plan_id,
        effectiveDate: pendingChange.effective_date
      });

      // Step 3: Update PayPlus back to current plan amount
      if (!subscription.payplus_subscription_uid) {
        throw new Error('Subscription missing PayPlus UID');
      }

      const payplusUpdateResult = await PayplusSubscriptionService.updateRecurringPayment({
        subscriptionUid: subscription.payplus_subscription_uid,
        newAmount: parseFloat(subscription.subscriptionPlan.price),
        reason: 'cancel_downgrade'
      });

      if (!payplusUpdateResult.success) {
        throw new Error(`PayPlus update failed: ${payplusUpdateResult.error}`);
      }

      ludlog.payments('✅ PayPlus subscription restored to current plan amount:', {
        amount: subscription.subscriptionPlan.price
      });

      // Step 4: Remove pending change from metadata
      const updatedMetadata = { ...subscription.metadata };
      delete updatedMetadata.pending_plan_change;

      // Add cancellation record to history
      if (!updatedMetadata.cancelled_plan_changes) {
        updatedMetadata.cancelled_plan_changes = [];
      }
      updatedMetadata.cancelled_plan_changes.push({
        ...pendingChange,
        cancelled_at: new Date().toISOString()
      });

      await subscription.update({
        metadata: updatedMetadata,
        updated_at: new Date()
      }, { transaction });

      // Step 5: Record subscription history
      await models.SubscriptionHistory.create({
        id: `subhist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        user_id: userId,
        subscription_plan_id: subscription.subscription_plan_id,
        subscription_id: subscription.id,
        action_type: 'renewed', // Using 'renewed' as closest match for canceling downgrade
        payplus_subscription_uid: subscription.payplus_subscription_uid,
        notes: `Canceled pending downgrade. Keeping ${subscription.subscriptionPlan.name}.`,
        metadata: {
          cancelled_downgrade: pendingChange,
          payplus_update_result: payplusUpdateResult
        },
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });

      // Commit transaction
      await transaction.commit();

      ludlog.payments('🎉 Pending downgrade canceled successfully:', {
        subscriptionId,
        currentPlan: subscription.subscriptionPlan.name
      });

      return {
        success: true,
        subscription: await models.Subscription.findByPk(subscriptionId, {
          include: [{ model: models.SubscriptionPlan, as: 'subscriptionPlan' }]
        }),
        message: `השינוי למנוי ${subscription.subscriptionPlan.name} בוטל. תמשיך ליהנות מ-${subscription.subscriptionPlan.name}.`
      };

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();

      luderror.payments('SubscriptionPlanChangeService: Error canceling pending downgrade:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available plan change options for a subscription
   * @param {Object} params - Query parameters
   * @param {string} params.userId - User ID
   * @param {string} params.subscriptionId - Subscription ID
   * @returns {Promise<Object>} Available options
   */
  static async getAvailablePlanChanges(params) {
    const {
      userId,
      subscriptionId
    } = params;

    try {
      // Get subscription
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId
        },
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }]
      });

      if (!subscription) {
        throw new Error('Subscription not found or does not belong to user');
      }

      // Get all active plans with same billing period
      const availablePlans = await models.SubscriptionPlan.findAll({
        where: {
          is_active: true,
          billing_period: subscription.subscriptionPlan.billing_period
        },
        order: [['price', 'ASC']]
      });

      // Categorize plans
      const currentPrice = parseFloat(subscription.billing_price);
      const upgradePlans = [];
      const downgradePlans = [];

      for (const plan of availablePlans) {
        if (plan.id === subscription.subscription_plan_id) {
          continue; // Skip current plan
        }

        const planPrice = parseFloat(plan.price);
        if (planPrice > currentPrice) {
          // Calculate proration for upgrades
          const prorationResult = await SubscriptionProrationService.calculateUpgradeProration(subscription, plan);
          upgradePlans.push({
            ...plan.toJSON(),
            proration: prorationResult.success ? prorationResult.calculation : null
          });
        } else if (planPrice < currentPrice) {
          // Calculate scheduling for downgrades
          const schedulingResult = await SubscriptionProrationService.calculateDowngradeScheduling(subscription, plan);
          downgradePlans.push({
            ...plan.toJSON(),
            scheduling: schedulingResult.success ? schedulingResult.scheduling : null
          });
        }
      }

      return {
        success: true,
        currentPlan: subscription.subscriptionPlan.toJSON(),
        pendingChange: subscription.metadata?.pending_plan_change || null,
        upgradePlans,
        downgradePlans,
        canUpgrade: upgradePlans.length > 0,
        canDowngrade: downgradePlans.length > 0 && !subscription.metadata?.pending_plan_change
      };

    } catch (error) {
      luderror.payments('SubscriptionPlanChangeService: Error getting available plan changes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default SubscriptionPlanChangeService;
