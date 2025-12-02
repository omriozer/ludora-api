import express from 'express';
import rateLimit from 'express-rate-limit';
import { webhookCors } from '../middleware/cors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import {
  PAYPLUS_STATUS_CODES,
  PAYMENT_STATUSES,
  TRANSACTION_TYPES,
  mapPayPlusStatusToPaymentStatus
} from '../constants/payplus.js';
import { validateWebhookSignature } from '../utils/payplusSignature.js';
import { luderror } from '../lib/ludlog.js';

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

    // Check if webhooks are active (always log regardless of flag)
    const webhooksActive = process.env.PAYMENTS_WEBHOOK_ACTIVE === 'true';


    // Capture raw request body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Capture PayPlus signature headers
    const possibleSignatureHeaders = [
      'hash',                        // PayPlus actual signature header
      'Hash',
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
        payment_page_request_uid: webhookData.transaction?.payment_page_request_uid,
        payplus_transaction_uid: webhookData.transaction_uid,
        created_at: new Date(),
        updated_at: new Date()
      });

      webhookLog.addProcessLog('Webhook received and logged');
      webhookLog.addProcessLog(`Sender IP: ${senderInfo.ip}, User-Agent: ${senderInfo.userAgent}`);
      webhookLog.addProcessLog(`Webhooks active: ${webhooksActive}`);

      // Check if webhooks are disabled - always log but skip processing
      if (!webhooksActive) {
        await webhookLog.updateStatus('ignored', 'Webhook processing disabled via PAYMENTS_WEBHOOK_ACTIVE=false');

        const responseData = {
          message: 'PayPlus webhook received and logged but processing is disabled',
          status: 'ignored',
          reason: 'PAYMENTS_WEBHOOK_ACTIVE environment variable is set to false',
          timestamp: new Date().toISOString(),
          webhookId: webhookLog.id
        };

        await webhookLog.update({ response_data: responseData });

        // Always respond with success to PayPlus to prevent retries
        return res.status(200).json(responseData);
      }

      await webhookLog.updateStatus('processing', 'Starting webhook processing');

      // CRITICAL SECURITY: Verify PayPlus webhook signature before processing
      // This prevents payment fraud by ensuring webhooks come from PayPlus
      // PayPlus sends signature in 'hash' header (as seen in successful webhook logs)
      const signatureValid = validateWebhookSignature(req, [
        'hash',
        'x-payplus-signature',
        'payplus-signature',
        'x-signature',
        'signature'
      ]);

      if (!signatureValid) {
        // Log security failure for monitoring
        await webhookLog.updateStatus('failed', 'Invalid or missing webhook signature');
        await webhookLog.update({
          security_check: 'failed',
          security_reason: 'Invalid webhook signature',
          response_data: {
            error: 'Unauthorized',
            message: 'Invalid webhook signature',
            webhookId: webhookLog.id,
            timestamp: new Date().toISOString()
          }
        });

        // Return 401 to reject forged webhooks
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
          webhookId: webhookLog.id
        });
      }

      // Signature verified successfully
      await webhookLog.update({ security_check: 'passed' });
      webhookLog.addProcessLog('PayPlus webhook signature verified successfully');

      // Import services dynamically to avoid circular dependencies
      const PaymentService = (await import('../services/PaymentService.js')).default;
      const SubscriptionService = (await import('../services/SubscriptionService.js')).default;
      const PaymentTokenService = (await import('../services/PaymentTokenService.js')).default;

      // Handle first payments vs recurring charges according to PayPlus specifications
      let transaction = null;

      if (webhookData.transaction?.payment_page_request_uid) {
        // FIRST PAYMENT: Has payment_page_request_uid
        webhookLog.addProcessLog(`Processing FIRST PAYMENT webhook for payment_page_request_uid: ${webhookData.transaction.payment_page_request_uid}`);

        transaction = await models.Transaction.findOne({
          where: {
            payment_page_request_uid: webhookData.transaction.payment_page_request_uid
          },
          include: [
            {
              model: models.Purchase,
              as: 'purchases'
            }
          ]
        });
      }

      // RECURRING CHARGES: Use subscription_uid according to PayPlus specs
      if (!transaction && webhookData.subscription_uid) {
        webhookLog.addProcessLog(`Processing RECURRING CHARGE webhook for subscription_uid: ${webhookData.subscription_uid}`);

        // Look for subscription with matching subscription_uid
        const subscription = await models.Subscription.findOne({
          where: {
            payplus_subscription_uid: webhookData.subscription_uid
          }
        });

        if (subscription) {
          webhookLog.addProcessLog(`Found subscription: ${subscription.id} with subscription_uid: ${webhookData.subscription_uid}`);

          // Find the most recent transaction for this subscription
          transaction = await models.Transaction.findOne({
            where: {
              'metadata.subscription_id': subscription.id
            },
            order: [['created_at', 'DESC']],
            include: [
              {
                model: models.Purchase,
                as: 'purchases'
              }
            ]
          });

          if (transaction) {
            webhookLog.addProcessLog(`Found renewal transaction: ${transaction.id} for subscription: ${subscription.id}`);

            // Create a new transaction for this renewal if this is a different charge
            if (transaction.payplus_transaction_uid !== webhookData.transaction_uid) {
              webhookLog.addProcessLog(`Creating new renewal transaction for transaction_uid: ${webhookData.transaction_uid}`);

              const newTransaction = await models.Transaction.create({
                id: generateId(),
                user_id: subscription.user_id,
                payment_method: 'payplus',
                amount: webhookData.transaction.amount || transaction.amount,
                currency: webhookData.transaction.currency || transaction.currency || 'ILS',
                payment_status: 'pending',
                transaction_type: 'subscription_renewal',
                payplus_transaction_uid: webhookData.transaction_uid,
                payment_page_request_uid: webhookData.transaction.payment_page_request_uid,
                metadata: {
                  subscription_id: subscription.id,
                  transaction_type: 'SUBSCRIPTION_RENEWAL',
                  renewal_for_subscription: subscription.id,
                  original_transaction_id: transaction.id,
                  payplus_subscription_uid: webhookData.subscription_uid,
                  charge_number: webhookData.charge_number,
                  renewal_webhook_data: webhookData,
                  created_via: 'webhook_renewal_detection',
                  detected_at: new Date().toISOString(),
                  resolvedBy: 'webhook', // Track that this renewal was detected by webhook
                  resolvedAt: new Date().toISOString()
                }
              });

              // Update webhook log with new transaction
              await webhookLog.update({ transaction_id: newTransaction.id });
              transaction = newTransaction;

              webhookLog.addProcessLog(`Created renewal transaction: ${newTransaction.id}`);
            }
          }
        }
      }

      if (!transaction) {
        const errorMessage = webhookData.subscription_uid
          ? `No transaction or subscription found for payment_page_request_uid: ${webhookData.transaction.payment_page_request_uid} or subscription_uid: ${webhookData.subscription_uid}`
          : `No transaction found for payment_page_request_uid: ${webhookData.transaction.payment_page_request_uid}`;
        throw new Error(errorMessage);
      }

      webhookLog.addProcessLog(`Found transaction: ${transaction.id}`);
      await webhookLog.update({ transaction_id: transaction.id });

      // Detect if this is a subscription or purchase transaction
      const isSubscriptionTransaction = !!(transaction.metadata?.subscription_id ||
        transaction.metadata?.transaction_type === TRANSACTION_TYPES.SUBSCRIPTION_PAYMENT ||
        transaction.metadata?.transaction_type === TRANSACTION_TYPES.SUBSCRIPTION_RETRY);
      const subscriptionId = transaction.metadata?.subscription_id;

      webhookLog.addProcessLog(`Transaction type detected: ${isSubscriptionTransaction ? 'subscription' : 'purchase'}`);
      if (subscriptionId) {
        webhookLog.addProcessLog(`Subscription ID: ${subscriptionId}`);
        await webhookLog.update({ subscription_id: subscriptionId });
      }

      // ENHANCED LOGGING: Capture PayPlus subscription webhook structure for analysis
      // This helps us understand recurring payment webhook payloads vs first payment
      if (isSubscriptionTransaction) {
        const ludlog = (await import('../lib/ludlog.js')).ludlog;
        ludlog.payments.prod('📊 SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS:', {
          webhookId: webhookLog.id,
          subscriptionId,
          analysis: {
            hasSubscriptionUid: !!webhookData.subscription_uid,
            subscriptionUid: webhookData.subscription_uid,
            hasCustomFields: !!webhookData.custom_fields,
            customFields: webhookData.custom_fields,
            hasTransactionUid: !!webhookData.transaction_uid,
            transactionUid: webhookData.transaction_uid,
            hasPaymentPageRequestUid: !!webhookData.transaction?.payment_page_request_uid,
            paymentPageRequestUid: webhookData.transaction?.payment_page_request_uid,
            statusCode: webhookData.transaction?.status_code,
            status: webhookData.status,
            webhookType: webhookData.type || 'unknown',
            recurringInfo: webhookData.recurring_info || null,
            chargeNumber: webhookData.charge_number || null
          },
          fullWebhookData: webhookData,
          timestamp: new Date().toISOString()
        });
      }

      // Process based on webhook status - PayPlus sends status_code in transaction object
      const paymentStatus = webhookData.status || mapPayPlusStatusToPaymentStatus(webhookData.transaction?.status_code);
      webhookLog.addProcessLog(`Payment status resolved: ${paymentStatus} (original: status=${webhookData.status}, status_code=${webhookData.transaction?.status_code})`);

      if (paymentStatus === PAYMENT_STATUSES.SUCCESS || paymentStatus === PAYMENT_STATUSES.APPROVED) {
        // Update transaction status first
        await transaction.update({
          payment_status: 'completed',
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            completedAt: new Date().toISOString(),
            resolvedBy: 'webhook', // Track that this payment was resolved by webhook
            resolvedAt: new Date().toISOString()
          }
        });

        webhookLog.addProcessLog('Transaction updated to completed status');

        // AUTOMATIC TOKEN CAPTURE: Extract and save payment token WITHOUT user permission
        // This enables one-click purchasing for future transactions
        let capturedPaymentMethod = null;
        try {
          // Get the user ID from the transaction
          const buyerUserId = transaction.user_id;

          if (buyerUserId) {
            webhookLog.addProcessLog('🔍 Attempting to extract payment token from webhook...');

            // Automatically extract and save token (NO user permission required)
            capturedPaymentMethod = await PaymentTokenService.extractAndSaveToken(
              webhookData,
              buyerUserId,
              null // No database transaction needed here as this is additive
            );

            if (capturedPaymentMethod) {
              webhookLog.addProcessLog(`💳 Payment method saved automatically: ${capturedPaymentMethod.getDisplayName()} (${capturedPaymentMethod.getMaskedToken()})`);

              // Link this transaction to the payment method for tracking
              await transaction.update({
                payment_method_id: capturedPaymentMethod.id,
                metadata: {
                  ...transaction.metadata,
                  payment_method_saved: true,
                  payment_method_id: capturedPaymentMethod.id,
                  token_capture_source: 'webhook'
                }
              });

              // TODO: implement notifying user about new payment method
              // This should send an email/notification that a payment method was saved
              // for their convenience on future purchases

            } else {
              webhookLog.addProcessLog('ℹ️ No payment token found in webhook data');
            }
          } else {
            webhookLog.addProcessLog('⚠️ No user ID found for token capture');
          }
        } catch (tokenError) {
          webhookLog.addProcessLog(`❌ Token capture failed: ${tokenError.message}`);
          // Don't fail the webhook processing if token capture fails
        }

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
            await SubscriptionPaymentService.handlePaymentSuccess(subscription, webhookData, { resolvedBy: 'webhook' });

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

      } else if (paymentStatus === PAYMENT_STATUSES.FAILED || paymentStatus === PAYMENT_STATUSES.DECLINED || (webhookData.transaction?.status_code && webhookData.transaction.status_code !== PAYPLUS_STATUS_CODES.SUCCESS)) {
        // Handle payment failure
        webhookLog.addProcessLog(`Processing payment failure with status: ${paymentStatus} (status_code: ${webhookData.transaction?.status_code})`);

        const failureReason = webhookData.reason || webhookData.transaction?.reason || `PayPlus status code: ${webhookData.transaction?.status_code}` || 'Payment declined';

        await transaction.update({
          payment_status: 'failed',
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            failedAt: new Date().toISOString(),
            failureReason: failureReason
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
        webhookLog.addProcessLog(`Processing webhook with status: ${paymentStatus} (status_code: ${webhookData.transaction?.status_code})`);

        await transaction.update({
          metadata: {
            ...transaction.metadata,
            payplusWebhookData: webhookData,
            payplus_transaction_uid: webhookData.transaction_uid,
            lastWebhookAt: new Date().toISOString()
          }
        });

        await webhookLog.completeProcessing(startTime, `Webhook status ${paymentStatus} processed`);
      }

      // Prepare successful response data
      const responseData = {
        message: 'PayPlus webhook processed successfully',
        timestamp: new Date().toISOString(),
        webhookId: webhookLog.id,
        transactionId: transaction.id,
        status: paymentStatus
      };

      // Update webhook log with response data
      await webhookLog.update({ response_data: responseData });

      // Always respond with success to PayPlus
      res.status(200).json(responseData);

    } catch (error) {
      luderror.payment('PayPlus webhook processing failed:', error.message);

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
        luderror.api('Failed to log webhook error:', logError.message);
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