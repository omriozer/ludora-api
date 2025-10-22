import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import PaymentService from './PaymentService.js';
import EmailService from './EmailService.js';
import { Op } from 'sequelize';

class SubscriptionService {
  constructor() {
    this.models = models;
  }

  // Create PayPlus subscription page
  async createPayplusSubscriptionPage({ planId, userId, userEmail }) {
    try {
      // Find subscription plan
      const plan = await this.models.SubscriptionPlan.findByPk(planId);
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      if (!plan.is_active) {
        throw new Error('Subscription plan is not active');
      }

      // Create pending subscription record with all required fields
      const pendingSubscription = await this.models.PendingSubscription.create({
        id: generateId(),
        plan_id: planId,
        user_id: userId,
        amount: plan.price,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Initialize transaction variables (will be created AFTER successful PayPlus page creation)
      let transactionId = null;
      let transaction = null;
      let purchase = null;

      // Integrate with actual PayPlus subscription API
      try {
        // Get user information for PayPlus
        const user = await this.models.User.findByPk(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Check for existing customer tokens for seamless subscription
        const customerTokens = await PaymentService.getCustomerTokens(userId);

        let subscriptionPageUrl;
        let payplus_subscription_uid;

        if (customerTokens.length > 0) {
          // Use PayPlus /RecurringPayments/Add API for token-based subscriptions
          console.log('🔄 Creating token-based subscription for user:', userId, 'using PayPlus /RecurringPayments/Add');

          try {
            const config = PaymentService.getPayplusConfig(process.env.ENVIRONMENT || 'development');
            const selectedToken = customerTokens[0]; // Use first available token

            // Build RecurringPayments/Add payload according to PayPlus API
            const recurringPayload = {
              customer_uid: selectedToken.payplus_customer_uid,
              token_uid: selectedToken.token_value, // Use correct field name from CustomerToken model
              amount: parseFloat(plan.price),
              currency_code: 'ILS',
              recurring_type: this.getPayplusIntervalType(plan.billing_period),
              recurring_range: 1, // Every billing period
              number_of_charges: 0, // Unlimited charges
              description: `${plan.name} - ${plan.billing_period} subscription`,
              more_info: `Token-based subscription for ${user.full_name || user.display_name || 'Customer'}`,
              customer_name: user.full_name || user.display_name || 'Customer',
              customer_email: userEmail || user.email,
              sendEmailApproval: true,
              sendEmailFailure: true
            };

            console.log('🚀 PayPlus Token Subscription API Request:', {
              url: `${config.apiBaseUrl}/RecurringPayments/Add`,
              payload: {
                ...recurringPayload,
                token_uid: `${recurringPayload.token_uid?.substring(0, 8)}...` // Hide token for logging
              }
            });

            const response = await fetch(`${config.apiBaseUrl}/RecurringPayments/Add`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': config.apiKey,
                'secret-key': config.secretKey
              },
              body: JSON.stringify(recurringPayload)
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('❌ PayPlus Token Subscription API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
              });
              throw new Error(`PayPlus token subscription failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const data = await response.json();

            if (data.results?.status === '000' || data.data?.status === 'success') {
              // Token-based subscription created successfully
              payplus_subscription_uid = data.data?.subscription_uid || data.results?.subscription_uid || data.uid;
              subscriptionPageUrl = null; // No payment page needed

              console.log('✅ Token-based subscription created successfully:', payplus_subscription_uid);

              // Mark transaction as completed for token-based payment
              if (transaction) {
                await transaction.update({
                  payment_status: 'completed',
                  completed_at: new Date(),
                  processing_source: 'token_api',
                  processing_completed_at: new Date(),
                  race_condition_winner: 'token_api',
                  payplus_response: {
                    ...data,
                    payment_method: 'token',
                    token_used: selectedToken.id,
                    created_via: 'token_api'
                  }
                });
              }

              // Mark purchase as completed
              if (purchase) {
                await purchase.update({
                  payment_status: 'completed',
                  metadata: {
                    ...purchase.metadata,
                    payment_method: 'token',
                    token_used: selectedToken.id,
                    payplus_response: data,
                    created_via: 'token_api'
                  }
                });
              }

              // Create active subscription immediately
              const subscriptionHistory = await this.models.SubscriptionHistory.create({
                id: generateId(),
                user_id: userId,
                subscription_plan_id: planId,
                action_type: 'subscribe',
                start_date: new Date().toISOString(),
                end_date: this.calculateEndDate(plan.billing_period),
                purchased_price: plan.price,
                payplus_subscription_uid: payplus_subscription_uid,
                status: 'active',
                metadata: {
                  payment_method: 'token',
                  token_used: selectedToken.id,
                  payplus_response: data,
                  created_via: 'token_api',
                  transaction_id: transactionId // Link to transaction
                },
                created_at: new Date(),
                updated_at: new Date()
              });

              // Mark token as used
              await selectedToken.markAsUsed();

              // Clean up pending subscription
              await pendingSubscription.destroy();

              return {
                success: true,
                message: 'Token-based subscription created successfully',
                data: {
                  subscriptionUrl: null,
                  subscriptionId: subscriptionHistory.id,
                  transactionId: transactionId,
                  payplusSubscriptionUid: payplus_subscription_uid,
                  paymentMethod: 'token',
                  status: 'active',
                  plan: {
                    id: plan.id,
                    name: plan.name,
                    price: plan.price,
                    billingPeriod: plan.billing_period
                  }
                }
              };
            } else {
              throw new Error(`PayPlus API returned unsuccessful status: ${JSON.stringify(data)}`);
            }

          } catch (tokenError) {
            console.error('❌ Token-based subscription creation failed:', tokenError.message);
            console.warn('🔄 Falling back to payment page creation for new customer flow');
            // Fall through to payment page creation
          }
        }

        // Create PayPlus subscription payment page for new customers or token failure
        console.log('🔗 Creating PayPlus subscription payment page for user:', userId);

        const config = PaymentService.getPayplusConfig(process.env.ENVIRONMENT || 'development');

        const recurringSettings = {
          instant_first_payment: true,
          recurring_type: this.getPayplusIntervalType(plan.billing_period),
          recurring_range: 1, // number of changes per billing period
          number_of_charges: 0, // 0 = unlimited charges
          start_date_on_payment_date: false,
          start_date: 1,
          successful_invoice: true,
          customer_failure_email: true
        };

        console.log('🔍 RECURRING SETTINGS DEBUG:', JSON.stringify(recurringSettings, null, 2));
        console.log('🔍 RECURRING SETTINGS KEYS:', Object.keys(recurringSettings));

        const payload = {
          payment_page_uid: config.paymentPageUid,
          amount: Number(plan.price || 0).toFixed(2),
          currency_code: 'ILS',
          charge_method: 3, // Recurring payment
          recurring_settings: recurringSettings,
          custom_invoice_name: `${plan.name} Subscription`,
          more_info: `${plan.billing_period} subscription to ${plan.name}`,
          customer_name: user.full_name || user.display_name || 'Customer',
          customer_email: userEmail || user.email,
          sendEmailApproval: true,
          sendEmailFailure: true,
          refURL_success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/account`,
          refURL_failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/account`,
          refURL_callback: process.env.ENVIRONMENT === 'production'
            ? 'https://api.ludora.app/api/webhooks/payplus-subscription'
            : 'http://localhost:3003/api/webhooks/payplus-subscription'
        };

        console.log('🚀 PayPlus Subscription API Request (FULL DEBUG):', {
          url: `${config.apiBaseUrl}/PaymentPages/generateLink`,
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'MISSING',
            'secret-key': config.secretKey ? `${config.secretKey.substring(0, 8)}...` : 'MISSING'
          },
          payload: payload,
          payloadString: JSON.stringify(payload, null, 2)
        });

        const response = await fetch(`${config.apiBaseUrl}/PaymentPages/generateLink`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey,
            'secret-key': config.secretKey
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ PayPlus Subscription API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorData: errorData,
            sentPayload: payload
          });

          // Provide detailed error for 422 validation errors
          if (response.status === 422) {
            const validationDetails = errorData.errors || errorData.message || JSON.stringify(errorData);
            console.error('❌ PayPlus 422 Validation Error Details:', validationDetails);
            throw new Error(`PayPlus subscription validation failed (422): ${validationDetails}`);
          }

          throw new Error(`PayPlus subscription page creation failed: ${response.status} - ${errorData.message || JSON.stringify(errorData) || 'Unknown error'}`);
        }

        const data = await response.json();

        if (!data.data?.payment_page_link) {
          throw new Error(`PayPlus API did not return a subscription payment link. Response: ${JSON.stringify(data)}`);
        }

        subscriptionPageUrl = data.data.payment_page_link;
        payplus_subscription_uid = data.data.page_request_uid;

        // Update pending subscription with PayPlus-specific data
        await pendingSubscription.update({
          payplus_page_uid: payplus_subscription_uid,
          payment_page_url: subscriptionPageUrl
        });

        // NOW create Transaction and Purchase records after successful PayPlus page creation
        try {
          transactionId = generateId();
          transaction = await this.models.Transaction.create({
            id: transactionId,
            total_amount: plan.price,
            payment_status: 'pending',
            payment_method: 'payplus',
            environment: process.env.ENVIRONMENT || 'development',
            payplus_page_uid: payplus_subscription_uid,
            payment_url: subscriptionPageUrl,
            payplus_response: {
              payment_page_link: subscriptionPageUrl,
              page_request_uid: payplus_subscription_uid,
              created_via: 'subscription_payment_page'
            },
            created_at: new Date(),
            updated_at: new Date()
          });

          // Create Purchase record to link user to subscription via transaction
          purchase = await this.models.Purchase.create({
            id: generateId(),
            transaction_id: transactionId,
            buyer_user_id: userId,
            payment_amount: plan.price,
            original_price: plan.price,
            payment_status: 'pending',
            purchasable_type: 'subscription',
            purchasable_id: planId,
            metadata: {
              subscription_type: 'payplus_subscription',
              billing_period: plan.billing_period,
              plan_name: plan.name,
              pending_subscription_id: pendingSubscription.id,
              payplus_page_request_uid: payplus_subscription_uid,
              transaction_type: 'subscription',
              environment: process.env.ENVIRONMENT || 'development'
            },
            created_at: new Date(),
            updated_at: new Date()
          });

          console.log(`✅ Created transaction ${transactionId} and purchase after successful PayPlus page creation`);

        } catch (transactionError) {
          console.error('⚠️ Failed to create transaction/purchase records for subscription:', transactionError);
          // Don't fail the whole flow - payment page was created successfully
          console.log('🔄 Continuing with subscription creation - payment page created but without transaction tracking');
        }

        return {
          success: true,
          message: 'Subscription page created',
          data: {
            subscriptionUrl: subscriptionPageUrl,
            subscriptionId: pendingSubscription.id,
            transactionId: transactionId,
            payplusUid: payplus_subscription_uid,
            paymentMethod: 'payment_page',
            plan: {
              id: plan.id,
              name: plan.name,
              price: plan.price,
              billingPeriod: plan.billing_period
            }
          }
        };

      } catch (paymentError) {
        console.error('PayPlus subscription creation error:', paymentError);
        throw new Error(`Failed to create subscription: ${paymentError.message}`);
      }
    } catch (error) {
      console.error('Error creating subscription page:', error);
      throw error;
    }
  }

  // Handle PayPlus subscription callback with enhanced field mapping and status handling
  async handlePayplusSubscriptionCallback({
    subscriptionId,
    status,
    planId,
    userId,
    payerEmail,
    customerName,
    amount,
    nextPaymentDate,
    callbackData
  }) {
    try {
      console.log('🔔 Enhanced subscription callback processing started:', {
        subscriptionId,
        status,
        planId,
        userId,
        payerEmail,
        customerName,
        amount,
        nextPaymentDate
      });

      // Enhanced status mapping for comprehensive PayPlus status codes
      const statusMap = {
        'active': 'active',
        'approved': 'active',
        'completed': 'active',
        'success': 'active',
        'paid': 'active',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
        'failed': 'failed',
        'declined': 'failed',
        'error': 'failed',
        'rejected': 'failed',
        'expired': 'expired',
        'pending': 'pending',
        'processing': 'pending'
      };

      const normalizedStatus = statusMap[status?.toLowerCase()] || 'failed';
      console.log(`📊 Enhanced status mapping: "${status}" → "${normalizedStatus}"`);

      // Find the pending subscription with enhanced error handling
      let pendingSubscription = null;
      let subscriptionLookupMethod = 'pending_subscription_id';

      try {
        pendingSubscription = await this.models.PendingSubscription.findByPk(subscriptionId);
        if (!pendingSubscription) {
          // Try alternative lookup by PayPlus UID
          pendingSubscription = await this.models.PendingSubscription.findOne({
            where: { payplus_page_uid: subscriptionId }
          });
          subscriptionLookupMethod = 'payplus_page_uid';
        }
      } catch (lookupError) {
        console.warn('Warning finding pending subscription:', lookupError.message);
      }

      if (!pendingSubscription) {
        console.warn(`⚠️ No pending subscription found for ID: ${subscriptionId} (tried ${subscriptionLookupMethod})`);
        // Continue processing without pending subscription for direct PayPlus webhooks
      }

      // Enhanced plan lookup with validation
      let plan = null;
      if (planId) {
        plan = await this.models.SubscriptionPlan.findByPk(planId);
        if (!plan) {
          throw new Error(`Subscription plan not found: ${planId}`);
        }
        if (!plan.is_active) {
          console.warn(`⚠️ Processing callback for inactive plan: ${planId}`);
        }
      } else if (pendingSubscription) {
        // Get plan from pending subscription if not provided
        plan = await this.models.SubscriptionPlan.findByPk(pendingSubscription.plan_id);
        planId = pendingSubscription.plan_id;
      }

      if (!plan) {
        throw new Error('No subscription plan found in callback or pending subscription');
      }

      // Enhanced user lookup with validation
      let user = null;
      if (userId) {
        user = await this.models.User.findByPk(userId);
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }
      } else if (pendingSubscription) {
        // Get user from pending subscription if not provided
        user = await this.models.User.findByPk(pendingSubscription.user_id);
        userId = pendingSubscription.user_id;
      }

      if (!user) {
        throw new Error('No user found in callback or pending subscription');
      }

      console.log(`✅ Enhanced validation complete: User ${userId}, Plan ${planId}, Status ${normalizedStatus}`);

      // Process based on normalized status
      if (normalizedStatus === 'active') {
        console.log('✅ Subscription approved - enhanced activation process');

        // Find associated transaction to complete it using PaymentCompletionService
        let transaction = null;
        if (pendingSubscription) {
          // Find transaction linked to this subscription via Purchase record
          const purchase = await this.models.Purchase.findOne({
            where: {
              buyer_user_id: userId,
              purchasable_type: 'subscription',
              purchasable_id: planId,
              payment_status: 'pending'
            },
            include: [{
              model: this.models.Transaction,
              as: 'transaction',
              where: {
                payment_status: { [Op.in]: ['pending', 'in_progress'] }
              }
            }],
            order: [['created_at', 'DESC']]
          });

          if (purchase && purchase.transaction) {
            transaction = purchase.transaction;
            console.log(`✅ Found associated transaction: ${transaction.id}`);

            // Import and use PaymentCompletionService for consistent processing
            const PaymentCompletionService = (await import('./PaymentCompletionService.js')).default;
            const completionService = new PaymentCompletionService();

            const completionResult = await completionService.processCompletion(
              transaction.id,
              {
                status: 'completed',
                status_code: '000',
                subscription_uid: subscriptionId,
                customer: {
                  name: customerName,
                  email: payerEmail
                },
                amount: amount,
                next_payment_date: nextPaymentDate,
                callback_data: callbackData
              },
              'webhook'
            );

            console.log(`✅ Transaction completion result: ${JSON.stringify(completionResult)}`);
          } else {
            console.warn(`⚠️ No associated transaction found for subscription ${subscriptionId}`);
          }
        }

        // Calculate subscription dates with next payment date if provided
        const subscriptionStartDate = new Date().toISOString();
        const subscriptionEndDate = nextPaymentDate
          ? new Date(nextPaymentDate).toISOString()
          : this.calculateEndDate(plan.billing_period);

        // Enhanced metadata for subscription history
        const enhancedMetadata = {
          payplus_callback_data: callbackData,
          customer_name: customerName,
          customer_email: payerEmail,
          paid_amount: amount,
          next_payment_date: nextPaymentDate,
          webhook_processed_at: new Date().toISOString(),
          subscription_lookup_method: subscriptionLookupMethod,
          enhanced_processing: true,
          transaction_id: transaction ? transaction.id : null // Link to transaction
        };

        // CLEAN ARCHITECTURE: Subscription data stored in SubscriptionHistory, not User table
        console.log(`✅ Subscription data will be stored in SubscriptionHistory table (clean architecture)`);

        // Create enhanced subscription history record
        const subscriptionHistory = await this.models.SubscriptionHistory.create({
          id: generateId(),
          user_id: userId,
          subscription_plan_id: planId,
          action_type: 'subscribe',
          start_date: subscriptionStartDate,
          end_date: subscriptionEndDate,
          purchased_price: amount || plan.price,
          payplus_subscription_uid: subscriptionId,
          status: normalizedStatus,
          metadata: enhancedMetadata,
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`✅ Created enhanced subscription history record: ${subscriptionHistory.id}`);

        // Clean up pending subscription if found
        if (pendingSubscription) {
          await pendingSubscription.destroy();
          console.log('🗑️ Cleaned up pending subscription record');
        }

        // Enhanced email notification with customer name
        if (payerEmail) {
          try {
            await EmailService.sendSubscriptionConfirmationEmail({
              email: payerEmail,
              customerName: customerName,
              subscriptionData: {
                subscription_id: subscriptionHistory.id,
                plan_name: plan.name,
                plan_price: amount || plan.price,
                billing_period: plan.billing_period,
                start_date: subscriptionHistory.start_date,
                end_date: subscriptionHistory.end_date,
                next_billing_date: nextPaymentDate || this.calculateNextBillingDate(subscriptionHistory.end_date, plan.billing_period)
              }
            });
            console.log(`✅ Enhanced subscription confirmation email sent to: ${payerEmail}`);
          } catch (emailError) {
            console.warn('Failed to send subscription confirmation email:', emailError);
            // Don't throw error - subscription was successful, email is secondary
          }
        }

        return {
          success: true,
          message: 'Subscription activated successfully with enhanced processing',
          data: {
            subscriptionId: subscriptionHistory.id,
            status: normalizedStatus,
            plan: plan.name,
            startDate: subscriptionHistory.start_date,
            endDate: subscriptionHistory.end_date,
            customerName,
            amount: amount || plan.price,
            enhancedProcessing: true
          }
        };

      } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'failed' || normalizedStatus === 'expired') {
        console.log(`❌ Subscription ${normalizedStatus} - enhanced failure processing`);

        // Enhanced metadata for failed subscriptions
        const failureMetadata = {
          failure_reason: status,
          payplus_callback_data: callbackData,
          customer_name: customerName,
          customer_email: payerEmail,
          attempted_amount: amount,
          webhook_processed_at: new Date().toISOString(),
          enhanced_processing: true
        };

        // CLEAN ARCHITECTURE: Failed subscription status tracked in SubscriptionHistory, not User table
        console.log(`✅ Failed subscription status will be tracked in SubscriptionHistory table`);

        // Create enhanced failure history record
        await this.models.SubscriptionHistory.create({
          id: generateId(),
          user_id: userId,
          subscription_plan_id: planId,
          action_type: `subscribe_${normalizedStatus}`,
          notes: `Subscription ${normalizedStatus} with status: ${status}`,
          status: normalizedStatus,
          metadata: failureMetadata,
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`📝 Created enhanced ${normalizedStatus} subscription history record`);

        // Clean up pending subscription if found
        if (pendingSubscription) {
          await pendingSubscription.destroy();
          console.log('🗑️ Cleaned up pending subscription record after failure');
        }

        return {
          success: true,
          message: `Subscription ${normalizedStatus} processed with enhanced handling`,
          data: {
            subscriptionId,
            status: normalizedStatus,
            originalStatus: status,
            plan: plan.name,
            enhancedProcessing: true
          }
        };

      } else if (normalizedStatus === 'pending') {
        console.log(`⏳ Subscription pending - enhanced pending state handling`);

        // For pending status, just log and wait for final callback
        const pendingMetadata = {
          pending_status: status,
          payplus_callback_data: callbackData,
          customer_name: customerName,
          customer_email: payerEmail,
          webhook_processed_at: new Date().toISOString(),
          enhanced_processing: true
        };

        // CLEAN ARCHITECTURE: Pending subscription status tracked in SubscriptionHistory
        console.log(`✅ Pending subscription status tracked in SubscriptionHistory table`);

        // Log pending status
        await this.models.SubscriptionHistory.create({
          id: generateId(),
          user_id: userId,
          subscription_plan_id: planId,
          action_type: 'subscribe_pending',
          notes: `Subscription pending with status: ${status}`,
          status: normalizedStatus,
          metadata: pendingMetadata,
          created_at: new Date(),
          updated_at: new Date()
        });

        return {
          success: true,
          message: 'Subscription pending status processed with enhanced handling',
          data: {
            subscriptionId,
            status: normalizedStatus,
            originalStatus: status,
            plan: plan.name,
            enhancedProcessing: true
          }
        };
      }

      // Fallback for unknown status
      console.warn(`⚠️ Unknown subscription status: ${status} (normalized: ${normalizedStatus})`);
      return {
        success: true,
        message: 'Subscription callback processed with unknown status',
        data: {
          subscriptionId,
          status: normalizedStatus,
          originalStatus: status,
          processed: true,
          enhancedProcessing: true
        }
      };

    } catch (error) {
      console.error('❌ Enhanced subscription callback processing failed:', error);
      throw error;
    }
  }

  // Check subscription status
  async checkSubscriptionStatus({ subscriptionId, userId }) {
    try {
      // Find active subscription
      const subscription = await this.models.SubscriptionHistory.findOne({
        where: {
          user_id: userId,
          action_type: 'subscribe'
        },
        include: [{
          model: this.models.SubscriptionPlan,
          as: 'plan'
        }],
        order: [['created_at', 'DESC']]
      });

      if (!subscription) {
        return {
          success: true,
          data: {
            status: 'no_subscription',
            message: 'No active subscription found'
          }
        };
      }

      // Check if subscription is still active
      const endDate = new Date(subscription.end_date);
      const now = new Date();
      const isActive = endDate > now;

      return {
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: isActive ? 'active' : 'expired',
          planName: subscription.SubscriptionPlan?.name,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          nextBillingDate: isActive ? this.calculateNextBillingDate(subscription.end_date, subscription.SubscriptionPlan?.billing_period) : null
        }
      };
    } catch (error) {
      console.error('Error checking subscription status:', error);
      throw error;
    }
  }

  // Get PayPlus recurring status
  async getPayplusRecurringStatus({ recurringId }) {
    try {
      // Find subscription by PayPlus UID
      const subscription = await this.models.SubscriptionHistory.findOne({
        where: { payplus_subscription_uid: recurringId },
        include: [{
          model: this.models.SubscriptionPlan,
          as: 'plan'
        }]
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Check actual status with PayPlus API
      let apiStatus;
      let nextBillingDate;
      let totalPayments;
      let lastPaymentDate;

      try {
        console.log(`🔍 Checking PayPlus API status for subscription: ${recurringId}`);
        const statusResult = await PaymentService.checkSubscriptionStatus(recurringId);

        if (statusResult.success) {
          apiStatus = statusResult.status;
          nextBillingDate = statusResult.nextBillingDate;
          totalPayments = statusResult.totalPayments;
          lastPaymentDate = statusResult.lastPayment;

          console.log(`✅ PayPlus API returned status: ${apiStatus} for subscription: ${recurringId}`);

          // Update our local subscription record with the latest API data
          const updateData = {
            status: apiStatus,
            updated_at: new Date(),
            metadata: {
              ...subscription.metadata,
              last_api_check: new Date().toISOString(),
              payplus_status: apiStatus,
              total_payments: totalPayments
            }
          };

          if (nextBillingDate) {
            updateData.next_billing_date = new Date(nextBillingDate);
            updateData.end_date = new Date(nextBillingDate);
          }

          await subscription.update(updateData);

        } else {
          console.warn(`⚠️ PayPlus API check failed for subscription ${recurringId}:`, statusResult);
          // Fall back to local data
          const isActive = new Date(subscription.end_date) > new Date();
          apiStatus = isActive ? 'active' : 'expired';
        }
      } catch (apiError) {
        console.error(`❌ Error checking PayPlus API for subscription ${recurringId}:`, apiError);
        // Fall back to local data
        const isActive = new Date(subscription.end_date) > new Date();
        apiStatus = isActive ? 'active' : 'expired';
      }

      // Calculate next payment date (use API data if available, otherwise calculate)
      const nextPayment = apiStatus === 'active'
        ? (nextBillingDate || this.calculateNextBillingDate(subscription.end_date, subscription.SubscriptionPlan?.billing_period))
        : null;

      return {
        success: true,
        data: {
          recurringId,
          status: apiStatus,
          nextPayment,
          plan: subscription.SubscriptionPlan?.name,
          totalPayments: totalPayments || 0,
          lastPaymentDate: lastPaymentDate || subscription.created_at,
          lastApiCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error getting recurring status:', error);
      throw error;
    }
  }

  // Cancel PayPlus recurring subscription
  async cancelPayplusRecurringSubscription({ recurringId, userId, reason }) {
    try {
      // Find active subscription
      const subscription = await this.models.SubscriptionHistory.findOne({
        where: { 
          payplus_subscription_uid: recurringId,
          user_id: userId 
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Create cancellation record
      await this.models.SubscriptionHistory.create({
        id: generateId(),
        user_id: userId,
        subscription_plan_id: subscription.subscription_plan_id,
        previous_plan_id: subscription.subscription_plan_id,
        action_type: 'cancel',
        cancellation_reason: reason,
        notes: 'Subscription cancelled by user',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Cancel subscription with PayPlus API
      try {
        console.log(`🛑 Cancelling PayPlus subscription: ${recurringId}`);

        const config = PaymentService.getPayplusConfig(process.env.ENVIRONMENT || 'development');

        const cancelPayload = {
          subscription_uid: recurringId,
          cancellation_reason: reason || 'User requested cancellation'
        };

        const response = await fetch(`${config.apiBaseUrl}/Subscriptions/Cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey,
            'secret-key': config.secretKey
          },
          body: JSON.stringify(cancelPayload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ PayPlus cancellation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);

          // Still create local cancellation record even if API call fails
          console.log('📝 Creating local cancellation record despite API failure');
        } else {
          const data = await response.json();
          console.log(`✅ PayPlus subscription cancelled successfully:`, data);

          // Update subscription with cancellation data from PayPlus
          await subscription.update({
            status: 'cancelled',
            cancelled_at: new Date(),
            updated_at: new Date(),
            metadata: {
              ...subscription.metadata,
              payplus_cancellation_response: data,
              cancelled_via_api: true,
              cancellation_date: new Date().toISOString()
            }
          });
        }

      } catch (apiError) {
        console.error(`❌ Error calling PayPlus cancellation API for subscription ${recurringId}:`, apiError);
        // Continue with local cancellation record creation
      }

      return {
        success: true,
        message: 'Recurring subscription cancelled',
        data: {
          recurringId,
          cancelled: true,
          cancellationDate: new Date().toISOString(),
          reason: reason || 'User requested cancellation'
        }
      };
    } catch (error) {
      console.error('Error cancelling recurring subscription:', error);
      throw error;
    }
  }

  // Process subscription callbacks (batch)
  async processSubscriptionCallbacks({ callbacks }) {
    try {
      const results = [];

      for (const callback of callbacks) {
        try {
          const result = await this.handlePayplusSubscriptionCallback(callback);
          results.push({
            subscriptionId: callback.subscriptionId,
            status: 'processed',
            data: result.data
          });
        } catch (error) {
          results.push({
            subscriptionId: callback.subscriptionId,
            status: 'failed',
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: 'Subscription callbacks processed',
        data: { 
          processed: results.length, 
          successful: results.filter(r => r.status === 'processed').length,
          failed: results.filter(r => r.status === 'failed').length,
          results 
        }
      };
    } catch (error) {
      console.error('Error processing subscription callbacks:', error);
      throw error;
    }
  }

  // Helper methods
  calculateEndDate(billingPeriod) {
    const now = new Date();
    switch (billingPeriod) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
      case 'weekly':
        return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
      default:
        return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString(); // Default to 30 days
    }
  }

  calculateNextBillingDate(endDate, billingPeriod) {
    const end = new Date(endDate);
    const monthly = new Date(end.getFullYear(), end.getMonth() + 1, end.getDate()).toISOString();
    switch (billingPeriod) {
      case 'monthly':
        return monthly;
      case 'weekly':
        return new Date(end.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
      case 'daily':
        return new Date(end.getTime() + (24 * 60 * 60 * 1000)).toISOString();
      default:
        return monthly;
    }
  }

  // Convert subscription billing periods to PayPlus interval types
  getPayplusIntervalType(billingPeriod) {
    const intervalMap = {
      'daily': 0,      // Daily
      'weekly': 1,     // Weekly
      'monthly': 2,   // Monthly
    };

    return intervalMap[billingPeriod] || 2; // Default to monthly
  }
}

export default new SubscriptionService();