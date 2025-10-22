import models from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';

/**
 * TransactionCleanupService - Background service for cleaning up expired PaymentIntent transactions
 * Automatically expires abandoned transactions and maintains database hygiene
 */
class TransactionCleanupService {
  constructor() {
    this.models = models;
    this.cleanupInterval = null;
    this.isRunning = false;

    // Cleanup every 5 minutes (5 * 60 * 1000 ms)
    this.intervalMs = 5 * 60 * 1000;
  }

  /**
   * Start the background cleanup service
   */
  start() {
    if (this.isRunning) {
      return;
    }

    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('❌ Initial transaction cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('❌ Scheduled transaction cleanup failed:', error);
      });
    }, this.intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the background cleanup service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Run the cleanup process for expired Transactions
   */
  async runCleanup() {
    try {
      const startTime = Date.now();

      // Clean up expired PaymentIntent Transactions
      const transactionResult = await this.cleanupExpiredTransactions();

      const cleanupTime = Date.now() - startTime;

      const summary = {
        transactions: transactionResult,
        totalExpiredCount: transactionResult.successCount,
        totalErrorCount: transactionResult.errorCount,
        cleanupTime
      };

      return summary;

    } catch (error) {
      console.error('❌ Transaction cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired PaymentIntent Transactions
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
        return { successCount: 0, errorCount: 0, foundCount: 0 };
      }

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
   * Expire a specific PaymentIntent transaction
   */
  async expireTransaction(transaction) {
    try {
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
        }
      }

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
      nextCleanup: this.cleanupInterval ? new Date(Date.now() + this.intervalMs).toISOString() : null
    };
  }

  /**
   * Run cleanup immediately (for manual triggers)
   */
  async runImmediateCleanup() {
    return await this.runCleanup();
  }

  /**
   * Get statistics about transactions
   */
  async getTransactionStats() {
    try {
      // Get Transaction statistics (PaymentIntent)
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
        paymentIntentTransactions: {
          counts: transactionCounts,
          expiredAwaitingCleanup: expiredTransactionCount,
          total: Object.values(transactionCounts).reduce((sum, count) => sum + count, 0)
        },
        summary: {
          totalPayments: Object.values(transactionCounts).reduce((sum, count) => sum + count, 0),
          totalExpiredAwaitingCleanup: expiredTransactionCount
        }
      };

    } catch (error) {
      console.error('❌ Failed to get transaction stats:', error);
      throw error;
    }
  }
}

export default new TransactionCleanupService();
