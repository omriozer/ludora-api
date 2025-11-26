import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import { error as logger } from '../lib/errorLogger.js';

/**
 * PayPlusPageStatusService - Handles PayPlus payment page status checking
 *
 * Distinguishes between:
 * - Payment page abandoned/closed (user never attempted payment)
 * - Payment attempted (user tried to pay, may have succeeded/failed)
 *
 * This service is used to determine if pending purchases should:
 * - Revert to 'cart' status (if page abandoned)
 * - Continue polling transaction status (if payment attempted)
 */
class PayPlusPageStatusService {

  /**
   * Check PayPlus payment page status
   * @param {string} pageRequestUid - PayPlus page request UID
   * @returns {Promise<Object>} Page status result
   */
  static async checkPaymentPageStatus(pageRequestUid) {
    try {
      console.log(`🔍 [DEBUG] Checking PayPlus page status for UID: ${pageRequestUid}`);

      // Get PayPlus credentials and call the API with enhanced debug logging
      console.log(`🔑 [DEBUG] Getting PayPlus credentials...`);
      const credentials = PaymentService.getPayPlusCredentials();
      console.log(`✅ [DEBUG] PayPlus credentials retrieved:`, {
        payplusUrl: credentials.payplusUrl,
        environment: credentials.environment,
        hasApiKey: !!credentials.payment_api_key,
        hasSecretKey: !!credentials.payment_secret_key,
        hasTerminalUid: !!credentials.terminal_uid,
        apiKeyLength: credentials.payment_api_key?.length,
        secretKeyLength: credentials.payment_secret_key?.length
      });

      const { payplusUrl, payment_api_key, payment_secret_key, terminal_uid } = credentials;
      const statusUrl = `${payplusUrl}TransactionReports/TransactionsHistory`;

      console.log(`🌐 [DEBUG] Making PayPlus API call to: ${statusUrl}`);
      console.log(`📋 [DEBUG] API request body:`, { terminal_uid, page_request_uid: pageRequestUid });

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

      console.log(`📡 [DEBUG] PayPlus API response:`, {
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        ok: statusResponse.ok,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
      });

      if (!statusResponse.ok) {
        console.log(`❌ [DEBUG] PayPlus API HTTP error ${statusResponse.status}:`, {
          status: statusResponse.status,
          statusText: statusResponse.statusText,
          response: responseText.substring(0, 500)
        });

        return {
          success: false,
          pageStatus: 'unknown',
          error: `PayPlus API HTTP ${statusResponse.status}: ${statusResponse.statusText}`,
          shouldRevertToCart: false, // Don't revert on API errors
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
        console.log(`❌ PayPlus page status invalid JSON response:`, {
          parseError: parseError.message,
          response: responseText.substring(0, 500)
        });

        return {
          success: false,
          pageStatus: 'unknown',
          error: 'Invalid PayPlus API response',
          shouldRevertToCart: false // Don't revert on API errors
        };
      }

      console.log(`📊 PayPlus transactions history response for ${pageRequestUid}:`, {
        transactionCount: statusData?.transactions?.length || 0,
        hasTransactions: !!statusData?.transactions,
        totalCount: statusData?.count
      });

      // Analyze response to determine page status
      return this.analyzeTransactionsHistoryResponse(statusData, pageRequestUid);

    } catch (error) {
      logger.payment('❌ PayPlusPageStatusService: Error checking page status:', error);

      return {
        success: false,
        pageStatus: 'error',
        error: error.message,
        shouldRevertToCart: false // Don't revert on errors
      };
    }
  }

  /**
   * Analyze PayPlus transactions history response to determine payment page status
   * @param {Object} statusData - PayPlus TransactionsHistory API response
   * @param {string} pageRequestUid - Page request UID
   * @returns {Object} Analyzed page status
   */
  static analyzeTransactionsHistoryResponse(statusData, pageRequestUid) {
    // Check if we have a valid response with transactions array
    if (!statusData || !Array.isArray(statusData.transactions)) {
      console.log(`⚠️ Invalid PayPlus transactions history response for ${pageRequestUid}`);

      return {
        success: false,
        pageStatus: 'error',
        error: 'Invalid transactions history response from PayPlus',
        shouldRevertToCart: false, // Don't revert on API errors
        payplus_response: statusData
      };
    }

    console.log(`📊 [DEBUG] Searching through ${statusData.transactions.length} transactions for page_request_uid: ${pageRequestUid}`);

    // Search for transaction with matching page_request_uid
    const matchingTransaction = statusData.transactions.find(transaction =>
      transaction.payment_page_payment_request?.uuid === pageRequestUid
    );

    if (!matchingTransaction) {
      // No transaction found = page was created but no payment attempted
      console.log(`📭 No transaction found for page_request_uid ${pageRequestUid} - page abandoned`);

      return {
        success: true,
        pageStatus: 'abandoned',
        reason: 'No transaction found for page request - payment page was not used',
        shouldRevertToCart: true,
        payplus_response: statusData
      };
    }

    // Transaction found - check payment status
    const statusCode = matchingTransaction.information?.status_code;
    const transactionUuid = matchingTransaction.uuid;

    console.log(`💳 [DEBUG] Transaction found for ${pageRequestUid}:`, {
      transactionUuid,
      statusCode,
      amount: matchingTransaction.information?.amount_by_currency,
      transactionAt: matchingTransaction.information?.transaction_at
    });

    // Check if payment was successful (status_code '000' = success)
    if (statusCode === '000') {
      console.log(`✅ Payment completed successfully for ${pageRequestUid} (transaction: ${transactionUuid})`);

      return {
        success: true,
        pageStatus: 'payment_completed',
        reason: 'Payment completed successfully',
        shouldRevertToCart: false,
        shouldCompleteTransaction: true,
        transactionData: matchingTransaction,
        transactionUuid: transactionUuid,
        statusCode: statusCode,
        payplus_response: statusData
      };
    } else {
      // Payment was attempted but not successful
      console.log(`❌ Payment failed for ${pageRequestUid} (transaction: ${transactionUuid}, status: ${statusCode})`);

      return {
        success: true,
        pageStatus: 'payment_failed',
        reason: `Payment failed with status code: ${statusCode}`,
        shouldRevertToCart: true,
        transactionData: matchingTransaction,
        transactionUuid: transactionUuid,
        statusCode: statusCode,
        payplus_response: statusData
      };
    }
  }

  /**
   * Handle abandoned payment page by reverting purchases to cart status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Revert result
   */
  static async handleAbandonedPaymentPage(transactionId) {
    try {
      console.log(`🔄 Handling abandoned payment page for transaction: ${transactionId}`);

      // Find all related purchases
      const relatedPurchases = await models.Purchase.findAll({
        where: {
          transaction_id: transactionId,
          payment_status: 'pending'
        }
      });

      console.log(`📝 Found ${relatedPurchases.length} pending purchases to revert to cart`);

      const revertedPurchases = [];
      for (const purchase of relatedPurchases) {
        await purchase.update({
          payment_status: 'cart',
          metadata: {
            ...purchase.metadata,
            reverted_to_cart_at: new Date().toISOString(),
            revert_reason: 'payplus_page_abandoned',
            original_pending_source: purchase.metadata?.pending_source
          }
        });

        revertedPurchases.push({
          purchase_id: purchase.id,
          reverted_at: new Date().toISOString()
        });

        console.log(`✅ Purchase ${purchase.id} reverted to cart status`);
      }

      return {
        success: true,
        reverted_count: revertedPurchases.length,
        reverted_purchases: revertedPurchases,
        message: `Successfully reverted ${revertedPurchases.length} purchases to cart status`
      };

    } catch (error) {
      logger.payment('❌ Error handling abandoned payment page:', error);
      throw error;
    }
  }

  /**
   * Check payment page status for a transaction and handle accordingly
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Combined page status and action result
   */
  static async checkAndHandlePaymentPageStatus(transactionId) {
    try {
      // ENHANCED DEBUG: Add detailed logging for diagnosis
      console.log(`🔍 [DEBUG] Starting payment page status check for transaction: ${transactionId}`);

      // Find transaction to get page_request_uid
      const transaction = await models.Transaction.findByPk(transactionId);
      if (!transaction) {
        const error = `Transaction ${transactionId} not found in database`;
        console.log(`❌ [DEBUG] ${error}`);
        throw new Error(error);
      }

      console.log(`✅ [DEBUG] Transaction found: ${transaction.id}, UID: ${transaction.payment_page_request_uid || 'MISSING'}`);

      if (!transaction.payment_page_request_uid) {
        const error = `No PayPlus page request UID found for transaction ${transactionId}`;
        console.log(`❌ [DEBUG] ${error}`);
        throw new Error(error);
      }

      // Check payment page status with enhanced error details
      console.log(`🔍 [DEBUG] Calling PayPlus API for UID: ${transaction.payment_page_request_uid}`);
      const pageStatusResult = await this.checkPaymentPageStatus(transaction.payment_page_request_uid);

      console.log(`📊 [DEBUG] PayPlus API result:`, {
        success: pageStatusResult.success,
        pageStatus: pageStatusResult.pageStatus,
        error: pageStatusResult.error || 'none',
        shouldRevertToCart: pageStatusResult.shouldRevertToCart,
        shouldPollTransaction: pageStatusResult.shouldPollTransaction
      });

      if (!pageStatusResult.success) {
        console.log(`❌ [DEBUG] PayPlus API check failed: ${pageStatusResult.error}`);
        return pageStatusResult;
      }

      // Handle based on page status
      if (pageStatusResult.shouldRevertToCart) {
        // Page was abandoned or payment failed - revert purchases to cart
        console.log(`🔄 [DEBUG] Page abandoned/failed - reverting to cart for transaction: ${transactionId}`);
        const revertResult = await this.handleAbandonedPaymentPage(transactionId);

        return {
          ...pageStatusResult,
          action_taken: 'reverted_to_cart',
          revert_result: revertResult
        };
      } else if (pageStatusResult.shouldCompleteTransaction) {
        // Payment was completed successfully - mark transaction as completed
        console.log(`✅ [DEBUG] Payment completed - marking transaction as completed: ${transactionId}`);
        return {
          ...pageStatusResult,
          action_taken: 'transaction_completed',
          message: 'Payment completed successfully, transaction marked as completed'
        };
      } else if (pageStatusResult.shouldPollTransaction) {
        // Payment was attempted - should continue with transaction polling
        console.log(`💳 [DEBUG] Payment attempted - should continue polling for transaction: ${transactionId}`);
        return {
          ...pageStatusResult,
          action_taken: 'continue_transaction_polling',
          message: 'Payment was attempted, continue with transaction status polling'
        };
      } else {
        // Other status - no action needed
        console.log(`ℹ️ [DEBUG] No action needed for transaction: ${transactionId}, status: ${pageStatusResult.pageStatus}`);
        return {
          ...pageStatusResult,
          action_taken: 'none',
          message: 'No action required based on page status'
        };
      }

    } catch (error) {
      // Enhanced error logging for debugging
      console.log(`💥 [DEBUG] Exception in checkAndHandlePaymentPageStatus:`, {
        transactionId,
        errorMessage: error.message,
        errorStack: error.stack?.substring(0, 500),
        errorName: error.name
      });

      logger.payment('❌ Error checking and handling payment page status:', error);
      return {
        success: false,
        error: error.message,
        action_taken: 'error',
        debug_info: {
          transaction_id: transactionId,
          error_type: error.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

export default PayPlusPageStatusService;