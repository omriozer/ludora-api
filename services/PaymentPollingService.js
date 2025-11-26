import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import EmailService from './EmailService.js';
import { error as logger } from '../lib/errorLogger.js';
import { PAYMENT_STATUSES, mapPayPlusStatusToPaymentStatus } from '../constants/payplus.js';

/**
 * PaymentPollingService - Handles PayPlus API polling for payment status
 *
 * Features:
 * - Polls PayPlus API every 20 seconds for payment status updates
 * - Handles abandonment workflow after 10 failed polling attempts
 * - Sends support notification emails when payments are abandoned
 * - Updates purchase and transaction records based on API responses
 * - Works as fallback when webhooks fail or are delayed
 */
class PaymentPollingService {

  /**
   * Poll PayPlus API for transaction status
   * @param {string} transactionId - Purchase/transaction ID to poll
   * @returns {Promise<Object>} Polling result with status and updated data
   */
  static async pollTransactionStatus(transactionId) {
    try {
      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🔍 Polling PayPlus status for transaction: ${transactionId}`);

      // Find the purchase to get PayPlus data
      const purchase = await models.Purchase.findByPk(transactionId, {
        include: [
          {
            model: models.Transaction,
            as: 'transaction',
            required: false
          }
        ]
      });

      if (!purchase) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (!purchase.transaction?.payment_page_request_uid) {
        throw new Error(`No PayPlus page request UID found for transaction ${transactionId}`);
      }

      const pageRequestUid = purchase.transaction.payment_page_request_uid;
      const currentAttempts = purchase.polling_attempts || 0;

      // Check if we've exceeded maximum polling attempts
      if (currentAttempts >= 10) {
        // TODO remove debug - implement payment status polling as webhook fallback
        logger.payment(`⚠️ Transaction ${transactionId} exceeded max polling attempts (${currentAttempts})`);

        await this.handleAbandonedPayment(purchase, transactionId);

        return {
          success: false,
          status: 'abandoned',
          attempts: currentAttempts,
          message: 'Payment abandoned after maximum polling attempts'
        };
      }

      // Increment polling attempts
      const newAttempts = currentAttempts + 1;
      await purchase.update({
        polling_attempts: newAttempts,
        last_polled_at: new Date(),
        updated_at: new Date()
      });

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🔍 Polling attempt ${newAttempts}/10 for PageRequestUID: ${pageRequestUid}`);

      // Get PayPlus credentials and poll the API
      const { payplusUrl, payment_api_key, payment_secret_key } = PaymentService.getPayPlusCredentials();
      const pollUrl = `${payplusUrl}Transactions/PaymentData`;

      const pollResponse = await fetch(pollUrl, {
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

      const responseText = await pollResponse.text();

      if (!pollResponse.ok) {
        // TODO remove debug - implement payment status polling as webhook fallback
        logger.payment(`❌ PayPlus polling HTTP error ${pollResponse.status}:`, {
          status: pollResponse.status,
          response: responseText.substring(0, 500)
        });

        return {
          success: false,
          status: purchase.payment_status,
          attempts: newAttempts,
          error: `PayPlus API error: ${pollResponse.status}`,
          should_retry: true
        };
      }

      let pollData;
      try {
        pollData = JSON.parse(responseText);
      } catch (parseError) {
        // TODO remove debug - implement payment status polling as webhook fallback
        logger.payment(`❌ PayPlus polling invalid JSON response:`, {
          parseError: parseError.message,
          response: responseText.substring(0, 500)
        });

        return {
          success: false,
          status: purchase.payment_status,
          attempts: newAttempts,
          error: 'Invalid PayPlus API response',
          should_retry: true
        };
      }

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`📊 PayPlus polling response for ${pageRequestUid}:`, {
        success: !!pollData?.results?.status,
        status: pollData?.results?.status,
        transaction: pollData?.data?.transaction?.status_description,
        statusCode: pollData?.data?.transaction?.status_code
      });

      // Check if PayPlus returned successful data
      if (pollData?.results?.status !== 'success') {
        return {
          success: false,
          status: purchase.payment_status,
          attempts: newAttempts,
          error: pollData?.results?.message || 'PayPlus API returned error',
          should_retry: true
        };
      }

      // Extract transaction data from PayPlus response
      const transactionData = pollData?.data?.transaction;
      if (!transactionData) {
        return {
          success: false,
          status: purchase.payment_status,
          attempts: newAttempts,
          error: 'No transaction data in PayPlus response',
          should_retry: true
        };
      }

      // Map PayPlus status to our payment status
      const paymentStatus = mapPayPlusStatusToPaymentStatus(transactionData.status_code);

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🔄 Status mapping: PayPlus code ${transactionData.status_code} -> ${paymentStatus}`);

      // Update purchase based on payment status
      if (paymentStatus === PAYMENT_STATUSES.SUCCESS || paymentStatus === PAYMENT_STATUSES.APPROVED) {
        // Payment succeeded - complete the purchase
        await this.handleSuccessfulPayment(purchase, transactionData, transactionId);

        return {
          success: true,
          status: 'completed',
          attempts: newAttempts,
          payment_status: paymentStatus,
          transaction_data: transactionData,
          message: 'Payment completed successfully via polling'
        };

      } else if (paymentStatus === PAYMENT_STATUSES.FAILED || paymentStatus === PAYMENT_STATUSES.DECLINED) {
        // Payment failed - update status
        await this.handleFailedPayment(purchase, transactionData, transactionId);

        return {
          success: true,
          status: 'failed',
          attempts: newAttempts,
          payment_status: paymentStatus,
          transaction_data: transactionData,
          message: 'Payment failed - no further polling needed'
        };

      } else {
        // Payment still pending or in other intermediate status
        // TODO remove debug - implement payment status polling as webhook fallback
        logger.payment(`⏳ Transaction ${transactionId} still pending with status: ${paymentStatus}`);

        return {
          success: false,
          status: 'pending',
          attempts: newAttempts,
          payment_status: paymentStatus,
          transaction_data: transactionData,
          should_retry: true,
          message: `Payment status: ${paymentStatus} - will continue polling`
        };
      }

    } catch (error) {
      logger.payment('❌ PaymentPollingService: Error polling transaction status:', error);

      // On error, still increment attempt count but allow retry
      try {
        const purchase = await models.Purchase.findByPk(transactionId);
        if (purchase) {
          await purchase.update({
            polling_attempts: (purchase.polling_attempts || 0) + 1,
            last_polled_at: new Date(),
            updated_at: new Date()
          });
        }
      } catch (updateError) {
        logger.payment('❌ Failed to update polling attempts after error:', updateError);
      }

      return {
        success: false,
        status: 'error',
        error: error.message,
        should_retry: true
      };
    }
  }

  /**
   * Handle successful payment detected via polling
   * @param {Object} purchase - Purchase record
   * @param {Object} transactionData - PayPlus transaction data
   * @param {string} transactionId - Transaction ID
   */
  static async handleSuccessfulPayment(purchase, transactionData, transactionId) {
    try {
      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`✅ Handling successful payment for transaction: ${transactionId}`);

      // Update the purchase to completed
      await purchase.update({
        payment_status: 'completed',
        payment_method: 'payplus',
        resolution_method: 'polling',
        metadata: {
          ...purchase.metadata,
          payplus_polling_data: transactionData,
          completed_via_polling_at: new Date().toISOString(),
          polling_attempts: purchase.polling_attempts || 0
        },
        updated_at: new Date()
      });

      // Update the transaction if it exists
      if (purchase.transaction) {
        await purchase.transaction.update({
          payment_status: 'completed',
          metadata: {
            ...purchase.transaction.metadata,
            payplus_polling_data: transactionData,
            completed_via_polling_at: new Date().toISOString(),
            resolvedBy: 'polling', // Track that this payment was resolved by polling
            resolvedAt: new Date().toISOString()
          },
          updated_at: new Date()
        });
      }

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`✅ Payment completion handled successfully for transaction: ${transactionId}`);

    } catch (error) {
      logger.payment('❌ Error handling successful payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment detected via polling
   * @param {Object} purchase - Purchase record
   * @param {Object} transactionData - PayPlus transaction data
   * @param {string} transactionId - Transaction ID
   */
  static async handleFailedPayment(purchase, transactionData, transactionId) {
    try {
      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`❌ Handling failed payment for transaction: ${transactionId}`);

      const failureReason = transactionData.status_description || transactionData.reason || `PayPlus status code: ${transactionData.status_code}`;

      // Update the purchase to failed
      await purchase.update({
        payment_status: 'failed',
        resolution_method: 'polling',
        metadata: {
          ...purchase.metadata,
          payplus_polling_data: transactionData,
          failed_via_polling_at: new Date().toISOString(),
          polling_attempts: purchase.polling_attempts || 0,
          failure_reason: failureReason
        },
        updated_at: new Date()
      });

      // Update the transaction if it exists
      if (purchase.transaction) {
        await purchase.transaction.update({
          payment_status: 'failed',
          metadata: {
            ...purchase.transaction.metadata,
            payplus_polling_data: transactionData,
            failed_via_polling_at: new Date().toISOString(),
            failure_reason: failureReason
          },
          updated_at: new Date()
        });
      }

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`❌ Payment failure handled for transaction: ${transactionId}, reason: ${failureReason}`);

    } catch (error) {
      logger.payment('❌ Error handling failed payment:', error);
      throw error;
    }
  }

  /**
   * Handle abandoned payment after maximum polling attempts
   * @param {Object} purchase - Purchase record
   * @param {string} transactionId - Transaction ID
   */
  static async handleAbandonedPayment(purchase, transactionId) {
    try {
      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🚨 Handling abandoned payment for transaction: ${transactionId}`);

      // Update purchase to abandoned status
      await purchase.update({
        payment_status: 'abandoned',
        resolution_method: 'polling_timeout',
        metadata: {
          ...purchase.metadata,
          abandoned_via_polling_at: new Date().toISOString(),
          polling_attempts: purchase.polling_attempts || 0,
          abandonment_reason: 'Exceeded maximum polling attempts (10)'
        },
        updated_at: new Date()
      });

      // Update transaction if it exists
      if (purchase.transaction) {
        await purchase.transaction.update({
          payment_status: 'abandoned',
          metadata: {
            ...purchase.transaction.metadata,
            abandoned_via_polling_at: new Date().toISOString(),
            abandonment_reason: 'Polling timeout after 10 attempts'
          },
          updated_at: new Date()
        });
      }

      // Send support notification email
      await this.sendAbandonmentSupportEmail(purchase, transactionId);

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🚨 Payment abandonment handled for transaction: ${transactionId}`);

    } catch (error) {
      logger.payment('❌ Error handling abandoned payment:', error);
      throw error;
    }
  }

  /**
   * Send support email notification for abandoned payment
   * @param {Object} purchase - Purchase record
   * @param {string} transactionId - Transaction ID
   */
  static async sendAbandonmentSupportEmail(purchase, transactionId) {
    try {
      // Get user information
      const user = await models.User.findByPk(purchase.buyer_user_id);
      const userEmail = user?.email || 'unknown@example.com';
      const userName = user?.displayName || user?.email || 'Unknown User';

      // Prepare email content
      const subject = `תשלום נטוש - Transaction #${transactionId}`;
      const emailContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2>תשלום נטוש במערכת</h2>
          <p>תשלום נטוש לאחר 10 ניסיונות polling:</p>

          <h3>פרטי התשלום:</h3>
          <ul>
            <li><strong>מזהה עסקה:</strong> ${transactionId}</li>
            <li><strong>משתמש:</strong> ${userName} (${userEmail})</li>
            <li><strong>סכום:</strong> ${purchase.payment_amount} ₪</li>
            <li><strong>סוג מוצר:</strong> ${purchase.purchasable_type}</li>
            <li><strong>מזהה מוצר:</strong> ${purchase.purchasable_id}</li>
            <li><strong>זמן יצירה:</strong> ${purchase.created_at}</li>
            <li><strong>ניסיונות polling:</strong> ${purchase.polling_attempts || 0}</li>
          </ul>

          <h3>PayPlus Details:</h3>
          <ul>
            <li><strong>Page Request UID:</strong> ${purchase.transaction?.payment_page_request_uid || 'N/A'}</li>
            <li><strong>Payment Page Link:</strong> ${purchase.transaction?.payment_page_link || 'N/A'}</li>
          </ul>

          <h3>מטא נתונים:</h3>
          <pre>${JSON.stringify(purchase.metadata, null, 2)}</pre>

          <p><strong>פעולה נדרשת:</strong> בדיקה ידנית של סטטוס התשלום ב-PayPlus ועדכון המערכת בהתאם.</p>
        </div>
      `;

      // Send email to support
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@ludora.app';

      await EmailService.sendEmail({
        to: supportEmail,
        subject: subject,
        html: emailContent,
        relatedEntityId: transactionId
      });

      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`📧 Abandonment support email sent for transaction: ${transactionId} to ${supportEmail}`);

    } catch (error) {
      logger.payment('❌ Error sending abandonment support email:', error);
      // Don't throw - email failure shouldn't break the abandonment process
    }
  }

  /**
   * Check all pending payments for a user and poll their status
   * @param {string} userId - User ID to check payments for
   * @returns {Promise<Object>} Polling results summary
   */
  static async checkUserPendingPayments(userId) {
    try {
      // TODO remove debug - implement payment status polling as webhook fallback
      logger.payment(`🔍 Checking pending payments for user: ${userId}`);

      // Find all pending purchases for this user
      const pendingPurchases = await models.Purchase.findAll({
        where: {
          buyer_user_id: userId,
          payment_status: 'pending'
        },
        include: [
          {
            model: models.Transaction,
            as: 'transaction',
            required: false
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const results = [];

      for (const purchase of pendingPurchases) {
        try {
          const pollResult = await this.pollTransactionStatus(purchase.id);
          results.push({
            transaction_id: purchase.id,
            poll_result: pollResult
          });
        } catch (error) {
          results.push({
            transaction_id: purchase.id,
            poll_result: {
              success: false,
              error: error.message
            }
          });
        }
      }

      return {
        success: true,
        user_id: userId,
        pending_count: pendingPurchases.length,
        results: results
      };

    } catch (error) {
      logger.payment('❌ Error checking user pending payments:', error);
      throw error;
    }
  }
}

export default PaymentPollingService;