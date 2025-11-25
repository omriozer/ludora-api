import express from 'express';
import rateLimit from 'express-rate-limit';
import { webhookCors } from '../middleware/cors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { error as logger } from '../lib/errorLogger.js';

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
        // In development, allow unsigned webhooks with warning
        if (process.env.ENVIRONMENT === 'development') {
          return next();
        }

        return res.status(401).json({ error: 'Webhook signature required' });
      }

      // TODO: Implement actual signature verification based on provider

      next();
    } catch (error) {
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

    // TODO: Implement GitHub webhook handling
    res.status(200).json({ message: 'GitHub webhook received', event });
  })
);

// Stripe webhooks
router.post('/stripe',
  verifyWebhookSignature('stripe'),
  asyncHandler(async (req, res) => {
    const event = req.body;

    // TODO: Implement Stripe webhook handling
    res.status(200).json({ message: 'Stripe webhook received', type: event.type });
  })
);

// PayPal webhooks
router.post('/paypal',
  verifyWebhookSignature('paypal'),
  asyncHandler(async (req, res) => {
    const event = req.body;

    // TODO: Implement PayPal webhook handling
    res.status(200).json({ message: 'PayPal webhook received', type: event.event_type });
  })
);

// PayPlus webhooks
router.post('/payplus',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const webhookData = req.body;

    // Capture raw request body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Capture PayPlus signature headers
    const possibleSignatureHeaders = [
      'X-PayPlus-Signature',
      'X-PayPlus-Webhook-Signature',
      'PayPlus-Signature',
      'Signature',
      'X-Signature',
      'X-Hub-Signature',
      'X-Webhook-Signature',
      'Authorization',
      'X-PayPlus-Auth',
      'PayPlus-Auth',
      'X-PayPlus-Token',
      'PayPlus-Token'
    ];

    const signatureHeaders = {};
    possibleSignatureHeaders.forEach(header => {
      const value = req.get(header);
      if (value) {
        signatureHeaders[header.toLowerCase()] = value;
      }
    });

    // Capture comprehensive sender information for security analysis
    const senderInfo = {
      // Basic request info
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url,
      protocol: req.protocol,
      secure: req.secure,

      // Forwarding and proxy headers
      forwarded: req.get('X-Forwarded-For'),
      realIp: req.get('X-Real-IP'),
      forwardedProto: req.get('X-Forwarded-Proto'),
      forwardedHost: req.get('X-Forwarded-Host'),
      forwardedPort: req.get('X-Forwarded-Port'),

      // Content headers
      host: req.get('Host'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      contentEncoding: req.get('Content-Encoding'),
      accept: req.get('Accept'),
      acceptEncoding: req.get('Accept-Encoding'),
      acceptLanguage: req.get('Accept-Language'),

      // Timing and cache headers
      timestamp: new Date().toISOString(),
      cacheControl: req.get('Cache-Control'),
      ifModifiedSince: req.get('If-Modified-Since'),

      // PayPlus specific headers we might be missing
      payplusVersion: req.get('X-PayPlus-Version'),
      payplusEvent: req.get('X-PayPlus-Event'),
      payplusTimestamp: req.get('X-PayPlus-Timestamp'),
      payplusRequestId: req.get('X-PayPlus-Request-Id'),

      // All possible signature headers (with actual values for analysis)
      signatureHeaders: signatureHeaders,

      // Complete headers object for full analysis
      allHeaders: req.headers,

      // Request body analysis
      rawBody: rawBody,
      bodySize: Buffer.byteLength(rawBody, 'utf8'),
      bodyContentType: typeof req.body,

      // Query parameters and routing
      query: req.query,
      params: req.params,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,

      // Express.js request metadata
      fresh: req.fresh,
      stale: req.stale,
      xhr: req.xhr,

      // Network and connection info
      httpVersion: req.httpVersion,
      socket: {
        remoteAddress: req.socket?.remoteAddress,
        remotePort: req.socket?.remotePort,
        localAddress: req.socket?.localAddress,
        localPort: req.socket?.localPort
      }
    };

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

          } catch (error) {
            webhookLog.addProcessLog(`Failed to process subscription payment: ${error.message}`);
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

          } catch (error) {
            webhookLog.addProcessLog(`Failed to complete purchases: ${error.message}`);
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

          } catch (error) {
            webhookLog.addProcessLog(`Failed to handle subscription payment failure: ${error.message}`);
          }
        } else {
          // For purchases, we mainly just mark them as failed in the transaction
          webhookLog.addProcessLog('Purchase payment failure recorded in transaction metadata');
        }

        await webhookLog.completeProcessing(startTime, 'Payment failure processing completed');

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
      logger.payment('PayPlus webhook processing failed:', error.message);

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
        logger.api('Failed to log webhook error:', logError.message);
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

    // TODO: Implement generic webhook handling
    res.status(200).json({
      message: 'Generic webhook received',
      provider,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;