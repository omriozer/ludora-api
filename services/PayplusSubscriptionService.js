import PaymentService from './PaymentService.js';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * PayplusSubscriptionService - Handles PayPlus subscription management APIs
 * Provides integration with PayPlus RecurringPayments endpoints for:
 * - Updating subscription amounts (for upgrades/downgrades)
 * - Adding one-time charges (for proration)
 * - Canceling subscriptions
 */
class PayplusSubscriptionService {
  /**
   * Get PayPlus credentials and API configuration
   * @returns {Object} PayPlus configuration
   */
  static getPayPlusConfig() {
    try {
      const config = PaymentService.getPayPlusCredentials();
      return {
        apiKey: config.payment_api_key,
        secretKey: config.payment_secret_key,
        baseURL: config.payplusUrl,
        environment: config.environment
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update recurring payment amount for existing subscription
   * Used for plan upgrades/downgrades that change the recurring amount
   * @param {Object} params - Update parameters
   * @param {string} params.subscriptionUid - PayPlus subscription UID
   * @param {number} params.newAmount - New recurring amount
   * @param {string} params.reason - Reason for update (for logging)
   * @returns {Promise<Object>} Update result
   */
  static async updateRecurringPayment(params) {
    try {
      const {
        subscriptionUid,
        newAmount,
        reason = 'plan_change'
      } = params;

      if (!subscriptionUid || !newAmount) {
        throw new Error('Missing required parameters: subscriptionUid and newAmount');
      }

      if (newAmount <= 0) {
        throw new Error('New amount must be greater than 0');
      }

      const config = this.getPayPlusConfig();

      ludlog.payments('🔄 Updating PayPlus recurring payment:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        newAmount,
        reason,
        environment: config.environment
      });

      // Build PayPlus recurring payment update request
      // Based on PayPlus API documentation for RecurringPayments/Update
      const updateRequest = {
        recurring_uid: subscriptionUid,
        amount: newAmount,
        currency: 'ILS',
        // Additional metadata for PayPlus
        metadata: {
          update_reason: reason,
          updated_at: new Date().toISOString(),
          source: 'ludora_plan_change'
        }
      };

      // PayPlus RecurringPayments/Update endpoint
      const updateEndpoint = `${config.baseURL}RecurringPayments/Update`;

      const response = await fetch(updateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(updateRequest)
      });

      const responseText = await response.text();

      if (!response.ok) {
        luderror.payments(`PayPlus RecurringPayments/Update API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Failed to update recurring payment: ${response.status}`);
      }

      // Parse JSON response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        luderror.payments(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error('PayPlus API returned invalid response');
      }

      // Check if update was successful
      if (responseData?.results?.status !== 'success') {
        luderror.payments('PayPlus recurring payment update failed:', responseData?.results);
        throw new Error(responseData?.results?.message || 'Failed to update recurring payment');
      }

      ludlog.payments('✅ Successfully updated PayPlus recurring payment:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        newAmount,
        response: responseData
      });

      return {
        success: true,
        subscriptionUid,
        newAmount,
        updatedAt: new Date().toISOString(),
        payplusResponse: responseData
      };

    } catch (error) {
      luderror.payments('PayplusSubscriptionService: Error updating recurring payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add a one-time charge to an existing subscription
   * Used for charging prorated amounts during plan upgrades
   * @param {Object} params - Charge parameters
   * @param {string} params.subscriptionUid - PayPlus subscription UID
   * @param {number} params.amount - One-time charge amount
   * @param {string} params.description - Charge description
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Charge result
   */
  static async addOneTimeCharge(params) {
    try {
      const {
        subscriptionUid,
        amount,
        description = 'Prorated upgrade charge',
        metadata = {}
      } = params;

      if (!subscriptionUid || !amount) {
        throw new Error('Missing required parameters: subscriptionUid and amount');
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const config = this.getPayPlusConfig();

      ludlog.payments('💳 Adding one-time charge to subscription:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        amount,
        description,
        environment: config.environment
      });

      // Build PayPlus one-time charge request
      // Based on PayPlus API documentation for RecurringPayments/AddRecurringCharge
      const chargeRequest = {
        recurring_uid: subscriptionUid,
        amount: amount,
        currency: 'ILS',
        description: description,
        charge_immediately: true, // Charge immediately, not at next billing
        metadata: {
          charge_type: 'proration',
          charge_reason: description,
          charged_at: new Date().toISOString(),
          source: 'ludora_plan_upgrade',
          ...metadata
        }
      };

      // PayPlus RecurringPayments/AddRecurringCharge endpoint
      const chargeEndpoint = `${config.baseURL}RecurringPayments/AddRecurringCharge`;

      const response = await fetch(chargeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(chargeRequest)
      });

      const responseText = await response.text();

      if (!response.ok) {
        luderror.payments(`PayPlus AddRecurringCharge API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Failed to add one-time charge: ${response.status}`);
      }

      // Parse JSON response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        luderror.payments(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error('PayPlus API returned invalid response');
      }

      // Check if charge was successful
      if (responseData?.results?.status !== 'success') {
        luderror.payments('PayPlus one-time charge failed:', responseData?.results);
        throw new Error(responseData?.results?.message || 'Failed to add one-time charge');
      }

      // Extract transaction details
      const transactionUid = responseData?.data?.transaction_uid || responseData?.transaction_uid;
      const chargeStatus = responseData?.data?.status || responseData?.status;

      ludlog.payments('✅ Successfully added one-time charge to subscription:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        amount,
        transactionUid,
        chargeStatus,
        response: responseData
      });

      return {
        success: true,
        subscriptionUid,
        amount,
        transactionUid,
        chargeStatus,
        chargedAt: new Date().toISOString(),
        payplusResponse: responseData
      };

    } catch (error) {
      luderror.payments('PayplusSubscriptionService: Error adding one-time charge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a PayPlus subscription
   * Used when user wants to cancel their subscription
   * @param {Object} params - Cancellation parameters
   * @param {string} params.subscriptionUid - PayPlus subscription UID
   * @param {boolean} params.immediate - Cancel immediately or at end of billing cycle
   * @param {string} params.reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelSubscription(params) {
    try {
      const {
        subscriptionUid,
        immediate = false,
        reason = 'user_requested'
      } = params;

      if (!subscriptionUid) {
        throw new Error('Missing required parameter: subscriptionUid');
      }

      const config = this.getPayPlusConfig();

      ludlog.payments('🚫 Canceling PayPlus subscription:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        immediate,
        reason,
        environment: config.environment
      });

      // Build PayPlus subscription cancellation request
      // Based on PayPlus API documentation for RecurringPayments/Cancel
      const cancelRequest = {
        recurring_uid: subscriptionUid,
        cancel_immediately: immediate,
        cancellation_reason: reason,
        metadata: {
          cancelled_at: new Date().toISOString(),
          source: 'ludora_cancellation'
        }
      };

      // PayPlus RecurringPayments/Cancel endpoint
      const cancelEndpoint = `${config.baseURL}RecurringPayments/Cancel`;

      const response = await fetch(cancelEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(cancelRequest)
      });

      const responseText = await response.text();

      if (!response.ok) {
        luderror.payments(`PayPlus RecurringPayments/Cancel API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Failed to cancel subscription: ${response.status}`);
      }

      // Parse JSON response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        luderror.payments(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error('PayPlus API returned invalid response');
      }

      // Check if cancellation was successful
      if (responseData?.results?.status !== 'success') {
        luderror.payments('PayPlus subscription cancellation failed:', responseData?.results);
        throw new Error(responseData?.results?.message || 'Failed to cancel subscription');
      }

      ludlog.payments('✅ Successfully canceled PayPlus subscription:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        immediate,
        response: responseData
      });

      return {
        success: true,
        subscriptionUid,
        immediate,
        cancelledAt: new Date().toISOString(),
        payplusResponse: responseData
      };

    } catch (error) {
      luderror.payments('PayplusSubscriptionService: Error canceling subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get subscription details from PayPlus
   * Used to verify subscription status and details
   * @param {string} subscriptionUid - PayPlus subscription UID
   * @returns {Promise<Object>} Subscription details
   */
  static async getSubscriptionDetails(subscriptionUid) {
    try {
      if (!subscriptionUid) {
        throw new Error('Missing required parameter: subscriptionUid');
      }

      const config = this.getPayPlusConfig();

      ludlog.payments('🔍 Fetching PayPlus subscription details:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        environment: config.environment
      });

      // Build PayPlus subscription details request
      // Based on PayPlus API documentation for RecurringPayments/Get
      const detailsRequest = {
        recurring_uid: subscriptionUid
      };

      // PayPlus RecurringPayments/Get endpoint
      const detailsEndpoint = `${config.baseURL}RecurringPayments/Get`;

      const response = await fetch(detailsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(detailsRequest)
      });

      const responseText = await response.text();

      if (!response.ok) {
        luderror.payments(`PayPlus RecurringPayments/Get API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Failed to get subscription details: ${response.status}`);
      }

      // Parse JSON response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        luderror.payments(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error('PayPlus API returned invalid response');
      }

      // Check if request was successful
      if (responseData?.results?.status !== 'success') {
        luderror.payments('PayPlus get subscription details failed:', responseData?.results);
        throw new Error(responseData?.results?.message || 'Failed to get subscription details');
      }

      const subscriptionData = responseData?.data || {};

      ludlog.payments('✅ Successfully retrieved PayPlus subscription details:', {
        subscriptionUid: subscriptionUid.substring(0, 20) + '...',
        status: subscriptionData.status,
        amount: subscriptionData.amount
      });

      return {
        success: true,
        subscription: {
          uid: subscriptionUid,
          status: subscriptionData.status,
          amount: subscriptionData.amount,
          currency: subscriptionData.currency,
          nextPaymentDate: subscriptionData.next_payment_date,
          createdAt: subscriptionData.created_at,
          ...subscriptionData
        },
        payplusResponse: responseData
      };

    } catch (error) {
      luderror.payments('PayplusSubscriptionService: Error getting subscription details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default PayplusSubscriptionService;
