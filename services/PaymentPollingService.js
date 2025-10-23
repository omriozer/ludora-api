import { Op } from 'sequelize';
import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import PaymentCompletionService from './PaymentCompletionService.js';

/**
 * PaymentPollingService - Reliable background polling for payment status
 *
 * This service polls PayPlus API to check status of pending transactions.
 * It implements smart polling intervals and race-condition handling with webhooks.
 * Ensures no payment is ever missed, regardless of webhook reliability.
 */
class PaymentPollingService {
  constructor() {
    this.models = models;
    this.paymentService = PaymentService;
    this.completionService = new PaymentCompletionService();
    this.isPolling = false;
    this.pollCount = 0;
    this.lastPollResults = null;

    // Background polling control
    this.pollingInterval = null;
    this.isBackgroundPollingActive = false;
    this.pollIntervalMs = 30000; // 30 seconds default
  }

  /**
   * Main polling method - checks all pending transactions
   * @param {Object} options - Polling configuration
   * @returns {Object} Polling results
   */
  async pollAllPendingTransactions(options = {}) {
    try {
      // Prevent concurrent polling runs
      if (this.isPolling) {
        console.log('⏸️ POLLING: Already running, skipping this cycle');
        return { skipped: true, reason: 'already_polling' };
      }

      this.isPolling = true;
      this.pollCount++;
      const pollStartTime = Date.now();

      console.log(`🔄 POLLING CYCLE ${this.pollCount}: Starting payment status polling...`);

      // Get all pending transactions with smart age-based filtering
      const pendingTransactions = await this.getPendingTransactions(options);

      if (pendingTransactions.length === 0) {
        console.log('📋 POLLING: No pending transactions found');
        this.isPolling = false;
        return {
          success: true,
          transactionsChecked: 0,
          completionsProcessed: 0,
          errors: 0,
          pollDuration: Date.now() - pollStartTime
        };
      }

      console.log(`📋 POLLING: Found ${pendingTransactions.length} pending transactions to check`);

      const results = {
        transactionsChecked: 0,
        completionsProcessed: 0,
        alreadyProcessed: 0,
        errors: 0,
        errorDetails: [],
        successfulCompletions: [],
        pollDuration: 0,
        rateLimitDelay: options.rateLimitDelay || 500 // ms between API calls
      };

      // Process each transaction with rate limiting
      for (const transaction of pendingTransactions) {
        try {
          await this.checkSingleTransaction(transaction, results);
          results.transactionsChecked++;

          // Rate limiting to avoid overwhelming PayPlus API
          if (results.rateLimitDelay > 0 && results.transactionsChecked < pendingTransactions.length) {
            await this.delay(results.rateLimitDelay);
          }

        } catch (error) {
          console.error(`❌ POLLING: Failed to check transaction ${transaction.id}:`, error);
          results.errors++;
          results.errorDetails.push({
            transactionId: transaction.id,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      results.pollDuration = Date.now() - pollStartTime;
      this.lastPollResults = {
        ...results,
        pollNumber: this.pollCount,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ POLLING CYCLE ${this.pollCount} COMPLETED:`, {
        checked: results.transactionsChecked,
        completed: results.completionsProcessed,
        alreadyProcessed: results.alreadyProcessed,
        errors: results.errors,
        duration: `${results.pollDuration}ms`
      });

      this.isPolling = false;
      return { success: true, ...results };

    } catch (error) {
      console.error('❌ POLLING: Critical error during polling cycle:', error);
      this.isPolling = false;
      throw error;
    }
  }

  /**
   * Check status of a single transaction with comprehensive audit trail
   */
  async checkSingleTransaction(transaction, results) {
    try {
      const checkStartTime = Date.now();
      console.log(`🔍 POLLING: Checking transaction ${transaction.id} (age: ${this.getTransactionAge(transaction)})`);

      // Mark that polling checked this transaction
      await transaction.markPollingCheck();

      // Call PayPlus API to check transaction status
      const payplusStatus = await this.paymentService.checkTransactionStatus(transaction.payplus_page_uid);

      if (!payplusStatus || !payplusStatus.success) {
        console.log(`⚠️ POLLING: PayPlus API check failed for transaction ${transaction.id}:`, payplusStatus?.error || 'Unknown error');

        // Add audit trail entry for failed API check
        const failedCheckHistory = transaction.addStatusHistoryEntry(
          transaction.payment_status, // No status change
          'polling',
          {
            api_check_result: 'failed',
            api_error: payplusStatus?.error || 'Unknown error',
            processing_time_ms: Date.now() - checkStartTime
          }
        );

        await transaction.update({
          status_history: failedCheckHistory,
          updated_at: new Date()
        });

        return;
      }

      // Check if payment is completed according to PayPlus
      if (this.isPaymentCompleted(payplusStatus)) {
        console.log(`💰 POLLING: Found completed payment for transaction ${transaction.id}, processing...`);

        // Use shared completion service (race condition with webhook)
        const completionResult = await this.completionService.processCompletion(
          transaction.id,
          payplusStatus.data || payplusStatus,
          'polling'
        );

        if (completionResult.alreadyProcessed) {
          console.log(`⏩ POLLING: Transaction ${transaction.id} already processed by webhook`);
          results.alreadyProcessed++;

          // Add audit trail entry for race condition loss
          const raceConditionHistory = transaction.addStatusHistoryEntry(
            'completed', // Status was already completed
            'polling',
            {
              race_condition_result: 'lost_to_webhook',
              api_check_result: 'completed',
              processing_time_ms: Date.now() - checkStartTime,
              payplus_status: payplusStatus.status
            }
          );

          await transaction.update({
            status_history: raceConditionHistory,
            updated_at: new Date()
          });

        } else {
          console.log(`🎉 POLLING: Successfully processed completion for transaction ${transaction.id}`);
          results.completionsProcessed++;
          results.successfulCompletions.push({
            transactionId: transaction.id,
            processedAt: new Date().toISOString(),
            details: completionResult.details
          });
        }

      } else if (this.isPaymentFailed(payplusStatus)) {
        // Handle failed payments with audit trail
        console.log(`❌ POLLING: Transaction ${transaction.id} failed according to PayPlus:`, payplusStatus.status);

        await this.handleFailedTransactionWithAudit(transaction, payplusStatus, checkStartTime);

      } else {
        // Still pending - update audit trail
        const age = this.getTransactionAge(transaction);
        console.log(`⏳ POLLING: Transaction ${transaction.id} still pending (age: ${age})`);

        // Add audit trail entry for pending check
        const pendingCheckHistory = transaction.addStatusHistoryEntry(
          transaction.payment_status, // No status change
          'polling',
          {
            api_check_result: 'still_pending',
            payplus_status: payplusStatus.status,
            transaction_age: age,
            processing_time_ms: Date.now() - checkStartTime
          }
        );

        await transaction.update({
          status_history: pendingCheckHistory,
          status_last_checked_at: new Date(),
          updated_at: new Date()
        });
      }

    } catch (error) {
      console.error(`❌ POLLING: Error checking transaction ${transaction.id}:`, error);

      // Add audit trail entry for error
      try {
        const errorHistory = transaction.addStatusHistoryEntry(
          transaction.payment_status, // No status change
          'polling',
          {
            api_check_result: 'error',
            error_message: error.message,
            processing_time_ms: Date.now() - (results.checkStartTime || Date.now())
          }
        );

        await transaction.update({
          status_history: errorHistory,
          updated_at: new Date()
        });
      } catch (auditError) {
        console.error(`❌ POLLING: Failed to update audit trail for error:`, auditError);
      }

      throw error;
    }
  }

  /**
   * Get pending transactions with smart filtering
   */
  async getPendingTransactions(options = {}) {
    try {
      const now = new Date();
      const where = {
        payment_status: { [Op.in]: ['pending', 'in_progress'] },
        payplus_page_uid: { [Op.ne]: null } // Must have PayPlus UID to check
      };

      // Smart age-based filtering
      if (options.maxAge) {
        const maxAgeDate = new Date(now.getTime() - options.maxAge);
        where.created_at = { [Op.gte]: maxAgeDate };
      }

      // Prioritize recently created transactions
      const order = [
        ['created_at', 'DESC'], // Newest first
        ['status_last_checked_at', 'ASC'] // Least recently checked first
      ];

      // Limit number of transactions to check in one cycle
      const limit = options.limit || 50;

      const transactions = await models.Transaction.findAll({
        where,
        order,
        limit,
        include: [{
          model: models.Purchase,
          as: 'purchases'
        }]
      });

      // Log age distribution for monitoring
      if (transactions.length > 0) {
        const ages = transactions.map(t => this.getTransactionAge(t));
        const avgAge = ages.reduce((sum, age) => sum + this.parseAge(age), 0) / ages.length;
        console.log(`📊 POLLING: Transaction ages - newest: ${ages[0]}, oldest: ${ages[ages.length - 1]}, avg: ${Math.round(avgAge)}min`);
      }

      return transactions;

    } catch (error) {
      console.error('❌ POLLING: Error fetching pending transactions:', error);
      throw error;
    }
  }

  /**
   * Check if PayPlus response indicates completed payment
   */
  isPaymentCompleted(payplusStatus) {
    const completionIndicators = [
      payplusStatus.status === 'completed',
      payplusStatus.status === 'success',
      payplusStatus.status === 'approved',
      payplusStatus.status_code === '000',
      payplusStatus.data?.status === 'completed',
      payplusStatus.data?.status_code === '000'
    ];

    return completionIndicators.some(indicator => indicator === true);
  }

  /**
   * Check if PayPlus response indicates failed payment
   */
  isPaymentFailed(payplusStatus) {
    const failureIndicators = [
      payplusStatus.status === 'failed',
      payplusStatus.status === 'declined',
      payplusStatus.status === 'cancelled',
      payplusStatus.status === 'expired',
      payplusStatus.status_code && ['002', '003', '004', '005', '006', '007', '008', '009', '010'].includes(payplusStatus.status_code)
    ];

    return failureIndicators.some(indicator => indicator === true);
  }

  /**
   * Handle failed transactions with comprehensive audit trail
   */
  async handleFailedTransactionWithAudit(transaction, payplusStatus, checkStartTime) {
    try {
      console.log(`❌ POLLING: Marking transaction ${transaction.id} as failed`);

      // Add audit trail entry for failure detection
      const failureHistory = transaction.addStatusHistoryEntry(
        'failed',
        'polling',
        {
          api_check_result: 'failed',
          payplus_status: payplusStatus.status,
          payplus_status_code: payplusStatus.status_code,
          failure_reason: payplusStatus.status_name || payplusStatus.status,
          processing_time_ms: Date.now() - checkStartTime
        }
      );

      await transaction.update({
        payment_status: 'failed',
        completed_at: new Date(),
        processing_completed_at: new Date(),
        status_history: failureHistory,
        processing_source: transaction.processing_source || 'polling',
        race_condition_winner: 'polling', // Since webhook would have processed success
        payplus_response: {
          ...transaction.payplus_response,
          failure_detected_by: 'polling',
          failure_detected_at: new Date().toISOString(),
          payplus_failure_status: payplusStatus,
          audit_trail: {
            last_updated_by: 'polling',
            last_updated_at: new Date().toISOString(),
            failure_detection_method: 'api_polling'
          }
        },
        updated_at: new Date()
      });

      // Update linked purchases to failed status
      if (transaction.purchases && transaction.purchases.length > 0) {
        await models.Purchase.update(
          {
            payment_status: 'failed',
            updated_at: new Date(),
            metadata: models.sequelize.fn(
              'jsonb_set',
              models.sequelize.col('metadata'),
              models.sequelize.literal(`'{failure_details}'`),
              models.sequelize.literal(`'${JSON.stringify({
                failed_by: 'polling',
                failed_at: new Date().toISOString(),
                payplus_failure_status: payplusStatus.status,
                transaction_id: transaction.id
              })}'`),
              models.sequelize.literal('true')
            )
          },
          {
            where: {
              transaction_id: transaction.id,
              payment_status: { [Op.in]: ['pending', 'cart', 'in_progress'] }
            }
          }
        );

        console.log(`❌ POLLING: Updated ${transaction.purchases.length} purchases to failed status with audit trail`);
      }

    } catch (error) {
      console.error(`❌ POLLING: Error handling failed transaction ${transaction.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed transactions (legacy method - kept for compatibility)
   */
  async handleFailedTransaction(transaction, payplusStatus) {
    return await this.handleFailedTransactionWithAudit(transaction, payplusStatus, Date.now());
  }

  /**
   * Get human-readable transaction age
   */
  getTransactionAge(transaction) {
    const now = new Date();
    const created = new Date(transaction.created_at);
    const ageMs = now - created;
    const ageMinutes = Math.floor(ageMs / (1000 * 60));

    if (ageMinutes < 60) {
      return `${ageMinutes}min`;
    } else if (ageMinutes < 1440) {
      return `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}min`;
    } else {
      return `${Math.floor(ageMinutes / 1440)}d ${Math.floor((ageMinutes % 1440) / 60)}h`;
    }
  }

  /**
   * Parse age string to minutes for calculations
   */
  parseAge(ageString) {
    const match = ageString.match(/(\d+)min|(\d+)h|(\d+)d/g);
    let totalMinutes = 0;

    if (match) {
      match.forEach(part => {
        if (part.includes('min')) {
          totalMinutes += parseInt(part);
        } else if (part.includes('h')) {
          totalMinutes += parseInt(part) * 60;
        } else if (part.includes('d')) {
          totalMinutes += parseInt(part) * 1440;
        }
      });
    }

    return totalMinutes;
  }

  /**
   * Utility delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get polling service status and metrics
   */
  getPollingStatus() {
    return {
      isCurrentlyPolling: this.isPolling,
      totalPollCycles: this.pollCount,
      lastPollResults: this.lastPollResults,
      serviceStarted: true
    };
  }

  /**
   * Manual trigger for immediate polling (for testing/debugging)
   */
  async triggerImmediatePoll(options = {}) {
    return // todo omri remove
    console.log('🚀 POLLING: Manual poll trigger requested');

    return await this.pollAllPendingTransactions({
      ...options,
      rateLimitDelay: 200, // Faster for manual polling
      limit: options.limit || 20,
      source: 'manual_trigger'
    });
  }

  /**
   * Check specific transaction by ID
   */
  async checkSpecificTransaction(transactionId) {
    try {
      console.log(`🎯 POLLING: Manual check requested for transaction: ${transactionId}`);

      const transaction = await models.Transaction.findByPk(transactionId, {
        include: [{
          model: models.Purchase,
          as: 'purchases'
        }]
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (!['pending', 'in_progress'].includes(transaction.payment_status)) {
        return {
          success: true,
          alreadyCompleted: true,
          currentStatus: transaction.payment_status,
          message: 'Transaction is not in pending status'
        };
      }

      const results = {
        transactionsChecked: 0,
        completionsProcessed: 0,
        alreadyProcessed: 0,
        errors: 0,
        errorDetails: []
      };

      await this.checkSingleTransaction(transaction, results);

      return {
        success: true,
        transactionId,
        ...results
      };

    } catch (error) {
      console.error(`❌ POLLING: Error checking specific transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Start background polling service
   */
  startBackgroundPolling(intervalMs = null) {
    return // todo omri remove
    if (this.isBackgroundPollingActive) {
      console.log('🔄 POLLING: Background polling already active');
      return;
    }

    const interval = intervalMs || this.pollIntervalMs;
    console.log(`🚀 POLLING: Starting background polling service (every ${interval}ms)`);

    this.isBackgroundPollingActive = true;
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollAllPendingTransactions({
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          limit: 20,
          rateLimitDelay: 500
        });
      } catch (error) {
        console.error('❌ POLLING: Background polling cycle failed:', error);
      }
    }, interval);

    console.log('✅ POLLING: Background polling service started');
  }

  /**
   * Stop background polling service
   */
  stopBackgroundPolling() {
    if (!this.isBackgroundPollingActive) {
      console.log('⏹️ POLLING: Background polling not active');
      return;
    }

    console.log('🛑 POLLING: Stopping background polling service');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.isBackgroundPollingActive = false;
    console.log('✅ POLLING: Background polling service stopped');
  }

  /**
   * Get polling service status including background service info
   */
  getPollingStatus() {
    return {
      isCurrentlyPolling: this.isPolling,
      totalPollCycles: this.pollCount,
      lastPollResults: this.lastPollResults,
      serviceStarted: true,
      backgroundPollingActive: this.isBackgroundPollingActive,
      pollIntervalMs: this.pollIntervalMs
    };
  }
}

export default new PaymentPollingService();