import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import PaymentService from './PaymentService.js';
import EmailService from './EmailService.js';

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

      // Create pending subscription record
      const pendingSubscription = await this.models.PendingSubscription.create({
        id: generateId(),
        created_at: new Date(),
        updated_at: new Date()
      });

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
          // Use token-based subscription creation for returning customers
          console.log('🔄 Creating token-based subscription for user:', userId);

          const tokenResult = await PaymentService.createRecurringSubscription({
            tokenUid: customerTokens[0].tokenUid,
            amount: plan.price,
            planType: plan.billing_period,
            userId,
            description: `${plan.name} - ${plan.billing_period} subscription`
          });

          if (tokenResult.success) {
            payplus_subscription_uid = tokenResult.subscriptionUid;
            subscriptionPageUrl = null; // No payment page needed for token-based subscriptions

            // Create active subscription immediately for token-based subscriptions
            await this.models.SubscriptionHistory.create({
              id: generateId(),
              user_id: userId,
              subscription_plan_id: planId,
              action_type: 'subscribe',
              start_date: new Date().toISOString(),
              end_date: this.calculateEndDate(plan.billing_period),
              purchased_price: plan.price,
              payplus_subscription_uid: payplus_subscription_uid,
              status: tokenResult.status,
              created_at: new Date(),
              updated_at: new Date()
            });

            // Clean up pending subscription since we created it directly
            await pendingSubscription.destroy();

            return {
              success: true,
              message: 'Token-based subscription created successfully',
              data: {
                subscriptionUrl: null,
                subscriptionId: payplus_subscription_uid,
                paymentMethod: 'token',
                status: tokenResult.status,
                plan: {
                  id: plan.id,
                  name: plan.name,
                  price: plan.price,
                  billingPeriod: plan.billing_period
                }
              }
            };
          } else {
            console.warn('Token-based subscription failed, falling back to payment page');
            // Fall through to payment page creation
          }
        }

        // Create PayPlus subscription payment page for new customers or token failure
        console.log('🔗 Creating PayPlus subscription payment page for user:', userId);

        const config = PaymentService.getPayplusConfig('production');

        const payload = {
          payment_page_uid: config.paymentPageUid,
          amount: plan.price.toFixed(2),
          currency_code: 'ILS',
          charge_method: 3, // Recurring payment
          recurring_settings: {
            intervalType: this.getPayplusIntervalType(plan.billing_period),
            intervalCount: 1,
            totalOccurrences: 0, // Unlimited
            trialDays: plan.trial_days || 0
          },
          custom_invoice_name: `${plan.name} Subscription`,
          more_info: `${plan.billing_period} subscription to ${plan.name}`,
          customer_name: user.full_name || user.display_name || 'Customer',
          customer_email: userEmail || user.email,
          sendEmailApproval: true,
          sendEmailFailure: true,
          refURL_success: `${process.env.FRONTEND_URL || 'https://ludora.app'}/subscription/success`,
          refURL_failure: `${process.env.FRONTEND_URL || 'https://ludora.app'}/subscription/failed`,
          refURL_callback: process.env.ENVIRONMENT === 'production'
            ? 'https://api.ludora.app/api/webhooks/payplus-subscription'
            : 'https://api.ludora.app/api/webhooks/payplus-subscription'
        };

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
          throw new Error(`PayPlus subscription page creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();

        if (!data.data?.payment_page_link) {
          throw new Error(`PayPlus API did not return a subscription payment link. Response: ${JSON.stringify(data)}`);
        }

        subscriptionPageUrl = data.data.payment_page_link;
        payplus_subscription_uid = data.data.page_request_uid;

        // Update pending subscription with PayPlus data
        await pendingSubscription.update({
          payplus_page_uid: payplus_subscription_uid,
          plan_id: planId,
          user_id: userId,
          amount: plan.price,
          payment_page_url: subscriptionPageUrl
        });

        return {
          success: true,
          message: 'Subscription page created',
          data: {
            subscriptionUrl: subscriptionPageUrl,
            subscriptionId: pendingSubscription.id,
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

  // Handle PayPlus subscription callback
  async handlePayplusSubscriptionCallback({ subscriptionId, status, planId, userId, payerEmail }) {
    try {
      // Find the pending subscription
      const pendingSubscription = await this.models.PendingSubscription.findByPk(subscriptionId);
      if (!pendingSubscription) {
        throw new Error('Pending subscription not found');
      }

      // Find the subscription plan
      const plan = await this.models.SubscriptionPlan.findByPk(planId);
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      if (status === 'active' || status === 'approved') {
        // Create subscription history record
        const subscriptionHistory = await this.models.SubscriptionHistory.create({
          id: generateId(),
          user_id: userId,
          subscription_plan_id: planId,
          action_type: 'subscribe',
          start_date: new Date().toISOString(),
          end_date: this.calculateEndDate(plan.billing_period),
          purchased_price: plan.price,
          payplus_subscription_uid: subscriptionId,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Clean up pending subscription
        await pendingSubscription.destroy();

        // Send confirmation email if email provided
        if (payerEmail) {
          try {
            await EmailService.sendSubscriptionConfirmationEmail({
              email: payerEmail,
              subscriptionData: {
                subscription_id: subscriptionHistory.id,
                plan_name: plan.name,
                plan_price: plan.price,
                billing_period: plan.billing_period,
                start_date: subscriptionHistory.start_date,
                end_date: subscriptionHistory.end_date,
                next_billing_date: this.calculateNextBillingDate(subscriptionHistory.end_date, plan.billing_period)
              }
            });
            console.log(`✅ Subscription confirmation email sent to: ${payerEmail}`);
          } catch (emailError) {
            console.warn('Failed to send subscription confirmation email:', emailError);
            // Don't throw error - subscription was successful, email is secondary
          }
        }

        return {
          success: true,
          message: 'Subscription activated successfully',
          data: {
            subscriptionId: subscriptionHistory.id,
            status: 'active',
            plan: plan.name,
            startDate: subscriptionHistory.start_date,
            endDate: subscriptionHistory.end_date
          }
        };
      } else if (status === 'cancelled' || status === 'failed') {
        // Handle failed subscription
        await this.models.SubscriptionHistory.create({
          id: generateId(),
          user_id: userId,
          subscription_plan_id: planId,
          action_type: 'subscribe_failed',
          notes: `Subscription failed with status: ${status}`,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Clean up pending subscription
        await pendingSubscription.destroy();
      }

      return {
        success: true,
        message: 'Subscription callback processed',
        data: { subscriptionId, status, processed: true }
      };
    } catch (error) {
      console.error('Error handling subscription callback:', error);
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

        const config = PaymentService.getPayplusConfig('production');

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
      case 'yearly':
        return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
      case 'weekly':
        return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
      default:
        return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString(); // Default to 30 days
    }
  }

  calculateNextBillingDate(endDate, billingPeriod) {
    const end = new Date(endDate);
    switch (billingPeriod) {
      case 'monthly':
        return new Date(end.getFullYear(), end.getMonth() + 1, end.getDate()).toISOString();
      case 'yearly':
        return new Date(end.getFullYear() + 1, end.getMonth(), end.getDate()).toISOString();
      case 'weekly':
        return new Date(end.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
      default:
        return new Date(end.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
    }
  }

  // Convert subscription billing periods to PayPlus interval types
  getPayplusIntervalType(billingPeriod) {
    const intervalMap = {
      'weekly': 1,      // Weekly
      'monthly': 2,     // Monthly
      'quarterly': 3,   // Quarterly
      'yearly': 4,      // Yearly
      'daily': 5        // Daily
    };

    return intervalMap[billingPeriod] || 2; // Default to monthly
  }
}

export default new SubscriptionService();