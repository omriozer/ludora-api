import models from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';

/**
 * PaymentSessionCleanupService - Background service for cleaning up expired payment sessions and transactions
 * Automatically expires abandoned sessions, PaymentIntent transactions, and maintains database hygiene
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
   * Run the cleanup process for both PaymentSessions and Transactions
   */
  async runCleanup() {
    try {
      const startTime = Date.now();
      console.log(`🧹 Starting payment cleanup (sessions & transactions) at ${new Date().toISOString()}`);

      // 1. Clean up expired PaymentSessions (legacy)
      const sessionResult = await this.cleanupExpiredSessions();

      // 2. Clean up expired PaymentIntent Transactions (primary)
      const transactionResult = await this.cleanupExpiredTransactions();

      const totalSuccessCount = sessionResult.successCount + transactionResult.successCount;
      const totalErrorCount = sessionResult.errorCount + transactionResult.errorCount;
      const cleanupTime = Date.now() - startTime;

      const summary = {
        sessions: sessionResult,
        transactions: transactionResult,
        totalExpiredCount: totalSuccessCount,
        totalErrorCount,
        cleanupTime
      };

      console.log(`✅ Payment cleanup completed: ${totalSuccessCount} total expired (${sessionResult.successCount} sessions, ${transactionResult.successCount} transactions), ${totalErrorCount} errors, ${cleanupTime}ms`);

      return summary;

    } catch (error) {
      console.error('❌ Payment cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired PaymentSessions (legacy)
   */
  async cleanupExpiredSessions() {
    try {
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
        return { successCount: 0, errorCount: 0, foundCount: 0 };
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

      return { successCount, errorCount, foundCount: expiredSessions.length };

    } catch (error) {
      console.error('❌ PaymentSession cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired PaymentIntent Transactions (primary flow)
   */
  async cleanupExpiredTransactions() {
    try {
      // Find expired transactions that need cleanup
      const expiredTransactions = await this.models.Transaction.findAll({
        where: {
          payment_status: ['pending', 'in_progress'],
          expires_at: {
            [Op.lt]: new Date()
          }
        },
        include: [{
          model: this.models.Purchase,
          as: 'purchases'
        }]
      });

      if (expiredTransactions.length === 0) {
        console.log('✅ No expired PaymentIntent transactions found');
        return { successCount: 0, errorCount: 0, foundCount: 0 };
      }

      console.log(`🔍 Found ${expiredTransactions.length} expired PaymentIntent transactions to clean up`);

      let successCount = 0;
      let errorCount = 0;

      // Process each expired transaction
      for (const transaction of expiredTransactions) {
        try {
          await this.expireTransaction(transaction);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to expire transaction ${transaction.id}:`, error.message);
        }
      }

      return { successCount, errorCount, foundCount: expiredTransactions.length };

    } catch (error) {
      console.error('❌ PaymentIntent transaction cleanup failed:', error);
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
   * Expire a specific PaymentIntent transaction
   */
  async expireTransaction(transaction) {
    try {
      console.log(`⏰ Expiring PaymentIntent transaction ${transaction.id} (status: ${transaction.payment_status})`);

      // Use Transaction model's updateStatus method for proper state machine handling
      await transaction.updateStatus('expired', {
        expired_by_cleanup_service: true,
        expired_at: new Date().toISOString()
      });

      // Reset associated purchases from 'pending' back to 'cart' status
      // This allows users to retry payment for the same items
      if (transaction.purchases && transaction.purchases.length > 0) {
        const purchasesToReset = transaction.purchases.filter(p =>
          p.payment_status === 'pending' ||
          p.metadata?.payment_in_progress === true
        );

        if (purchasesToReset.length > 0) {
          await this.models.Purchase.update(
            {
              payment_status: 'cart',
              updated_at: new Date(),
              metadata: fn('jsonb_set',
                col('metadata'),
                literal(`'{payment_in_progress}'`),
                literal('false'),
                false
              )
            },
            {
              where: {
                transaction_id: transaction.id,
                payment_status: 'pending'
              }
            }
          );

          console.log(`🛒 Reset ${purchasesToReset.length} purchases from pending to cart status for transaction ${transaction.id}`);
        }
      }

      console.log(`✅ Successfully expired PaymentIntent transaction ${transaction.id}`);

    } catch (error) {
      console.error(`❌ Failed to expire transaction ${transaction.id}:`, error);
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
   * Get statistics about payment sessions and transactions
   */
  async getPaymentStats() {
    try {
      // 1. Get PaymentSession statistics (legacy)
      const sessionStats = await this.models.PaymentSession.findAll({
        attributes: [
          'session_status',
          [fn('COUNT', '*'), 'count']
        ],
        group: ['session_status'],
        raw: true
      });

      const sessionCounts = sessionStats.reduce((acc, stat) => {
        acc[stat.session_status] = parseInt(stat.count);
        return acc;
      }, {});

      // Count expired sessions that need cleanup
      const expiredSessionCount = await this.models.PaymentSession.count({
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

      // 2. Get Transaction statistics (PaymentIntent)
      const transactionStats = await this.models.Transaction.findAll({
        attributes: [
          'payment_status',
          [fn('COUNT', '*'), 'count']
        ],
        group: ['payment_status'],
        raw: true
      });

      const transactionCounts = transactionStats.reduce((acc, stat) => {
        acc[stat.payment_status] = parseInt(stat.count);
        return acc;
      }, {});

      // Count expired transactions that need cleanup
      const expiredTransactionCount = await this.models.Transaction.count({
        where: {
          payment_status: ['pending', 'in_progress'],
          expires_at: {
            [Op.lt]: new Date()
          }
        }
      });

      return {
        paymentSessions: {
          counts: sessionCounts,
          expiredAwaitingCleanup: expiredSessionCount,
          total: Object.values(sessionCounts).reduce((sum, count) => sum + count, 0)
        },
        paymentIntentTransactions: {
          counts: transactionCounts,
          expiredAwaitingCleanup: expiredTransactionCount,
          total: Object.values(transactionCounts).reduce((sum, count) => sum + count, 0)
        },
        summary: {
          totalPayments: Object.values(sessionCounts).reduce((sum, count) => sum + count, 0) +
                         Object.values(transactionCounts).reduce((sum, count) => sum + count, 0),
          totalExpiredAwaitingCleanup: expiredSessionCount + expiredTransactionCount
        }
      };

    } catch (error) {
      console.error('❌ Failed to get payment stats:', error);
      throw error;
    }
  }
}

export default new PaymentSessionCleanupService();