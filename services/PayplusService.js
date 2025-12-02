import PaymentService from './PaymentService.js';
import { luderror } from '../lib/ludlog.js';
import { calcFinalPurchasePrice } from '../utils/purchasePricing.js';
import models from '../models/index.js';
import { PAYPLUS_CHARGE_METHODS } from '../constants/payplus.js';

/**
 * PayplusService - Handles PayPlus payment page generation and configuration
 */
class PayplusService {
  /**
   * Get the webhook URL from environment configuration
   * @returns {string} Full webhook URL
   */
  static getWebhookUrl() {
    // Ensure API_URL is defined with proper fallback
    const apiUrl = process.env.API_URL || '';

    // If API_URL is not set, log warning and use fallback
    if (!apiUrl) {
      luderror.payment('⚠️ WARNING: API_URL environment variable is not set! Using fallback for webhook URL.');
      // Fallback based on environment
      if (process.env.NODE_ENV === 'staging') {
        return 'https://api-staging.ludora.app/api/webhooks/payplus';
      } else if (process.env.NODE_ENV === 'production') {
        return 'https://api.ludora.app/api/webhooks/payplus';
      } else {
        return 'http://localhost:3003/api/webhooks/payplus';
      }
    }

    // Ensure API_URL doesn't have trailing slash
    const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return cleanApiUrl + '/api/webhooks/payplus';
  }

  /**
   * Open PayPlus payment page for transactions or subscriptions
   * @param {Object} options - Payment configuration options
   * @param {string} options.frontendOrigin - Origin context ('cart', 'checkout', 'subscription')
   * @param {Array} options.purchaseItems - Purchase items to process
   * @param {Object} options.customer - Customer information
   * @param {Object} options.callbacks - Success/failure callback URLs
   * @returns {Promise<Object>} PayPlus payment page response with URL
   */
  static async openPayplusPage(options = {}) {
    const {
      frontendOrigin = 'cart',
      purchaseItems = [],
      customer = {},
    } = options;

    try {
      // Get PayPlus credentials (environment auto-detected from NODE_ENV)
      const {payplusUrl, payment_page_uid, payment_api_key, payment_secret_key, environment} = PaymentService.getPayPlusCredentials();
      const payplusPaymentPageUrl = `${payplusUrl}PaymentPages/generateLink`;

      // Determine charge method based on frontend origin and purchase items
      const chargeMethod = this.determineChargeMethod(frontendOrigin, purchaseItems);

      // Calculate total amount
      const totalAmount = this.calculateTotalAmount(purchaseItems);
      if (totalAmount <= 0) {
        throw new Error('Total amount must be greater than 0 for PayPlus payment');
      }

      // Determine webhook URL
      const webhookUrl = this.getWebhookUrl();

      // Log webhook URL for debugging
      luderror.payment(`PayplusService: Using webhook URL: ${webhookUrl} for environment: ${process.env.NODE_ENV || 'development'}`);

      // Build PayPlus request payload
      const paymentRequest = {
        payment_page_uid,
        charge_method: chargeMethod,
        amount: totalAmount,
        currency_code: 'ILS',
        language_code: 'he',
        sendEmailApproval: true,
        sendEmailFailure: false,

        // Customer information
        customer: {
          customer_name: customer.name || customer.customer_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          ...customer
        },

        // Items configuration
        items: this.formatPurchaseItemsForPayplus(purchaseItems),

        // URL callbacks
        refURL_success: process.env.FRONTEND_URL + '/payment-result',
        refURL_failure: process.env.FRONTEND_URL + '/payment-result',
        refURL_cancel: process.env.FRONTEND_URL + '/payment-result',
        refURL_callback: webhookUrl,

        // Additional settings based on charge method
        ...this.getAdditionalSettings(chargeMethod, frontendOrigin, purchaseItems)
      };

      // Make request to PayPlus API
      const response = await fetch(payplusPaymentPageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        },
        body: JSON.stringify(paymentRequest)
      });

      const errorMsg = 'לא הצלחנו לפתוח את דף התשלום. אנא פנה לתמיכה טכנית.';

      // First check if response is ok and get the text
      const responseText = await response.text();

      if (!response.ok) {
        luderror.payment(`!!!! PayPlus API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500) // First 500 chars to avoid huge logs
        });
        throw new Error(errorMsg);
      }

      // Try to parse as JSON
      let paymentData;
      try {
        paymentData = JSON.parse(responseText);
      } catch (parseError) {
        luderror.payment(`!!!! PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500) // First 500 chars
        });
        throw new Error(errorMsg);
      }

      if (paymentData?.results?.code || paymentData?.results?.status !== 'success') {
        luderror.payment(`!!!! PayPlus API error:`, paymentData?.results);
        throw new Error(errorMsg);
      }

      // Extract PayPlus response data
      const pageRequestUid = paymentData?.data?.page_request_uid;
      const paymentPageLink = paymentData?.data?.payment_page_link;

      if (!pageRequestUid || !paymentPageLink) {
        luderror.payment('!!!! PayPlus API missing required data:', {
          hasPageRequestUid: !!pageRequestUid,
          hasPaymentPageLink: !!paymentPageLink,
          data: paymentData?.data
        });
        throw new Error(errorMsg);
      }

      return {
        success: true,
        pageRequestUid,
        paymentPageLink,
        paymentUrl: paymentPageLink, // For backward compatibility
        qrCodeImage: paymentData?.data?.qr_code_image,
        environment,
        chargeMethod,
        totalAmount,
        data: paymentData
      };

    } catch (error) {
      luderror.payment('❌ PayplusService: Error opening PayPlus payment page:', error);
      throw error;
    }
  }

  /**
   * Determine the appropriate charge method based on context and purchase items
   * @param {string} frontendOrigin - Origin context
   * @param {Array} purchaseItems - Purchase items to analyze
   * @returns {number} PayPlus charge method
   */
  static determineChargeMethod(frontendOrigin, purchaseItems) {
    // All purchase transactions use immediate charge
    return PAYPLUS_CHARGE_METHODS.IMMEDIATE;
  }

  /**
   * Calculate total amount from purchase items
   * @param {Array} purchaseItems - Purchase items to calculate total for
   * @returns {number} Total amount
   */
  static calculateTotalAmount(purchaseItems) {
    return purchaseItems.reduce((total, purchaseItem) => {
      // Use the consistent pricing utility for purchases
      const amount = calcFinalPurchasePrice(purchaseItem);
      return total + amount;
    }, 0);
  }

  /**
   * Format purchase items for PayPlus API
   * @param {Array} purchaseItems - Purchase items to format
   * @returns {Array} Formatted items array
   */
  static formatPurchaseItemsForPayplus(purchaseItems) {
    return purchaseItems.map(purchaseItem => ({
      name: purchaseItem.metadata?.product_title || purchaseItem.title || purchaseItem.name || 'Product',
      price: calcFinalPurchasePrice(purchaseItem).toFixed(2),
      quantity: 1,
      barcode: purchaseItem.purchasable_type || 'general' + '_' + (purchaseItem.purchasable_id || purchaseItem.id || '0'),
      // product_uid: purchaseItem.purchasable_id || purchaseItem.id,
      // category_uid: purchaseItem.purchasable_type || 'general'
    }));
  }

  /**
   * Get additional settings based on charge method and context
   * @param {number} chargeMethod - PayPlus charge method
   * @param {string} frontendOrigin - Origin context (for future use)
   * @param {Array} purchaseItems - Purchase items to analyze for subscription settings
   * @returns {Object} Additional settings
   */
  static getAdditionalSettings(chargeMethod, frontendOrigin, purchaseItems = []) {
    const settings = {};


    // Common settings for all payment types
    settings.payments = 1; // Single payment by default
    settings.hide_other_charge_methods = false;
    
    settings.send_failure_callback = true;
    settings.create_token = true;
    settings.hide_payments_field = true;
    settings.payments = 1;

    return settings;
  }

  /**
   * Validate if purchase items are eligible for PayPlus payment
   * @param {Array} purchaseItems - Purchase items to validate
   * @returns {Object} Validation result
   */
  static validatePurchaseItemsForPayment(purchaseItems) {
    if (!purchaseItems || !Array.isArray(purchaseItems) || purchaseItems.length === 0) {
      return {
        valid: false,
        error: 'No purchase items provided for payment'
      };
    }

    const totalAmount = this.calculateTotalAmount(purchaseItems);
    if (totalAmount <= 0) {
      return {
        valid: false,
        error: 'Total amount must be greater than 0'
      };
    }

    const hasInvalidItems = purchaseItems.some(purchaseItem => {
      const amount = calcFinalPurchasePrice(purchaseItem);
      return isNaN(amount) || amount < 0;
    });

    if (hasInvalidItems) {
      return {
        valid: false,
        error: 'Some purchase items have invalid amounts'
      };
    }

    return {
      valid: true,
      totalAmount
    };
  }
}

export default PayplusService;