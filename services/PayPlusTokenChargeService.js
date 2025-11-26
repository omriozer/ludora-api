import PaymentService from './PaymentService.js';
import { clog, cerror } from '../lib/logger.js';

/**
 * PayPlusTokenChargeService - Handles direct PayPlus token charging
 * Enables one-click payments using saved payment method tokens
 * WITHOUT opening PayPlus payment page
 */
class PayPlusTokenChargeService {
  /**
   * Get PayPlus credentials and API endpoints
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
      cerror('Failed to get PayPlus configuration:', error);
      throw error;
    }
  }

  /**
   * Charges a saved payment token directly WITHOUT opening payment page
   * @param {Object} params - Charge parameters
   * @param {string} params.token - PayPlus payment token
   * @param {number} params.amount - Amount in cents (e.g., 5000 for 50.00 ILS)
   * @param {string} params.currency - Currency code (default: ILS)
   * @param {string} params.customerEmail - Customer email
   * @param {string} params.customerName - Customer name
   * @param {string} params.description - Transaction description
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Charge result
   */
  static async chargeToken(params) {
    try {
      const {
        token,
        amount,
        currency = 'ILS',
        customerEmail,
        customerName,
        description = 'Ludora Purchase',
        metadata = {}
      } = params;

      if (!token || !amount || !customerEmail) {
        throw new Error('Missing required parameters: token, amount, customerEmail');
      }

      const config = this.getPayPlusConfig();

      // TODO remove debug - token capture system
      clog('🔄 Charging saved payment token:', {
        amount: amount / 100, // Show in ILS
        currency,
        customerEmail,
        tokenMasked: this.maskToken(token),
        environment: config.environment
      });

      // Build PayPlus token charge request
      // Note: This is based on expected PayPlus API structure
      // May need adjustment based on actual PayPlus documentation
      const chargeRequest = {
        api_key: config.apiKey,
        secret_key: config.secretKey,
        payment_token: token,
        amount: amount,
        currency: currency,
        customer: {
          email: customerEmail,
          name: customerName
        },
        description: description,
        charge_method: 1, // Immediate charge
        metadata: {
          source: 'ludora_saved_payment_method',
          ...metadata
        }
      };

      // TODO remove debug - token capture system
      clog('📤 Sending token charge request to PayPlus API');

      // Make request to PayPlus token charging endpoint
      // Note: Endpoint URL may need verification against PayPlus documentation
      const chargeEndpoint = `${config.baseURL}Charges/ChargeWithToken`;

      const response = await fetch(chargeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(chargeRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PayPlus API HTTP error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      // TODO remove debug - token capture system
      clog('📥 PayPlus token charge response:', {
        success: responseData.success,
        status: responseData.status,
        transactionId: responseData.transaction_uid || responseData.uid
      });

      // Parse PayPlus response
      if (responseData.success !== false && (responseData.status === 'approved' || responseData.status === 'success')) {
        return {
          success: true,
          transactionId: responseData.transaction_uid || responseData.uid,
          amount: responseData.amount || amount,
          currency: responseData.currency || currency,
          status: responseData.status,
          authCode: responseData.auth_code,
          last4: responseData.card_last4,
          brand: responseData.card_brand,
          metadata: {
            payplus_response: responseData,
            charge_method: 'saved_token',
            charged_at: new Date().toISOString()
          }
        };
      }

      // Payment failed or was declined
      const errorMessage = responseData.error_message ||
                          responseData.decline_reason ||
                          responseData.message ||
                          'Payment was declined';

      return {
        success: false,
        error: errorMessage,
        errorCode: responseData.error_code || 'CHARGE_FAILED',
        decline_reason: responseData.decline_reason,
        metadata: {
          payplus_response: responseData,
          failed_at: new Date().toISOString()
        }
      };

    } catch (error) {
      cerror('❌ Token charge failed:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'API_ERROR',
        metadata: {
          error_details: error.stack,
          failed_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Validates a payment token by making a small authorization
   * @param {string} token - PayPlus payment token
   * @param {string} customerEmail - Customer email for validation
   * @returns {Promise<Object>} Validation result
   */
  static async validateToken(token, customerEmail) {
    try {
      const config = this.getPayPlusConfig();

      // TODO remove debug - token capture system
      clog('🔍 Validating payment token:', this.maskToken(token));

      // Use small amount (1 cent) for validation
      const validationRequest = {
        api_key: config.apiKey,
        secret_key: config.secretKey,
        payment_token: token,
        amount: 1, // 1 cent
        currency: 'ILS',
        customer: {
          email: customerEmail
        },
        charge_method: 0, // Card check/validation only
        description: 'Token validation'
      };

      const validationEndpoint = `${config.baseURL}Charges/ValidateToken`;

      const response = await fetch(validationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(validationRequest)
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `API error: ${response.status}`
        };
      }

      const responseData = await response.json();

      return {
        valid: responseData.success !== false && responseData.status === 'approved',
        last4: responseData.card_last4,
        brand: responseData.card_brand,
        expired: responseData.card_expired,
        error: responseData.error_message || null
      };

    } catch (error) {
      cerror('Token validation error:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Masks token for secure logging
   * @param {string} token - Payment token
   * @returns {string} Masked token
   */
  static maskToken(token) {
    if (!token || token.length <= 8) return 'tok_****';

    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    return `${start}****${end}`;
  }

  /**
   * Estimates charge time for UI feedback
   * @returns {number} Estimated seconds
   */
  static getEstimatedChargeTime() {
    return 3; // Saved payment methods charge faster than payment pages
  }

  /**
   * Checks if token charging is available (configuration validation)
   * @returns {boolean} True if token charging is properly configured
   */
  static isTokenChargingAvailable() {
    try {
      const config = this.getPayPlusConfig();
      return !!(config.apiKey && config.secretKey && config.baseURL);
    } catch (error) {
      return false;
    }
  }
}

export default PayPlusTokenChargeService;