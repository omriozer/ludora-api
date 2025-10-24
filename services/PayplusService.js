import PaymentService from './PaymentService.js';
import { clog, cerror } from '../lib/utils.js';
import { calcFinalPurchasePrice } from '../utils/purchasePricing.js';
import models from '../models/index.js';

/**
 * PayplusService - Handles PayPlus payment page generation and configuration
 */
class PayplusService {
  /**
   * Open PayPlus payment page for transactions or subscriptions
   * @param {Object} options - Payment configuration options
   * @param {string} options.frontendOrigin - Origin context ('cart', 'checkout', 'subscription')
   * @param {Array} options.purchaseItems - Purchase items to process
   * @param {string} options.environment - Environment ('production' or 'staging')
   * @param {Object} options.customer - Customer information
   * @param {Object} options.callbacks - Success/failure callback URLs
   * @returns {Promise<Object>} PayPlus payment page response with URL
   */
  static async openPayplusPage(options = {}) {
    const {
      frontendOrigin = 'cart',
      purchaseItems = [],
      environment = 'production',
      customer = {},
      callbacks = {}
    } = options;

    try {
      clog('🎯 PayplusService: Opening PayPlus payment page', {
        frontendOrigin,
        purchaseItemsCount: purchaseItems.length,
        environment,
        hasCustomer: !!customer.email
      });

      // Get PayPlus credentials for the environment
      const {payplusUrl, payment_page_uid, payment_api_key, payment_secret_key} = PaymentService.getPayPlusCredentials(environment);
      const payplusPaymentPageUrl = `${payplusUrl}PaymentPages/generateLink`;

      // Determine charge method based on frontend origin and purchase items
      const chargeMethod = this.determineChargeMethod(frontendOrigin, purchaseItems);
      clog('🔍 PayplusService: Determined charge method', { chargeMethod, frontendOrigin });

      // Calculate total amount
      const totalAmount = this.calculateTotalAmount(purchaseItems);
      if (totalAmount <= 0) {
        throw new Error('Total amount must be greater than 0 for PayPlus payment');
      }

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
        refURL_success: callbacks.successUrl || process.env.FRONTEND_URL + '/payment/success',
        refURL_failure: callbacks.failureUrl || process.env.FRONTEND_URL + '/payment/failure',
        refURL_cancel: callbacks.cancelUrl || process.env.FRONTEND_URL + '/payment/cancel',
        refURL_callback: callbacks.callbackUrl || process.env.API_URL + '/webhooks/payplus',

        // Additional settings based on charge method
        ...this.getAdditionalSettings(chargeMethod, frontendOrigin)
      };

      clog('🚀 PayplusService: Sending request to PayPlus', {
        url: payplusPaymentPageUrl,
        method: chargeMethod,
        amount: totalAmount,
        purchaseItemsCount: paymentRequest.items.length
      });

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
      const paymentData = await response.json();
      if (!response.ok || paymentData?.results?.code || paymentData?.results?.status !== 'success') {
        cerror(`!!!! PayPlus API error:`, paymentData?.results);
        throw new Error(errorMsg);
      }

      // Extract PayPlus response data
      const pageRequestUid = paymentData?.data?.page_request_uid;
      const paymentPageLink = paymentData?.data?.payment_page_link;

      if (!pageRequestUid || !paymentPageLink) {
        cerror('!!!! PayPlus API missing required data:', {
          hasPageRequestUid: !!pageRequestUid,
          hasPaymentPageLink: !!paymentPageLink,
          data: paymentData?.data
        });
        throw new Error(errorMsg);
      }

      clog('✅ PayplusService: PayPlus payment page created successfully', {
        pageRequestUid: pageRequestUid.substring(0, 8) + '...',
        hasPaymentPageLink: !!paymentPageLink,
        environment
      });

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
      cerror('❌ PayplusService: Error opening PayPlus payment page:', error);
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
    // Check if any purchase items are subscriptions
    const hasSubscriptions = purchaseItems.some(item => item.purchasable_type === 'subscription');

    if (hasSubscriptions || frontendOrigin === 'subscription') {
      // Use recurring payments for subscriptions
      return 3; // Recurring Payments
    }

    // Default to immediate charge for one-time purchases
    return 1; // Charge (J4) - immediate payment
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
   * @param {string} frontendOrigin - Origin context
   * @returns {Object} Additional settings
   */
  static getAdditionalSettings(chargeMethod, frontendOrigin) {
    const settings = {};

    // For recurring payments (subscriptions)
    if (chargeMethod === 3) {
      settings.recurring_settings = {
        instant_first_payment: true,
        recurring_type: 2, // Monthly
        recurring_range: 1, // Every month
        number_of_charges: 0, // Unlimited
        start_date_on_payment_date: true,
        start_date: 1,
        jump_payments: 0, // No free trial by default
        successful_invoice: true,
        customer_failure_email: true,
        send_customer_success_email: true
      };
    }

    // Common settings for all payment types
    settings.payments = 1; // Single payment by default
    settings.hide_other_charge_methods = false;
    settings.allowed_charge_methods = ['credit-card', 'bit'];

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