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
      // Check if polling is disabled
      const pollingActive = process.env.PAYMENTS_POLLING_ACTIVE === 'true';
      if (!pollingActive) {
        ludlog.payment('⚠️ SubscriptionPaymentStatusService: Polling disabled (PAYMENTS_POLLING_ACTIVE=false)', {
          pageRequestUid: pageRequestUid.substring(0, 8) + '...'
        });

        return {
          success: false,
          pageStatus: 'disabled',
          error: 'Subscription payment polling is disabled via PAYMENTS_POLLING_ACTIVE environment variable',
          shouldCancelSubscription: false, // Don't cancel when disabled
          message: 'Polling functionality is currently disabled'
        };
      }
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

      ludlog.payment('🔍 Checking subscription renewal status via PayPlus APIs', {
        subscriptionId: subscription.id,
        subscriptionUid: subscription.payplus_subscription_uid.substring(0, 8) + '...',
        attemptNumber,
        maxAttempts
      });

      // Query PayPlus ViewRecurring API for subscription details
      const subscriptionDetailsResult = await this.queryPayPlusSubscriptionDetails(subscription.payplus_subscription_uid);

      if (!subscriptionDetailsResult.success) {
        return subscriptionDetailsResult;
      }

      // Query PayPlus ViewRecurringCharge API for charge history
      const chargeHistoryResult = await this.queryPayPlusSubscriptionCharges(subscription.payplus_subscription_uid);

      if (!chargeHistoryResult.success) {
        return chargeHistoryResult;
      }

      // Analyze the subscription details and charges to find renewals
      const analysisResult = await this.analyzeSubscriptionChargesForRenewals(
        subscriptionDetailsResult.subscriptionDetails,
        chargeHistoryResult.charges,
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
   * Query PayPlus for subscription details using ViewRecurring API
   * @param {string} subscriptionUid - PayPlus subscription UID
   * @returns {Promise<Object>} Subscription details result
   */
  static async queryPayPlusSubscriptionDetails(subscriptionUid) {
    try {
      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key } = credentials;

      // Use PayPlus ViewRecurring API as per documentation
      const viewRecurringUrl = `${payplusUrl}RecurringPayments/${subscriptionUid}/ViewRecurring`;

      ludlog.payment('📡 Querying PayPlus ViewRecurring API for subscription details', {
        subscriptionUid: subscriptionUid.substring(0, 8) + '...',
        endpoint: 'ViewRecurring'
      });

      const response = await fetch(viewRecurringUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        }
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `PayPlus ViewRecurring API HTTP ${response.status}: ${response.statusText}`,
          debug_info: {
            http_status: response.status,
            response_preview: responseText.substring(0, 200),
            endpoint: 'ViewRecurring'
          }
        };
      }

      let subscriptionData;
      try {
        subscriptionData = JSON.parse(responseText);
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid PayPlus ViewRecurring API response',
          debug_info: {
            parse_error: parseError.message,
            endpoint: 'ViewRecurring'
          }
        };
      }

      ludlog.payment('📊 PayPlus ViewRecurring API result', {
        subscriptionUid: subscriptionUid.substring(0, 8) + '...',
        status: subscriptionData.status,
        nextPaymentDate: subscriptionData.next_payment_date,
        chargesCompleted: subscriptionData.recurring_settings?.charges_completed
      });

      return {
        success: true,
        subscriptionDetails: subscriptionData,
        endpoint: 'ViewRecurring'
      };

    } catch (error) {
      luderror.payment('❌ Error querying PayPlus ViewRecurring API:', error);
      return {
        success: false,
        error: error.message,
        endpoint: 'ViewRecurring'
      };
    }
  }

  /**
   * Query PayPlus for subscription charge history using ViewRecurringCharge API
   * @param {string} subscriptionUid - PayPlus subscription UID
   * @returns {Promise<Object>} Charge history result
   */
  static async queryPayPlusSubscriptionCharges(subscriptionUid) {
    try {
      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key } = credentials;

      // Use PayPlus ViewRecurringCharge API as per documentation
      const viewChargesUrl = `${payplusUrl}RecurringPayments/${subscriptionUid}/ViewRecurringCharge`;

      ludlog.payment('📡 Querying PayPlus ViewRecurringCharge API for charge history', {
        subscriptionUid: subscriptionUid.substring(0, 8) + '...',
        endpoint: 'ViewRecurringCharge'
      });

      const response = await fetch(viewChargesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        }
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `PayPlus ViewRecurringCharge API HTTP ${response.status}: ${response.statusText}`,
          debug_info: {
            http_status: response.status,
            response_preview: responseText.substring(0, 200),
            endpoint: 'ViewRecurringCharge'
          }
        };
      }

      let chargeData;
      try {
        chargeData = JSON.parse(responseText);
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid PayPlus ViewRecurringCharge API response',
          debug_info: {
            parse_error: parseError.message,
            endpoint: 'ViewRecurringCharge'
          }
        };
      }

      ludlog.payment('📊 PayPlus ViewRecurringCharge API result', {
        subscriptionUid: subscriptionUid.substring(0, 8) + '...',
        totalCharges: chargeData.total_charges,
        successfulCharges: chargeData.successful_charges,
        failedCharges: chargeData.failed_charges,
        chargesFound: Array.isArray(chargeData.charges) ? chargeData.charges.length : 0
      });

      return {
        success: true,
        chargeHistory: chargeData,
        charges: chargeData.charges || [],
        endpoint: 'ViewRecurringCharge'
      };

    } catch (error) {
      luderror.payment('❌ Error querying PayPlus ViewRecurringCharge API:', error);
      return {
        success: false,
        error: error.message,
        endpoint: 'ViewRecurringCharge'
      };
    }
  }

  /**
   * Analyze subscription charges using PayPlus ViewRecurringCharge API data
   * @param {Object} subscriptionDetails - PayPlus ViewRecurring API response
   * @param {Array} charges - PayPlus ViewRecurringCharge API charges array
   * @param {Object} subscription - Subscription record
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  static async analyzeSubscriptionChargesForRenewals(subscriptionDetails, charges, subscription, options = {}) {
    const { attemptNumber = 1, maxAttempts = 6 } = options;

    try {
      ludlog.payment('🔍 Analyzing PayPlus subscription charges for renewals', {
        subscriptionId: subscription.id,
        subscriptionStatus: subscriptionDetails.status,
        totalCharges: charges.length,
        nextPaymentDate: subscriptionDetails.next_payment_date,
        attemptNumber,
        maxAttempts
      });

      if (!Array.isArray(charges) || charges.length === 0) {
        // No charges found for this subscription
        const shouldCancel = attemptNumber >= maxAttempts;

        return {
          success: true,
          pageStatus: shouldCancel ? 'abandoned' : 'pending_processing',
          reason: shouldCancel
            ? `No charges found after ${maxAttempts} attempts`
            : `No charges found yet (attempt ${attemptNumber}/${maxAttempts})`,
          shouldCancelSubscription: shouldCancel,
          shouldRetryLater: !shouldCancel,
          isRenewalAttempt: true,
          attemptNumber,
          maxAttempts,
          subscriptionStatus: subscriptionDetails.status
        };
      }

      // Sort charges by charge_number (most recent first)
      const sortedCharges = charges.sort((a, b) => (b.charge_number || 0) - (a.charge_number || 0));

      // Get the most recent charge
      const latestCharge = sortedCharges[0];
      const transactionUid = latestCharge.transaction_uid;

      ludlog.payment('🔍 Analyzing latest subscription charge for renewal', {
        subscriptionId: subscription.id,
        chargeNumber: latestCharge.charge_number,
        transactionUid: transactionUid ? transactionUid.substring(0, 8) + '...' : null,
        chargedAt: latestCharge.charged_at,
        status: latestCharge.status,
        statusCode: latestCharge.status_code
      });

      if (!transactionUid) {
        return {
          success: true,
          pageStatus: 'pending_processing',
          reason: 'Latest charge has no transaction UID - still processing',
          shouldRetryLater: true,
          isRenewalAttempt: true,
          chargeData: latestCharge
        };
      }

      // Check if this is a new charge we haven't processed yet
      const existingTransaction = await models.Transaction.findOne({
        where: {
          payplus_transaction_uid: transactionUid
        }
      });

      if (existingTransaction) {
        // We already know about this charge - check its status
        const statusCode = latestCharge.status_code;

        if (statusCode === '000' || latestCharge.status === 'success') {
          return {
            success: true,
            pageStatus: 'payment_completed',
            reason: 'Existing renewal charge completed successfully',
            shouldActivateSubscription: true,
            transactionData: latestCharge,
            transactionUuid: transactionUid,
            isRenewalAttempt: true,
            existingTransactionId: existingTransaction.id,
            chargeNumber: latestCharge.charge_number
          };
        } else {
          return {
            success: true,
            pageStatus: 'payment_failed',
            reason: `Existing renewal charge failed: ${latestCharge.failure_reason || latestCharge.status}`,
            shouldCancelSubscription: true,
            transactionData: latestCharge,
            isRenewalAttempt: true,
            chargeNumber: latestCharge.charge_number
          };
        }
      }

      // This is a NEW charge - create a renewal transaction record
      await this.createRenewalTransactionFromCharge(subscription, latestCharge);

      // Check the payment status of this new renewal charge
      const statusCode = latestCharge.status_code;
      const { status } = latestCharge;

      if (statusCode === '000' || status === 'success') {
        return {
          success: true,
          pageStatus: 'payment_completed',
          reason: 'New renewal charge completed successfully',
          shouldActivateSubscription: true,
          transactionData: latestCharge,
          transactionUuid: transactionUid,
          isRenewalAttempt: true,
          newRenewalCreated: true,
          chargeNumber: latestCharge.charge_number
        };
      } else if (status === 'failed' || (statusCode && statusCode !== '000')) {
        return {
          success: true,
          pageStatus: 'payment_failed',
          reason: `New renewal charge failed: ${latestCharge.failure_reason || status}`,
          shouldCancelSubscription: true,
          transactionData: latestCharge,
          isRenewalAttempt: true,
          newRenewalCreated: true,
          chargeNumber: latestCharge.charge_number
        };
      } else {
        // Charge exists but status is pending
        return {
          success: true,
          pageStatus: 'pending_processing',
          reason: 'New renewal charge is still processing',
          shouldRetryLater: true,
          transactionData: latestCharge,
          isRenewalAttempt: true,
          newRenewalCreated: true,
          chargeNumber: latestCharge.charge_number
        };
      }

    } catch (error) {
      luderror.payment('❌ Error analyzing subscription charges for renewals:', error);
      return {
        success: false,
        error: error.message,
        pageStatus: 'error'
      };
    }
  }

  /**
   * Create a new Transaction record for a subscription renewal from PayPlus charge data
   * @param {Object} subscription - Subscription record
   * @param {Object} chargeData - PayPlus ViewRecurringCharge API charge data
   * @returns {Promise<Object>} Created transaction
   */
  static async createRenewalTransactionFromCharge(subscription, chargeData) {
    const { generateId } = await import('../models/baseModel.js');

    try {
      ludlog.payment('📝 Creating renewal transaction record from PayPlus charge', {
        subscriptionId: subscription.id,
        chargeId: chargeData.charge_id,
        chargeNumber: chargeData.charge_number,
        transactionUid: chargeData.transaction_uid ? chargeData.transaction_uid.substring(0, 8) + '...' : null
      });

      const newTransaction = await models.Transaction.create({
        id: generateId(),
        user_id: subscription.user_id,
        payment_method: 'payplus',
        amount: chargeData.amount || subscription.monthly_price || 0,
        currency: chargeData.currency || 'ILS',
        payment_status: chargeData.status === 'success' ? 'completed' : 'pending',
        transaction_type: 'subscription_renewal',
        payplus_transaction_uid: chargeData.transaction_uid,
        payment_page_request_uid: null, // Renewals don't have page request UIDs
        metadata: {
          subscription_id: subscription.id,
          transaction_type: 'SUBSCRIPTION_RENEWAL',
          renewal_for_subscription: subscription.id,
          payplus_subscription_uid: subscription.payplus_subscription_uid,
          charge_number: chargeData.charge_number,
          charge_id: chargeData.charge_id,
          charged_at: chargeData.charged_at,
          next_charge_date: chargeData.next_charge_date,
          failure_reason: chargeData.failure_reason,
          payplus_charge_data: chargeData,
          created_via: 'payplus_charge_polling',
          detected_at: new Date().toISOString(),
          resolvedBy: 'polling', // Track that this renewal was detected by polling
          resolvedAt: new Date().toISOString()
        }
      });

      ludlog.payment('✅ Renewal transaction created successfully from PayPlus charge', {
        newTransactionId: newTransaction.id,
        subscriptionId: subscription.id,
        chargeNumber: chargeData.charge_number,
        chargeStatus: chargeData.status
      });

      return newTransaction;

    } catch (error) {
      luderror.payment('❌ Error creating renewal transaction from charge:', error);
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

      // Use SubscriptionPaymentService for consistent resolution source tracking
      const SubscriptionPaymentService = (await import('./SubscriptionPaymentService.js')).default;
      const activationResult = await SubscriptionPaymentService.handlePaymentSuccess(subscription, transactionData, {
        resolvedBy: 'polling'
      });

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

      const { transaction } = subscription;
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
      // Check if polling is disabled
      const pollingActive = process.env.PAYMENTS_POLLING_ACTIVE === 'true';
      if (!pollingActive) {
        ludlog.payment('⚠️ SubscriptionPaymentStatusService: Polling disabled for user (PAYMENTS_POLLING_ACTIVE=false)', { userId });

        return {
          success: true,
          message: 'Subscription payment polling is disabled',
          summary: {
            total_pending: 0,
            activated: 0,
            cancelled: 0,
            errors: 0,
            skipped: 0
          },
          results: [],
          disabled: true
        };
      }

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