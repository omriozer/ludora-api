import models from '../models/index.js';
import { clog, cerror } from '../lib/utils.js';
import { calcSubscriptionPlanPrice } from '../utils/purchasePricing.js';

/**
 * SubscriptionPaymentService - Dedicated service for subscription payments
 * Handles PayPlus integration for subscriptions without using the Purchase system
 */
class SubscriptionPaymentService {

  /**
   * Create a PayPlus payment for a subscription
   * @param {Object} options - Payment creation options
   * @param {string} options.userId - User ID
   * @param {string} options.subscriptionPlanId - Subscription plan ID
   * @param {string} options.environment - PayPlus environment ('production' or 'staging')
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Payment creation result
   */
  static async createSubscriptionPayment(options = {}) {
    const {
      userId,
      subscriptionPlanId,
      environment = 'production',
      metadata = {}
    } = options;

    try {
      clog('SubscriptionPaymentService: Creating subscription payment', {
        userId,
        subscriptionPlanId,
        environment
      });

      // Import services to avoid circular dependencies
      const SubscriptionService = (await import('./SubscriptionService.js')).default;
      const PaymentService = (await import('./PaymentService.js')).default;

      // Validate subscription creation first
      const validation = await SubscriptionService.validateSubscriptionCreation(userId, subscriptionPlanId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get subscription plan details (already validated)
      const subscriptionPlan = validation.subscriptionPlan;

      // Calculate pricing with discounts
      const pricingInfo = calcSubscriptionPlanPrice(subscriptionPlan);
      const finalPrice = pricingInfo.finalPrice;

      clog('SubscriptionPaymentService: Calculated subscription pricing', {
        subscriptionPlanId,
        originalPrice: pricingInfo.originalPrice,
        discountAmount: pricingInfo.discountAmount,
        finalPrice,
        isDiscounted: pricingInfo.isDiscounted
      });

      if (finalPrice === 0) {
        // Free subscription - create and activate immediately
        const subscription = await SubscriptionService.createSubscription({
          userId,
          subscriptionPlanId,
          metadata: {
            source: 'free_subscription_payment',
            environment,
            pricingInfo,
            ...metadata
          }
        });

        return {
          success: true,
          message: 'Free subscription created successfully',
          data: {
            subscription,
            isFree: true,
            completed: true,
            pricingInfo
          }
        };
      }

      // Paid subscription - create subscription record first (with pending status)
      const subscription = await SubscriptionService.createSubscription({
        userId,
        subscriptionPlanId,
        metadata: {
          source: 'paid_subscription_payment',
          environment,
          pricingInfo,
          ...metadata
        }
      });

      // Get user information for customer data
      const user = await models.User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create PayPlus payment directly for subscription
      const paymentResult = await this.createPayPlusSubscriptionPayment({
        subscription,
        subscriptionPlan,
        user,
        pricingInfo,
        environment
      });

      // Create transaction with PayPlus data and link directly to subscription
      const transaction = await PaymentService.createPayPlusTransaction({
        userId,
        amount: paymentResult.totalAmount,
        environment,
        pageRequestUid: paymentResult.pageRequestUid,
        paymentPageLink: paymentResult.paymentPageLink,
        purchaseItems: [], // No purchase items for subscriptions
        metadata: {
          subscription_id: subscription.id,
          subscription_plan_id: subscriptionPlanId,
          transaction_type: 'subscription_payment',
          frontendOrigin: 'subscription',
          customerInfo: {
            name: user.displayName || user.email,
            email: user.email
          },
          pricingInfo,
          payplusResponse: paymentResult.data
        }
      });

      // Update subscription with transaction ID
      await subscription.update({
        transaction_id: transaction.id,
        updated_at: new Date()
      });

      clog('SubscriptionPaymentService: Subscription payment created successfully', {
        subscriptionId: subscription.id,
        transactionId: transaction.id,
        environment: paymentResult.environment
      });

      return {
        success: true,
        message: 'Subscription payment page created',
        data: paymentResult.data,
        paymentUrl: paymentResult.paymentPageLink,
        subscriptionId: subscription.id,
        transactionId: transaction.id,
        pageRequestUid: paymentResult.pageRequestUid,
        environment: paymentResult.environment
      };

    } catch (error) {
      cerror('SubscriptionPaymentService: Error creating subscription payment:', error);
      throw error;
    }
  }

  /**
   * Create PayPlus payment page specifically for subscriptions
   * @param {Object} options - PayPlus payment options
   * @returns {Promise<Object>} PayPlus payment page response
   */
  static async createPayPlusSubscriptionPayment(options = {}) {
    const {
      subscription,
      subscriptionPlan,
      user,
      pricingInfo,
      environment
    } = options;

    try {
      // Import PaymentService to get credentials
      const PaymentService = (await import('./PaymentService.js')).default;

      // Get PayPlus credentials for the environment
      const { payplusUrl, payment_page_uid, payment_api_key, payment_secret_key } = PaymentService.getPayPlusCredentials(environment);
      const payplusPaymentPageUrl = `${payplusUrl}PaymentPages/generateLink`;

      clog('SubscriptionPaymentService: Creating PayPlus payment page', {
        subscriptionId: subscription.id,
        environment,
        amount: pricingInfo.finalPrice
      });

      // Determine recurring settings based on billing period
      const recurringSettings = this.getRecurringSettings(subscriptionPlan);

      // Build PayPlus request payload specifically for subscriptions
      const paymentRequest = {
        payment_page_uid,
        charge_method: 3, // Always use recurring payments for subscriptions
        amount: pricingInfo.finalPrice,
        currency_code: 'ILS',
        language_code: 'he',
        sendEmailApproval: true,
        sendEmailFailure: false,

        // Customer information
        customer: {
          customer_name: user.displayName || user.email,
          email: user.email,
          phone: user.phone || ''
        },

        // Subscription item
        items: [{
          name: subscriptionPlan.name,
          price: pricingInfo.finalPrice.toFixed(2),
          quantity: 1,
          barcode: `subscription_${subscriptionPlan.id}`
        }],

        // URL callbacks
        refURL_success: process.env.FRONTEND_URL + '/payment/success',
        refURL_failure: process.env.FRONTEND_URL + '/payment/failure',
        refURL_cancel: process.env.FRONTEND_URL + '/payment/cancel',
        refURL_callback: process.env.API_URL + '/webhooks/payplus',

        // Recurring payment settings
        recurring_settings: {
          instant_first_payment: true,
          recurring_type: recurringSettings.recurringType,
          recurring_range: recurringSettings.recurringRange,
          number_of_charges: 0, // Unlimited
          start_date_on_payment_date: true,
          start_date: 1,
          jump_payments: 0, // No free trial by default
          successful_invoice: true,
          customer_failure_email: true,
          send_customer_success_email: true,
          // Add subscription metadata for webhook processing
          custom_fields: {
            subscription_id: subscription.id,
            subscription_plan_id: subscriptionPlan.id,
            billing_period: subscriptionPlan.billing_period || 'monthly'
          }
        },

        // Common settings
        payments: 1,
        hide_other_charge_methods: false,
        send_failure_callback: true,
        create_token: true,
        hide_payments_field: true,
        payments: 1,
      };

      clog('SubscriptionPaymentService: Sending request to PayPlus paymentRequest: ', paymentRequest);

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
      const responseText = await response.text();

      if (!response.ok) {
        cerror(`PayPlus API HTTP error ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(errorMsg);
      }

      // Parse JSON response
      let paymentData;
      try {
        paymentData = JSON.parse(responseText);
      } catch (parseError) {
        cerror(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(errorMsg);
      }

      if (paymentData?.results?.code || paymentData?.results?.status !== 'success') {
        cerror(`PayPlus API error:`, paymentData?.results);
        throw new Error(errorMsg);
      }

      // Extract PayPlus response data
      const pageRequestUid = paymentData?.data?.page_request_uid;
      const paymentPageLink = paymentData?.data?.payment_page_link;

      if (!pageRequestUid || !paymentPageLink) {
        cerror('PayPlus API missing required data:', {
          hasPageRequestUid: !!pageRequestUid,
          hasPaymentPageLink: !!paymentPageLink,
          data: paymentData?.data
        });
        throw new Error(errorMsg);
      }

      clog('SubscriptionPaymentService: PayPlus payment page created successfully', {
        subscriptionId: subscription.id,
        pageRequestUid: pageRequestUid.substring(0, 8) + '...',
        hasPaymentPageLink: !!paymentPageLink,
        environment
      });

      return {
        success: true,
        pageRequestUid,
        paymentPageLink,
        paymentUrl: paymentPageLink,
        qrCodeImage: paymentData?.data?.qr_code_image,
        environment,
        chargeMethod: 3,
        totalAmount: pricingInfo.finalPrice,
        data: paymentData
      };

    } catch (error) {
      cerror('SubscriptionPaymentService: Error creating PayPlus subscription payment:', error);
      throw error;
    }
  }

  /**
   * Get recurring settings based on subscription plan billing period
   * @param {Object} subscriptionPlan - Subscription plan object
   * @returns {Object} Recurring settings for PayPlus
   */
  static getRecurringSettings(subscriptionPlan) {
    let recurringType = 2; // Default to monthly
    let recurringRange = 1; // Default to every period

    switch (subscriptionPlan.billing_period) {
      case 'weekly':
        recurringType = 1; // Weekly
        recurringRange = 1;
        break;
      case 'monthly':
        recurringType = 2; // Monthly
        recurringRange = 1;
        break;
      case 'quarterly':
        recurringType = 2; // Monthly
        recurringRange = 3; // Every 3 months
        break;
      case 'yearly':
        recurringType = 3; // Yearly
        recurringRange = 1;
        break;
      default:
        recurringType = 2; // Default to monthly
        recurringRange = 1;
    }

    return {
      recurringType,
      recurringRange
    };
  }

  /**
   * Handle subscription payment completion from webhook
   * @param {Object} subscription - Subscription object
   * @param {Object} webhookData - PayPlus webhook data
   * @returns {Promise<Object>} Updated subscription
   */
  static async handlePaymentSuccess(subscription, webhookData) {
    try {
      clog('SubscriptionPaymentService: Handling payment success', {
        subscriptionId: subscription.id,
        payplusSubscriptionUid: webhookData.subscription_uid
      });

      // Import SubscriptionService
      const SubscriptionService = (await import('./SubscriptionService.js')).default;

      // Activate subscription
      const activatedSubscription = await SubscriptionService.activateSubscription(subscription.id, {
        payplusSubscriptionUid: webhookData.subscription_uid,
        activationDate: new Date(),
        payplusWebhookData: webhookData,
        metadata: {
          paymentCompletedAt: new Date().toISOString(),
          payplusData: webhookData
        }
      });

      // Update subscription with PayPlus UID if provided
      if (webhookData.subscription_uid) {
        await SubscriptionService.updateSubscriptionPayPlusUid(subscription.id, webhookData.subscription_uid);
      }

      clog('SubscriptionPaymentService: Subscription payment completed successfully', {
        subscriptionId: activatedSubscription.id,
        status: activatedSubscription.status
      });

      return activatedSubscription;

    } catch (error) {
      cerror('SubscriptionPaymentService: Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle subscription payment failure from webhook
   * @param {Object} subscription - Subscription object
   * @param {Object} webhookData - PayPlus webhook data
   * @returns {Promise<Object>} Updated subscription
   */
  static async handlePaymentFailure(subscription, webhookData) {
    try {
      clog('SubscriptionPaymentService: Handling payment failure', {
        subscriptionId: subscription.id,
        reason: webhookData.reason
      });

      // Update subscription status to failed
      const updatedSubscription = await subscription.update({
        status: 'failed',
        metadata: {
          ...subscription.metadata,
          paymentFailedAt: new Date().toISOString(),
          failureReason: webhookData.reason || 'Payment declined',
          payplusWebhookData: webhookData
        },
        updated_at: new Date()
      });

      clog('SubscriptionPaymentService: Subscription payment failure handled', {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status
      });

      return updatedSubscription;

    } catch (error) {
      cerror('SubscriptionPaymentService: Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Create a retry payment for an existing pending subscription
   * @param {Object} options - Retry payment options
   * @param {string} options.userId - User ID
   * @param {Object} options.pendingSubscription - Existing pending subscription
   * @param {Object} options.subscriptionPlan - Subscription plan details
   * @param {string} options.environment - PayPlus environment
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Retry payment result
   */
  static async createRetryPayment(options = {}) {
    const {
      userId,
      pendingSubscription,
      subscriptionPlan,
      environment = 'production',
      metadata = {}
    } = options;

    try {
      clog('SubscriptionPaymentService: Creating retry payment', {
        userId,
        subscriptionId: pendingSubscription.id,
        subscriptionPlanId: subscriptionPlan.id,
        environment
      });

      // Import services to avoid circular dependencies
      const PaymentService = (await import('./PaymentService.js')).default;

      // Get user information for customer data
      const user = await models.User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate pricing (use existing pricing from subscription if available)
      let pricingInfo;
      if (pendingSubscription.metadata?.pricingSnapshot) {
        pricingInfo = pendingSubscription.metadata.pricingSnapshot;
      } else {
        pricingInfo = calcSubscriptionPlanPrice(subscriptionPlan);
      }

      clog('SubscriptionPaymentService: Using pricing for retry payment', {
        subscriptionId: pendingSubscription.id,
        originalPrice: pricingInfo.originalPrice,
        finalPrice: pricingInfo.finalPrice
      });

      // Create new PayPlus payment page for the existing subscription
      const paymentResult = await this.createPayPlusSubscriptionPayment({
        subscription: pendingSubscription,
        subscriptionPlan,
        user,
        pricingInfo,
        environment
      });

      // Create new transaction for retry payment
      const transaction = await PaymentService.createPayPlusTransaction({
        userId,
        amount: paymentResult.totalAmount,
        environment,
        pageRequestUid: paymentResult.pageRequestUid,
        paymentPageLink: paymentResult.paymentPageLink,
        purchaseItems: [], // No purchase items for subscriptions
        metadata: {
          subscription_id: pendingSubscription.id,
          subscription_plan_id: subscriptionPlan.id,
          transaction_type: 'subscription_retry_payment',
          frontendOrigin: 'subscription_retry',
          customerInfo: {
            name: user.displayName || user.email,
            email: user.email
          },
          pricingInfo,
          payplusResponse: paymentResult.data,
          ...metadata
        }
      });

      // Update subscription with new transaction ID and mark retry attempt
      const retryCount = (pendingSubscription.metadata?.retryCount || 0) + 1;
      await pendingSubscription.update({
        transaction_id: transaction.id,
        metadata: {
          ...pendingSubscription.metadata,
          retryCount,
          lastRetryAt: new Date().toISOString(),
          latestTransactionId: transaction.id,
          retryMetadata: metadata
        },
        updated_at: new Date()
      });

      clog('SubscriptionPaymentService: Retry payment created successfully', {
        subscriptionId: pendingSubscription.id,
        transactionId: transaction.id,
        retryCount,
        environment: paymentResult.environment
      });

      return {
        success: true,
        message: 'Retry payment page created',
        data: paymentResult.data,
        paymentUrl: paymentResult.paymentPageLink,
        subscriptionId: pendingSubscription.id,
        transactionId: transaction.id,
        pageRequestUid: paymentResult.pageRequestUid,
        environment: paymentResult.environment,
        retryCount
      };

    } catch (error) {
      cerror('SubscriptionPaymentService: Error creating retry payment:', error);
      throw error;
    }
  }
}

export default SubscriptionPaymentService;