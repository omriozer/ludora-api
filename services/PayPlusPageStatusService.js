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
        apiKeyLength: credentials.payment_api_key?.length,
        secretKeyLength: credentials.payment_secret_key?.length
      });

      const { payplusUrl, payment_api_key, payment_secret_key } = credentials;
      const statusUrl = `${payplusUrl}Transactions/PaymentData`;

      console.log(`🌐 [DEBUG] Making PayPlus API call to: ${statusUrl}`);
      console.log(`📋 [DEBUG] API request body:`, { page_request_uid: pageRequestUid });

      const statusResponse = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        },
        body: JSON.stringify({
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

      console.log(`📊 PayPlus page status response for ${pageRequestUid}:`, {
        resultsStatus: statusData?.results?.status,
        hasTransactionData: !!statusData?.data?.transaction,
        transactionStatus: statusData?.data?.transaction?.status_code
      });

      // Analyze response to determine page status
      return this.analyzePageStatusResponse(statusData, pageRequestUid);

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
   * Analyze PayPlus API response to determine payment page status
   * @param {Object} statusData - PayPlus API response
   * @param {string} pageRequestUid - Page request UID
   * @returns {Object} Analyzed page status
   */
  static analyzePageStatusResponse(statusData, pageRequestUid) {
    // FIXED BUG: Check if PayPlus API call failed completely (not about payment status)
    // Only treat as abandoned if there's an actual API error, not a payment status
    if (!statusData || statusData?.results?.status === 'error' || statusData?.results?.status === 'failure') {
      // PayPlus API returned error - might mean page was never used
      console.log(`⚠️ PayPlus API returned error for ${pageRequestUid}: ${statusData?.results?.message}`);

      return {
        success: true,
        pageStatus: 'abandoned',
        reason: 'PayPlus API returned error - likely page never accessed or abandoned',
        shouldRevertToCart: true,
        payplus_response: statusData
      };
    }

    // TODO remove debug - fix payplus payment completion
    console.log(`📊 [DEBUG] PayPlus API response analysis for ${pageRequestUid}:`, {
      resultsStatus: statusData?.results?.status,
      hasResults: !!statusData?.results,
      hasData: !!statusData?.data,
      hasTransaction: !!statusData?.data?.transaction,
      transactionStatus: statusData?.data?.transaction?.status_code,
      fullResponse: JSON.stringify(statusData).substring(0, 500)
    });

    // Check if transaction data exists
    const transactionData = statusData?.data?.transaction;
    if (!transactionData) {
      // No transaction data = page was created but no payment attempted
      console.log(`📭 No transaction data for ${pageRequestUid} - page abandoned`);

      return {
        success: true,
        pageStatus: 'abandoned',
        reason: 'No transaction data found - payment page was not used',
        shouldRevertToCart: true,
        payplus_response: statusData
      };
    }

    // Transaction data exists = payment was attempted
    console.log(`💳 Transaction data found for ${pageRequestUid} - payment was attempted`);

    return {
      success: true,
      pageStatus: 'payment_attempted',
      reason: 'Transaction data found - payment was attempted',
      shouldRevertToCart: false,
      shouldPollTransaction: true, // Should continue with transaction status polling
      transactionData: transactionData,
      payplus_response: statusData
    };
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
        // Page was abandoned - revert purchases to cart
        console.log(`🔄 [DEBUG] Page abandoned - reverting to cart for transaction: ${transactionId}`);
        const revertResult = await this.handleAbandonedPaymentPage(transactionId);

        return {
          ...pageStatusResult,
          action_taken: 'reverted_to_cart',
          revert_result: revertResult
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