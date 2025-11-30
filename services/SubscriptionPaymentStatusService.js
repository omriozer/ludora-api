import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import SubscriptionService from './SubscriptionService.js';
import { luderror, ludlog } from '../lib/ludlog.js';

/**
 * SubscriptionPaymentStatusService - Handles subscription payment page status checking
 *
 * Similar to PayPlusPageStatusService but specifically for subscription payments.
 * Distinguishes between:
 * - Payment page abandoned/closed (user never attempted payment)
 * - Payment attempted (user tried to pay, may have succeeded/failed)
 *
 * This service is used to determine if pending subscriptions should:
 * - Be cancelled (if page abandoned)
 * - Continue waiting (if payment attempted)
 * - Be activated (if payment completed)
 */
class SubscriptionPaymentStatusService {

  /**
   * Check PayPlus payment page status for subscription payment
   * @param {string} pageRequestUid - PayPlus page request UID
   * @param {Object} options - Check options
   * @param {number} options.attemptNumber - Current polling attempt number
   * @param {number} options.maxAttempts - Maximum attempts before considering abandoned
   * @returns {Promise<Object>} Page status result
   */
  static async checkSubscriptionPaymentPageStatus(pageRequestUid, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;
    try {
      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key, terminal_uid } = credentials;
      const statusUrl = `${payplusUrl}TransactionReports/TransactionsHistory`;

      ludlog.payment('🔍 SubscriptionPaymentStatusService: Checking PayPlus page status for subscription payment', {
        pageRequestUid: pageRequestUid.substring(0, 8) + '...'
      });

      const statusResponse = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        },
        body: JSON.stringify({
          terminal_uid: terminal_uid,
          page_request_uid: pageRequestUid
        })
      });

      const responseText = await statusResponse.text();

      if (!statusResponse.ok) {
        return {
          success: false,
          pageStatus: 'unknown',
          error: `PayPlus API HTTP ${statusResponse.status}: ${statusResponse.statusText}`,
          shouldCancelSubscription: false, // Don't cancel on API errors
          debug_info: {
            http_status: statusResponse.status,
            response_preview: responseText.substring(0, 200)
          }
        };
      }

      let statusData;
      try {
        statusData = JSON.parse(responseText);
      } catch (parseError) {
        return {
          success: false,
          pageStatus: 'unknown',
          error: 'Invalid PayPlus API response',
          shouldCancelSubscription: false // Don't cancel on API errors
        };
      }

      // Analyze response to determine subscription page status
      return this.analyzeSubscriptionTransactionsResponse(statusData, pageRequestUid, {
        attemptNumber,
        maxAttempts
      });

    } catch (error) {
      luderror.payment('❌ SubscriptionPaymentStatusService: Error checking page status:', error);

      return {
        success: false,
        pageStatus: 'error',
        error: error.message,
        shouldCancelSubscription: false // Don't cancel on errors
      };
    }
  }

  /**
   * Analyze PayPlus transactions history response for subscription payment
   * @param {Object} statusData - PayPlus TransactionsHistory API response
   * @param {string} pageRequestUid - Page request UID
   * @param {Object} options - Analysis options
   * @param {number} options.attemptNumber - Current polling attempt number (for grace period)
   * @param {number} options.maxAttempts - Maximum attempts before considering abandoned
   * @returns {Object} Analyzed page status
   */
  static analyzeSubscriptionTransactionsResponse(statusData, pageRequestUid, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;

    // Check if we have a valid response with transactions array
    if (!statusData || !Array.isArray(statusData.transactions)) {
      return {
        success: false,
        pageStatus: 'error',
        error: 'Invalid transactions history response from PayPlus',
        shouldCancelSubscription: false, // Don't cancel on API errors
        payplus_response: statusData
      };
    }

    ludlog.payment('🔍 Analyzing PayPlus transactions response', {
      totalTransactions: statusData.transactions.length,
      attemptNumber,
      maxAttempts,
      pageRequestUid: pageRequestUid.substring(0, 8) + '...'
    });

    // Search for transaction with matching page_request_uid
    const matchingTransaction = statusData.transactions.find(transaction =>
      transaction.payment_page_payment_request?.uuid === pageRequestUid
    );

    if (!matchingTransaction) {
      // CRITICAL FIX: Don't immediately cancel - PayPlus has processing delays
      // Only cancel if we've tried multiple times and given sufficient grace period
      const shouldCancel = attemptNumber >= maxAttempts;

      ludlog.payment(shouldCancel ? '⚠️ No transaction found after max attempts' : '⏳ No transaction found yet, will retry', {
        attemptNumber,
        maxAttempts,
        willCancel: shouldCancel,
        pageRequestUid: pageRequestUid.substring(0, 8) + '...'
      });

      return {
        success: true,
        pageStatus: shouldCancel ? 'abandoned' : 'pending_processing',
        reason: shouldCancel
          ? `No transaction found after ${maxAttempts} attempts - payment page appears abandoned`
          : `No transaction found yet (attempt ${attemptNumber}/${maxAttempts}) - PayPlus may still be processing`,
        shouldCancelSubscription: shouldCancel,
        shouldRetryLater: !shouldCancel,
        attemptNumber,
        maxAttempts,
        payplus_response: statusData
      };
    }

    // Transaction found - check payment status
    const statusCode = matchingTransaction.information?.status_code;
    const transactionUuid = matchingTransaction.uuid;

    ludlog.payment('📊 Subscription transaction found', {
      transactionUuid: transactionUuid.substring(0, 8) + '...',
      statusCode
    });

    // Check if payment was successful (status_code '000' = success)
    if (statusCode === '000') {
      return {
        success: true,
        pageStatus: 'payment_completed',
        reason: 'Subscription payment completed successfully',
        shouldCancelSubscription: false,
        shouldActivateSubscription: true,
        transactionData: matchingTransaction,
        transactionUuid: transactionUuid,
        statusCode: statusCode,
        payplus_response: statusData
      };
    } else {
      // Payment was attempted but not successful
      return {
        success: true,
        pageStatus: 'payment_failed',
        reason: `Subscription payment failed with status code: ${statusCode}`,
        shouldCancelSubscription: true,
        transactionData: matchingTransaction,
        transactionUuid: transactionUuid,
        statusCode: statusCode,
        payplus_response: statusData
      };
    }
  }

  /**
   * Check for subscription renewals by querying PayPlus for all transactions related to a subscription
   * @param {Object} subscription - Subscription record with payplus_subscription_uid
   * @param {Object} options - Check options
   * @param {number} options.attemptNumber - Current polling attempt number
   * @param {number} options.maxAttempts - Maximum attempts before considering abandoned
   * @returns {Promise<Object>} Renewal status result
   */
  static async checkSubscriptionRenewalStatus(subscription, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;

    try {
      if (!subscription.payplus_subscription_uid) {
        return {
          success: false,
          error: 'No PayPlus subscription UID available for renewal detection',
          pageStatus: 'error'
        };
      }

      ludlog.payment('🔍 Checking subscription renewal status via subscription UID', {
        subscriptionId: subscription.id,
        subscriptionUid: subscription.payplus_subscription_uid.substring(0, 8) + '...',
        attemptNumber,
        maxAttempts
      });

      // Query PayPlus for all transactions related to this subscription
      const renewalStatusResult = await this.queryPayPlusForSubscriptionTransactions(subscription.payplus_subscription_uid);

      if (!renewalStatusResult.success) {
        return renewalStatusResult;
      }

      // Analyze the transactions to find renewals
      const analysisResult = await this.analyzeSubscriptionTransactionsForRenewals(
        renewalStatusResult.transactions,
        subscription,
        { attemptNumber, maxAttempts }
      );

      return analysisResult;

    } catch (error) {
      luderror.payment('❌ Error checking subscription renewal status:', error);
      return {
        success: false,
        error: error.message,
        pageStatus: 'error'
      };
    }
  }

  /**
   * Query PayPlus for all transactions related to a subscription UID
   * @param {string} subscriptionUid - PayPlus subscription UID
   * @returns {Promise<Object>} Query result with transactions
   */
  static async queryPayPlusForSubscriptionTransactions(subscriptionUid) {
    try {
      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key, terminal_uid } = credentials;

      // NOTE: This approach may need adjustment based on PayPlus API capabilities
      // If PayPlus doesn't support subscription-based queries, we may need to use a different strategy
      const statusUrl = `${payplusUrl}TransactionReports/TransactionsHistory`;

      ludlog.payment('📡 Querying PayPlus for subscription transactions', {
        subscriptionUid: subscriptionUid.substring(0, 8) + '...'
      });

      // Try to query PayPlus - this may need to be adapted based on actual PayPlus API
      // For now, we'll attempt a broader query and filter results
      const statusResponse = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        },
        body: JSON.stringify({
          terminal_uid: terminal_uid,
          // NOTE: May need to adjust this query based on PayPlus API capabilities
          // subscription_uid: subscriptionUid  // If PayPlus supports this
          // For now, we'll need to query more broadly and filter
        })
      });

      const responseText = await statusResponse.text();

      if (!statusResponse.ok) {
        return {
          success: false,
          error: `PayPlus API HTTP ${statusResponse.status}: ${statusResponse.statusText}`,
          debug_info: {
            http_status: statusResponse.status,
            response_preview: responseText.substring(0, 200)
          }
        };
      }

      let statusData;
      try {
        statusData = JSON.parse(responseText);
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid PayPlus API response for subscription query'
        };
      }

      // Filter transactions related to this subscription
      const subscriptionTransactions = (statusData.transactions || []).filter(transaction =>
        transaction.subscription_uid === subscriptionUid ||
        transaction.subscription_id === subscriptionUid ||
        (transaction.custom_fields && transaction.custom_fields.subscription_uid === subscriptionUid)
      );

      ludlog.payment('📊 PayPlus subscription query result', {
        totalTransactions: statusData.transactions ? statusData.transactions.length : 0,
        subscriptionTransactions: subscriptionTransactions.length,
        subscriptionUid: subscriptionUid.substring(0, 8) + '...'
      });

      return {
        success: true,
        transactions: subscriptionTransactions,
        allTransactions: statusData.transactions,
        queryResult: statusData
      };

    } catch (error) {
      luderror.payment('❌ Error querying PayPlus for subscription transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze subscription transactions to detect renewals
   * @param {Array} transactions - PayPlus transactions related to subscription
   * @param {Object} subscription - Subscription record
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  static async analyzeSubscriptionTransactionsForRenewals(transactions, subscription, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;

    try {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        // No transactions found for this subscription
        const shouldCancel = attemptNumber >= maxAttempts;

        return {
          success: true,
          pageStatus: shouldCancel ? 'abandoned' : 'pending_processing',
          reason: shouldCancel
            ? `No renewal transactions found after ${maxAttempts} attempts`
            : `No renewal transactions found yet (attempt ${attemptNumber}/${maxAttempts})`,
          shouldCancelSubscription: shouldCancel,
          shouldRetryLater: !shouldCancel,
          isRenewalAttempt: true,
          attemptNumber,
          maxAttempts
        };
      }

      // Sort transactions by most recent first
      const sortedTransactions = transactions.sort((a, b) =>
        new Date(b.information?.transaction_at || b.created_at || 0) -
        new Date(a.information?.transaction_at || a.created_at || 0)
      );

      // Get the most recent transaction
      const latestTransaction = sortedTransactions[0];
      const transactionUuid = latestTransaction.uuid;

      ludlog.payment('🔍 Analyzing latest subscription transaction for renewal', {
        subscriptionId: subscription.id,
        latestTransactionUuid: transactionUuid.substring(0, 8) + '...',
        transactionDate: latestTransaction.information?.transaction_at,
        statusCode: latestTransaction.information?.status_code
      });

      // Check if this is a new transaction we haven't processed yet
      const existingTransaction = await models.Transaction.findOne({
        where: {
          payplus_transaction_uid: transactionUuid
        }
      });

      if (existingTransaction) {
        // We already know about this transaction - check its status
        const statusCode = latestTransaction.information?.status_code;

        if (statusCode === '000') {
          return {
            success: true,
            pageStatus: 'payment_completed',
            reason: 'Existing renewal transaction completed successfully',
            shouldActivateSubscription: true,
            transactionData: latestTransaction,
            transactionUuid: transactionUuid,
            isRenewalAttempt: true,
            existingTransactionId: existingTransaction.id
          };
        } else {
          return {
            success: true,
            pageStatus: 'payment_failed',
            reason: `Existing renewal transaction failed with status code: ${statusCode}`,
            shouldCancelSubscription: true,
            transactionData: latestTransaction,
            isRenewalAttempt: true
          };
        }
      }

      // This is a NEW transaction - create a renewal transaction record
      await this.createRenewalTransaction(subscription, latestTransaction);

      // Check the payment status of this new renewal
      const statusCode = latestTransaction.information?.status_code;

      if (statusCode === '000') {
        return {
          success: true,
          pageStatus: 'payment_completed',
          reason: 'New renewal transaction completed successfully',
          shouldActivateSubscription: true,
          transactionData: latestTransaction,
          transactionUuid: transactionUuid,
          isRenewalAttempt: true,
          newRenewalCreated: true
        };
      } else if (statusCode && statusCode !== '000') {
        return {
          success: true,
          pageStatus: 'payment_failed',
          reason: `New renewal transaction failed with status code: ${statusCode}`,
          shouldCancelSubscription: true,
          transactionData: latestTransaction,
          isRenewalAttempt: true,
          newRenewalCreated: true
        };
      } else {
        // Transaction exists but status is pending
        return {
          success: true,
          pageStatus: 'pending_processing',
          reason: 'New renewal transaction is still processing',
          shouldRetryLater: true,
          transactionData: latestTransaction,
          isRenewalAttempt: true,
          newRenewalCreated: true
        };
      }

    } catch (error) {
      luderror.payment('❌ Error analyzing subscription transactions for renewals:', error);
      return {
        success: false,
        error: error.message,
        pageStatus: 'error'
      };
    }
  }

  /**
   * Create a new Transaction record for a subscription renewal
   * @param {Object} subscription - Subscription record
   * @param {Object} renewalTransactionData - PayPlus renewal transaction data
   * @returns {Promise<Object>} Created transaction
   */
  static async createRenewalTransaction(subscription, renewalTransactionData) {
    const { generateId } = await import('../models/baseModel.js');

    try {
      ludlog.payment('📝 Creating renewal transaction record', {
        subscriptionId: subscription.id,
        renewalTransactionUuid: renewalTransactionData.uuid.substring(0, 8) + '...'
      });

      const newTransaction = await models.Transaction.create({
        id: generateId(),
        user_id: subscription.user_id,
        payment_method: 'payplus',
        amount: renewalTransactionData.information?.amount_by_currency || subscription.amount || 0,
        currency: renewalTransactionData.information?.currency || 'ILS',
        payment_status: 'pending',
        transaction_type: 'subscription_renewal',
        payplus_transaction_uid: renewalTransactionData.uuid,
        payment_page_request_uid: renewalTransactionData.payment_page_payment_request?.uuid,
        metadata: {
          subscription_id: subscription.id,
          transaction_type: 'SUBSCRIPTION_RENEWAL',
          renewal_for_subscription: subscription.id,
          payplus_subscription_uid: subscription.payplus_subscription_uid,
          charge_number: renewalTransactionData.charge_number,
          renewal_polling_data: renewalTransactionData,
          created_via: 'polling_renewal_detection',
          detected_at: new Date().toISOString()
        }
      });

      ludlog.payment('✅ Renewal transaction created successfully', {
        newTransactionId: newTransaction.id,
        subscriptionId: subscription.id
      });

      return newTransaction;

    } catch (error) {
      luderror.payment('❌ Error creating renewal transaction:', error);
      throw error;
    }
  }

  /**
   * Handle completed subscription payment by activating the subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} transactionData - PayPlus transaction data
   * @returns {Promise<Object>} Completion result
   */
  static async handleCompletedSubscriptionPayment(subscriptionId, transactionData) {
    try {
      ludlog.payment('✅ SubscriptionPaymentStatusService: Handling completed subscription payment', {
        subscriptionId,
        transactionUuid: transactionData.uuid
      });

      // Find the subscription
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          status: 'pending'
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          }
        ]
      });

      if (!subscription) {
        throw new Error(`Pending subscription ${subscriptionId} not found`);
      }

      // Activate the subscription using SubscriptionService
      const activationResult = await SubscriptionService.activateSubscription(subscriptionId, {
        paymentMethod: 'payplus',
        transactionData: {
          payplus_transaction_uuid: transactionData.uuid,
          payplus_status_code: transactionData.information?.status_code,
          payplus_approval_number: transactionData.information?.approval_number,
          amount_paid: transactionData.information?.amount_by_currency,
          transaction_at: transactionData.information?.transaction_at,
          card_last_four: transactionData.information?.card_num,
          completed_at: new Date().toISOString(),
          completion_source: 'subscription_page_status_check'
        }
      });

      // Update the associated transaction if it exists
      const transaction = await models.Transaction.findOne({
        where: { subscription_id: subscriptionId }
      });

      if (transaction) {
        await transaction.update({
          payment_status: 'completed',
          metadata: {
            ...transaction.metadata,
            payplus_transaction_uuid: transactionData.uuid,
            payplus_approval_number: transactionData.information?.approval_number,
            completed_at: new Date().toISOString(),
            completion_source: 'subscription_page_status_check'
          },
          updated_at: new Date()
        });
      }

      return {
        success: true,
        subscription_activated: true,
        subscription_id: subscriptionId,
        activation_result: activationResult,
        transaction_completed: !!transaction,
        message: 'Subscription successfully activated via page status check'
      };

    } catch (error) {
      luderror.payment('❌ Error handling completed subscription payment:', error);
      throw error;
    }
  }

  /**
   * Handle abandoned subscription payment page by cancelling the subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Cancellation result
   */
  static async handleAbandonedSubscriptionPaymentPage(subscriptionId) {
    try {
      ludlog.payment('🚫 SubscriptionPaymentStatusService: Handling abandoned subscription payment', {
        subscriptionId
      });

      // Cancel the subscription using SubscriptionService
      const cancellationResult = await SubscriptionService.cancelSubscription(subscriptionId, {
        reason: 'payplus_page_abandoned',
        immediate: true, // Cancel immediately since no payment was attempted
        metadata: {
          cancelled_via: 'subscription_page_status_check',
          cancellation_source: 'payplus_page_abandoned',
          cancelled_at: new Date().toISOString()
        }
      });

      return {
        success: true,
        subscription_cancelled: true,
        subscription_id: subscriptionId,
        cancellation_result: cancellationResult,
        message: 'Subscription cancelled due to abandoned payment page'
      };

    } catch (error) {
      luderror.payment('❌ Error handling abandoned subscription payment page:', error);
      throw error;
    }
  }

  /**
   * Check subscription payment page status and handle accordingly
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} options - Check options
   * @param {number} options.attemptNumber - Current polling attempt number
   * @param {number} options.maxAttempts - Maximum attempts before considering abandoned
   * @returns {Promise<Object>} Combined page status and action result
   */
  static async checkAndHandleSubscriptionPaymentPageStatus(subscriptionId, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;
    try {
      // Find subscription and its transaction to get page_request_uid
      const subscription = await models.Subscription.findOne({
        where: { id: subscriptionId },
        include: [
          {
            model: models.Transaction,
            as: 'transaction',
            required: false
          }
        ]
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found in database`);
      }

      const transaction = subscription.transaction;
      if (!transaction || !transaction.payment_page_request_uid) {
        throw new Error(`No PayPlus page request UID found for subscription ${subscriptionId}`);
      }

      ludlog.payment('🔍 Checking subscription payment page status', {
        subscriptionId,
        pageRequestUid: transaction.payment_page_request_uid.substring(0, 8) + '...',
        hasSubscriptionUid: !!subscription.payplus_subscription_uid,
        attemptNumber,
        maxAttempts
      });

      // Check payment page status
      let pageStatusResult = await this.checkSubscriptionPaymentPageStatus(
        transaction.payment_page_request_uid,
        { attemptNumber, maxAttempts }
      );

      // CRITICAL FIX FOR SUBSCRIPTION RENEWALS VIA POLLING: Fallback to subscription UID lookup
      // If primary lookup failed and we have subscription UID, try renewal detection
      if (!pageStatusResult.success || (pageStatusResult.pageStatus === 'abandoned' && subscription.payplus_subscription_uid)) {
        ludlog.payment('🔄 Primary polling lookup failed, attempting subscription renewal detection', {
          subscriptionId,
          subscriptionUid: subscription.payplus_subscription_uid ? subscription.payplus_subscription_uid.substring(0, 8) + '...' : null,
          primaryResult: pageStatusResult.pageStatus
        });

        // Try subscription-based renewal detection
        const renewalResult = await this.checkSubscriptionRenewalStatus(subscription, { attemptNumber, maxAttempts });

        if (renewalResult.success) {
          ludlog.payment('✅ Renewal detection succeeded, using renewal result', {
            subscriptionId,
            renewalStatus: renewalResult.pageStatus
          });
          pageStatusResult = renewalResult;
        } else {
          ludlog.payment('⚠️ Renewal detection failed, falling back to primary result', {
            subscriptionId,
            renewalError: renewalResult.error
          });
          // Keep the original pageStatusResult if renewal detection fails
        }
      }

      if (!pageStatusResult.success) {
        return pageStatusResult;
      }

      // Handle retry scenario - don't cancel yet, just wait
      if (pageStatusResult.shouldRetryLater) {
        return {
          ...pageStatusResult,
          action_taken: 'none',
          message: 'Payment still processing - will retry later',
          subscriptionId
        };
      }

      // Handle based on page status
      if (pageStatusResult.shouldCancelSubscription) {
        // Page was abandoned or payment failed - cancel subscription
        const cancellationResult = await this.handleAbandonedSubscriptionPaymentPage(subscriptionId);

        return {
          ...pageStatusResult,
          action_taken: 'subscription_cancelled',
          cancellation_result: cancellationResult
        };
      } else if (pageStatusResult.shouldActivateSubscription) {
        // Payment was completed successfully - activate subscription
        const activationResult = await this.handleCompletedSubscriptionPayment(subscriptionId, pageStatusResult.transactionData);

        return {
          ...pageStatusResult,
          action_taken: 'subscription_activated',
          activation_result: activationResult
        };
      } else {
        // Other status - no action needed (still pending)
        return {
          ...pageStatusResult,
          action_taken: 'none',
          message: 'No action required based on subscription page status - payment still pending'
        };
      }

    } catch (error) {
      luderror.payment('❌ Error checking and handling subscription payment page status:', error);
      return {
        success: false,
        error: error.message,
        action_taken: 'error',
        debug_info: {
          subscription_id: subscriptionId,
          error_type: error.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Check payment status for all pending subscriptions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Check result with summary
   */
  static async checkUserPendingSubscriptions(userId) {
    try {
      ludlog.payment('🔍 Checking all pending subscriptions for user', { userId });

      // Find all pending subscriptions for this user
      const pendingSubscriptions = await models.Subscription.findAll({
        where: {
          user_id: userId,
          status: 'pending'
        },
        include: [
          {
            model: models.Transaction,
            as: 'transaction',
            required: false
          },
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          }
        ],
        order: [['created_at', 'DESC']]
      });

      if (pendingSubscriptions.length === 0) {
        return {
          success: true,
          message: 'No pending subscriptions found',
          summary: {
            total_pending: 0,
            activated: 0,
            cancelled: 0,
            errors: 0,
            skipped: 0
          },
          results: []
        };
      }

      const results = [];
      const maxSubscriptionsToProcess = 10; // Prevent overload
      const subscriptionsToProcess = pendingSubscriptions.slice(0, maxSubscriptionsToProcess);

      for (const subscription of subscriptionsToProcess) {
        try {
          if (!subscription.transaction?.payment_page_request_uid) {
            // No PayPlus page UID - skip this subscription
            results.push({
              subscription_id: subscription.id,
              transaction_id: subscription.transaction?.id,
              status: 'skipped',
              reason: 'No PayPlus page request UID found'
            });
            continue;
          }

          // Check subscription page status and handle accordingly
          const pageStatusResult = await this.checkAndHandleSubscriptionPaymentPageStatus(subscription.id);

          results.push({
            subscription_id: subscription.id,
            transaction_id: subscription.transaction?.id,
            page_request_uid: subscription.transaction.payment_page_request_uid,
            page_status_result: pageStatusResult
          });

        } catch (error) {
          results.push({
            subscription_id: subscription.id,
            transaction_id: subscription.transaction?.id,
            status: 'error',
            error: error.message
          });
        }
      }

      // Count actions taken
      const summary = {
        total_pending: pendingSubscriptions.length,
        activated: results.filter(r => r.page_status_result?.action_taken === 'subscription_activated').length,
        cancelled: results.filter(r => r.page_status_result?.action_taken === 'subscription_cancelled').length,
        errors: results.filter(r => r.status === 'error' || r.page_status_result?.success === false).length,
        skipped: results.filter(r => r.status === 'skipped').length
      };

      ludlog.payment('📊 Subscription status check complete', summary);

      return {
        success: true,
        message: 'Subscription payment page status checked for pending subscriptions',
        summary,
        results
      };

    } catch (error) {
      luderror.payment('❌ Error checking user pending subscriptions:', error);
      throw error;
    }
  }
}

export default SubscriptionPaymentStatusService;