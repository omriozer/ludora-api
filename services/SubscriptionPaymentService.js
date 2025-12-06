import models from '../models/index.js';
import { luderror } from '../lib/ludlog.js';
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
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Payment creation result
   */
  static async createSubscriptionPayment(options = {}) {
    const {
      userId,
      subscriptionPlanId,
      metadata = {}
    } = options;

    try {
      // Auto-detect environment from NODE_ENV
      const nodeEnv = process.env.NODE_ENV || 'development';
      const environment = nodeEnv === 'production' ? 'production' : 'staging';

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
        pricingInfo
      });

      // Create transaction with PayPlus data and link directly to subscription
      const transaction = await PaymentService.createPayPlusTransaction({
        userId,
        amount: paymentResult.totalAmount,
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

      // CRITICAL: Start automatic polling for subscription payment status using persistent jobs
      // This replaces setTimeout-based polling with Redis-backed job scheduling
      // Jobs survive server restarts and provide better monitoring
      try {
        const jobScheduler = (await import('./JobScheduler.js')).default;

        if (jobScheduler.isInitialized) {
          await jobScheduler.scheduleJob('SUBSCRIPTION_PAYMENT_CHECK', {
            subscriptionId: subscription.id,
            attemptNumber: 1,
            maxAttempts: 6,
            isRetryPayment: false
          }, {
            delay: 5000, // Start first poll after 5 seconds
            priority: 100 // Highest priority for payment checking
          });

          ludlog.payment('✅ Scheduled persistent subscription payment polling:', {
            subscriptionId: subscription.id.substring(0, 20) + '...',
            startDelay: '5s',
            maxAttempts: 6,
            source: 'job_scheduler'
          });
        } else {
          luderror.payment('❌ JobScheduler not initialized, falling back to manual status checking');
          // Could implement manual fallback here if needed
        }
      } catch (jobSchedulerError) {
        luderror.payment('❌ Failed to schedule subscription payment polling job:', jobSchedulerError);
        // Job scheduling failed - subscription will need manual verification
      }

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
      luderror.payment('SubscriptionPaymentService: Error creating subscription payment:', error);
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
      pricingInfo
    } = options;

    try {
      // Auto-detect environment from NODE_ENV
      const nodeEnv = process.env.NODE_ENV || 'development';
      const environment = nodeEnv === 'production' ? 'production' : 'staging';

      // Import PaymentService to get credentials
      const PaymentService = (await import('./PaymentService.js')).default;

      // Get PayPlus credentials (environment auto-detected)
      const { payplusUrl, payment_page_uid, payment_api_key, payment_secret_key } = PaymentService.getPayPlusCredentials();
      const payplusPaymentPageUrl = `${payplusUrl}PaymentPages/generateLink`;

      // Determine recurring settings based on billing period
      const recurringSettings = this.getRecurringSettings(subscriptionPlan);

      // CRITICAL: Get webhook URL for PayPlus callback
      const webhookUrl = this.getWebhookUrl();

      // Log webhook URL for debugging
      const ludlog = (await import('../lib/ludlog.js')).ludlog;
      ludlog.payment('🔗 SubscriptionPaymentService: Using webhook URL:', {
        webhookUrl,
        environment,
        subscriptionId: subscription.id
      });

      // Log if in test mode for visibility
      if (recurringSettings.testMode) {
        ludlog.payments.prod('🧪 DAILY SUBSCRIPTION TEST MODE ACTIVE:', {
          subscriptionId: subscription.id,
          subscriptionPlanId: subscriptionPlan.id,
          recurringType: recurringSettings.recurringType,
          message: 'First recurring charge will occur tomorrow (24 hours from now)',
          environment
        });
      }

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

        // Redirect URLs AND webhook callback for consistent UX with one-time purchases
        refURL_success: process.env.FRONTEND_URL + '/payment-result',
        refURL_failure: process.env.FRONTEND_URL + '/payment-result',
        refURL_cancel: process.env.FRONTEND_URL + '/payment-result',
        refURL_callback: webhookUrl, // CRITICAL FIX: Add webhook URL

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
        hide_other_charge_methods: false,
        send_failure_callback: true,
        create_token: true,
        hide_payments_field: true,
        payments: 1
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
      const responseText = await response.text();

      if (!response.ok) {
        luderror.payment(`PayPlus API HTTP error ${response.status}:`, {
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
        luderror.payment(`PayPlus API returned invalid JSON:`, {
          parseError: parseError.message,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(errorMsg);
      }

      if (paymentData?.results?.code || paymentData?.results?.status !== 'success') {
        luderror.payment(`PayPlus API error:`, paymentData?.results);
        throw new Error(errorMsg);
      }

      // Extract PayPlus response data
      const pageRequestUid = paymentData?.data?.page_request_uid;
      const paymentPageLink = paymentData?.data?.payment_page_link;

      if (!pageRequestUid || !paymentPageLink) {
        luderror.payment('PayPlus API missing required data:', {
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
        paymentUrl: paymentPageLink,
        qrCodeImage: paymentData?.data?.qr_code_image,
        environment,
        chargeMethod: 3,
        totalAmount: pricingInfo.finalPrice,
        data: paymentData
      };

    } catch (error) {
      luderror.payment('SubscriptionPaymentService: Error creating PayPlus subscription payment:', error);
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

    // TESTING MODE: Use daily billing in staging for rapid subscription testing
    // This allows testing the full subscription lifecycle in 2-3 days instead of waiting a month
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isStaging = nodeEnv !== 'production';
    const enableDailyTesting = process.env.ENABLE_DAILY_SUBSCRIPTION_TESTING === 'true';

    if (isStaging && enableDailyTesting) {
      // Override to daily billing for testing recurring webhooks
      return {
        recurringType: 0, // Daily
        recurringRange: 1,
        testMode: true
      };
    }

    switch (subscriptionPlan.billing_period) {
      case 'daily':
        recurringType = 0; // Daily
        recurringRange = 1;
        break;
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
      recurringRange,
      testMode: false
    };
  }

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
   * Handle subscription payment completion from webhook
   * @param {Object} subscription - Subscription object
   * @param {Object} webhookData - PayPlus webhook data
   * @param {Object} options - Additional options
   * @param {string} options.resolvedBy - Source of resolution ('webhook' or 'polling')
   * @returns {Promise<Object>} Updated subscription
   */
  static async handlePaymentSuccess(subscription, webhookData, options = {}) {
    try {
      const { resolvedBy = 'webhook' } = options;

      // Import SubscriptionService
      const SubscriptionService = (await import('./SubscriptionService.js')).default;

      // Extract PayPlus UID from webhook data before activation
      // PayPlus might send the recurring UID in different fields depending on webhook type
      const possibleUidFields = [
        webhookData.subscription_uid,
        webhookData.transaction?.recurring_charge_information?.recurring_uid, // ✅ FIX: Added missing path
        webhookData.recurring_charge_information?.recurring_uid,
        webhookData.recurring_uid,
        webhookData.recurring_info?.recurring_uid,
        webhookData.transaction?.subscription_uid,
        webhookData.recurring_charge_information?.subscription_uid
      ];

      const subscriptionUid = possibleUidFields.find(uid => uid && uid.trim());

      // CRITICAL: Detect renewal and update plan snapshot
      // A renewal is when subscription already has active status AND a PayPlus UID
      const isRenewal = subscription.status === 'active' && subscription.payplus_subscription_uid;

      if (isRenewal) {
        const { ludlog } = await import('../lib/ludlog.js');
        ludlog.payment('🔄 Renewal detected - updating plan snapshot with current benefits:', {
          subscriptionId: subscription.id.substring(0, 20) + '...',
          currentStatus: subscription.status,
          hasUID: !!subscription.payplus_subscription_uid
        });

        try {
          // Get current subscription plan to update snapshot with latest benefits
          const currentPlan = await models.SubscriptionPlan.findByPk(subscription.subscription_plan_id);

          if (currentPlan) {
            const pricingInfo = calcSubscriptionPlanPrice(currentPlan);

            // Update subscription with NEW snapshot at renewal
            await subscription.update({
              metadata: {
                ...subscription.metadata,
                planSnapshot: {
                  name: currentPlan.name,
                  description: currentPlan.description,
                  benefits: currentPlan.benefits, // ✅ Update with current plan benefits
                  originalPrice: pricingInfo.originalPrice,
                  discountInfo: pricingInfo.isDiscounted ? {
                    type: pricingInfo.discountType,
                    value: pricingInfo.discountValue,
                    amount: pricingInfo.discountAmount
                  } : null
                },
                lastSnapshotUpdate: new Date().toISOString(),
                snapshotUpdateReason: 'renewal',
                renewalAt: new Date().toISOString()
              }
            });

            ludlog.payment('✅ Plan snapshot updated at renewal:', {
              subscriptionId: subscription.id.substring(0, 20) + '...',
              planId: currentPlan.id,
              planName: currentPlan.name,
              benefitsUpdated: !!currentPlan.benefits
            });
          } else {
            luderror.payment('⚠️ Could not find subscription plan for renewal snapshot update:', {
              subscriptionId: subscription.id,
              subscriptionPlanId: subscription.subscription_plan_id
            });
          }
        } catch (snapshotError) {
          luderror.payment('❌ Failed to update plan snapshot at renewal:', {
            subscriptionId: subscription.id,
            error: snapshotError.message
          });
          // Don't fail the renewal if snapshot update fails - just log the error
        }
      }

      // Extract PayPlus status for subscription record
      const payplusStatus = webhookData.status ||
                           (webhookData.transaction?.status_code === '000' ? 'active' : 'unknown');

      // Activate subscription with PayPlus UID, status, and resolution source tracking
      const activatedSubscription = await SubscriptionService.activateSubscription(subscription.id, {
        payplusSubscriptionUid: subscriptionUid, // Set UID during activation
        payplusStatus: payplusStatus, // Set PayPlus status
        activationDate: new Date(),
        payplusWebhookData: webhookData,
        metadata: {
          paymentCompletedAt: new Date().toISOString(),
          payplusData: webhookData,
          payplusStatusCaptured: payplusStatus,
          resolvedBy: resolvedBy, // Track resolution source
          resolvedAt: new Date().toISOString()
        }
      });

      // Log UID capture result
      if (subscriptionUid) {
        const { ludlog } = await import('../lib/ludlog.js');
        ludlog.payment('✅ Activated subscription with PayPlus UID:', {
          subscriptionId: subscription.id.substring(0, 20) + '...',
          subscriptionUid: subscriptionUid.substring(0, 20) + '...',
          source: 'webhook',
          resolvedBy
        });
      } else {
        const { ludlog } = await import('../lib/ludlog.js');
        ludlog.payment('⚠️ No subscription UID found in webhook data for subscription:', {
          subscriptionId: subscription.id.substring(0, 20) + '...',
          checkedFields: possibleUidFields.map(field => field ? 'found' : 'null'),
          webhookDataKeys: Object.keys(webhookData),
          resolvedBy
        });
      }

      // Update the associated transaction with resolution source if it exists
      try {
        const transaction = await models.Transaction.findOne({
          where: {
            [models.Sequelize.Op.or]: [
              models.sequelize.literal(`metadata->>'subscription_id' = '${subscription.id}'`),
              { payment_page_request_uid: webhookData.transaction?.payment_page_request_uid }
            ]
          }
        });

        if (transaction) {
          await transaction.update({
            payment_status: 'completed',
            metadata: {
              ...transaction.metadata,
              payplus_transaction_uuid: webhookData.transaction_uid,
              payplus_approval_number: webhookData.information?.approval_number || webhookData.transaction?.approval_number,
              completed_at: new Date().toISOString(),
              completion_source: `subscription_${resolvedBy}`,
              resolvedBy: resolvedBy, // Track resolution source (webhook/polling)
              resolvedAt: new Date().toISOString()
            },
            updated_at: new Date()
          });
        }
      } catch (error) {
        // Don't fail activation if transaction update fails, just log it
        luderror.payment('Failed to update transaction with resolution source:', error);
      }

      return activatedSubscription;

    } catch (error) {
      luderror.payment('SubscriptionPaymentService: Error handling payment success:', error);
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
      // Extract PayPlus status for failed payment
      const payplusStatus = webhookData.status ||
                           (webhookData.transaction?.status_code ? 'failed' : 'unknown');

      // Update subscription status to failed with PayPlus status
      const updatedSubscription = await subscription.update({
        status: 'failed',
        payplus_status: payplusStatus, // Set PayPlus status for failures
        metadata: {
          ...subscription.metadata,
          paymentFailedAt: new Date().toISOString(),
          failureReason: webhookData.reason || 'Payment declined',
          payplusStatusCaptured: payplusStatus,
          payplusWebhookData: webhookData
        },
        updated_at: new Date()
      });

      return updatedSubscription;

    } catch (error) {
      luderror.payment('SubscriptionPaymentService: Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Create a retry payment for an existing pending subscription
   * @param {Object} options - Retry payment options
   * @param {string} options.userId - User ID
   * @param {Object} options.pendingSubscription - Existing pending subscription
   * @param {Object} options.subscriptionPlan - Subscription plan details
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Retry payment result
   */
  static async createRetryPayment(options = {}) {
    const {
      userId,
      pendingSubscription,
      subscriptionPlan,
      metadata = {}
    } = options;

    try {
      // Auto-detect environment from NODE_ENV
      const nodeEnv = process.env.NODE_ENV || 'development';
      const environment = nodeEnv === 'production' ? 'production' : 'staging';

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

      // Create new PayPlus payment page for the existing subscription
      const paymentResult = await this.createPayPlusSubscriptionPayment({
        subscription: pendingSubscription,
        subscriptionPlan,
        user,
        pricingInfo
      });

      // Create new transaction for retry payment
      const transaction = await PaymentService.createPayPlusTransaction({
        userId,
        amount: paymentResult.totalAmount,
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

      // CRITICAL: Start automatic polling for subscription retry payment status using persistent jobs
      // This replaces setTimeout-based polling with Redis-backed job scheduling
      // Jobs survive server restarts and provide better monitoring
      try {
        const jobScheduler = (await import('./JobScheduler.js')).default;

        if (jobScheduler.isInitialized) {
          await jobScheduler.scheduleJob('SUBSCRIPTION_PAYMENT_CHECK', {
            subscriptionId: pendingSubscription.id,
            attemptNumber: 1,
            maxAttempts: 6,
            isRetryPayment: true
          }, {
            delay: 5000, // Start first poll after 5 seconds
            priority: 100 // Highest priority for payment checking
          });

          ludlog.payment('✅ Scheduled persistent subscription retry payment polling:', {
            subscriptionId: pendingSubscription.id.substring(0, 20) + '...',
            startDelay: '5s',
            maxAttempts: 6,
            retryCount,
            source: 'job_scheduler'
          });
        } else {
          luderror.payment('❌ JobScheduler not initialized, falling back to manual status checking for retry');
          // Could implement manual fallback here if needed
        }
      } catch (jobSchedulerError) {
        luderror.payment('❌ Failed to schedule subscription retry payment polling job:', jobSchedulerError);
        // Job scheduling failed - subscription will need manual verification
      }

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
      luderror.payment('SubscriptionPaymentService: Error creating retry payment:', error);
      throw error;
    }
  }
}

export default SubscriptionPaymentService;