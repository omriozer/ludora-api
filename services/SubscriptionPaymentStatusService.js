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
   * @returns {Promise<Object>} Page status result
   */
  static async checkSubscriptionPaymentPageStatus(pageRequestUid) {
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
      return this.analyzeSubscriptionTransactionsResponse(statusData, pageRequestUid);

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
   * @returns {Object} Analyzed page status
   */
  static analyzeSubscriptionTransactionsResponse(statusData, pageRequestUid) {
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

    // Search for transaction with matching page_request_uid
    const matchingTransaction = statusData.transactions.find(transaction =>
      transaction.payment_page_payment_request?.uuid === pageRequestUid
    );

    if (!matchingTransaction) {
      // No transaction found = page was created but no payment attempted
      return {
        success: true,
        pageStatus: 'abandoned',
        reason: 'No transaction found for page request - subscription payment page was not used',
        shouldCancelSubscription: true,
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
      const subscription = await models.SubscriptionHistory.findOne({
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
   * @returns {Promise<Object>} Combined page status and action result
   */
  static async checkAndHandleSubscriptionPaymentPageStatus(subscriptionId) {
    try {
      // Find subscription and its transaction to get page_request_uid
      const subscription = await models.SubscriptionHistory.findOne({
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
        pageRequestUid: transaction.payment_page_request_uid.substring(0, 8) + '...'
      });

      // Check payment page status
      const pageStatusResult = await this.checkSubscriptionPaymentPageStatus(transaction.payment_page_request_uid);

      if (!pageStatusResult.success) {
        return pageStatusResult;
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
      const pendingSubscriptions = await models.SubscriptionHistory.findAll({
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