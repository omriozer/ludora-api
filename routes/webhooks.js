import express from 'express';
import rateLimit from 'express-rate-limit';
import { webhookCors } from '../middleware/cors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

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
  // Note: onLimitReached was deprecated in express-rate-limit v7
  // Rate limit violations are now logged via middleware instead
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

// PayPlus webhooks
router.post('/payplus',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const webhookData = req.body;

    // Capture comprehensive sender information for security analysis
    const senderInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      forwarded: req.get('X-Forwarded-For'),
      realIp: req.get('X-Real-IP'),
      host: req.get('Host'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      timestamp: new Date().toISOString(),
      headers: {
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP'),
        'x-forwarded-proto': req.get('X-Forwarded-Proto'),
        'x-forwarded-host': req.get('X-Forwarded-Host'),
        'authorization': req.get('Authorization') ? '[REDACTED]' : null,
        'x-webhook-signature': req.get('X-Webhook-Signature') ? '[REDACTED]' : null,
      },
      query: req.query,
      method: req.method,
      url: req.url,
      protocol: req.protocol,
      secure: req.secure
    };

    console.log(`📨 PayPlus webhook received:`, {
      page_request_uid: webhookData.page_request_uid,
      status: webhookData.status,
      transaction_type: webhookData.transaction_type,
      sender_ip: senderInfo.ip,
      user_agent: senderInfo.userAgent
    });

    let webhookLog = null;

    try {
      // Create webhook log entry immediately - FIRST THING
      webhookLog = await models.WebhookLog.create({
        id: generateId(),
        provider: 'payplus',
        event_type: webhookData.transaction_type || webhookData.status || 'unknown',
        event_data: webhookData,
        sender_info: senderInfo,
        status: 'received',
        page_request_uid: webhookData.page_request_uid,
        payplus_transaction_uid: webhookData.transaction_uid,
        created_at: new Date(),
        updated_at: new Date()
      });

      webhookLog.addProcessLog('Webhook received and logged');
      webhookLog.addProcessLog(`Sender IP: ${senderInfo.ip}, User-Agent: ${senderInfo.userAgent}`);
      await webhookLog.updateStatus('processing', 'Starting webhook processing');

      // Import services dynamically to avoid circular dependencies
      const PaymentService = (await import('../services/PaymentService.js')).default;
      const SubscriptionService = (await import('../services/SubscriptionService.js')).default;

      // Validate required webhook data
      if (!webhookData.page_request_uid) {
        throw new Error('Missing required page_request_uid in webhook data');
      }

      webhookLog.addProcessLog(`Processing webhook for page_request_uid: ${webhookData.page_request_uid}`);

      // Find the transaction by page_request_uid
      const transaction = await models.Transaction.findOne({
        where: {
          page_request_uid: webhookData.page_request_uid
        },
        include: [
          {
            model: models.Purchase,
            as: 'purchases'
          }
        ]
      });

      if (!transaction) {
        throw new Error(`No transaction found for page_request_uid: ${webhookData.page_request_uid}`);
      }

      webhookLog.addProcessLog(`Found transaction: ${transaction.id}`);
      await webhookLog.update({ transaction_id: transaction.id });

      // Detect if this is a subscription or purchase transaction
      const isSubscriptionTransaction = !!(transaction.metadata?.subscription_id || transaction.metadata?.transaction_type === 'subscription_payment' || transaction.metadata?.transaction_type === 'subscription_retry_payment');
      const subscriptionId = transaction.metadata?.subscription_id;

      webhookLog.addProcessLog(`Transaction type detected: ${isSubscriptionTransaction ? 'subscription' : 'purchase'}`);
      if (subscriptionId) {
        webhookLog.addProcessLog(`Subscription ID: ${subscriptionId}`);
        await webhookLog.update({ subscription_id: subscriptionId });
      }

      // Process based on webhook status
      if (webhookData.status === 'success' || webhookData.status === 'approved') {
        // Update transaction status first
        await transaction.update({
          payment_status: 'completed',
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            completedAt: new Date().toISOString()
          }
        });

        webhookLog.addProcessLog('Transaction updated to completed status');

        if (isSubscriptionTransaction) {
          // Handle subscription payment success
          webhookLog.addProcessLog(`Processing subscription payment completion for subscription: ${subscriptionId}`);

          try {
            // Get subscription record
            const subscription = await models.Subscription.findByPk(subscriptionId);
            if (!subscription) {
              throw new Error(`Subscription ${subscriptionId} not found`);
            }

            webhookLog.addProcessLog(`Found subscription: ${subscription.id}, status: ${subscription.status}`);

            // Use dedicated SubscriptionPaymentService for handling payment success
            const SubscriptionPaymentService = (await import('../services/SubscriptionPaymentService.js')).default;
            await SubscriptionPaymentService.handlePaymentSuccess(subscription, webhookData);

            webhookLog.addProcessLog(`Subscription ${subscriptionId} activated successfully`);
            console.log(`✅ PayPlus webhook: Subscription ${subscriptionId} payment completed successfully`);

          } catch (error) {
            webhookLog.addProcessLog(`Failed to process subscription payment: ${error.message}`);
            console.error(`❌ PayPlus webhook: Failed to process subscription payment ${subscriptionId}:`, error);
            // Don't throw error - log it but continue webhook processing
          }

        } else {
          // Handle regular purchase completion
          const purchases = transaction.purchases || [];
          webhookLog.addProcessLog(`Processing ${purchases.length} purchases completion`);

          try {
            for (const purchase of purchases) {
              await PaymentService.completePurchase(purchase.id, {
                transactionId: transaction.id,
                payplusWebhookData: webhookData
              });
              webhookLog.addProcessLog(`Purchase ${purchase.id} completed successfully`);
            }

            console.log(`✅ PayPlus webhook: Completed ${purchases.length} purchases`);

          } catch (error) {
            webhookLog.addProcessLog(`Failed to complete purchases: ${error.message}`);
            console.error(`❌ PayPlus webhook: Failed to complete purchases:`, error);
            // Don't throw error - log it but continue webhook processing
          }
        }

        await webhookLog.completeProcessing(startTime, 'Payment success processing completed');

      } else if (webhookData.status === 'failed' || webhookData.status === 'declined') {
        // Handle payment failure
        webhookLog.addProcessLog(`Processing payment failure with status: ${webhookData.status}`);

        await transaction.update({
          payment_status: 'failed',
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            failedAt: new Date().toISOString(),
            failureReason: webhookData.reason || 'Payment declined'
          }
        });

        webhookLog.addProcessLog('Transaction updated to failed status');

        if (isSubscriptionTransaction) {
          // Handle subscription payment failure
          webhookLog.addProcessLog(`Processing subscription payment failure for subscription: ${subscriptionId}`);

          try {
            const subscription = await models.Subscription.findByPk(subscriptionId);
            if (!subscription) {
              throw new Error(`Subscription ${subscriptionId} not found`);
            }

            webhookLog.addProcessLog(`Found subscription: ${subscription.id}, handling payment failure`);

            // Use dedicated SubscriptionPaymentService for handling payment failure
            const SubscriptionPaymentService = (await import('../services/SubscriptionPaymentService.js')).default;
            await SubscriptionPaymentService.handlePaymentFailure(subscription, webhookData);

            webhookLog.addProcessLog(`Subscription ${subscriptionId} payment failure handled successfully`);
            console.log(`✅ PayPlus webhook: Subscription ${subscriptionId} payment failure handled`);

          } catch (error) {
            webhookLog.addProcessLog(`Failed to handle subscription payment failure: ${error.message}`);
            console.error(`❌ PayPlus webhook: Failed to handle subscription payment failure ${subscriptionId}:`, error);
          }
        } else {
          // For purchases, we mainly just mark them as failed in the transaction
          webhookLog.addProcessLog('Purchase payment failure recorded in transaction metadata');
        }

        await webhookLog.completeProcessing(startTime, 'Payment failure processing completed');
        console.log(`❌ PayPlus webhook: Payment failed for transaction ${transaction.id}`);

      } else {
        // Handle other statuses (pending, processing, etc.)
        webhookLog.addProcessLog(`Processing webhook with status: ${webhookData.status}`);

        await transaction.update({
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            lastWebhookAt: new Date().toISOString()
          }
        });

        await webhookLog.completeProcessing(startTime, `Webhook status ${webhookData.status} processed`);
        console.log(`ℹ️ PayPlus webhook: Updated transaction ${transaction.id} with status ${webhookData.status}`);
      }

      // Prepare successful response data
      const responseData = {
        message: 'PayPlus webhook processed successfully',
        timestamp: new Date().toISOString(),
        webhookId: webhookLog.id,
        transactionId: transaction.id,
        status: webhookData.status
      };

      // Update webhook log with response data
      await webhookLog.update({ response_data: responseData });

      // Always respond with success to PayPlus
      res.status(200).json(responseData);

    } catch (error) {
      console.error('❌ PayPlus webhook processing error:', error);

      const errorResponse = {
        message: 'PayPlus webhook received but processing failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        webhookId: webhookLog?.id || null
      };

      // Try to update webhook log if it exists
      try {
        if (webhookLog) {
          await webhookLog.failProcessing(startTime, error, `Webhook processing failed: ${error.message}`);
          await webhookLog.update({ response_data: errorResponse });
        }
      } catch (logError) {
        console.error('❌ Failed to update webhook log:', logError);
      }

      // Still respond with success to prevent PayPlus retries
      res.status(200).json(errorResponse);
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

// Webhook health check
router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
    supportedProviders: ['github', 'stripe', 'paypal', 'generic']
  });
});

export default router;