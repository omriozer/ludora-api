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
      const transaction = req.body.transaction || req.body;
      const {
        payment_page_request_uid: page_request_uid,
        uid: transaction_uid,
        status_code,
        amount,
        date: payment_date
      } = transaction;

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

      // Find purchase by page_request_uid stored in metadata
      const purchase = await models.Purchase.findOne({
        where: {
          metadata: {
            payplus_page_request_uid: page_request_uid
          }
        }
      });

      if (!purchase) {
        console.warn(`PayPlus webhook: No purchase found for page_request_uid: ${page_request_uid}`);
        return res.status(404).json({ error: 'Purchase not found for this payment' });
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

      // Process the payment callback
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

      console.log(`✅ PayPlus payment processed:`, {
        purchaseId: purchase.id,
        pageRequestUid: page_request_uid,
        status: paymentStatus,
        amount,
        success: result.success
      });

      console.log(`🎯 ===== PAYPLUS WEBHOOK COMPLETED SUCCESSFULLY =====`);

      res.status(200).json({
        message: 'PayPlus webhook processed successfully',
        purchaseId: purchase.id,
        pageRequestUid: page_request_uid,
        status: paymentStatus,
        processed: true
      });

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