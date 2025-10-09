import models from '../models/index.js';
import { Op } from 'sequelize';

/**
 * PaymentSessionCleanupService - Background service for cleaning up expired payment sessions
 * Automatically expires abandoned sessions and maintains database hygiene
 */
class PaymentSessionCleanupService {
  constructor() {
    this.models = models;
    this.cleanupInterval = null;
    this.isRunning = false;

    // Cleanup every 5 minutes (5 * 60 * 1000 ms)
    this.intervalMs = 5 * 60 * 1000;

    // Sessions expire after 30 minutes of inactivity
    this.sessionTimeoutMs = 30 * 60 * 1000;
  }

  /**
   * Start the background cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  PaymentSessionCleanupService is already running');
      return;
    }

    console.log(`🧹 Starting PaymentSessionCleanupService - cleanup every ${this.intervalMs / 1000 / 60} minutes`);

    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('❌ Initial session cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('❌ Scheduled session cleanup failed:', error);
      });
    }, this.intervalMs);

    this.isRunning = true;
    console.log('✅ PaymentSessionCleanupService started successfully');
  }

  /**
   * Stop the background cleanup service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  PaymentSessionCleanupService is not running');
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 PaymentSessionCleanupService stopped');
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    try {
      const startTime = Date.now();
      console.log(`🧹 Starting payment session cleanup at ${new Date().toISOString()}`);

      // Find expired sessions that are still active
      const expiredSessions = await this.models.PaymentSession.findAll({
        where: {
          session_status: ['created', 'pending'],
          [Op.or]: [
            // Sessions with explicit expiration time that has passed
            {
              expires_at: {
                [Op.lt]: new Date()
              }
            },
            // Sessions without expiration time that are older than timeout
            {
              expires_at: null,
              created_at: {
                [Op.lt]: new Date(Date.now() - this.sessionTimeoutMs)
              }
            }
          ]
        }
      });

      if (expiredSessions.length === 0) {
        console.log('✅ No expired payment sessions found');
        return { expiredCount: 0, cleanupTime: Date.now() - startTime };
      }

      console.log(`🔍 Found ${expiredSessions.length} expired payment sessions to clean up`);

      let successCount = 0;
      let errorCount = 0;

      // Process each expired session
      for (const session of expiredSessions) {
        try {
          await this.expireSession(session);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to expire session ${session.id}:`, error.message);
        }
      }

      const cleanupTime = Date.now() - startTime;
      const summary = {
        expiredCount: successCount,
        errorCount,
        cleanupTime
      };

      console.log(`✅ Session cleanup completed: ${successCount} expired, ${errorCount} errors, ${cleanupTime}ms`);

      return summary;

    } catch (error) {
      console.error('❌ Payment session cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Expire a specific payment session
   */
  async expireSession(session) {
    try {
      console.log(`⏰ Expiring session ${session.id} (status: ${session.session_status})`);

      // Mark session as expired
      await session.markExpired();

      // If session has associated purchases, reset them from 'pending' back to 'cart' status
      // This allows users to retry payment for the same items
      if (session.purchase_ids && session.purchase_ids.length > 0) {
        const purchases = await this.models.Purchase.findAll({
          where: {
            id: session.purchase_ids,
            payment_status: 'pending' // Only reset pending purchases
          }
        });

        if (purchases.length > 0) {
          await this.models.Purchase.update(
            {
              payment_status: 'cart',
              updated_at: new Date()
            },
            {
              where: {
                id: session.purchase_ids,
                payment_status: 'pending'
              }
            }
          );

          console.log(`🛒 Reset ${purchases.length} purchases from pending to cart status for session ${session.id}`);
        }
      }

      console.log(`✅ Successfully expired session ${session.id}`);

    } catch (error) {
      console.error(`❌ Failed to expire session ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Get cleanup service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      sessionTimeoutMs: this.sessionTimeoutMs,
      nextCleanup: this.cleanupInterval ? new Date(Date.now() + this.intervalMs).toISOString() : null
    };
  }

  /**
   * Run cleanup immediately (for manual triggers)
   */
  async runImmediateCleanup() {
    console.log('🧹 Running immediate payment session cleanup...');
    return await this.runCleanup();
  }

  /**
   * Get statistics about payment sessions
   */
  async getSessionStats() {
    try {
      const stats = await this.models.PaymentSession.findAll({
        attributes: [
          'session_status',
          [this.models.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['session_status'],
        raw: true
      });

      const sessionCounts = stats.reduce((acc, stat) => {
        acc[stat.session_status] = parseInt(stat.count);
        return acc;
      }, {});

      // Count expired sessions that need cleanup
      const expiredCount = await this.models.PaymentSession.count({
        where: {
          session_status: ['created', 'pending'],
          [Op.or]: [
            {
              expires_at: {
                [Op.lt]: new Date()
              }
            },
            {
              expires_at: null,
              created_at: {
                [Op.lt]: new Date(Date.now() - this.sessionTimeoutMs)
              }
            }
          ]
        }
      });

      return {
        sessionCounts,
        expiredAwaitingCleanup: expiredCount,
        totalSessions: Object.values(sessionCounts).reduce((sum, count) => sum + count, 0)
      };

    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      throw error;
    }
  }
}

export default new PaymentSessionCleanupService();