import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/validation.js';
import PaymentService from '../services/PaymentService.js';
import PayplusService from '../services/PayplusService.js';
import PaymentPollingService from '../services/PaymentPollingService.js';
import models from '../models/index.js';
import { luderror } from '../lib/ludlog.js';

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
    return false;
  }

  // Check if there is at least one paid item (payment_amount > 0)
  const hasPaidItems = cartItems.some(item => {
    const amount = parseFloat(item.payment_amount || 0);
    return amount > 0;
  });

  if (!hasPaidItems) {
    return false;
  }

  return true;
}

// Purchase Management Routes

// Create a new purchase (add item to cart)
router.post('/purchases', authenticateToken, async (req, res) => {
  try {
    const { purchasableType, purchasableId, additionalData = {} } = req.body;
    const userId = req.user.id;

    // Validation
    if (!purchasableType || !purchasableId) {
      return res.status(400).json({ error: 'purchasableType and purchasableId are required' });
    }

    // CRITICAL FIX: The purchasableId could be either a Product ID (for bundles) or an entity ID (for other types)
    // We need to find the correct Product ID to store in the Purchase record for access control
    let productId = null;
    let productRecord = null;
    let entityRecord = null;
    let isBundle = false;

    // Try to find as Product first (could be a bundle or direct product ID)
    productRecord = await models.Product.findByPk(purchasableId);

    if (productRecord) {
      // Found as Product - this could be a bundle or direct product reference
      productId = productRecord.id;
      isBundle = productRecord.type_attributes?.is_bundle || false;

      // If not a bundle, get the entity record for price info
      if (!isBundle && productRecord.entity_id) {
        switch (purchasableType) {
          case 'workshop':
            entityRecord = await models.Workshop.findByPk(productRecord.entity_id);
            break;
          case 'course':
            entityRecord = await models.Course.findByPk(productRecord.entity_id);
            break;
          case 'file':
            entityRecord = await models.File.findByPk(productRecord.entity_id);
            break;
          case 'lesson_plan':
            entityRecord = await models.LessonPlan.findByPk(productRecord.entity_id);
            break;
          case 'tool':
            entityRecord = await models.Tool.findByPk(productRecord.entity_id);
            break;
          case 'game':
            entityRecord = await models.Game.findByPk(productRecord.entity_id);
            break;
        }
      }
    } else {
      // Not found as Product - must be an entity ID, need to find the corresponding Product
      switch (purchasableType) {
        case 'workshop':
          entityRecord = await models.Workshop.findByPk(purchasableId);
          break;
        case 'course':
          entityRecord = await models.Course.findByPk(purchasableId);
          break;
        case 'file':
          entityRecord = await models.File.findByPk(purchasableId);
          break;
        case 'lesson_plan':
          entityRecord = await models.LessonPlan.findByPk(purchasableId);
          break;
        case 'tool':
          entityRecord = await models.Tool.findByPk(purchasableId);
          break;
        case 'game':
          entityRecord = await models.Game.findByPk(purchasableId);
          break;
        // NOTE: 'subscription' case removed - use dedicated /api/subscriptions endpoints
        default:
          return res.status(400).json({ error: `Unknown purchasable type: ${purchasableType}` });
      }

      if (!entityRecord) {
        return res.status(404).json({ error: `${purchasableType} not found` });
      }

      // Find the Product record that references this entity
      productRecord = await models.Product.findOne({
        where: {
          product_type: purchasableType,
          entity_id: purchasableId
        }
      });

      if (!productRecord) {
        return res.status(404).json({
          error: `Product record not found for ${purchasableType} ${purchasableId}. This entity may not be properly set up as a product.`
        });
      }

      productId = productRecord.id;
    }

    // Validate purchase creation constraints using Product ID
    const validation = await PaymentService.validatePurchaseCreation(userId, purchasableType, productId);

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

    // Determine item for price extraction (Product for bundles, entity for others)
    const item = isBundle ? productRecord : (entityRecord || productRecord);

    // Get price from Product record (which has the authoritative price)
    let price = parseFloat(productRecord.price || 0);

    // Check if price is provided in additionalData (for entities that don't have price)
    if (additionalData.product_price && price === 0) {
      price = parseFloat(additionalData.product_price || 0);
    }

    const isFree = price === 0;

    // CRITICAL: Create purchase with Product ID (not entity ID) for proper access control
    const purchaseData = {
      id: `pur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      buyer_user_id: userId,
      purchasable_type: purchasableType,
      purchasable_id: productId, // ✅ FIXED: Use Product ID instead of entity ID
      payment_amount: price,
      original_price: price,
      discount_amount: 0,
      payment_status: isFree ? 'completed' : 'cart', // Complete free items immediately
      payment_method: isFree ? 'free' : null,
      metadata: {
        product_title: productRecord.title || item.title || item.name || 'Unknown Product',
        entity_id: entityRecord?.id || null, // Store entity ID in metadata for reference
        is_bundle: isBundle,
        ...additionalData
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    const purchase = await models.Purchase.create(purchaseData);

    // Return appropriate response based on item type
    if (isFree) {
      res.json({
        success: true,
        message: 'Free item added to library',
        data: {
          purchase,
          isFree,
          completed: true // Free items are completed immediately
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Item added to cart',
        data: {
          purchase,
          isFree,
          completed: false
        }
      });
    }

  } catch (error) {
    luderror.payment('Error creating purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete cart item (remove from cart)
router.delete('/purchases/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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
    luderror.payment('Error deleting cart item:', error);
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
    luderror.payment('Error updating cart purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// PayPlus Payment Page Creation
router.post('/createPayplusPaymentPage', authenticateToken, async (req, res) => {
  try {
    const { cartItems, frontendOrigin = 'cart' } = req.body;
    const userId = req.user.id;

    // Validation
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'cartItems are required and must be a non-empty array' });
    }

    // Check if we should open PayPlus payment page
    if (!shouldOpenPayplusPage(cartItems)) {
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

    // Use PayplusService to create payment page (environment auto-detected)
    const paymentResult = await PayplusService.openPayplusPage({
      frontendOrigin,
      purchaseItems: cartItems,
      customer: {
        customer_name: user.displayName || user.email,
        email: user.email,
        phone: user.phone || ''
      },
    });

    // Create transaction with PayPlus data (environment auto-detected)
    const transaction = await PaymentService.createPayPlusTransaction({
      userId,
      amount: paymentResult.totalAmount,
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

    // Ensure transaction uses PayPlus-returned page_request_uid (not our generated one)
    const payplusReturnedUid = paymentResult.data?.data?.page_request_uid;
    if (payplusReturnedUid && payplusReturnedUid !== paymentResult.pageRequestUid) {
      await transaction.update({
        payment_page_request_uid: payplusReturnedUid,
        updated_at: new Date()
      });
    }

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
    luderror.payment('❌ Payment: Error creating PayPlus payment page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subscription Payment Creation - Using dedicated SubscriptionPaymentService
router.post('/createSubscriptionPayment', authenticateToken, async (req, res) => {
  try {
    const { subscriptionPlanId } = req.body;
    const userId = req.user.id;

    // Validation
    if (!subscriptionPlanId) {
      return res.status(400).json({ error: 'subscriptionPlanId is required' });
    }

    // Use dedicated SubscriptionPaymentService instead of Purchase system
    const SubscriptionPaymentService = (await import('../services/SubscriptionPaymentService.js')).default;

    const result = await SubscriptionPaymentService.createSubscriptionPayment({
      userId,
      subscriptionPlanId,
      metadata: {
        source: 'subscription_modal',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    res.json(result);

  } catch (error) {
    luderror.payment('❌ Payment: Error creating subscription payment:', error);

    // Handle specific validation errors
    if (error.message.includes('already has an active subscription') ||
        error.message.includes('already has a pending subscription')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

// Payment Status Polling Routes

// Update transaction status (called from PayPlus iframe events)
router.post('/update-status', authenticateToken, async (req, res) => {
  try {
    const { transaction_id, status } = req.body;
    const userId = req.user.id;

    // Validation
    if (!transaction_id || !status) {
      return res.status(400).json({ error: 'transaction_id and status are required' });
    }

    // Find the purchase by ID and user ownership
    const purchase = await models.Purchase.findOne({
      where: {
        id: transaction_id,
        buyer_user_id: userId
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Only allow specific status transitions from frontend
    if (purchase.payment_status === 'cart' && status === 'pending') {
      await purchase.update({
        payment_status: 'pending',
        metadata: {
          ...purchase.metadata,
          pending_started_at: new Date().toISOString(),
          pending_source: 'pp_submitProcess_event'
        },
        updated_at: new Date()
      });

      // CRITICAL: Start automatic polling when payment becomes pending
      // This replaces setTimeout-based polling with Redis-backed job scheduling
      // Jobs survive server restarts and provide better monitoring
      try {
        const jobScheduler = (await import('../services/JobScheduler.js')).default;

        if (jobScheduler.isInitialized) {
          // Schedule payment status polling with job scheduler (starts after 2 seconds)
          await jobScheduler.scheduleJob('PAYMENT_STATUS_CHECK', {
            checkType: 'single_transaction',
            transactionId: transaction_id,
            attemptNumber: 1,
            maxAttempts: 10, // Allow up to 10 polling attempts
            source: 'payment_pending'
          }, {
            delay: 2000, // Start after 2 seconds
            priority: 90 // High priority for payment checks
          });

          ludlog.payment(`✅ Payment polling scheduled via job scheduler for ${transaction_id}`);
        } else {
          ludlog.payment(`⚠️ Job scheduler not initialized, payment polling not scheduled for ${transaction_id}`);
          // Don't fail the request if job scheduler is not available
        }
      } catch (jobError) {
        luderror.payment(`❌ Failed to schedule payment polling job for ${transaction_id}:`, jobError);
        // Don't fail the request if job scheduling fails
      }
    }

    res.json({
      success: true,
      status: purchase.payment_status,
      transaction_id: transaction_id
    });

  } catch (error) {
    luderror.payment('Error updating transaction status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Poll transaction status (triggers PayPlus API check)
router.get('/transaction-status/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership before polling
    const purchase = await models.Purchase.findOne({
      where: {
        id,
        buyer_user_id: userId
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Use PaymentPollingService to poll PayPlus API
    const pollResult = await PaymentPollingService.pollTransactionStatus(id);

    res.json({
      transaction_id: id,
      poll_result: pollResult,
      polling_attempts: (purchase.polling_attempts || 0) + (pollResult.success ? 0 : 1),
      last_polled_at: new Date().toISOString()
    });

  } catch (error) {
    luderror.payment('Error polling transaction status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check all pending payments for current user (triggers polling)
router.post('/check-pending-payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use PaymentPollingService to check all pending payments and poll them
    const pollResults = await PaymentPollingService.checkUserPendingPayments(userId);

    res.json({
      success: true,
      message: 'Pending payments checked and polled',
      data: pollResults
    });

  } catch (error) {
    luderror.payment('Error checking pending payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// In-memory request tracking to prevent duplicate concurrent requests
const activeRequests = new Map();

// Check PayPlus payment page status for pending payments (smart polling trigger)
router.post('/check-payment-page-status', rateLimiters.paymentStatusCheck, authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // PROTECTION 1: Prevent concurrent requests from same user
    if (activeRequests.has(userId)) {
      return res.status(429).json({
        error: 'Payment status check already in progress',
        message: 'Please wait for the current check to complete',
        retryAfter: 5
      });
    }

    // Mark request as active
    activeRequests.set(userId, Date.now());

    // PROTECTION 2: Set a maximum timeout to prevent hanging
    const requestTimeout = setTimeout(() => {
      activeRequests.delete(userId);
    }, 30000); // 30 second timeout


    // Import PayPlusPageStatusService
    const PayPlusPageStatusService = (await import('../services/PayPlusPageStatusService.js')).default;

    // Find all pending purchases for this user
    const pendingPurchases = await models.Purchase.findAll({
      where: {
        buyer_user_id: userId,
        payment_status: 'pending'
      },
      include: [
        {
          model: models.Transaction,
          as: 'transaction',
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });


    // PROTECTION 3: Limit the number of purchases to process (prevent overload)
    const maxPurchasesToProcess = 10;
    const purchasesToProcess = pendingPurchases.slice(0, maxPurchasesToProcess);

    if (pendingPurchases.length > maxPurchasesToProcess) {
    }

    const results = [];

    for (const purchase of purchasesToProcess) {
      try {
        if (!purchase.transaction?.payment_page_request_uid) {
          // No PayPlus page UID - skip this purchase
          results.push({
            purchase_id: purchase.id,
            transaction_id: purchase.transaction_id,
            status: 'skipped',
            reason: 'No PayPlus page request UID found'
          });
          continue;
        }

        // Check PayPlus page status and handle accordingly
        const pageStatusResult = await PayPlusPageStatusService.checkAndHandlePaymentPageStatus(purchase.transaction_id);

        results.push({
          purchase_id: purchase.id,
          transaction_id: purchase.transaction_id,
          page_request_uid: purchase.transaction.payment_page_request_uid,
          page_status_result: pageStatusResult
        });


      } catch (error) {
        results.push({
          purchase_id: purchase.id,
          transaction_id: purchase.transaction_id,
          status: 'error',
          error: error.message
        });

      }
    }

    // Count actions taken
    const summary = {
      total_pending: pendingPurchases.length,
      reverted_to_cart: results.filter(r => r.page_status_result?.action_taken === 'reverted_to_cart').length,
      continue_polling: results.filter(r => r.page_status_result?.action_taken === 'continue_transaction_polling').length,
      errors: results.filter(r => r.status === 'error' || r.page_status_result?.success === false).length,
      skipped: results.filter(r => r.status === 'skipped').length
    };


    // CLEANUP: Clear request tracking and timeout on success
    clearTimeout(requestTimeout);
    activeRequests.delete(userId);

    res.json({
      success: true,
      message: 'PayPlus payment page status checked for pending payments',
      summary,
      results
    });

  } catch (error) {
    // CLEANUP: Clear request tracking and timeout on error
    clearTimeout(requestTimeout);
    activeRequests.delete(userId);

    luderror.payment('Error checking payment page status:', error);

    // Return safe error message (don't expose internal details)
    res.status(500).json({
      error: 'Payment status check temporarily unavailable',
      message: 'Please try again in a few moments',
      retryAfter: 60
    });
  }
});

// Get detailed transaction information
router.get('/transaction-details/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the purchase with full details
    const purchase = await models.Purchase.findOne({
      where: {
        id,
        buyer_user_id: userId
      },
      include: [
        {
          model: models.Transaction,
          as: 'transaction',
          required: false
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      transaction_id: id,
      payment_status: purchase.payment_status,
      payment_amount: purchase.payment_amount,
      created_at: purchase.created_at,
      updated_at: purchase.updated_at,
      polling_attempts: purchase.polling_attempts || 0,
      last_polled_at: purchase.last_polled_at,
      resolution_method: purchase.resolution_method,
      metadata: purchase.metadata,
      transaction: purchase.transaction
    });

  } catch (error) {
    luderror.payment('Error getting transaction details:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;