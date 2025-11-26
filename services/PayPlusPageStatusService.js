import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import { luderror } from '../lib/ludlog.js';

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
      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key, terminal_uid } = credentials;
      const statusUrl = `${payplusUrl}TransactionReports/TransactionsHistory`;

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
        return {
          success: false,
          pageStatus: 'unknown',
          error: 'Invalid PayPlus API response',
          shouldRevertToCart: false // Don't revert on API errors
        };
      }

      // Analyze response to determine page status
      return this.analyzeTransactionsHistoryResponse(statusData, pageRequestUid);

    } catch (error) {
      luderror.payment('❌ PayPlusPageStatusService: Error checking page status:', error);

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
      return {
        success: false,
        pageStatus: 'error',
        error: 'Invalid transactions history response from PayPlus',
        shouldRevertToCart: false, // Don't revert on API errors
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
        reason: 'No transaction found for page request - payment page was not used',
        shouldRevertToCart: true,
        payplus_response: statusData
      };
    }

    // Transaction found - check payment status
    const statusCode = matchingTransaction.information?.status_code;
    const transactionUuid = matchingTransaction.uuid;

    // Check if payment was successful (status_code '000' = success)
    if (statusCode === '000') {
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
   * Handle completed payment by updating purchases and transaction to completed status
   * @param {string} transactionId - Transaction ID
   * @param {Object} transactionData - PayPlus transaction data
   * @returns {Promise<Object>} Completion result
   */
  static async handleCompletedPayment(transactionId, transactionData) {
    try {
      // Find all related pending purchases
      const relatedPurchases = await models.Purchase.findAll({
        where: {
          transaction_id: transactionId,
          payment_status: 'pending'
        }
      });

      const completedPurchases = [];
      for (const purchase of relatedPurchases) {
        // Use PaymentService to complete each purchase
        const completedPurchase = await PaymentService.completePurchase(purchase.id, {
          paymentMethod: 'payplus',
          transactionData: {
            payplus_transaction_uuid: transactionData.uuid,
            payplus_status_code: transactionData.information?.status_code,
            payplus_approval_number: transactionData.information?.approval_number,
            amount_paid: transactionData.information?.amount_by_currency,
            transaction_at: transactionData.information?.transaction_at,
            card_last_four: transactionData.information?.card_num,
            completed_at: new Date().toISOString(),
            completion_source: 'payplus_page_status_check'
          }
        });

        completedPurchases.push({
          purchase_id: completedPurchase.id,
          completed_at: new Date().toISOString(),
          amount: transactionData.information?.amount_by_currency
        });
      }

      // Get the current transaction to preserve existing metadata
      const currentTransaction = await models.Transaction.findByPk(transactionId);

      // Update transaction status to completed
      await models.Transaction.update(
        {
          payment_status: 'completed',
          metadata: {
            ...(currentTransaction?.metadata || {}),
            payplus_transaction_uuid: transactionData.uuid,
            payplus_approval_number: transactionData.information?.approval_number,
            completed_at: new Date().toISOString(),
            completion_source: 'payplus_page_status_check'
          },
          updated_at: new Date()
        },
        {
          where: { id: transactionId }
        }
      );

      return {
        success: true,
        completed_count: completedPurchases.length,
        completed_purchases: completedPurchases,
        transaction_completed: true,
        message: `Successfully completed ${completedPurchases.length} purchases and updated transaction status`
      };

    } catch (error) {
      luderror.payment('❌ Error handling completed payment:', error);
      throw error;
    }
  }

  /**
   * Handle abandoned payment page by reverting purchases to cart status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Revert result
   */
  static async handleAbandonedPaymentPage(transactionId) {
    try {
      // Find all related purchases
      const relatedPurchases = await models.Purchase.findAll({
        where: {
          transaction_id: transactionId,
          payment_status: 'pending'
        }
      });

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
      }

      return {
        success: true,
        reverted_count: revertedPurchases.length,
        reverted_purchases: revertedPurchases,
        message: `Successfully reverted ${revertedPurchases.length} purchases to cart status`
      };

    } catch (error) {
      luderror.payment('❌ Error handling abandoned payment page:', error);
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
      // Find transaction to get page_request_uid
      const transaction = await models.Transaction.findByPk(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found in database`);
      }

      if (!transaction.payment_page_request_uid) {
        throw new Error(`No PayPlus page request UID found for transaction ${transactionId}`);
      }

      // Check payment page status
      const pageStatusResult = await this.checkPaymentPageStatus(transaction.payment_page_request_uid);

      if (!pageStatusResult.success) {
        return pageStatusResult;
      }

      // Handle based on page status
      if (pageStatusResult.shouldRevertToCart) {
        // Page was abandoned or payment failed - revert purchases to cart
        const revertResult = await this.handleAbandonedPaymentPage(transactionId);

        return {
          ...pageStatusResult,
          action_taken: 'reverted_to_cart',
          revert_result: revertResult
        };
      } else if (pageStatusResult.shouldCompleteTransaction) {
        // Payment was completed successfully - complete purchases and transaction
        const completionResult = await this.handleCompletedPayment(transactionId, pageStatusResult.transactionData);

        return {
          ...pageStatusResult,
          action_taken: 'transaction_completed',
          completion_result: completionResult
        };
      } else if (pageStatusResult.shouldPollTransaction) {
        // Payment was attempted - should continue with transaction polling
        return {
          ...pageStatusResult,
          action_taken: 'continue_transaction_polling',
          message: 'Payment was attempted, continue with transaction status polling'
        };
      } else {
        // Other status - no action needed
        return {
          ...pageStatusResult,
          action_taken: 'none',
          message: 'No action required based on page status'
        };
      }

    } catch (error) {
      luderror.payment('❌ Error checking and handling payment page status:', error);
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