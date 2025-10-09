import express from 'express';
import rateLimit from 'express-rate-limit';
import { webhookCors } from '../middleware/cors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import PaymentService from '../services/PaymentService.js';
import models from '../models/index.js';

const router = express.Router();

// Apply webhook-specific CORS
router.use(webhookCors);

// Apply webhook-specific rate limiting
router.use(rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 webhook calls per 5 minutes
  message: {
    error: 'Webhook rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    console.warn('🚨 WEBHOOK RATE LIMIT VIOLATION:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
}));

// Webhook signature verification middleware (example for common providers)
const verifyWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'] ||
                       req.headers['x-hub-signature'] ||
                       req.headers['x-stripe-signature'];

      if (!signature) {
        console.warn('⚠️ Webhook received without signature:', {
          provider,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });

        // In development, allow unsigned webhooks with warning
        if (process.env.ENVIRONMENT === 'development') {
          console.warn('🚨 DEVELOPMENT: Allowing unsigned webhook');
          return next();
        }

        return res.status(401).json({ error: 'Webhook signature required' });
      }

      // TODO: Implement actual signature verification based on provider
      // For now, just log the signature for debugging
      console.log(`📨 Webhook signature received: ${signature.substring(0, 20)}...`);

      next();
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      res.status(401).json({ error: 'Invalid webhook signature' });
    }
  };
};

// Webhook endpoints for different providers

// GitHub webhooks
router.post('/github',
  verifyWebhookSignature('github'),
  asyncHandler(async (req, res) => {
    const event = req.headers['x-github-event'];
    console.log(`📨 GitHub webhook received: ${event}`);

    // TODO: Implement GitHub webhook handling
    res.status(200).json({ message: 'GitHub webhook received', event });
  })
);

// Stripe webhooks
router.post('/stripe',
  verifyWebhookSignature('stripe'),
  asyncHandler(async (req, res) => {
    const event = req.body;
    console.log(`📨 Stripe webhook received: ${event.type}`);

    // TODO: Implement Stripe webhook handling
    res.status(200).json({ message: 'Stripe webhook received', type: event.type });
  })
);

// PayPal webhooks
router.post('/paypal',
  verifyWebhookSignature('paypal'),
  asyncHandler(async (req, res) => {
    const event = req.body;
    console.log(`📨 PayPal webhook received: ${event.event_type}`);

    // TODO: Implement PayPal webhook handling
    res.status(200).json({ message: 'PayPal webhook received', type: event.event_type });
  })
);

// PayPlus webhooks (Israeli payment gateway)
router.post('/payplus',
  asyncHandler(async (req, res) => {
    try {
      console.log(`🎯 ===== PAYPLUS WEBHOOK RECEIVED =====`);
      console.log(`📨 PayPlus webhook received at ${new Date().toISOString()}`);
      console.log('PayPlus headers:', JSON.stringify(req.headers, null, 2));
      console.log('PayPlus body:', JSON.stringify(req.body, null, 2));

      // Log webhook for debugging
      await models.WebhookLog?.create({
        webhook_type: 'payplus_payment',
        payload: JSON.stringify(req.body),
        status: 'received',
        source_ip: req.ip,
        created_at: new Date(),
        updated_at: new Date()
      }).catch(err => console.log('WebhookLog not available:', err.message));

      // Extract PayPlus callback data from transaction object
      const transactionData = req.body.transaction || req.body;
      const {
        payment_page_request_uid: page_request_uid,
        uid: transaction_uid,
        status_code,
        amount,
        date: payment_date
      } = transactionData;

      // Extract customer data from customer object
      const customer = req.body.customer || {};
      const {
        name: customer_name,
        email: customer_email
      } = customer;

      if (!page_request_uid) {
        console.warn('PayPlus webhook missing page_request_uid');
        return res.status(400).json({ error: 'Missing page_request_uid' });
      }

      // Find payment session, transaction, or purchase by page_request_uid
      // First, try to find a PaymentSession record (new session-based payments)
      let paymentSession = await models.PaymentSession.findOne({
        where: {
          payplus_page_uid: page_request_uid
        },
        include: [{
          model: models.User,
          as: 'user'
        }]
      });

      let purchases = [];
      let transaction = null;
      let isSessionPayment = false;
      let isTransactionPayment = false;

      if (paymentSession) {
        // Session-based payment found
        isSessionPayment = true;
        console.log(`✅ Found payment session ${paymentSession.id} for user ${paymentSession.user_id}`);

        // Get purchases associated with this session
        if (paymentSession.purchase_ids && paymentSession.purchase_ids.length > 0) {
          purchases = await models.Purchase.findAll({
            where: { id: paymentSession.purchase_ids }
          });
          console.log(`✅ Found ${purchases.length} purchases for session ${paymentSession.id}`);
        }
      } else {
        // Fallback to legacy Transaction lookup (multi-item cart payments)
        transaction = await models.Transaction.findOne({
          where: {
            payplus_page_uid: page_request_uid
          },
          include: [{
            model: models.Purchase,
            as: 'purchases'
          }]
        });

        if (transaction) {
          // Multi-item cart payment found
          purchases = transaction.purchases || [];
          isTransactionPayment = true;
          console.log(`✅ Found transaction ${transaction.id} with ${purchases.length} purchases`);
        } else {
        // Single-item payment: find individual purchase by page_request_uid stored in metadata
        let purchase = await models.Purchase.findOne({
          where: {
            metadata: {
              payplus_page_request_uid: page_request_uid
            }
          }
        });

        // If not found, try alternative field names that PayPlus might use
        if (!purchase) {
          console.log(`🔍 PayPlus webhook: Trying alternative lookup for page_request_uid: ${page_request_uid}`);

          // Try with different metadata field names
          const alternatives = [
            { payplus_payment_page_request_uid: page_request_uid },
            { page_request_uid: page_request_uid },
            { payment_page_request_uid: page_request_uid }
          ];

          for (const whereClause of alternatives) {
            purchase = await models.Purchase.findOne({
              where: { metadata: whereClause }
            });
            if (purchase) {
              console.log(`✅ Found purchase using alternative metadata field:`, whereClause);
              break;
            }
          }
        }

        // If still not found, try finding by transaction_uid as a last resort
        if (!purchase && transaction_uid) {
          console.log(`🔍 PayPlus webhook: Trying lookup by transaction_uid: ${transaction_uid}`);
          purchase = await models.Purchase.findOne({
            where: {
              transaction_id: transaction_uid
            }
          });
          if (purchase) {
            console.log(`✅ Found purchase using transaction_uid`);
          }
        }

        if (purchase) {
          purchases = [purchase];
          console.log(`✅ Found single purchase: ${purchase.id}`);
        }
      }

      if (!isSessionPayment && purchases.length === 0) {
        console.warn(`❌ PayPlus webhook: No payment session, transaction, or purchase found for page_request_uid: ${page_request_uid} or transaction_uid: ${transaction_uid}`);
        return res.status(404).json({ error: 'No payment session, transaction, or purchase found for this payment' });
      }

      // Map PayPlus status to our internal status
      // PayPlus sends status_code: "000" for successful payments
      const statusMap = {
        '000': 'completed',  // PayPlus success code
        'success': 'completed',
        'approved': 'completed',
        'failed': 'failed',
        'error': 'failed',
        'cancelled': 'cancelled',
        'refunded': 'refunded'
      };

      const paymentStatus = statusMap[status_code] || statusMap[status_name?.toLowerCase()] || 'pending';

      // Process payment for all purchases (session-based, transaction-based, or single item)
      if (isSessionPayment && paymentSession) {
        // Session-based payment processing
        console.log(`🎯 Processing session-based payment for session ${paymentSession.id} with ${purchases.length} purchases`);

        // Update PaymentSession record
        if (paymentStatus === 'completed') {
          await paymentSession.markCompleted({
            webhook_received_at: new Date().toISOString(),
            transaction_uid,
            status_code,
            amount,
            customer_email,
            customer_name,
            payment_date
          });
        } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
          await paymentSession.markFailed(`Payment ${paymentStatus}: ${status_code}`, {
            webhook_received_at: new Date().toISOString(),
            transaction_uid,
            status_code,
            amount,
            customer_email,
            customer_name,
            payment_date
          });
        }

        // Commit coupon usage if payment successful and coupons were used
        if (paymentStatus === 'completed' && paymentSession.applied_coupons?.length > 0) {
          console.log(`🎫 Committing coupon usage for ${paymentSession.applied_coupons.length} coupons (session payment)`);

          for (const appliedCoupon of paymentSession.applied_coupons) {
            try {
              await PaymentService.commitCouponUsage(appliedCoupon.code);
              console.log(`✅ Committed usage for coupon: ${appliedCoupon.code}`);
            } catch (error) {
              console.error(`❌ Failed to commit usage for coupon ${appliedCoupon.code}:`, error);
              // Don't throw - payment is successful, coupon tracking is secondary
            }
          }
        }

        // Update all related purchases
        if (purchases.length > 0) {
          await models.Purchase.update(
            {
              payment_status: paymentStatus,
              updated_at: new Date()
            },
            { where: { id: paymentSession.purchase_ids } }
          );

          console.log(`✅ Updated ${purchases.length} purchases to status: ${paymentStatus}`);
        }

        // Handle post-payment logic for each purchase
        for (const purchase of purchases) {
          if (paymentStatus === 'completed') {
            // Update download count for file products
            if (purchase.product_id) {
              const product = await models.Product.findByPk(purchase.product_id);
              if (product && product.product_type === 'file') {
                const fileEntity = await models.File.findByPk(product.entity_id);
                if (fileEntity) {
                  await fileEntity.update({
                    downloads_count: (fileEntity.downloads_count || 0) + 1
                  });
                }
              }
            }
          }
        }

        console.log(`✅ PayPlus session payment processed:`, {
          sessionId: paymentSession.id,
          purchaseCount: purchases.length,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          amount,
          totalAmount: paymentSession.total_amount
        });

        res.status(200).json({
          message: 'PayPlus session webhook processed successfully',
          sessionId: paymentSession.id,
          purchaseCount: purchases.length,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          processed: true
        });

      } else if (isTransactionPayment && transaction) {
        // Multi-item transaction payment
        console.log(`🛒 Processing multi-item transaction payment for ${purchases.length} purchases`);

        // Update Transaction record
        await transaction.update({
          payment_status: paymentStatus,
          completed_at: paymentStatus === 'completed' ? new Date() : null,
          payplus_response: {
            ...transaction.payplus_response,
            webhook_received_at: new Date().toISOString(),
            transaction_uid,
            status_code,
            amount,
            customer_email,
            customer_name,
            payment_date
          },
          updated_at: new Date()
        });

        // Commit coupon usage if payment successful and coupons were used
        if (paymentStatus === 'completed' && transaction.payplus_response?.coupon_info?.applied_coupons?.length > 0) {
          console.log(`🎫 Committing coupon usage for ${transaction.payplus_response.coupon_info.applied_coupons.length} coupons`);

          for (const appliedCoupon of transaction.payplus_response.coupon_info.applied_coupons) {
            try {
              await PaymentService.commitCouponUsage(appliedCoupon.code);
              console.log(`✅ Committed usage for coupon: ${appliedCoupon.code}`);
            } catch (error) {
              console.error(`❌ Failed to commit usage for coupon ${appliedCoupon.code}:`, error);
              // Don't throw - payment is successful, coupon tracking is secondary
            }
          }
        }

        // Update all related purchases
        await models.Purchase.update(
          {
            payment_status: paymentStatus,
            updated_at: new Date()
          },
          { where: { transaction_id: transaction.id } }
        );

        // Handle post-payment logic for each purchase
        for (const purchase of purchases) {
          if (paymentStatus === 'completed') {
            // Update download count for file products
            if (purchase.product_id) {
              const product = await models.Product.findByPk(purchase.product_id);
              if (product && product.product_type === 'file') {
                const fileEntity = await models.File.findByPk(product.entity_id);
                if (fileEntity) {
                  await fileEntity.update({
                    downloads_count: (fileEntity.downloads_count || 0) + 1
                  });
                }
              }
            }
          }
        }

        console.log(`✅ PayPlus transaction processed:`, {
          transactionId: transaction.id,
          purchaseCount: purchases.length,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          amount,
          totalAmount: transaction.total_amount
        });

        res.status(200).json({
          message: 'PayPlus transaction webhook processed successfully',
          transactionId: transaction.id,
          purchaseCount: purchases.length,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          processed: true
        });

      } else {
        // Single-item purchase payment (legacy behavior)
        const purchase = purchases[0];
        console.log(`💳 Processing single-item purchase payment for purchase ${purchase.id}`);

        const result = await PaymentService.handlePayplusCallback({
          paymentId: purchase.id,
          status: paymentStatus,
          amount: parseFloat(amount) || 0,
          transactionId: transaction_uid,
          payerEmail: customer_email,
          payerName: customer_name,
          paymentDate: payment_date,
          payplusData: {
            page_request_uid,
            transaction_uid,
            status_code
          }
        });

        // For single-item purchases, check if coupons were applied (stored in purchase metadata)
        if (paymentStatus === 'completed' && purchase.metadata?.applied_coupons?.length > 0) {
          console.log(`🎫 Committing coupon usage for ${purchase.metadata.applied_coupons.length} coupons (single-item purchase)`);

          for (const appliedCoupon of purchase.metadata.applied_coupons) {
            try {
              await PaymentService.commitCouponUsage(appliedCoupon.code);
              console.log(`✅ Committed usage for coupon: ${appliedCoupon.code}`);
            } catch (error) {
              console.error(`❌ Failed to commit usage for coupon ${appliedCoupon.code}:`, error);
              // Don't throw - payment is successful, coupon tracking is secondary
            }
          }
        }

        console.log(`✅ PayPlus single payment processed:`, {
          purchaseId: purchase.id,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          amount,
          success: result.success
        });

        res.status(200).json({
          message: 'PayPlus webhook processed successfully',
          purchaseId: purchase.id,
          pageRequestUid: page_request_uid,
          status: paymentStatus,
          processed: true
        });
      }

      console.log(`🎯 ===== PAYPLUS WEBHOOK COMPLETED SUCCESSFULLY =====`);

    } catch (error) {
      console.error('🚨 ===== PAYPLUS WEBHOOK FAILED =====');
      console.error('❌ PayPlus webhook processing failed:', error);
      console.error('📥 Request body was:', JSON.stringify(req.body, null, 2));
      console.error('📋 Request headers were:', JSON.stringify(req.headers, null, 2));

      // Log the error but still return 200 to avoid PayPlus retrying
      await models.WebhookLog?.create({
        webhook_type: 'payplus_payment',
        payload: JSON.stringify(req.body),
        status: 'failed',
        error_message: error.message,
        source_ip: req.ip,
        created_at: new Date(),
        updated_at: new Date()
      }).catch(err => console.log('WebhookLog not available:', err.message));

      res.status(200).json({
        message: 'PayPlus webhook received but processing failed',
        error: error.message,
        processed: false
      });
    }
  })
);

// Generic webhook endpoint
router.post('/generic/:provider',
  verifyWebhookSignature('generic'),
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    console.log(`📨 Generic webhook received from: ${provider}`);

    // Log webhook data for debugging
    console.log('Webhook headers:', JSON.stringify(req.headers, null, 2));
    console.log('Webhook body:', JSON.stringify(req.body, null, 2));

    // TODO: Implement generic webhook handling
    res.status(200).json({
      message: 'Generic webhook received',
      provider,
      timestamp: new Date().toISOString()
    });
  })
);

// PayPlus webhook test endpoint
router.get('/payplus/test', (req, res) => {
  console.log('🧪 PayPlus webhook test endpoint called');
  res.status(200).json({
    message: 'PayPlus webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: `${req.protocol}://${req.get('host')}/api/webhooks/payplus`,
    method: 'POST required for actual webhook'
  });
});

// Webhook health check
router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
    supportedProviders: ['github', 'stripe', 'paypal', 'payplus', 'generic']
  });
});

export default router;