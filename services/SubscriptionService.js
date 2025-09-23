import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

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

      // TODO: Integrate with actual PayPlus subscription API
      const subscriptionPageUrl = `https://payplus.example.com/subscribe/${pendingSubscription.id}`;

      return {
        success: true,
        message: 'Subscription page created',
        data: {
          subscriptionUrl: subscriptionPageUrl,
          subscriptionId: pendingSubscription.id,
          plan: {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            billingPeriod: plan.billing_period
          }
        }
      };
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
          // TODO: Send subscription confirmation email
          console.log(`Subscription confirmation email should be sent to: ${payerEmail}`);
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

      // TODO: Check actual status with PayPlus API
      const isActive = new Date(subscription.end_date) > new Date();

      return {
        success: true,
        data: {
          recurringId,
          status: isActive ? 'active' : 'expired',
          nextPayment: isActive ? this.calculateNextBillingDate(subscription.end_date, subscription.SubscriptionPlan?.billing_period) : null,
          plan: subscription.SubscriptionPlan?.name
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

      // TODO: Cancel subscription with PayPlus API

      return {
        success: true,
        message: 'Recurring subscription cancelled',
        data: { 
          recurringId, 
          cancelled: true,
          cancellationDate: new Date().toISOString()
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
}

export default new SubscriptionService();