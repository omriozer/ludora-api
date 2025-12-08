import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import BulkSubscriptionPollingService from '../services/BulkSubscriptionPollingService.js';
import SubscriptionAllowanceService from '../services/SubscriptionAllowanceService.js';
import SubscriptionPlanChangeService from '../services/SubscriptionPlanChangeService.js';
import PayplusSubscriptionService from '../services/PayplusSubscriptionService.js';
import SubscriptionPaymentStatusService from '../services/SubscriptionPaymentStatusService.js';
import SubscriptionService from '../services/SubscriptionService.js';
import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/subscriptions/audit
 *
 * Comprehensive subscription audit - queries PayPlus bulk API to get all subscriptions
 * and cross-references with local database to find discrepancies.
 *
 * Features:
 * - Detects missing webhook notifications
 * - Finds subscriptions missing in local database
 * - Identifies status mismatches
 * - Generates actionable recommendations
 * - Saves results to temporary markdown file
 *
 * Admin-only endpoint for manual subscription verification.
 */
router.get('/subscriptions/audit', async (req, res) => {
  try {
    // Generate comprehensive audit report
    const auditReport = await BulkSubscriptionPollingService.generateSubscriptionAuditReport();

    if (!auditReport.success) {
      return res.status(500).json({
        error: 'Failed to generate subscription audit report',
        details: auditReport
      });
    }

    // Save report to temporary file
    const filePath = await BulkSubscriptionPollingService.saveReportToTempFile(auditReport);

    // Return audit summary with file location
    res.json({
      success: true,
      message: 'Subscription audit completed successfully',
      audit_summary: {
        total_discrepancies: auditReport.discrepancies.length,
        missing_activation_webhooks: auditReport.summary.missing_activation_webhooks,
        missing_in_database: auditReport.summary.missing_in_database,
        status_mismatches: auditReport.summary.status_mismatches,
        perfect_matches: auditReport.summary.perfect_matches,
        payplus_total: auditReport.payplus_query.total_subscriptions,
        local_total: auditReport.local_database.total_subscriptions
      },
      recommendations: auditReport.recommendations,
      report_file: filePath,
      audit_timestamp: auditReport.audit_timestamp,
      next_steps: auditReport.discrepancies.length > 0
        ? 'Review discrepancies in the generated report and take recommended actions'
        : 'All subscriptions are properly synchronized - no action required'
    });

  } catch (error) {
    console.error('❌ Admin subscription audit error:', error);
    res.status(500).json({
      error: 'Internal server error during subscription audit',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/subscriptions/payplus-raw
 *
 * Get raw PayPlus subscription data without analysis.
 * Useful for debugging PayPlus API responses.
 */
router.get('/subscriptions/payplus-raw', async (req, res) => {
  try {
    const payplusResult = await BulkSubscriptionPollingService.getAllPayPlusSubscriptions();

    if (!payplusResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch PayPlus subscriptions',
        details: payplusResult
      });
    }

    res.json({
      success: true,
      message: 'PayPlus subscriptions retrieved successfully',
      total_subscriptions: payplusResult.subscriptions?.length || 0,
      endpoint_used: payplusResult.endpoint,
      retrieved_at: payplusResult.retrieved_at,
      subscriptions: payplusResult.subscriptions
    });

  } catch (error) {
    console.error('❌ Admin PayPlus raw query error:', error);
    res.status(500).json({
      error: 'Internal server error during PayPlus query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/users/:userId/subscription
 *
 * Get complete subscription details for a user including:
 * - Current subscription and plan details
 * - Benefits usage tracking
 * - PayPlus subscription data
 * - Subscription history
 * - Next billing information
 */
router.get('/users/:userId/subscription', async (req, res) => {
  try {
    const { userId } = req.params;

    ludlog.payments('Admin fetching subscription details for user:', { userId, adminId: req.user.id });

    // Get active subscription with plan
    const subscription = await models.Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      },
      include: [{
        model: models.SubscriptionPlan,
        as: 'subscriptionPlan'
      }]
    });

    if (!subscription) {
      return res.json({
        success: true,
        hasSubscription: false,
        message: 'User has no active subscription'
      });
    }

    // Get monthly allowances and usage
    const allowances = await SubscriptionAllowanceService.calculateMonthlyAllowances(userId);

    // Get subscription history
    const history = await models.SubscriptionHistory.findAll({
      where: { subscription_id: subscription.id },
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Get PayPlus subscription details if available
    let payplusDetails = null;
    if (subscription.payplus_subscription_uid) {
      const payplusResult = await PayplusSubscriptionService.getSubscriptionDetails(
        subscription.payplus_subscription_uid
      );
      if (payplusResult.success) {
        payplusDetails = payplusResult.subscription;
      }
    }

    // Get available plan change options
    const planChangeOptions = await SubscriptionPlanChangeService.getAvailablePlanChanges({
      userId,
      subscriptionId: subscription.id
    });

    res.json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billing_price: subscription.billing_price,
        original_price: subscription.original_price,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        next_billing_date: subscription.next_billing_date,
        auto_renew: subscription.getAutoRenewStatus(),
        metadata: subscription.metadata,
        payplus_subscription_uid: subscription.payplus_subscription_uid
      },
      plan: subscription.subscriptionPlan,
      allowances: allowances?.allowances || {},
      monthYear: allowances?.monthYear,
      history: history.map(h => ({
        id: h.id,
        action_type: h.action_type,
        previous_plan_id: h.previous_plan_id,
        purchased_price: h.purchased_price,
        notes: h.notes,
        created_at: h.created_at
      })),
      payplusDetails,
      planChangeOptions: planChangeOptions.success ? {
        upgradePlans: planChangeOptions.upgradePlans,
        downgradePlans: planChangeOptions.downgradePlans,
        pendingChange: planChangeOptions.pendingChange
      } : null
    });

  } catch (error) {
    luderror.payments('Admin subscription details error:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription details',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/users/:userId/subscription/poll-payplus
 *
 * Poll PayPlus for current subscription status and payment history
 */
router.post('/users/:userId/subscription/poll-payplus', async (req, res) => {
  try {
    const { userId } = req.params;

    ludlog.payments('Admin polling PayPlus for user subscription:', { userId, adminId: req.user.id });

    // Get user's active subscription
    const subscription = await models.Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (!subscription || !subscription.payplus_subscription_uid) {
      return res.status(404).json({
        error: 'No active subscription with PayPlus UID found'
      });
    }

    // Poll PayPlus for subscription details
    const payplusResult = await PayplusSubscriptionService.getSubscriptionDetails(
      subscription.payplus_subscription_uid
    );

    if (!payplusResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch PayPlus subscription details',
        message: payplusResult.error
      });
    }

    // Check for pending subscription payments with timeout and staging awareness
    let statusCheckResult = null;
    try {
      // Add timeout for PayPlus staging behavior (5 second limit)
      const statusCheckPromise = SubscriptionPaymentStatusService.checkAndHandleSubscriptionPaymentPageStatus(
        subscription.id
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PayPlus status check timed out')), 5000);
      });

      statusCheckResult = await Promise.race([statusCheckPromise, timeoutPromise]);

    } catch (error) {
      ludlog.payments('PayPlus status check failed or timed out (likely staging environment):', {
        error: error.message,
        subscriptionId: subscription.id,
        environment: process.env.ENVIRONMENT
      });

      // In staging/development, this is expected behavior
      statusCheckResult = {
        success: false,
        error: 'PayPlus status check unavailable',
        message: process.env.ENVIRONMENT === 'production'
          ? 'PayPlus polling temporarily unavailable'
          : 'PayPlus staging environment does not process charges',
        stagingLimitation: process.env.ENVIRONMENT !== 'production'
      };
    }

    res.json({
      success: true,
      payplus: payplusResult.subscription,
      statusCheck: statusCheckResult,
      localSubscription: {
        id: subscription.id,
        status: subscription.status,
        billing_price: subscription.billing_price,
        next_billing_date: subscription.next_billing_date
      },
      syncStatus: {
        amountMatch: payplusResult.subscription.amount ?
          parseFloat(payplusResult.subscription.amount) === parseFloat(subscription.billing_price) :
          null,
        statusMatch: payplusResult.subscription.status === subscription.status
      }
    });

  } catch (error) {
    luderror.payments('Admin PayPlus polling error:', error);
    res.status(500).json({
      error: 'Failed to poll PayPlus',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/adjust-usage
 *
 * Manually adjust user benefits usage (add or deduct allowances)
 * For current billing period only
 */
router.post('/subscriptions/:subscriptionId/adjust-usage', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { productType, adjustment, reason } = req.body;

    if (!productType || typeof adjustment !== 'number' || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: productType, adjustment (number), reason'
      });
    }

    ludlog.payments('Admin adjusting subscription usage:', {
      subscriptionId,
      productType,
      adjustment,
      reason,
      adminId: req.user.id
    });

    // Get subscription
    const subscription = await models.Subscription.findByPk(subscriptionId, {
      include: [{
        model: models.SubscriptionPlan,
        as: 'subscriptionPlan'
      }]
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found'
      });
    }

    // Validate product type exists in plan benefits
    const benefits = SubscriptionAllowanceService.transformBenefits(
      subscription.subscriptionPlan.benefits
    );

    if (!benefits[productType]) {
      return res.status(400).json({
        error: `Product type '${productType}' not included in subscription plan`
      });
    }

    // Create audit record in subscription metadata
    const currentMonth = SubscriptionAllowanceService.getCurrentMonthYear();
    const metadata = subscription.metadata || {};

    if (!metadata.admin_adjustments) {
      metadata.admin_adjustments = [];
    }

    metadata.admin_adjustments.push({
      product_type: productType,
      adjustment,
      reason,
      month_year: currentMonth,
      adjusted_by: req.user.id,
      adjusted_at: new Date().toISOString()
    });

    // If adding claims (positive adjustment), create SubscriptionPurchase records
    // If removing (negative adjustment), mark existing claims
    if (adjustment > 0) {
      // Create placeholder subscription purchases to track admin-added allowances
      const transaction = await models.sequelize.transaction();

      try {
        for (let i = 0; i < adjustment; i++) {
          await models.SubscriptionPurchase.create({
            user_id: subscription.user_id,
            subscription_id: subscription.id,
            product_type: productType,
            product_id: `admin_adjustment_${Date.now()}_${i}`,
            month_year: currentMonth,
            usage: {
              claimed_at: new Date().toISOString(),
              claim_source: 'admin_adjustment',
              admin_reason: reason,
              admin_user_id: req.user.id,
              is_admin_added: true
            }
          }, { transaction });
        }

        await subscription.update({ metadata }, { transaction });
        await transaction.commit();

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } else if (adjustment < 0) {
      // Deduct allowances by marking in metadata
      // Don't delete SubscriptionPurchase records, just track the deduction
      await subscription.update({ metadata });
    }

    // Get updated allowances
    const allowances = await SubscriptionAllowanceService.calculateMonthlyAllowances(
      subscription.user_id
    );

    ludlog.payments('Usage adjustment completed:', {
      subscriptionId,
      productType,
      adjustment,
      newAllowances: allowances?.allowances[productType]
    });

    res.json({
      success: true,
      message: `Successfully adjusted ${productType} allowances by ${adjustment}`,
      adjustment: {
        productType,
        adjustment,
        reason,
        adminId: req.user.id,
        timestamp: new Date().toISOString()
      },
      updatedAllowances: allowances?.allowances[productType] || null
    });

  } catch (error) {
    luderror.payments('Admin usage adjustment error:', error);
    res.status(500).json({
      error: 'Failed to adjust usage',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/change-plan
 *
 * Change subscription plan with optional price override
 * Allows admins to change benefits without changing billing price
 */
router.post('/subscriptions/:subscriptionId/change-plan', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanId, overridePrice, reason } = req.body;

    if (!newPlanId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: newPlanId, reason'
      });
    }

    ludlog.payments('Admin changing subscription plan:', {
      subscriptionId,
      newPlanId,
      overridePrice,
      reason,
      adminId: req.user.id
    });

    const transaction = await models.sequelize.transaction();

    try {
      // Get subscription
      const subscription = await models.Subscription.findByPk(subscriptionId, {
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }],
        transaction
      });

      if (!subscription) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Subscription not found'
        });
      }

      // Get new plan
      const newPlan = await models.SubscriptionPlan.findByPk(newPlanId, { transaction });
      if (!newPlan) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'New plan not found'
        });
      }

      const previousPlanId = subscription.subscription_plan_id;
      const previousPrice = subscription.billing_price;

      // Update subscription with new plan
      const updateData = {
        subscription_plan_id: newPlanId,
        metadata: {
          ...subscription.metadata,
          admin_plan_changes: [
            ...(subscription.metadata?.admin_plan_changes || []),
            {
              from_plan_id: previousPlanId,
              to_plan_id: newPlanId,
              previous_price: previousPrice,
              new_price: overridePrice || newPlan.price,
              price_overridden: !!overridePrice,
              reason,
              changed_by: req.user.id,
              changed_at: new Date().toISOString()
            }
          ]
        },
        updated_at: new Date()
      };

      // Apply price override if provided
      if (overridePrice !== undefined) {
        updateData.billing_price = overridePrice;
        updateData.metadata.price_override = {
          original_plan_price: newPlan.price,
          override_price: overridePrice,
          reason,
          set_by: req.user.id,
          set_at: new Date().toISOString()
        };
      } else {
        updateData.billing_price = newPlan.price;
      }

      await subscription.update(updateData, { transaction });

      // Record history
      await models.SubscriptionHistory.create({
        user_id: subscription.user_id,
        subscription_plan_id: newPlanId,
        subscription_id: subscription.id,
        action_type: 'admin_plan_change',
        previous_plan_id: previousPlanId,
        purchased_price: updateData.billing_price,
        notes: `Admin plan change: ${reason}`,
        metadata: {
          admin_user_id: req.user.id,
          price_overridden: !!overridePrice,
          original_plan_price: newPlan.price,
          actual_billing_price: updateData.billing_price
        }
      }, { transaction });

      await transaction.commit();

      ludlog.payments('Admin plan change completed:', {
        subscriptionId,
        fromPlan: previousPlanId,
        toPlan: newPlanId,
        priceOverride: overridePrice
      });

      res.json({
        success: true,
        message: 'Subscription plan changed successfully',
        changes: {
          previousPlan: subscription.subscriptionPlan.name,
          newPlan: newPlan.name,
          previousPrice,
          newPrice: updateData.billing_price,
          priceOverridden: !!overridePrice
        }
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    luderror.payments('Admin plan change error:', error);
    res.status(500).json({
      error: 'Failed to change plan',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/add-one-time-charge
 *
 * Add one-time charge or discount to next billing cycle
 * Negative amounts = discount, positive = extra charge
 */
router.post('/subscriptions/:subscriptionId/add-one-time-charge', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { amount, description, reason } = req.body;

    if (amount === undefined || !description || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: amount (number), description, reason'
      });
    }

    ludlog.payments('Admin adding one-time charge to subscription:', {
      subscriptionId,
      amount,
      description,
      reason,
      adminId: req.user.id
    });

    // Get subscription
    const subscription = await models.Subscription.findByPk(subscriptionId);

    if (!subscription || !subscription.payplus_subscription_uid) {
      return res.status(404).json({
        error: 'Subscription not found or missing PayPlus UID'
      });
    }

    // Add one-time charge via PayPlus
    const chargeResult = await PayplusSubscriptionService.addOneTimeCharge({
      subscriptionUid: subscription.payplus_subscription_uid,
      amount: parseFloat(amount),
      description: `${description} (Admin: ${reason})`,
      metadata: {
        admin_user_id: req.user.id,
        admin_reason: reason,
        charge_type: amount < 0 ? 'admin_discount' : 'admin_charge'
      }
    });

    if (!chargeResult.success) {
      return res.status(500).json({
        error: 'Failed to add one-time charge',
        message: chargeResult.error
      });
    }

    // Record in subscription metadata
    const metadata = subscription.metadata || {};
    if (!metadata.admin_charges) {
      metadata.admin_charges = [];
    }

    metadata.admin_charges.push({
      amount,
      description,
      reason,
      transaction_uid: chargeResult.transactionUid,
      added_by: req.user.id,
      added_at: new Date().toISOString(),
      payplus_response: chargeResult
    });

    await subscription.update({ metadata });

    ludlog.payments('One-time charge added successfully:', {
      subscriptionId,
      amount,
      transactionUid: chargeResult.transactionUid
    });

    res.json({
      success: true,
      message: amount < 0 ?
        `Discount of ₪${Math.abs(amount)} applied successfully` :
        `Charge of ₪${amount} added successfully`,
      charge: {
        amount,
        description,
        transactionUid: chargeResult.transactionUid,
        status: chargeResult.chargeStatus
      }
    });

  } catch (error) {
    luderror.payments('Admin one-time charge error:', error);
    res.status(500).json({
      error: 'Failed to add one-time charge',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/subscription-plans
 *
 * Get all available subscription plans for admin selection
 */
router.get('/subscription-plans', async (req, res) => {
  try {
    ludlog.payments('Admin fetching subscription plans for creation:', { adminId: req.user.id });

    // Get all subscription plans
    const subscriptionPlans = await models.SubscriptionPlan.findAll({
      order: [['price', 'ASC']],
      attributes: ['id', 'name', 'description', 'price', 'billing_period', 'benefits']
    });

    res.json({
      success: true,
      plans: subscriptionPlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: parseFloat(plan.price),
        billing_period: plan.billing_period,
        benefits: plan.benefits,
        benefitsSummary: formatPlanBenefits(plan.benefits)
      }))
    });

  } catch (error) {
    luderror.payments('Admin subscription plans fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription plans',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/toggle-auto-renew
 *
 * Toggle auto renewal for a subscription
 * Updates PayPlus if it's a PayPlus subscription
 */
router.post('/subscriptions/:subscriptionId/toggle-auto-renew', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { autoRenew, reason } = req.body;

    if (typeof autoRenew !== 'boolean' || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: autoRenew (boolean), reason'
      });
    }

    ludlog.payments('Admin toggling auto renew for subscription:', {
      subscriptionId,
      autoRenew,
      reason,
      adminId: req.user.id
    });

    const transaction = await models.sequelize.transaction();

    try {
      // Get subscription
      const subscription = await models.Subscription.findByPk(subscriptionId, {
        transaction
      });

      if (!subscription) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Subscription not found'
        });
      }

      const previousAutoRenew = subscription.getAutoRenewStatus();

      // Update PayPlus if this is a PayPlus subscription
      if (subscription.payplus_subscription_uid) {
        try {
          const payplusResult = await PayplusSubscriptionService.updateAutoRenewal({
            subscriptionUid: subscription.payplus_subscription_uid,
            autoRenew: autoRenew
          });

          if (!payplusResult.success) {
            await transaction.rollback();
            return res.status(500).json({
              error: 'Failed to update PayPlus auto renewal',
              message: payplusResult.error
            });
          }
        } catch (error) {
          await transaction.rollback();
          luderror.payments('PayPlus auto renew update error:', error);
          return res.status(500).json({
            error: 'PayPlus update failed',
            message: error.message
          });
        }
      }

      // Update subscription metadata
      const metadata = subscription.metadata || {};
      if (!metadata.admin_auto_renew_changes) {
        metadata.admin_auto_renew_changes = [];
      }

      metadata.admin_auto_renew_changes.push({
        from: previousAutoRenew,
        to: autoRenew,
        reason,
        changed_by: req.user.id,
        changed_at: new Date().toISOString(),
        payplus_updated: !!subscription.payplus_subscription_uid
      });

      // Calculate billing date changes when toggling auto-renewal
      const updateData = {
        metadata,
        updated_at: new Date()
      };

      // Get subscription plan for billing period calculation
      const subscriptionPlan = await models.SubscriptionPlan.findByPk(subscription.subscription_plan_id, { transaction });

      if (autoRenew && !subscription.next_billing_date) {
        // Enabling auto-renewal: convert from end_date to next_billing_date
        const startDate = subscription.end_date || subscription.start_date || new Date();
        updateData.next_billing_date = SubscriptionService.calculateNextBillingDate(startDate, subscriptionPlan.billing_period || 'monthly');
        updateData.end_date = null; // Clear end_date for auto-renewable subscriptions

      } else if (!autoRenew && subscription.next_billing_date) {
        // Disabling auto-renewal: convert from next_billing_date to end_date
        updateData.end_date = subscription.next_billing_date;
        updateData.next_billing_date = null; // Clear next_billing_date for non-renewable subscriptions

      }

      // Update subscription
      await subscription.update(updateData, { transaction });

      // Record in history
      await models.SubscriptionHistory.recordAction({
        userId: subscription.user_id,
        subscriptionPlanId: subscription.subscription_plan_id,
        subscriptionId: subscription.id,
        actionType: 'renewed', // Use valid enum value for auto-renew changes
        notes: `Admin ${autoRenew ? 'enabled' : 'disabled'} auto renewal: ${reason}`,
        metadata: {
          admin_user_id: req.user.id,
          action_type: 'auto_renew_toggle',
          previous_auto_renew: previousAutoRenew,
          new_auto_renew: autoRenew,
          reason,
          payplus_updated: !!subscription.payplus_subscription_uid
        }
      });

      await transaction.commit();

      ludlog.payments('Auto renew toggle completed:', {
        subscriptionId,
        from: previousAutoRenew,
        to: autoRenew,
        payplusUpdated: !!subscription.payplus_subscription_uid
      });

      res.json({
        success: true,
        message: `Auto renewal ${autoRenew ? 'enabled' : 'disabled'} successfully`,
        autoRenew: autoRenew,
        previousAutoRenew: previousAutoRenew,
        payplusUpdated: !!subscription.payplus_subscription_uid
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    luderror.payments('Admin auto renew toggle error:', error);
    res.status(500).json({
      error: 'Failed to toggle auto renewal',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/reset
 *
 * Delete/reset a user's subscription entirely
 * Cancels PayPlus subscription if applicable
 */
router.post('/subscriptions/:subscriptionId/reset', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Missing required field: reason'
      });
    }

    ludlog.payments('Admin resetting subscription:', {
      subscriptionId,
      reason,
      adminId: req.user.id
    });

    const transaction = await models.sequelize.transaction();

    try {
      // Get subscription with related data
      const subscription = await models.Subscription.findByPk(subscriptionId, {
        include: [{
          model: models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }],
        transaction
      });

      if (!subscription) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Subscription not found'
        });
      }

      const subscriptionData = {
        id: subscription.id,
        user_id: subscription.user_id,
        plan_name: subscription.subscriptionPlan?.name,
        billing_price: subscription.billing_price,
        status: subscription.status,
        payplus_uid: subscription.payplus_subscription_uid
      };

      // Cancel PayPlus subscription if it exists
      if (subscription.payplus_subscription_uid) {
        try {
          const payplusResult = await PayplusSubscriptionService.cancelSubscription({
            subscriptionUid: subscription.payplus_subscription_uid,
            reason: `Admin reset: ${reason}`
          });

          if (!payplusResult.success) {
            ludlog.payments('PayPlus cancellation failed during reset, continuing with local deletion:', {
              subscriptionId,
              payplusError: payplusResult.error
            });
          }
        } catch (error) {
          ludlog.payments('PayPlus cancellation error during reset, continuing with local deletion:', {
            subscriptionId,
            error: error.message
          });
        }
      }

      // Record final history entry before deletion
      await models.SubscriptionHistory.recordAction({
        userId: subscription.user_id,
        subscriptionPlanId: subscription.subscription_plan_id,
        subscriptionId: subscription.id,
        actionType: 'cancelled',
        notes: `Admin reset subscription: ${reason}`,
        metadata: {
          admin_user_id: req.user.id,
          action_type: 'admin_reset',
          reason,
          reset_at: new Date().toISOString(),
          subscription_snapshot: subscriptionData,
          payplus_cancelled: !!subscription.payplus_subscription_uid
        }
      });

      // Delete the subscription
      await subscription.destroy({ transaction });

      await transaction.commit();

      ludlog.payments('Subscription reset completed:', {
        subscriptionId,
        userId: subscription.user_id,
        planName: subscriptionData.plan_name,
        payplusCancelled: !!subscription.payplus_subscription_uid
      });

      res.json({
        success: true,
        message: 'Subscription reset successfully',
        deletedSubscription: {
          id: subscriptionData.id,
          planName: subscriptionData.plan_name,
          billingPrice: subscriptionData.billing_price,
          status: subscriptionData.status
        },
        payplusCancelled: !!subscription.payplus_subscription_uid,
        resetBy: req.user.id,
        resetAt: new Date().toISOString()
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    luderror.payments('Admin subscription reset error:', error);
    res.status(500).json({
      error: 'Failed to reset subscription',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/users/:userId/subscription/create
 *
 * Create a new subscription for a user (free or paid)
 * Allows complete customization of subscription details
 */
router.post('/users/:userId/subscription/create', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      planId,
      subscriptionType, // 'free' or 'paid'
      customPrice,
      customStartDate,
      customEndDate,
      customBenefits,
      adminNotes,
      reason,
      enableAutoRenewal = null  // Whether to enable auto-renewal (null = auto-decide based on price)
    } = req.body;

    // Validation
    if (!planId || !subscriptionType || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: planId, subscriptionType (free/paid), reason'
      });
    }

    if (!['free', 'paid'].includes(subscriptionType)) {
      return res.status(400).json({
        error: 'subscriptionType must be "free" or "paid"'
      });
    }


    ludlog.payments('Admin creating subscription for user:', {
      userId,
      planId,
      subscriptionType,
      customPrice,
      enableAutoRenewal,
      reason,
      adminId: req.user.id
    });

    // Check if user already has an active subscription
    const existingSubscription = await models.Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: 'User already has an active subscription',
        existingSubscriptionId: existingSubscription.id
      });
    }

    // Get the subscription plan
    const subscriptionPlan = await models.SubscriptionPlan.findByPk(planId);
    if (!subscriptionPlan) {
      return res.status(404).json({
        error: 'Subscription plan not found'
      });
    }

    // Get the user
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const transaction = await models.sequelize.transaction();

    try {
      // Prepare billing price based on subscription type
      let billingPrice = null;
      if (subscriptionType === 'free') {
        billingPrice = 0; // Free subscription
      } else if (customPrice !== undefined) {
        billingPrice = customPrice; // Paid with custom price
      }
      // If subscriptionType === 'paid' and no customPrice, billingPrice stays null (use plan price)

      // Prepare admin metadata - this follows the same pattern as regular subscription creation
      const adminMetadata = {
        source: 'admin_created_subscription',
        environment: process.env.NODE_ENV || 'development',
        admin_created: true,
        created_by_admin: req.user.id,
        admin_creation_reason: reason,
        subscription_type: subscriptionType,
        admin_notes: adminNotes,
        created_at: new Date().toISOString(),
        custom_overrides: {
          price_override: billingPrice !== null,
          original_plan_price: subscriptionPlan.price,
          actual_billing_price: billingPrice || subscriptionPlan.price,
          custom_start_date: !!customStartDate,
          custom_end_date: !!customEndDate,
          custom_benefits: !!customBenefits,
          enable_auto_renewal: enableAutoRenewal
        }
      };

      if (customBenefits) {
        adminMetadata.custom_benefits = customBenefits;
      }

      // Debug logging before calling SubscriptionService
      const subscriptionOptions = {
        userId: userId,
        subscriptionPlanId: planId,
        skipValidation: true, // Admin override
        billing_price: billingPrice, // Use admin override for billing price
        start_date: customStartDate || null, // Use admin override for start date
        end_date: customEndDate || null, // Use admin override for end date
        enableAutoRenewal: enableAutoRenewal, // Whether subscription should auto-renew (for free subscriptions)
        metadata: adminMetadata
      };


      // Create subscription using SubscriptionService - same pattern as regular subscription creation
      const subscription = await SubscriptionService.createSubscription(subscriptionOptions);

      // Record in subscription history using the proper static method
      await models.SubscriptionHistory.recordAction({
        userId: userId,
        subscriptionPlanId: planId,
        subscriptionId: subscription.id,
        actionType: 'started', // Use valid enum value
        purchasedPrice: subscription.billing_price,
        notes: `Admin created ${subscriptionType} subscription: ${reason}`,
        metadata: {
          admin_user_id: req.user.id,
          creation_type: subscriptionType,
          admin_reason: reason,
          admin_notes: adminNotes,
          original_plan_price: subscriptionPlan.price,
          overrides_applied: adminMetadata.custom_overrides,
          admin_created: true
        }
      });

      await transaction.commit();

      // Get updated allowances
      const allowances = await SubscriptionAllowanceService.calculateMonthlyAllowances(userId);

      ludlog.payments('Admin subscription creation completed:', {
        subscriptionId: subscription.id,
        userId,
        planId,
        subscriptionType,
        billingPrice: subscription.billing_price
      });

      res.json({
        success: true,
        message: `${subscriptionType === 'free' ? 'Free' : 'Paid'} subscription created successfully`,
        subscription: {
          id: subscription.id,
          planName: subscriptionPlan.name,
          subscriptionType,
          billingPrice: subscription.billing_price,
          originalPrice: subscriptionPlan.price,
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.end_date
        },
        allowances: allowances?.allowances || {},
        creation: {
          adminId: req.user.id,
          reason,
          notes: adminNotes,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    luderror.payments('Admin subscription creation error:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error.message
    });
  }
});

// Helper function to format plan benefits for display
function formatPlanBenefits(benefits) {
  if (!benefits || typeof benefits !== 'object') return 'No benefits';

  const benefitParts = [];

  if (benefits.video_access) benefitParts.push('Video access');
  if (benefits.workshop_videos) benefitParts.push('Workshop videos');
  if (benefits.course_videos) benefitParts.push('Course videos');
  if (benefits.workshop_access) benefitParts.push('Workshop access');
  if (benefits.course_access) benefitParts.push('Course access');
  if (benefits.all_content) benefitParts.push('All content access');

  // Add allowances
  Object.keys(benefits).forEach(key => {
    if (key.includes('_allowance') && benefits[key] !== undefined) {
      const productType = key.replace('_allowance', '');
      const allowance = benefits[key];
      if (allowance === 'unlimited') {
        benefitParts.push(`Unlimited ${productType}`);
      } else if (typeof allowance === 'number') {
        benefitParts.push(`${allowance} ${productType}/month`);
      }
    }
  });

  return benefitParts.length > 0 ? benefitParts.join(', ') : 'Custom benefits';
}

export default router;