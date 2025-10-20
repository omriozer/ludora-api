import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import cron from 'node-cron';

/**
 * SubscriptionMonitoringService - Background service for monitoring subscription statuses
 *
 * This service runs scheduled jobs to check subscription statuses via PayPlus API
 * and update local records accordingly. It handles:
 * - Hourly subscription status checks
 * - Renewal date updates
 * - Failed payment detection
 * - Subscription expiration handling
 */
class SubscriptionMonitoringService {
  constructor() {
    this.models = models;
    this.isJobRunning = false;
    this.lastRunTime = null;
    this.stats = {
      totalChecked: 0,
      statusUpdated: 0,
      errors: 0,
      lastRun: null
    };
  }

  /**
   * Start the hourly subscription monitoring cron job
   */
  startHourlyMonitoring() {
    console.log('🕐 Starting hourly subscription monitoring service...');

    // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
    const cronJob = cron.schedule('0 * * * *', async () => {
      if (this.isJobRunning) {
        console.log('⚠️ Subscription monitoring job already running, skipping this cycle');
        return;
      }

      console.log('🔍 Starting hourly subscription status check...');
      await this.checkAllActiveSubscriptions();
    }, {
      scheduled: true,
      timezone: "Asia/Jerusalem" // Adjust timezone as needed
    });

    console.log('✅ Hourly subscription monitoring started - will run every hour');
    return cronJob;
  }

  /**
   * Check all active subscriptions and update their status
   */
  async checkAllActiveSubscriptions() {
    this.isJobRunning = true;
    this.lastRunTime = new Date();

    const startTime = Date.now();
    let checkedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
      console.log('🔍 SubscriptionMonitoring: Fetching all active subscriptions...');

      // Find all active subscriptions that have PayPlus UIDs
      const activeSubscriptions = await this.models.Subscription?.findAll({
        where: {
          status: ['active', 'trial', 'pending'],
          payplus_subscription_uid: {
            [this.models.Sequelize.Op.ne]: null
          }
        },
        include: [{
          model: this.models.User,
          as: 'user',
          attributes: ['id', 'email', 'full_name']
        }, {
          model: this.models.SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'billing_period', 'price']
        }]
      }) || [];

      console.log(`📊 Found ${activeSubscriptions.length} active subscriptions to check`);

      if (activeSubscriptions.length === 0) {
        console.log('✅ No active subscriptions found, monitoring cycle complete');
        this.isJobRunning = false;
        return;
      }

      // Process subscriptions in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < activeSubscriptions.length; i += batchSize) {
        const batch = activeSubscriptions.slice(i, i + batchSize);

        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeSubscriptions.length / batchSize)} (${batch.length} subscriptions)`);

        // Process batch with small delay between calls to be API-friendly
        for (const subscription of batch) {
          try {
            checkedCount++;
            const wasUpdated = await this.checkSubscriptionStatus(subscription);
            if (wasUpdated) {
              updatedCount++;
            }

            // Small delay to be respectful to PayPlus API
            await this.sleep(100);

          } catch (subscriptionError) {
            errorCount++;
            console.error(`❌ Error checking subscription ${subscription.id}:`, subscriptionError.message);
          }
        }

        // Longer delay between batches
        if (i + batchSize < activeSubscriptions.length) {
          await this.sleep(1000);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Subscription monitoring complete - ${checkedCount} checked, ${updatedCount} updated, ${errorCount} errors in ${duration}ms`);

      // Update statistics
      this.stats = {
        totalChecked: checkedCount,
        statusUpdated: updatedCount,
        errors: errorCount,
        lastRun: new Date()
      };

    } catch (error) {
      console.error('❌ Fatal error in subscription monitoring:', error);
      errorCount++;
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Check a single subscription's status via PayPlus API
   */
  async checkSubscriptionStatus(subscription) {
    try {
      if (!subscription.payplus_subscription_uid) {
        console.log(`⚠️ Subscription ${subscription.id} has no PayPlus UID, skipping`);
        return false;
      }

      console.log(`🔍 Checking PayPlus status for subscription ${subscription.id} (User: ${subscription.user?.email})`);

      // Use PaymentService to check subscription status
      const statusResult = await PaymentService.checkSubscriptionStatus(subscription.payplus_subscription_uid);

      if (!statusResult.success) {
        console.warn(`⚠️ PayPlus API check failed for subscription ${subscription.id}`);
        return false;
      }

      const payplusStatus = statusResult.status;
      const currentStatus = subscription.status;

      // Map PayPlus status to our subscription status
      let newStatus = this.mapPayplusStatusToInternal(payplusStatus);
      let shouldUpdate = false;
      let shouldUpdateBilling = false;

      // Check if status changed
      if (newStatus && newStatus !== currentStatus) {
        console.log(`🔄 Subscription ${subscription.id} status changed: ${currentStatus} → ${newStatus}`);
        shouldUpdate = true;
      }

      // Check if billing information needs updating
      if (statusResult.nextBillingDate) {
        const currentNextBilling = subscription.next_billing_date?.getTime();
        const newNextBilling = new Date(statusResult.nextBillingDate).getTime();

        if (currentNextBilling !== newNextBilling) {
          console.log(`📅 Subscription ${subscription.id} billing date update needed`);
          shouldUpdateBilling = true;
          shouldUpdate = true;
        }
      }

      // Update subscription if needed
      if (shouldUpdate) {
        const updateData = {
          updated_at: new Date(),
          metadata: {
            ...subscription.metadata,
            last_api_check: new Date().toISOString(),
            payplus_status: payplusStatus,
            monitoring_check: true,
            total_payments: statusResult.totalPayments
          }
        };

        if (newStatus) {
          updateData.status = newStatus;
        }

        if (shouldUpdateBilling && statusResult.nextBillingDate) {
          updateData.next_billing_date = new Date(statusResult.nextBillingDate);
          updateData.billing_cycle_end = new Date(statusResult.nextBillingDate);
        }

        await subscription.update(updateData);

        // Create subscription history entry for significant status changes
        if (newStatus && newStatus !== currentStatus) {
          await this.models.SubscriptionHistory?.create({
            subscription_id: subscription.id,
            event_type: 'status_updated',
            status: newStatus,
            amount: statusResult.amount || subscription.amount,
            payment_method: 'payplus',
            metadata: {
              monitoring_check: true,
              payplus_status: payplusStatus,
              previous_status: currentStatus,
              updated_via: 'hourly_monitoring'
            },
            created_at: new Date()
          });
        }

        console.log(`✅ Subscription ${subscription.id} updated successfully`);
        return true;
      } else {
        console.log(`📋 Subscription ${subscription.id} status unchanged`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Error checking subscription ${subscription.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Map PayPlus status to internal subscription status
   */
  mapPayplusStatusToInternal(payplusStatus) {
    const statusMap = {
      'active': 'active',
      'approved': 'active',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'expired': 'expired',
      'failed': 'payment_failed',
      'declined': 'payment_failed',
      'trial': 'trial',
      'pending': 'pending'
    };

    return statusMap[payplusStatus] || null;
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isJobRunning,
      lastRunTime: this.lastRunTime
    };
  }

  /**
   * Manually trigger a monitoring check (for testing/debugging)
   */
  async triggerManualCheck() {
    if (this.isJobRunning) {
      throw new Error('Monitoring job is already running');
    }

    console.log('🔍 Manual subscription monitoring check triggered');
    await this.checkAllActiveSubscriptions();
    return this.getStats();
  }

  /**
   * Stop the monitoring service
   */
  stopMonitoring() {
    if (this.cronJob) {
      this.cronJob.destroy();
      console.log('🛑 Subscription monitoring service stopped');
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new SubscriptionMonitoringService();