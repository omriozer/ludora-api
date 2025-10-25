import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import SubscriptionService from '../services/SubscriptionService.js';
import SubscriptionPaymentService from '../services/SubscriptionPaymentService.js';
import models from '../models/index.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

/**
 * Get user's subscription data (current subscription, plans, history)
 * GET /api/subscriptions/user
 */
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    clog('Subscriptions: Getting user subscription data', { userId });

    // Get user's subscription history
    const subscriptions = await SubscriptionService.getUserSubscriptionHistory(userId, {
      limit: 50,
      offset: 0
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

    res.json({
      success: true,
      data: {
        subscriptions,
        activeSubscription,
        plans,
        summary: {
          hasActiveSubscription: !!activeSubscription,
          currentPlan: activeSubscription?.subscriptionPlan || null,
          totalSubscriptions: subscriptions.length
        }
      }
    });

  } catch (error) {
    cerror('Subscriptions: Error getting user subscription data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user's active subscription
 * GET /api/subscriptions/current
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    clog('Subscriptions: Getting current subscription', { userId });

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
    cerror('Subscriptions: Error getting current subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all available subscription plans
 * GET /api/subscriptions/plans
 */
router.get('/plans', async (req, res) => {
  try {
    clog('Subscriptions: Getting available plans');

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
    cerror('Subscriptions: Error getting subscription plans:', error);
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
    const userId = req.user.uid;

    clog('Subscriptions: Creating subscription payment', {
      userId,
      subscriptionPlanId,
      environment,
      isRetry
    });

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
          clog('Subscriptions: No pending subscription found, creating new payment instead');
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
    cerror('Subscriptions: Error creating subscription payment:', error);

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
    const userId = req.user.uid;
    const { reason = 'user_cancelled', immediate = false } = req.body;

    clog('Subscriptions: Cancelling subscription', { userId, reason, immediate });

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
    cerror('Subscriptions: Error cancelling subscription:', error);
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
    const userId = req.user.uid;

    clog('Subscriptions: Getting subscription by ID', { id, userId });

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
    cerror('Subscriptions: Error getting subscription:', error);
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
    const userId = req.user.uid;

    clog('Subscriptions: Validating subscription creation', { userId, subscriptionPlanId });

    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    const validation = await SubscriptionService.validateSubscriptionCreation(userId, subscriptionPlanId);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    cerror('Subscriptions: Error validating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get subscription plans with user-specific information
 * GET /api/subscriptions/plans-with-context
 */
router.get('/plans-with-context', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    clog('Subscriptions: Getting plans with user context', { userId });

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
    cerror('Subscriptions: Error getting plans with context:', error);
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
    const userId = req.user.uid;

    clog('Subscriptions: Changing subscription plan', {
      userId,
      subscriptionPlanId,
      actionType,
      fromPlanId
    });

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
    cerror('Subscriptions: Error changing subscription plan:', error);

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
    const userId = req.user.uid;

    clog('Subscriptions: Cancelling pending subscription', { id, userId });

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
    cerror('Subscriptions: Error cancelling pending subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;