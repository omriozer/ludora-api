import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/validation.js';
import SubscriptionService from '../services/SubscriptionService.js';
import SubscriptionPaymentService from '../services/SubscriptionPaymentService.js';
import SubscriptionPaymentStatusService from '../services/SubscriptionPaymentStatusService.js';
import SubscriptionAllowanceService from '../services/SubscriptionAllowanceService.js';
import SubscriptionPlanChangeService from '../services/SubscriptionPlanChangeService.js';
import models from '../models/index.js';
import { luderror, ludlog } from '../lib/ludlog.js';

const router = express.Router();

/**
 * Get user's subscription data (current subscription, plans, history)
 * GET /api/subscriptions/user?limit=10&offset=0
 *
 * Features ETag support for data-driven caching and pagination following Ludora patterns
 */
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query; // Default to 10, not 50

    // Validate pagination parameters
    const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 records
    const offsetNum = Math.max(parseInt(offset) || 0, 0); // Min 0

    // Calculate ETag from data versions including pagination params (data-driven caching)
    const [maxUserSubscriptionUpdate, maxSubscriptionPlanUpdate] = await Promise.all([
      models.Subscription.max('updated_at', { where: { user_id: userId } }),
      models.SubscriptionPlan.max('updated_at', { where: { is_active: true } })
    ]);

    // Include pagination in ETag to ensure different pages get different cache entries
    const etagValue = `W/"${userId}-${maxUserSubscriptionUpdate || 'none'}-${maxSubscriptionPlanUpdate || 'none'}-${limitNum}-${offsetNum}"`;
    const clientETag = req.headers['if-none-match'];

    // Return 304 Not Modified if client ETag matches (data unchanged for this pagination)
    if (clientETag === etagValue) {
      ludlog.payment('✅ ETag match - returning 304 Not Modified for user subscriptions');
      return res.status(304).end();
    }

    // Set ETag and cache headers for new/updated data
    res.setHeader('ETag', etagValue);
    res.setHeader('Cache-Control', 'private, no-cache');

    ludlog.payment('🔄 Loading fresh subscription data for user with pagination', {
      data: { limit: limitNum, offset: offsetNum }
    });

    // Get user's subscription history with pagination
    const subscriptions = await SubscriptionService.getUserSubscriptionHistory(userId, {
      limit: limitNum,
      offset: offsetNum
    });

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    // Get available subscription plans
    const plans = await models.SubscriptionPlan.findAll({
      where: {
        is_active: true
      },
      order: [['price', 'ASC']]
    });

    // Get total count for pagination metadata
    const totalSubscriptions = await models.Subscription.count({
      where: { user_id: userId }
    });

    res.json({
      success: true,
      data: {
        subscriptions,
        activeSubscription,
        plans,
        summary: {
          hasActiveSubscription: !!activeSubscription,
          currentPlan: activeSubscription?.subscriptionPlan || null,
          totalSubscriptions: subscriptions.length // Length of current page
        },
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: totalSubscriptions,
          hasMore: (offsetNum + limitNum) < totalSubscriptions,
          currentPage: Math.floor(offsetNum / limitNum) + 1,
          totalPages: Math.ceil(totalSubscriptions / limitNum)
        }
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting user subscription data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user's active subscription
 * GET /api/subscriptions/current
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      data: activeSubscription
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting current subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get lightweight subscription status for current user (optimized for frequent checks)
 * GET /api/subscriptions/current-status
 *
 * Features ETag support for data-driven caching following Ludora patterns
 * Ultra-fast endpoint with minimal data transfer for navigation components
 */
router.get('/current-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Calculate ETag from user's subscription data version only (lightweight)
    const maxUserSubscriptionUpdate = await models.Subscription.max('updated_at', {
      where: { user_id: userId }
    });

    // Generate ETag with weak validation for computed/processed data
    const etagValue = `W/"${userId}-${maxUserSubscriptionUpdate || 'none'}"`;
    const clientETag = req.headers['if-none-match'];

    // Return 304 Not Modified if client ETag matches (data unchanged)
    if (clientETag === etagValue) {
      ludlog.payment('✅ ETag match - returning 304 Not Modified for subscription status');
      return res.status(304).end();
    }

    // Set ETag and cache headers for new/updated data
    res.setHeader('ETag', etagValue);
    res.setHeader('Cache-Control', 'private, no-cache');

    // Single lightweight query - no joins needed
    const activeSubscription = await models.Subscription.findOne({
      where: {
        user_id: userId,
        status: ['active', 'pending']
      },
      attributes: ['id', 'status', 'subscription_plan_id', 'next_billing_date', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    ludlog.payment('🔄 Returning lightweight subscription status for user');

    res.json({
      success: true,
      data: {
        hasActiveSubscription: !!activeSubscription && activeSubscription.status === 'active',
        hasPendingSubscription: !!activeSubscription && activeSubscription.status === 'pending',
        status: activeSubscription?.status || null,
        subscriptionId: activeSubscription?.id || null,
        planId: activeSubscription?.subscription_plan_id || null,
        nextBilling: activeSubscription?.next_billing_date || null
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all available subscription plans
 * GET /api/subscriptions/plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await models.SubscriptionPlan.findAll({
      where: {
        is_active: true
      },
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting subscription plans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a subscription payment
 * POST /api/subscriptions/create-payment
 */
router.post('/create-payment', authenticateToken, async (req, res) => {
  try {
    const { subscriptionPlanId, environment = 'production', isRetry = false } = req.body;
    const userId = req.user.id;

    // Validation
    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    // Check if this is a retry payment
    if (isRetry) {
      const retryValidation = await SubscriptionService.validateRetryPayment(userId, subscriptionPlanId);

      if (!retryValidation.valid) {
        if (retryValidation.canCreateNew) {
          // No pending subscription found, create a new one
        } else {
          return res.status(400).json({ error: retryValidation.error });
        }
      } else {
        // Create retry payment for existing pending subscription
        const result = await SubscriptionPaymentService.createRetryPayment({
          userId,
          pendingSubscription: retryValidation.pendingSubscription,
          subscriptionPlan: retryValidation.subscriptionPlan,
          environment,
          metadata: {
            source: 'subscription_retry_api',
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }
        });

        return res.json(result);
      }
    }

    // Create new subscription payment (regular flow)
    const result = await SubscriptionPaymentService.createSubscriptionPayment({
      userId,
      subscriptionPlanId,
      environment,
      metadata: {
        source: 'subscription_api',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json(result);

  } catch (error) {
    luderror.payment('Subscriptions: Error creating subscription payment:', error);

    // Handle specific validation errors
    if (error.message.includes('already has an active subscription') ||
        error.message.includes('already has a pending subscription')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel current subscription
 * POST /api/subscriptions/cancel
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason = 'user_cancelled', immediate = false } = req.body;

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({ error: 'No active subscription found to cancel' });
    }

    if (!activeSubscription.canBeCancelled()) {
      return res.status(400).json({ error: 'Subscription cannot be cancelled in its current state' });
    }

    // Cancel the subscription
    const cancelledSubscription = await SubscriptionService.cancelSubscription(activeSubscription.id, {
      reason,
      keepActiveUntilEndDate: !immediate,
      metadata: {
        cancelledVia: 'subscription_api',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      success: true,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription scheduled for cancellation',
      data: cancelledSubscription
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error cancelling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get subscription by ID (for authenticated user only)
 * GET /api/subscriptions/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const subscription = await SubscriptionService.getSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Ensure user can only access their own subscriptions
    if (subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied to this subscription' });
    }

    res.json({
      success: true,
      data: subscription
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Validate subscription creation (check if user can create subscription for a plan)
 * POST /api/subscriptions/validate
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { subscriptionPlanId } = req.body;
    const userId = req.user.id;

    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    const validation = await SubscriptionService.validateSubscriptionCreation(userId, subscriptionPlanId);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error validating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get subscription plans with user-specific information
 * GET /api/subscriptions/plans-with-context
 */
router.get('/plans-with-context', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get available plans
    const plans = await models.SubscriptionPlan.findAll({
      where: {
        is_active: true
      },
      order: [['price', 'ASC']]
    });

    // Get user's current subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    // Add context to each plan
    const plansWithContext = await Promise.all(plans.map(async (plan) => {
      const planData = plan.toJSON();

      // Validate if user can subscribe to this plan
      try {
        const validation = await SubscriptionService.validateSubscriptionCreation(userId, plan.id);
        planData.canSubscribe = validation.valid;
        planData.subscriptionStatus = validation;
      } catch (error) {
        planData.canSubscribe = false;
        planData.subscriptionStatus = { valid: false, error: error.message };
      }

      // Check if this is the user's current plan
      planData.isCurrentPlan = activeSubscription?.subscription_plan_id === plan.id;

      return planData;
    }));

    res.json({
      success: true,
      data: {
        plans: plansWithContext,
        currentSubscription: activeSubscription
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting plans with context:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Change subscription plan (for direct changes like downgrades or free plans)
 * POST /api/subscriptions/change-plan
 */
router.post('/change-plan', authenticateToken, async (req, res) => {
  try {
    const { subscriptionPlanId, actionType, fromPlanId } = req.body;
    const userId = req.user.id;

    // Validation
    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }

    // Change the plan using the service
    const result = await SubscriptionService.changePlan({
      userId,
      subscriptionPlanId,
      actionType,
      fromPlanId,
      metadata: {
        source: 'change_plan_api',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        requestedAt: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: result.message,
      data: {
        subscription: result.subscription,
        actionType: result.actionType
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error changing subscription plan:', error);

    // Handle specific validation errors
    if (error.message.includes('not found') ||
        error.message.includes('inactive')) {
      return res.status(404).json({ error: error.message });
    }

    if (error.message.includes('must go through payment flow')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel pending subscription
 * POST /api/subscriptions/cancel-pending/:id
 */
router.post('/cancel-pending/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First, get the subscription to verify ownership
    const subscription = await SubscriptionService.getSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Ensure user can only cancel their own subscriptions
    if (subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied to this subscription' });
    }

    // Ensure subscription is in pending status
    if (subscription.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending subscriptions can be cancelled' });
    }

    // Cancel the subscription
    const cancelledSubscription = await SubscriptionService.cancelSubscription(subscription.id, {
      reason: 'user_cancelled_pending',
      immediate: true,
      metadata: {
        cancelledVia: 'cancel_pending_api',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json({
      success: true,
      message: 'Pending subscription cancelled successfully',
      data: cancelledSubscription
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error cancelling pending subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check subscription payment page status for pending subscriptions (equivalent to purchase system)
 * POST /api/subscriptions/check-payment-status
 */
router.post('/check-payment-status', rateLimiters.paymentStatusCheck, authenticateToken, async (req, res) => {
  const userId = req.user.id;

  // In-memory request tracking to prevent duplicate concurrent requests
  const activeSubscriptionRequests = new Map();

  try {
    // PROTECTION 1: Prevent concurrent requests from same user
    if (activeSubscriptionRequests.has(userId)) {
      return res.status(429).json({
        error: 'Subscription payment status check already in progress',
        message: 'Please wait for the current check to complete',
        retryAfter: 5
      });
    }

    // Mark request as active
    activeSubscriptionRequests.set(userId, Date.now());

    // PROTECTION 2: Set a maximum timeout to prevent hanging
    const requestTimeout = setTimeout(() => {
      activeSubscriptionRequests.delete(userId);
    }, 30000); // 30 second timeout

    ludlog.payment('🔍 Checking subscription payment page status for user', { userId });

    // Use SubscriptionPaymentStatusService to check all pending subscriptions
    const checkResult = await SubscriptionPaymentStatusService.checkUserPendingSubscriptions(userId);

    // Count actions taken for summary
    const summary = {
      total_pending: checkResult.summary.total_pending,
      activated: checkResult.summary.activated,
      cancelled: checkResult.summary.cancelled,
      errors: checkResult.summary.errors,
      skipped: checkResult.summary.skipped
    };

    ludlog.payment('📊 Subscription payment status check complete', summary);

    // CLEANUP: Clear request tracking and timeout on success
    clearTimeout(requestTimeout);
    activeSubscriptionRequests.delete(userId);

    res.json({
      success: true,
      message: 'Subscription payment page status checked for pending subscriptions',
      summary,
      results: checkResult.results
    });

  } catch (error) {
    // CLEANUP: Clear request tracking and timeout on error
    clearTimeout(requestTimeout);
    activeSubscriptionRequests.delete(userId);

    luderror.payment('Error checking subscription payment page status:', error);

    // Return safe error message (don't expose internal details)
    res.status(500).json({
      error: 'Subscription status check temporarily unavailable',
      message: 'Please try again in a few moments',
      retryAfter: 60
    });
  }
});

// ===== SUBSCRIPTION PLAN CHANGE ENDPOINTS =====

/**
 * Get available plan change options for user's subscription
 * GET /api/subscriptions/plan-changes/available
 */
router.get('/plan-changes/available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({
        error: 'No active subscription found',
        message: 'You must have an active subscription to change plans'
      });
    }

    // Get available plan changes
    const result = await SubscriptionPlanChangeService.getAvailablePlanChanges({
      userId,
      subscriptionId: activeSubscription.id
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error getting available plan changes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upgrade subscription plan with immediate proration
 * POST /api/subscriptions/plan-changes/upgrade
 */
router.post('/plan-changes/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPlanId, paymentMethodId } = req.body;

    // Validation
    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId is required' });
    }

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({
        error: 'No active subscription found',
        message: 'You must have an active subscription to upgrade'
      });
    }

    // Perform upgrade
    const result = await SubscriptionPlanChangeService.upgradeSubscription({
      userId,
      subscriptionId: activeSubscription.id,
      newPlanId,
      paymentMethodId
    });

    if (!result.success) {
      // Check if error is payment-related
      if (result.error.includes('payment method')) {
        return res.status(400).json({
          error: result.error,
          needsPaymentMethod: true
        });
      }

      if (result.error.includes('charge failed')) {
        return res.status(402).json({
          error: result.error,
          paymentFailed: true
        });
      }

      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error upgrading subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Schedule subscription downgrade for next billing cycle
 * POST /api/subscriptions/plan-changes/downgrade
 */
router.post('/plan-changes/downgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPlanId } = req.body;

    // Validation
    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId is required' });
    }

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({
        error: 'No active subscription found',
        message: 'You must have an active subscription to downgrade'
      });
    }

    // Check if there's already a pending downgrade
    if (activeSubscription.metadata?.pending_plan_change) {
      return res.status(409).json({
        error: 'You already have a pending plan change',
        pendingChange: activeSubscription.metadata.pending_plan_change,
        message: 'Cancel your pending change before scheduling a new one'
      });
    }

    // Perform downgrade scheduling
    const result = await SubscriptionPlanChangeService.downgradeSubscription({
      userId,
      subscriptionId: activeSubscription.id,
      newPlanId
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error downgrading subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a pending subscription downgrade
 * POST /api/subscriptions/plan-changes/cancel-pending-downgrade
 */
router.post('/plan-changes/cancel-pending-downgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's active subscription
    const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({
        error: 'No active subscription found'
      });
    }

    // Check if there's a pending downgrade
    if (!activeSubscription.metadata?.pending_plan_change) {
      return res.status(404).json({
        error: 'No pending plan change found to cancel'
      });
    }

    if (activeSubscription.metadata.pending_plan_change.type !== 'downgrade') {
      return res.status(400).json({
        error: 'Can only cancel pending downgrades'
      });
    }

    // Cancel pending downgrade
    const result = await SubscriptionPlanChangeService.cancelPendingDowngrade({
      userId,
      subscriptionId: activeSubscription.id
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    luderror.payment('Subscriptions: Error canceling pending downgrade:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SUBSCRIPTION BENEFITS ENDPOINTS =====

/**
 * Claim a product using subscription allowance (Teachers only)
 * POST /api/subscriptions/benefits/claim
 *
 * CRITICAL: Returns updated user context for real-time frontend state synchronization
 */
router.post('/benefits/claim', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productType, productId, skipConfirmation = false } = req.body;
    // Validation
    if (!productType) {
      return res.status(400).json({ error: 'productType is required' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    // Only teachers can claim products with subscriptions
    if (req.user.user_type !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can claim products with subscription benefits' });
    }

    // Attempt to claim the product
    const claimResult = await SubscriptionAllowanceService.claimProduct(
      userId,
      productType,
      productId,
      {
        skipConfirmation,
        metadata: {
          source: 'subscription_benefits_api',
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      }
    );

    if (!claimResult.success) {
      // Handle different error scenarios
      if (claimResult.needsConfirmation) {
        return res.status(200).json({
          success: false,
          needsConfirmation: true,
          remainingClaims: claimResult.remainingClaims,
          message: claimResult.message,
          productType,
          productId
        });
      }

      // Other failures
      const statusCode = claimResult.step === 'allowance_check' ? 403 :
                        claimResult.step === 'product_validation' ? 404 : 400;

      return res.status(statusCode).json({
        error: claimResult.reason,
        step: claimResult.step,
        details: {
          used: claimResult.used,
          allowed: claimResult.allowed
        }
      });
    }

    // Get updated user context for real-time state sync
    const AccessControlIntegrator = (await import('../services/AccessControlIntegrator.js')).default;
    const updatedContext = await AccessControlIntegrator.getUserAccessContext(userId);

    // Success response with updated context for frontend state sync
    res.json({
      success: true,
      message: claimResult.message,
      data: {
        claim: claimResult.claim,
        alreadyClaimed: claimResult.alreadyClaimed || false,
        remainingClaims: claimResult.remainingClaims
      },
      // CRITICAL: Updated user context for real-time state synchronization
      updatedContext: {
        subscriptionAllowances: updatedContext.subscriptionAllowances,
        activeSubscriptions: updatedContext.activeSubscriptions
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions Benefits: Error claiming product:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's monthly subscription allowances (Teachers only)
 * GET /api/subscriptions/benefits/my-allowances
 */
router.get('/benefits/my-allowances', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthYear } = req.query;
    // Note: Access control is handled at the route/page level - all users reaching this endpoint
    // are already authenticated and authorized to view subscription allowances

    const allowances = await SubscriptionAllowanceService.getMonthlyAllowances(userId, monthYear);

    if (!allowances) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      data: allowances
    });

  } catch (error) {
    luderror.payment('Subscriptions Benefits: Error getting allowances:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record product usage (Teachers and Students)
 * POST /api/subscriptions/benefits/record-usage
 */
router.post('/benefits/record-usage', authenticateToken, async (req, res) => {
  try {
    const {
      productType,
      productId,
      duration_minutes = 0,
      activity_type = 'view',
      completion_percent = 0,
      feature_action = null,
      teacherId = null // For students: ID of teacher whose claimed product they're using
    } = req.body;
    const userId = req.user.id;

    // Validation
    if (!productType) {
      return res.status(400).json({ error: 'productType is required' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    // Determine the owner of the claimed product
    let claimOwnerId = userId;

    if (req.user.user_type === 'student') {
      // Students must specify which teacher's claimed product they're using
      if (!teacherId) {
        return res.status(400).json({
          error: 'Students must specify teacherId when recording usage of teacher\'s claimed products'
        });
      }

      // Validate the teacher exists and student has access
      const teacher = await models.User.findOne({
        where: { id: teacherId, user_type: 'teacher' }
      });

      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      // TODO: Add classroom-based validation to ensure student belongs to this teacher
      // For now, we'll allow any student to record usage of any teacher's claimed products

      claimOwnerId = teacherId;
    }

    // Record the usage
    const usageData = {
      duration_minutes: Math.max(0, duration_minutes),
      activity_type,
      completion_percent: Math.min(100, Math.max(0, completion_percent)),
      feature_action,
      device_info: req.headers['user-agent'] ? 'web' : 'unknown',
      ip_address: req.ip,
      started_at: new Date().toISOString(),
      ended_at: new Date(Date.now() + (duration_minutes * 60 * 1000)).toISOString()
    };

    const updatedUsage = await SubscriptionAllowanceService.recordUsage(
      claimOwnerId,
      productType,
      productId,
      usageData
    );

    res.json({
      success: true,
      message: 'Usage recorded successfully',
      data: {
        totalSessions: updatedUsage.total_sessions,
        totalMinutes: updatedUsage.total_usage_minutes,
        engagementPattern: updatedUsage.engagement_metrics?.usage_pattern,
        completionStatus: updatedUsage.completion_status
      }
    });

  } catch (error) {
    luderror.payment('Subscriptions Benefits: Error recording usage:', error);

    if (error.message.includes('No active subscription claim found')) {
      return res.status(404).json({ error: 'No subscription claim found for this product' });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's subscription usage summary (Teachers only)
 * GET /api/subscriptions/benefits/my-summary
 */
router.get('/benefits/my-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthYear } = req.query;

    // Only teachers can view their subscription usage summary
    if (req.user.user_type !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view subscription usage summary' });
    }

    const summary = await SubscriptionAllowanceService.getUserUsageSummary(userId, monthYear);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    luderror.payment('Subscriptions Benefits: Error getting usage summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get subscription benefits analytics (Admin only)
 * GET /api/subscriptions/benefits/analytics
 */
router.get('/benefits/analytics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, productType, userId } = req.query;

    // Only admins can view analytics
    if (req.user.role !== 'admin' && req.user.role !== 'sysadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const options = {};

    // Parse query parameters
    if (startDate) {
      options.startDate = new Date(startDate);
    }

    if (endDate) {
      options.endDate = new Date(endDate);
    }

    if (productType) {
      options.productType = productType;
    }

    if (userId) {
      options.userId = userId;
    }

    const analytics = await SubscriptionAllowanceService.getUsageAnalytics(options);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    luderror.payment('Subscriptions Benefits: Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;