import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import PaymentService from '../services/PaymentService.js';
import PayplusService from '../services/PayplusService.js';
import models from '../models/index.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

/**
 * Determines if PayPlus payment page should be opened based on cart contents
 *
 * PayPlus API supports different charge methods:
 * - 0: Card Check (J2) - validates card without charging
 * - 1: Charge (J4) - immediate payment (transactional purchases)
 * - 2: Approval (J5) - funds verification
 * - 3: Recurring Payments - subscription billing
 * - 4: Refund - immediate refund
 *
 * @param {Array} cartItems - Array of purchase objects in cart
 * @returns {boolean} Whether to proceed with PayPlus payment page creation
 */
function shouldOpenPayplusPage(cartItems) {
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    clog('❌ shouldOpenPayplusPage: No cart items provided');
    return false;
  }

  // Check if there is at least one paid item (payment_amount > 0)
  const hasPaidItems = cartItems.some(item => {
    const amount = parseFloat(item.payment_amount || 0);
    return amount > 0;
  });

  clog('🔍 shouldOpenPayplusPage: Cart analysis', {
    itemCount: cartItems.length,
    hasPaidItems,
    amounts: cartItems.map(item => ({
      id: item.id,
      amount: item.payment_amount,
      type: item.purchasable_type
    }))
  });

  if (!hasPaidItems) {
    clog('❌ shouldOpenPayplusPage: No paid items found - all items are free');
    return false;
  }

  clog('✅ shouldOpenPayplusPage: Found paid items - proceeding with PayPlus');
  return true;
}

// Purchase Management Routes

// Create a new purchase (add item to cart)
router.post('/purchases', authenticateToken, async (req, res) => {
  try {
    const { purchasableType, purchasableId, additionalData = {} } = req.body;
    const userId = req.user.uid;

    // Validation
    if (!purchasableType || !purchasableId) {
      return res.status(400).json({ error: 'purchasableType and purchasableId are required' });
    }

    // Validate purchase creation constraints
    const validation = await PaymentService.validatePurchaseCreation(userId, purchasableType, purchasableId);

    if (!validation.valid) {
      if (validation.canUpdate && purchasableType === 'subscription') {
        // Special case: subscription in cart, need to update instead
        return res.status(409).json({
          error: validation.error,
          canUpdate: true,
          existingPurchaseId: validation.existingPurchase.id
        });
      }
      return res.status(409).json({ error: validation.error });
    }

    // Get product/subscription details to determine price
    let item = null;
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
      case 'tool':
        item = await models.Tool.findByPk(purchasableId);
        break;
      case 'game':
        item = await models.Game.findByPk(purchasableId);
        break;
      // NOTE: 'subscription' case removed - use dedicated /api/subscriptions endpoints
      default:
        return res.status(400).json({ error: `Unknown purchasable type: ${purchasableType}` });
    }

    if (!item) {
      return res.status(404).json({ error: `${purchasableType} not found` });
    }

    const price = parseFloat(item.price || 0);
    const isFree = price === 0;

    // Create purchase with cart status for all items
    const purchaseData = {
      id: `pur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      buyer_user_id: userId,
      purchasable_type: purchasableType,
      purchasable_id: purchasableId,
      payment_amount: price,
      original_price: price,
      discount_amount: 0,
      payment_status: 'cart',
      payment_method: null,
      metadata: {
        product_title: item.title || item.name || 'Unknown Product',
        ...additionalData
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    const purchase = await models.Purchase.create(purchaseData);

    // Return cart purchase for all items
    res.json({
      success: true,
      message: 'Item added to cart',
      data: {
        purchase,
        isFree,
        completed: false
      }
    });

  } catch (error) {
    cerror('Error creating purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete cart item (remove from cart)
router.delete('/purchases/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    // Find the purchase
    const purchase = await models.Purchase.findOne({
      where: {
        id,
        buyer_user_id: userId,
        payment_status: 'cart'
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    // Delete the purchase
    await purchase.destroy();

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: { purchaseId: id }
    });

  } catch (error) {
    cerror('Error deleting cart item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update cart subscription - DEPRECATED: Use /api/subscriptions endpoints instead
router.put('/purchases/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionPlanId } = req.body;

    // Check if this is a subscription update request
    if (subscriptionPlanId) {
      return res.status(410).json({
        error: 'Subscription updates via purchase system are deprecated. Use /api/subscriptions endpoints instead.',
        migrationNote: 'Use POST /api/subscriptions/create-payment with the new subscriptionPlanId'
      });
    }

    // Handle other purchase types (non-subscription updates)
    return res.status(400).json({
      error: 'Purchase update not supported for this type. Use specific endpoints for different product types.'
    });

  } catch (error) {
    cerror('Error updating cart purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// PayPlus Payment Page Creation
router.post('/createPayplusPaymentPage', authenticateToken, async (req, res) => {
  try {
    const { cartItems, environment = 'production', frontendOrigin = 'cart' } = req.body;
    const userId = req.user.uid;

    clog('🎯 Payment: Creating PayPlus payment page', {
      userId,
      cartItemsCount: cartItems?.length || 0,
      environment,
      frontendOrigin
    });

    // Validation
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'cartItems are required and must be a non-empty array' });
    }

    // Check if we should open PayPlus payment page
    if (!shouldOpenPayplusPage(cartItems)) {
      clog('❌ Payment: PayPlus page creation denied by shouldOpenPayplusPage');
      return res.json({
        success: false,
        message: 'No paid items found - PayPlus payment page not needed',
        data: {
          reason: 'all_items_free',
          cartItems: cartItems.length
        }
      });
    }

    // Get user information for customer data
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Use PayplusService to create payment page
    const paymentResult = await PayplusService.openPayplusPage({
      frontendOrigin,
      purchaseItems: cartItems,
      environment,
      customer: {
        customer_name: user.displayName || user.email,
        email: user.email,
        phone: user.phone || ''
      },
      callbacks: {
        successUrl: `${process.env.FRONTEND_URL}/payment/success`,
        failureUrl: `${process.env.FRONTEND_URL}/payment/failure`,
        cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
        callbackUrl: `${process.env.API_URL}/webhooks/payplus`
      }
    });

    // Create transaction with PayPlus data
    const transaction = await PaymentService.createPayPlusTransaction({
      userId,
      amount: paymentResult.totalAmount,
      environment,
      pageRequestUid: paymentResult.pageRequestUid,
      paymentPageLink: paymentResult.paymentPageLink,
      purchaseItems: cartItems,
      metadata: {
        frontendOrigin,
        customerInfo: {
          name: user.displayName || user.email,
          email: user.email
        },
        payplusResponse: paymentResult.data
      }
    });

    clog('✅ Payment: PayPlus payment page and transaction created successfully', {
      transactionId: transaction.id,
      purchaseCount: cartItems.length,
      transactionType: transaction.metadata.transaction_type
    });

    res.json({
      success: true,
      message: 'PayPlus payment page created',
      data: paymentResult.data,
      paymentUrl: paymentResult.paymentPageLink,
      transactionId: transaction.id,
      pageRequestUid: paymentResult.pageRequestUid,
      environment: paymentResult.environment
    });

  } catch (error) {
    cerror('❌ Payment: Error creating PayPlus payment page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subscription Payment Creation - Using dedicated SubscriptionPaymentService
router.post('/createSubscriptionPayment', authenticateToken, async (req, res) => {
  try {
    const { subscriptionPlanId, environment = 'production' } = req.body;
    const userId = req.user.uid;

    clog('🎯 Payment: Creating subscription payment', {
      userId,
      subscriptionPlanId,
      environment
    });

    // Validation
    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    // Use dedicated SubscriptionPaymentService instead of Purchase system
    const SubscriptionPaymentService = (await import('../services/SubscriptionPaymentService.js')).default;

    const result = await SubscriptionPaymentService.createSubscriptionPayment({
      userId,
      subscriptionPlanId,
      environment,
      metadata: {
        source: 'subscription_modal',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json(result);

  } catch (error) {
    cerror('❌ Payment: Error creating subscription payment:', error);

    // Handle specific validation errors
    if (error.message.includes('already has an active subscription') ||
        error.message.includes('already has a pending subscription')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

export default router;