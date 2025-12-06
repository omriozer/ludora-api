import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * SubscriptionProrationService - Handles subscription plan change proration calculations
 * Calculates prorated amounts when users upgrade or downgrade subscription plans
 */
class SubscriptionProrationService {
  /**
   * Calculate proration for subscription plan upgrade
   * @param {Object} currentSubscription - Current active subscription
   * @param {Object} newPlan - Target subscription plan
   * @returns {Promise<Object>} Proration calculation result
   */
  static async calculateUpgradeProration(currentSubscription, newPlan) {
    try {
      // Validate inputs
      if (!currentSubscription || !newPlan) {
        throw new Error('Missing required parameters: currentSubscription and newPlan');
      }

      if (currentSubscription.status !== 'active') {
        throw new Error(`Cannot calculate proration for non-active subscription (status: ${currentSubscription.status})`);
      }

      if (!currentSubscription.next_billing_date) {
        throw new Error('Cannot calculate proration without next_billing_date');
      }

      // Get current plan details
      const currentPlan = await models.SubscriptionPlan.findByPk(currentSubscription.subscription_plan_id);
      if (!currentPlan) {
        throw new Error(`Current subscription plan ${currentSubscription.subscription_plan_id} not found`);
      }

      // Validate billing periods match
      if (currentPlan.billing_period !== newPlan.billing_period) {
        throw new Error(`Billing period mismatch: current (${currentPlan.billing_period}) vs new (${newPlan.billing_period})`);
      }

      // Calculate time remaining in current billing cycle
      const now = new Date();
      const nextBilling = new Date(currentSubscription.next_billing_date);
      const cycleStart = new Date(currentSubscription.start_date);

      // Calculate billing cycle in milliseconds
      const totalCycleMs = nextBilling.getTime() - cycleStart.getTime();
      const remainingMs = nextBilling.getTime() - now.getTime();

      if (remainingMs <= 0) {
        throw new Error('Subscription billing cycle has already ended');
      }

      // Calculate remaining ratio (0 to 1)
      const remainingRatio = remainingMs / totalCycleMs;

      // Calculate days remaining for display
      const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil(totalCycleMs / (1000 * 60 * 60 * 24));

      // Calculate price difference
      const currentPrice = parseFloat(currentSubscription.billing_price);
      const newPrice = parseFloat(newPlan.price);
      const priceDifference = newPrice - currentPrice;

      // Must be an upgrade (higher price)
      if (priceDifference <= 0) {
        throw new Error('New plan price must be higher than current plan price for upgrade');
      }

      // Calculate prorated amount to charge immediately
      const proratedAmount = priceDifference * remainingRatio;

      // Round to 2 decimal places
      const proratedAmountRounded = Math.round(proratedAmount * 100) / 100;

      ludlog.payments('✅ Calculated upgrade proration:', {
        currentPlanId: currentPlan.id,
        newPlanId: newPlan.id,
        currentPrice,
        newPrice,
        priceDifference,
        remainingRatio: remainingRatio.toFixed(4),
        daysRemaining,
        totalDays,
        proratedAmount: proratedAmountRounded
      });

      return {
        success: true,
        calculation: {
          currentPlanId: currentPlan.id,
          currentPlanName: currentPlan.name,
          currentPrice,
          newPlanId: newPlan.id,
          newPlanName: newPlan.name,
          newPrice,
          priceDifference,
          remainingDays: daysRemaining,
          totalDays,
          remainingRatio,
          proratedAmount: proratedAmountRounded,
          nextBillingDate: currentSubscription.next_billing_date,
          calculatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      luderror.payments('SubscriptionProrationService: Error calculating upgrade proration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate proration for subscription plan downgrade
   * Note: Downgrades take effect at end of billing cycle (no proration charge)
   * @param {Object} currentSubscription - Current active subscription
   * @param {Object} newPlan - Target subscription plan
   * @returns {Promise<Object>} Downgrade scheduling information
   */
  static async calculateDowngradeScheduling(currentSubscription, newPlan) {
    try {
      // Validate inputs
      if (!currentSubscription || !newPlan) {
        throw new Error('Missing required parameters: currentSubscription and newPlan');
      }

      if (currentSubscription.status !== 'active') {
        throw new Error(`Cannot schedule downgrade for non-active subscription (status: ${currentSubscription.status})`);
      }

      if (!currentSubscription.next_billing_date) {
        throw new Error('Cannot schedule downgrade without next_billing_date');
      }

      // Get current plan details
      const currentPlan = await models.SubscriptionPlan.findByPk(currentSubscription.subscription_plan_id);
      if (!currentPlan) {
        throw new Error(`Current subscription plan ${currentSubscription.subscription_plan_id} not found`);
      }

      // Validate billing periods match
      if (currentPlan.billing_period !== newPlan.billing_period) {
        throw new Error(`Billing period mismatch: current (${currentPlan.billing_period}) vs new (${newPlan.billing_period})`);
      }

      // Calculate time remaining in current billing cycle
      const now = new Date();
      const effectiveDate = new Date(currentSubscription.next_billing_date);
      const remainingMs = effectiveDate.getTime() - now.getTime();

      if (remainingMs <= 0) {
        throw new Error('Subscription billing cycle has already ended');
      }

      // Calculate days remaining
      const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      // Calculate price change
      const currentPrice = parseFloat(currentSubscription.billing_price);
      const newPrice = parseFloat(newPlan.price);
      const priceDifference = currentPrice - newPrice;

      // Must be a downgrade (lower price)
      if (priceDifference <= 0) {
        throw new Error('New plan price must be lower than current plan price for downgrade');
      }

      ludlog.payments('✅ Calculated downgrade scheduling:', {
        currentPlanId: currentPlan.id,
        newPlanId: newPlan.id,
        currentPrice,
        newPrice,
        priceSavings: priceDifference,
        daysRemaining,
        effectiveDate: effectiveDate.toISOString()
      });

      return {
        success: true,
        scheduling: {
          currentPlanId: currentPlan.id,
          currentPlanName: currentPlan.name,
          currentPrice,
          newPlanId: newPlan.id,
          newPlanName: newPlan.name,
          newPrice,
          priceSavings: priceDifference,
          daysRemaining,
          effectiveDate: effectiveDate.toISOString(),
          keepCurrentPlanUntil: effectiveDate.toISOString(),
          scheduledAt: new Date().toISOString()
        }
      };

    } catch (error) {
      luderror.payments('SubscriptionProrationService: Error calculating downgrade scheduling:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate subscription plan change eligibility
   * @param {Object} currentSubscription - Current active subscription
   * @param {Object} newPlan - Target subscription plan
   * @returns {Promise<Object>} Validation result
   */
  static async validatePlanChange(currentSubscription, newPlan) {
    try {
      const validationErrors = [];

      // Check subscription status
      if (currentSubscription.status !== 'active') {
        validationErrors.push(`Subscription must be active (current status: ${currentSubscription.status})`);
      }

      // Check if trying to change to same plan
      if (currentSubscription.subscription_plan_id === newPlan.id) {
        validationErrors.push('Cannot change to the same subscription plan');
      }

      // Check if new plan is active
      if (!newPlan.is_active) {
        validationErrors.push('Target subscription plan is not active');
      }

      // Check if new plan exists
      const currentPlan = await models.SubscriptionPlan.findByPk(currentSubscription.subscription_plan_id);
      if (!currentPlan) {
        validationErrors.push('Current subscription plan not found');
      }

      // Check billing periods match
      if (currentPlan && currentPlan.billing_period !== newPlan.billing_period) {
        validationErrors.push(`Billing period mismatch: current (${currentPlan.billing_period}) vs new (${newPlan.billing_period})`);
      }

      // Check if there's already a pending plan change
      if (currentSubscription.metadata?.pending_plan_change) {
        validationErrors.push('Subscription already has a pending plan change');
      }

      // Check if subscription has next billing date
      if (!currentSubscription.next_billing_date) {
        validationErrors.push('Subscription missing next_billing_date');
      }

      // Check if next billing date is in the future
      if (currentSubscription.next_billing_date) {
        const nextBilling = new Date(currentSubscription.next_billing_date);
        if (nextBilling <= new Date()) {
          validationErrors.push('Subscription billing cycle has already ended');
        }
      }

      // Check if subscription has PayPlus UID (required for updates)
      if (!currentSubscription.payplus_subscription_uid) {
        validationErrors.push('Subscription missing PayPlus subscription UID');
      }

      // Determine change type
      let changeType = null;
      if (currentPlan && newPlan) {
        const currentPrice = parseFloat(currentSubscription.billing_price);
        const newPrice = parseFloat(newPlan.price);

        if (newPrice > currentPrice) {
          changeType = 'upgrade';
        } else if (newPrice < currentPrice) {
          changeType = 'downgrade';
        } else {
          validationErrors.push('New plan price must be different from current plan price');
        }
      }

      if (validationErrors.length > 0) {
        return {
          valid: false,
          errors: validationErrors,
          changeType
        };
      }

      return {
        valid: true,
        changeType,
        message: `Subscription is eligible for ${changeType}`
      };

    } catch (error) {
      luderror.payments('SubscriptionProrationService: Error validating plan change:', error);
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Calculate next billing date based on billing period
   * @param {Date} fromDate - Starting date
   * @param {string} billingPeriod - Billing period ('daily', 'monthly', 'yearly')
   * @returns {Date} Next billing date
   */
  static calculateNextBillingDate(fromDate, billingPeriod) {
    const nextBilling = new Date(fromDate);

    switch (billingPeriod) {
      case 'daily':
        nextBilling.setDate(nextBilling.getDate() + 1);
        break;
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
   * Get proration summary for display to user
   * @param {Object} prorationResult - Result from calculateUpgradeProration
   * @returns {Object} User-friendly summary
   */
  static getProrationSummary(prorationResult) {
    if (!prorationResult.success) {
      return {
        error: prorationResult.error
      };
    }

    const calc = prorationResult.calculation;

    return {
      currentPlan: calc.currentPlanName,
      newPlan: calc.newPlanName,
      chargeNow: calc.proratedAmount,
      remainingDays: calc.remainingDays,
      totalDays: calc.totalDays,
      nextFullCharge: calc.newPrice,
      nextBillingDate: new Date(calc.nextBillingDate).toLocaleDateString('he-IL'),
      explanation: `תחויב ₪${calc.proratedAmount} עכשיו עבור ${calc.remainingDays} הימים הנותרים במחזור התשלום הנוכחי. התשלום הבא יהיה ₪${calc.newPrice} ב-${new Date(calc.nextBillingDate).toLocaleDateString('he-IL')}.`
    };
  }
}

export default SubscriptionProrationService;
