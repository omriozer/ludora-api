import express from 'express';
import rateLimit from 'express-rate-limit';
import { Op } from 'sequelize';
import { webhookCors } from '../middleware/cors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import PaymentIntentService from '../services/PaymentIntentService.js';
import PaymentService from '../services/PaymentService.js';
import PaymentCompletionService from '../services/PaymentCompletionService.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

const router = express.Router();

// Helper function to map PayPlus status codes to system statuses
function mapPayPlusStatusToSystem(payplusStatusCode) {
  const statusMap = {
    '000': 'completed',    // Payment successful
    '001': 'pending',      // Payment pending
    '002': 'failed',       // Payment failed
    '003': 'cancelled',    // Payment cancelled by user
    '004': 'expired',      // Payment session expired
    '005': 'failed',       // Card declined
    '006': 'failed',       // Insufficient funds
    '007': 'failed',       // Invalid card details
    '008': 'failed',       // Processing error
    '009': 'cancelled',    // User cancelled
    '010': 'expired'       // Session timeout
  };

  console.log(`🔄 Mapping PayPlus status code "${payplusStatusCode}" to system status`);
  const systemStatus = statusMap[payplusStatusCode] || 'failed';
  console.log(`📊 PayPlus "${payplusStatusCode}" → System "${systemStatus}"`);

  return systemStatus;
}

// Helper function to extract and save customer tokens from PayPlus webhooks
async function extractAndSaveCustomerToken(payplusResponse, transaction, purchases, paymentSource, explicitUserId = null) {
  try {
    console.log(`🔑 TOKEN EXTRACTION: Starting token extraction for ${paymentSource} payment`);

    // Extract token data from PayPlus response
    const tokenData = payplusResponse.customer_token || payplusResponse.token || payplusResponse.customer?.token;
    const customerData = payplusResponse.customer || {};
    const transactionData = payplusResponse.transaction || payplusResponse;

    // Check if token data exists in the response
    if (!tokenData && !customerData.customer_uid && !transactionData.customer_uid) {
      console.log(`⚠️ TOKEN EXTRACTION: No token data found in PayPlus ${paymentSource} response`);
      return null;
    }

    // Determine user ID from multiple sources
    let userId = explicitUserId;

    if (!userId && transaction) {
      // Get userId from transaction's linked purchases
      const transactionPurchases = transaction.purchases || purchases || [];
      if (transactionPurchases.length > 0) {
        userId = transactionPurchases[0].buyer_user_id;
      }
    }

    if (!userId && purchases && purchases.length > 0) {
      // Get userId from purchases array
      userId = purchases[0].buyer_user_id;
    }

    if (!userId) {
      console.warn(`⚠️ TOKEN EXTRACTION: No user ID found for ${paymentSource} payment - cannot save token`);
      return null;
    }

    console.log(`🔑 TOKEN EXTRACTION: Processing token for user ${userId} from ${paymentSource} payment`);

    // Extract token information with multiple fallback patterns
    const extractedTokenData = {
      // Token value (required)
      token_uid: tokenData?.token_uid || tokenData?.uid || tokenData?.value || customerData.customer_uid || transactionData.customer_uid,

      // Customer identification
      customer_uid: customerData.customer_uid || customerData.uid || transactionData.customer_uid,

      // Card information
      last_four_digits: tokenData?.card_mask || tokenData?.last_four || customerData.card_mask,
      card_brand: tokenData?.card_brand || tokenData?.brand || customerData.card_brand,

      // Expiry information
      expiry_month: tokenData?.expiry_month || tokenData?.exp_month,
      expiry_year: tokenData?.expiry_year || tokenData?.exp_year,

      // Customer details
      customer_name: customerData.name || payplusResponse.customer_name,
      customer_email: customerData.email || payplusResponse.customer_email,

      // Metadata
      payment_source: paymentSource,
      original_response: payplusResponse
    };

    // Only proceed if we have at least a token identifier
    if (!extractedTokenData.token_uid && !extractedTokenData.customer_uid) {
      console.log(`⚠️ TOKEN EXTRACTION: No valid token identifier found in ${paymentSource} response`);
      console.log(`🔍 TOKEN EXTRACTION: Available data:`, JSON.stringify({
        tokenData,
        customerData: Object.keys(customerData),
        transactionData: Object.keys(transactionData)
      }, null, 2));
      return null;
    }

    console.log(`🔑 TOKEN EXTRACTION: Extracted token data:`, {
      token_uid: extractedTokenData.token_uid,
      customer_uid: extractedTokenData.customer_uid,
      user_id: userId,
      payment_source: paymentSource,
      has_card_info: !!(extractedTokenData.last_four_digits || extractedTokenData.card_brand)
    });

    // Call PaymentService to save the token
    const paymentService = new PaymentService();
    const savedToken = await paymentService.saveCustomerToken(
      userId,
      extractedTokenData,
      paymentSource
    );

    if (savedToken) {
      console.log(`✅ TOKEN EXTRACTION: Successfully saved customer token ${savedToken.id} for user ${userId}`);
      return savedToken;
    } else {
      console.warn(`⚠️ TOKEN EXTRACTION: PaymentService.saveCustomerToken returned null for user ${userId}`);
      return null;
    }

  } catch (error) {
    console.error(`❌ TOKEN EXTRACTION: Failed to extract/save customer token for ${paymentSource}:`, error.message);
    console.error(`🔍 TOKEN EXTRACTION: PayPlus response was:`, JSON.stringify(payplusResponse, null, 2));

    // Don't throw - token extraction failure shouldn't break payment processing
    return null;
  }
}

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

// PayPlus webhooks (Israeli payment gateway)
router.post('/payplus',
  asyncHandler(async (req, res) => {
    // Helper function to update webhook log status - defined outside try-catch for proper scoping
    let webhookLog = null;
    let webhookStartTime = null;

    const updateWebhookLog = async (status, data = {}, error = null) => {
      if (!webhookLog) return;
      try {
        await webhookLog.update({
          processing_status: status,
          response_data: data,
          error_message: error?.message,
          error_stack: error?.stack,
          processing_time_ms: webhookStartTime ? Date.now() - webhookStartTime : null,
          processed_at: status === 'processed' ? new Date() : null,
          updated_at: new Date()
        });
      } catch (updateErr) {
        console.error('❌ Failed to update WebhookLog:', updateErr.message);
      }
    };

    try {
      console.log(`🎯 ===== PAYPLUS WEBHOOK RECEIVED =====`);
      console.log(`📨 PayPlus webhook received at ${new Date().toISOString()}`);
      console.log('PayPlus headers:', JSON.stringify(req.headers, null, 2));
      console.log('PayPlus body:', JSON.stringify(req.body, null, 2));

      // ===== COMPREHENSIVE WEBHOOK LOGGING =====
      webhookStartTime = Date.now();
      const webhookLogId = generateId();

      // Extract PayPlus webhook data
      const {
        page_request_uid,
        transaction_uid,
        status_code,
        status_name,
        payment_page_request_uid,
        transactionUid,
        ...payplusData
      } = req.body || {};

      // Resolve final UIDs for consistent logging (will be updated after extracting transaction data)
      let finalPageRequestUid = page_request_uid || payment_page_request_uid;
      let finalTransactionUid = transaction_uid || transactionUid;

      // Create comprehensive webhook log entry
      webhookLog = await models.WebhookLog.create({
        id: webhookLogId,
        payplus_page_uid: finalPageRequestUid,
        payplus_transaction_uid: finalTransactionUid,
        http_method: req.method,
        request_headers: req.headers,
        request_body: req.body,
        user_agent: req.get('User-Agent'),
        ip_address: req.ip || req.connection.remoteAddress,
        payplus_data: payplusData,
        status_code: status_code,
        status_name: status_name,
        processing_status: 'pending',
        webhook_source: 'payplus',
        created_at: new Date(),
        updated_at: new Date()
      }).catch(err => {
        console.error('❌ Failed to create WebhookLog entry:', err.message);
        return null;
      });

      console.log(`📊 WebhookLog created with ID: ${webhookLogId}`);

      // Extract PayPlus callback data from transaction object
      const transactionData = req.body.transaction || req.body;
      const {
        payment_page_request_uid: transaction_payment_page_request_uid,
        uid: transaction_uid_from_data,
        status_code: transactionStatusCode,
        amount,
        date: payment_date
      } = transactionData;

      // Update final UIDs with transaction data if available
      finalPageRequestUid = finalPageRequestUid || transaction_payment_page_request_uid;
      finalTransactionUid = finalTransactionUid || transaction_uid_from_data;

      // Extract customer data from customer object
      const customer = req.body.customer || {};
      const {
        name: customer_name,
        email: customer_email
      } = customer;

      // finalPageRequestUid and finalTransactionUid are already declared earlier for webhook logging

      // Use the status_code from the main payload, fallback to status_code from transaction object if needed
      const finalStatusCode = status_code || transactionStatusCode;

      if (!finalPageRequestUid) {
        console.warn('PayPlus webhook missing page_request_uid');
        return res.status(400).json({ error: 'Missing page_request_uid' });
      }

      // Transaction-centric lookup (PaymentIntent architecture)
      // 1. First, try to find a Transaction record (primary PaymentIntent flow)
      console.log(`🔍 WEBHOOK DEBUG: Looking for transaction with payplus_page_uid: ${finalPageRequestUid}`);

      let transaction = await models.Transaction.findOne({
        where: {
          payplus_page_uid: finalPageRequestUid
        },
        include: [{
          model: models.Purchase,
          as: 'purchases'
        }]
      });

      console.log(`🔍 WEBHOOK DEBUG: Transaction found:`, transaction ? {
        id: transaction.id,
        status: transaction.payment_status,
        payplus_page_uid: transaction.payplus_page_uid,
        includedPurchasesCount: transaction.purchases ? transaction.purchases.length : 0
      } : 'null');

      let purchases = [];
      let isTransactionPayment = false;
      let paymentIntentService = null;

      if (transaction) {
        // Transaction-based PaymentIntent found (preferred flow)
        isTransactionPayment = true;
        purchases = transaction.purchases || [];
        paymentIntentService = new PaymentIntentService();
        console.log(`✅ WEBHOOK DEBUG: Found PaymentIntent transaction ${transaction.id} with ${purchases.length} purchases`);

        // Debug: Log all purchase details
        if (purchases.length > 0) {
          console.log(`🔍 WEBHOOK DEBUG: Purchase details:`);
          purchases.forEach((purchase, index) => {
            console.log(`  ${index + 1}. Purchase ID: ${purchase.id}, Status: ${purchase.payment_status}, User: ${purchase.buyer_user_id}, Amount: ${purchase.payment_amount}, Type: ${purchase.purchasable_type}, EntityID: ${purchase.purchasable_id}`);
          });
        } else {
          console.log(`⚠️ WEBHOOK DEBUG: No purchases found in transaction.purchases array`);
        }

        // If transaction exists but has no linked purchases, debug why
        if (purchases.length === 0) {
          console.log(`🔍 Transaction ${transaction.id} has no linked purchases, debugging...`);

          // Debug: Check if purchases exist with this transaction_id directly
          const directPurchases = await models.Purchase.findAll({
            where: {
              transaction_id: transaction.id
            }
          });
          console.log(`🔍 Direct query found ${directPurchases.length} purchases with transaction_id: ${transaction.id}`);

          if (directPurchases.length > 0) {
            directPurchases.forEach(purchase => {
              console.log(`📦 Purchase ${purchase.id}: status=${purchase.payment_status}, transaction_id=${purchase.transaction_id}`);
            });
            purchases = directPurchases;
          } else {
            // If no purchases found by transaction_id, check if purchases exist for this payment
            const allRecentPurchases = await models.Purchase.findAll({
              where: {
                created_at: {
                  [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last hour
                }
              },
              order: [['created_at', 'DESC']],
              limit: 10
            });

            console.log(`🔍 Recent purchases in last hour: ${allRecentPurchases.length}`);
            allRecentPurchases.forEach(purchase => {
              console.log(`📦 Recent purchase ${purchase.id}: user=${purchase.buyer_user_id}, status=${purchase.payment_status}, transaction_id=${purchase.transaction_id}, amount=${purchase.payment_amount}`);
            });

            // Try to find purchases that might belong to this transaction by amount matching
            const amountMatches = allRecentPurchases.filter(purchase =>
              purchase.payment_amount == amount && purchase.payment_status === 'cart'
            );

            if (amountMatches.length > 0) {
              console.log(`🎯 Found ${amountMatches.length} purchases with matching amount (${amount}) in cart status`);

              // Link these purchases to the transaction
              for (const purchase of amountMatches) {
                await purchase.update({
                  transaction_id: transaction.id,
                  updated_at: new Date()
                });
                console.log(`🔗 Linked purchase ${purchase.id} to transaction ${transaction.id}`);
              }

              purchases = amountMatches;
            } else {
              console.warn(`⚠️ No purchases found that match transaction ${transaction.id} (amount: ${amount})`);
            }
          }
        }
      } else {
        // No transaction found, try legacy purchase lookup by PayPlus metadata
        console.log('🔍 No transaction found, checking for legacy purchases by payplus_page_request_uid...');

        const legacyPurchases = await models.Purchase.findAll({
          where: {
            metadata: {
              payplus_page_request_uid: finalPageRequestUid
            }
          }
        });

        if (legacyPurchases.length > 0) {
          purchases = legacyPurchases;
          isTransactionPayment = false;
          console.log(`✅ Found ${purchases.length} legacy purchases with matching payplus_page_request_uid`);
        } else {
          console.warn(`⚠️ No transaction or legacy purchases found for page_request_uid: ${finalPageRequestUid}`);
        }
      }

      // ===== PAYMENT COMPLETION LOGIC =====
      if (transaction || purchases.length > 0) {
        console.log(`🎯 Processing payment completion for PayPlus status code: ${finalStatusCode}`);

        // Map PayPlus status code to our system status
        const systemStatus = mapPayPlusStatusToSystem(finalStatusCode);
        console.log(`📊 Mapped PayPlus status ${finalStatusCode} to system status: ${systemStatus}`);

        if (isTransactionPayment && transaction && systemStatus === 'completed') {
          // Transaction-based payment completion using shared completion service
          console.log(`🔄 Using PaymentCompletionService for transaction ${transaction.id} completion`);

          try {
            const completionService = new PaymentCompletionService();
            const completionResult = await completionService.processCompletion(
              transaction.id,
              req.body,
              'webhook'
            );

            if (completionResult.alreadyProcessed) {
              console.log(`⏩ WEBHOOK: Transaction ${transaction.id} already processed by polling`);

              // Log that we arrived second
              await updateWebhookLog('processed', {
                transaction_id: transaction.id,
                purchase_count: purchases.length,
                final_status: systemStatus,
                payplus_status_code: finalStatusCode,
                processing_method: 'PaymentCompletionService',
                race_condition_result: 'already_processed_by_polling'
              });
            } else {
              console.log(`🎉 WEBHOOK: Successfully processed completion for transaction ${transaction.id}`);

              // Log successful processing
              await updateWebhookLog('processed', {
                transaction_id: transaction.id,
                purchase_count: purchases.length,
                final_status: systemStatus,
                payplus_status_code: finalStatusCode,
                processing_method: 'PaymentCompletionService',
                race_condition_result: 'webhook_won_race',
                completion_details: completionResult.details
              });
            }

          } catch (paymentUpdateError) {
            console.error(`❌ PaymentCompletionService failed for transaction ${transaction.id}:`, paymentUpdateError);
            throw paymentUpdateError;
          }
        } else if (isTransactionPayment && transaction && systemStatus !== 'completed') {
          // Non-completed transaction status update (pending, failed, etc.)
          console.log(`🔄 Using PaymentIntentService for non-completed status update: ${systemStatus}`);

          try {
            await paymentIntentService.updatePaymentStatus(
              transaction.id,
              systemStatus,
              {
                payplus_callback_data: req.body,
                payplus_transaction_uid: finalTransactionUid,
                customer_name,
                customer_email,
                amount: parseFloat(amount) || 0,
                payment_date,
                webhook_processed_at: new Date().toISOString()
              }
            );

            console.log(`✅ PaymentIntentService updated transaction ${transaction.id} to status: ${systemStatus}`);

            // Log successful non-completion processing
            await updateWebhookLog('processed', {
              transaction_id: transaction.id,
              purchase_count: purchases.length,
              final_status: systemStatus,
              payplus_status_code: finalStatusCode,
              processing_method: 'PaymentIntentService'
            });

          } catch (paymentUpdateError) {
            console.error(`❌ PaymentIntentService failed for transaction ${transaction.id}:`, paymentUpdateError);
            throw paymentUpdateError;
          }

        } else if (purchases.length > 0) {
          // Legacy purchase-based flow or transaction without PaymentIntentService
          console.log(`🔄 Using legacy purchase update for ${purchases.length} purchases`);

          const purchaseUpdatePromises = purchases.map(async (purchase) => {
            try {
              const updatedPurchase = await purchase.update({
                payment_status: systemStatus,
                updated_at: new Date(),
                metadata: {
                  ...purchase.metadata,
                  payplus_callback_processed: true,
                  payplus_callback_data: req.body,
                  payplus_transaction_uid: finalTransactionUid,
                  customer_name,
                  customer_email,
                  webhook_processed_at: new Date().toISOString()
                }
              });

              console.log(`✅ Updated purchase ${purchase.id} to status: ${systemStatus}`);
              return updatedPurchase;

            } catch (purchaseUpdateError) {
              console.error(`❌ Failed to update purchase ${purchase.id}:`, purchaseUpdateError);
              throw purchaseUpdateError;
            }
          });

          await Promise.all(purchaseUpdatePromises);
          console.log(`✅ Successfully updated all ${purchases.length} purchases`);

          // ===== TOKEN EXTRACTION FOR SUCCESSFUL PAYMENTS =====
          if (systemStatus === 'completed') {
            await extractAndSaveCustomerToken(req.body, transaction, purchases, 'legacy_purchase');
          }

          // Log successful processing
          await updateWebhookLog('processed', {
            purchase_ids: purchases.map(p => p.id),
            purchase_count: purchases.length,
            final_status: systemStatus,
            payplus_status_code: finalStatusCode,
            processing_method: 'legacy_purchase_update'
          });

        } else {
          throw new Error('No purchases found to update, but transaction exists');
        }

        // Successful completion response
        console.log('✅ PayPlus webhook processed successfully');
        res.status(200).json({
          message: 'PayPlus webhook processed successfully',
          status: systemStatus,
          processed: true,
          transaction_id: transaction?.id,
          purchase_count: purchases.length,
          webhook_log_id: webhookLog?.id
        });

      } else {
        // No matching transaction or purchases found
        console.warn(`⚠️ No transaction or purchases found for PayPlus webhook with page_request_uid: ${finalPageRequestUid}`);

        await updateWebhookLog('failed', {
          error_type: 'no_matching_payment_found',
          searched_page_request_uid: finalPageRequestUid
        }, new Error('No matching transaction or purchases found'));

        res.status(400).json({
          error: 'No matching payment found for this webhook',
          page_request_uid: finalPageRequestUid,
          processed: false
        });
      }

    } catch (error) {
      console.error('🚨 ===== PAYPLUS WEBHOOK FAILED =====');
      console.error('❌ PayPlus webhook processing failed:', error);
      console.error('📥 Request body was:', JSON.stringify(req.body, null, 2));
      console.error('📋 Request headers were:', JSON.stringify(req.headers, null, 2));

      // Log comprehensive error details
      await updateWebhookLog('failed', {
        error_details: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          request_body: req.body,
          request_headers: req.headers
        }
      }, error);

      res.status(200).json({
        message: 'PayPlus webhook received but processing failed',
        error: error.message,
        processed: false
      });
    }
  })
);

// PayPlus subscription webhooks (separate from regular payments)
router.post('/payplus-subscription',
  asyncHandler(async (req, res) => {
    // Helper function to update webhook log status - defined outside try-catch for proper scoping
    let webhookLog = null;
    let webhookStartTime = null;

    const updateWebhookLog = async (status, data = {}, error = null) => {
      if (!webhookLog) return;
      try {
        await webhookLog.update({
          processing_status: status,
          response_data: data,
          error_message: error?.message,
          error_stack: error?.stack,
          processing_time_ms: webhookStartTime ? Date.now() - webhookStartTime : null,
          processed_at: status === 'processed' ? new Date() : null,
          updated_at: new Date()
        });
      } catch (updateErr) {
        console.error('❌ Failed to update subscription WebhookLog:', updateErr.message);
      }
    };

    try {
      console.log(`🔔 ===== PAYPLUS SUBSCRIPTION WEBHOOK RECEIVED =====`);
      console.log(`📨 PayPlus subscription webhook received at ${new Date().toISOString()}`);
      console.log('PayPlus subscription headers:', JSON.stringify(req.headers, null, 2));
      console.log('PayPlus subscription body:', JSON.stringify(req.body, null, 2));

      // ===== COMPREHENSIVE WEBHOOK LOGGING FOR SUBSCRIPTIONS =====
      webhookStartTime = Date.now();
      const webhookLogId = generateId();

      // Extract subscription callback data with fallbacks for field variations
      const {
        subscription_uid,
        subscriptionUid,
        page_request_uid,
        status,
        status_code,
        statusCode,
        plan_id,
        planId,
        user_id,
        userId,
        amount,
        next_payment_date,
        customer_email,
        customer_name,
        ...subscriptionData
      } = req.body || {};

      // Resolve final values with fallbacks (similar to transactional webhook)
      const finalSubscriptionUid = subscription_uid || subscriptionUid || page_request_uid;
      const finalUserId = user_id || userId;
      const finalPlanId = plan_id || planId;
      const finalStatusCode = status_code || statusCode;
      const finalStatus = status || 'unknown';

      console.log(`🔍 SUBSCRIPTION WEBHOOK DEBUG: Resolved values:`, {
        finalSubscriptionUid,
        finalUserId,
        finalPlanId,
        finalStatus,
        finalStatusCode
      });

      // Create comprehensive webhook log entry for subscription
      webhookLog = await models.WebhookLog.create({
        id: webhookLogId,
        payplus_page_uid: finalSubscriptionUid, // Using subscription UID in the page UID field
        payplus_transaction_uid: finalSubscriptionUid, // Store subscription UID here too
        http_method: req.method,
        request_headers: req.headers,
        request_body: req.body,
        user_agent: req.get('User-Agent'),
        ip_address: req.ip || req.connection.remoteAddress,
        payplus_data: subscriptionData,
        status_code: finalStatusCode,
        status_name: finalStatus,
        processing_status: 'pending',
        webhook_source: 'payplus-subscription',
        created_at: new Date(),
        updated_at: new Date()
      }).catch(err => {
        console.error('❌ Failed to create subscription WebhookLog entry:', err.message);
        return null;
      });

      console.log(`📊 Subscription WebhookLog created with ID: ${webhookLogId}`);

      if (!finalSubscriptionUid) {
        console.warn('PayPlus subscription webhook missing subscription_uid');
        await updateWebhookLog('failed', {
          error_type: 'missing_subscription_uid',
          received_fields: Object.keys(req.body || {})
        }, new Error('Missing subscription_uid'));

        return res.status(400).json({ error: 'Missing subscription_uid' });
      }

      console.log(`🔍 Processing subscription callback for UID: ${finalSubscriptionUid}, Status: ${finalStatus}`);

      // Import SubscriptionService dynamically to avoid circular imports
      const SubscriptionService = (await import('../services/SubscriptionService.js')).default;

      // Process the subscription callback
      const result = await SubscriptionService.handlePayplusSubscriptionCallback({
        subscriptionId: finalSubscriptionUid,
        status: finalStatus,
        planId: finalPlanId,
        userId: finalUserId,
        payerEmail: customer_email,
        customerName: customer_name,
        amount: parseFloat(amount) || 0,
        nextPaymentDate: next_payment_date,
        callbackData: req.body
      });

      console.log('✅ PayPlus subscription webhook processed successfully:', result);

      // ===== TOKEN EXTRACTION FOR SUCCESSFUL SUBSCRIPTIONS =====
      if (finalStatus === 'completed' || finalStatus === 'active' || finalStatusCode === '000') {
        await extractAndSaveCustomerToken(req.body, null, [], 'subscription', finalUserId);
      }

      // Log successful processing
      await updateWebhookLog('processed', {
        subscription_uid: finalSubscriptionUid,
        user_id: finalUserId,
        plan_id: finalPlanId,
        final_status: finalStatus,
        result_data: result.data,
        processing_method: 'SubscriptionService'
      });

      res.status(200).json({
        message: 'PayPlus subscription webhook processed successfully',
        subscription_uid: finalSubscriptionUid,
        status: finalStatus,
        processed: true,
        result: result.data,
        webhook_log_id: webhookLog?.id
      });

    } catch (error) {
      console.error('🚨 ===== PAYPLUS SUBSCRIPTION WEBHOOK FAILED =====');
      console.error('❌ PayPlus subscription webhook processing failed:', error);
      console.error('📥 Request body was:', JSON.stringify(req.body, null, 2));
      console.error('📋 Request headers were:', JSON.stringify(req.headers, null, 2));

      // Log comprehensive error details
      await updateWebhookLog('failed', {
        error_details: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          request_body: req.body,
          request_headers: req.headers
        }
      }, error);

      res.status(200).json({
        message: 'PayPlus subscription webhook received but processing failed',
        error: error.message,
        processed: false,
        webhook_log_id: webhookLog?.id
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