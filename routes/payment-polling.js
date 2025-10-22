import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import PaymentPollingService from '../services/PaymentPollingService.js';
import PaymentCompletionService from '../services/PaymentCompletionService.js';
import models from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Initialize services (PaymentPollingService is a singleton)
const pollingService = PaymentPollingService;
const completionService = new PaymentCompletionService();

// Manual polling trigger for all pending transactions
router.post('/poll/all', authenticateToken, asyncHandler(async (req, res) => {
  try {
    console.log('🚀 MANUAL POLLING: Triggered by user');

    const options = {
      limit: req.body.limit || 20,
      maxAge: req.body.maxAge || (24 * 60 * 60 * 1000), // 24 hours default
      rateLimitDelay: req.body.rateLimitDelay || 200 // Faster for manual polling
    };

    const result = await pollingService.triggerImmediatePoll(options);

    res.json({
      success: true,
      message: 'Manual polling completed',
      data: {
        trigger_time: new Date().toISOString(),
        ...result
      }
    });

  } catch (error) {
    console.error('❌ Manual polling failed:', error);
    res.status(500).json({
      error: 'Manual polling failed',
      message: error.message
    });
  }
}));

// Manual polling for specific transaction
router.post('/poll/transaction/:transactionId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { transactionId } = req.params;
    console.log(`🎯 MANUAL POLLING: Checking specific transaction: ${transactionId}`);

    const result = await pollingService.checkSpecificTransaction(transactionId);

    res.json({
      success: true,
      message: 'Transaction polling completed',
      data: {
        transaction_id: transactionId,
        trigger_time: new Date().toISOString(),
        ...result
      }
    });

  } catch (error) {
    console.error(`❌ Manual transaction polling failed for ${req.params.transactionId}:`, error);
    res.status(500).json({
      error: 'Transaction polling failed',
      message: error.message,
      transaction_id: req.params.transactionId
    });
  }
}));

// Get polling service status and metrics
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const pollingStatus = pollingService.getPollingStatus();

    // Get recent transaction statistics
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const [pendingCount, recentCompletions, recentFailures] = await Promise.all([
      // Pending transactions
      models.Transaction.count({
        where: {
          payment_status: { [Op.in]: ['pending', 'in_progress'] },
          payplus_page_uid: { [Op.ne]: null }
        }
      }),

      // Recent completions (last 24 hours)
      models.Transaction.count({
        where: {
          payment_status: 'completed',
          completed_at: { [Op.gte]: oneDayAgo },
          processing_source: { [Op.ne]: null }
        }
      }),

      // Recent failures (last 24 hours)
      models.Transaction.count({
        where: {
          payment_status: 'failed',
          completed_at: { [Op.gte]: oneDayAgo },
          processing_source: { [Op.ne]: null }
        }
      })
    ]);

    // Get race condition statistics
    const raceConditionStats = await models.Transaction.findAll({
      attributes: [
        'race_condition_winner',
        [models.sequelize.fn('COUNT', '*'), 'count']
      ],
      where: {
        race_condition_winner: { [Op.ne]: null },
        completed_at: { [Op.gte]: oneDayAgo }
      },
      group: ['race_condition_winner'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        polling_service: pollingStatus,
        transaction_stats: {
          pending_transactions: pendingCount,
          recent_completions_24h: recentCompletions,
          recent_failures_24h: recentFailures
        },
        race_condition_stats: raceConditionStats.reduce((acc, stat) => {
          acc[stat.race_condition_winner] = parseInt(stat.count);
          return acc;
        }, {}),
        status_retrieved_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get polling status:', error);
    res.status(500).json({
      error: 'Failed to get polling status',
      message: error.message
    });
  }
}));

// Get detailed audit trail for specific transaction
router.get('/audit/:transactionId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await models.Transaction.findByPk(transactionId, {
      include: [{
        model: models.Purchase,
        as: 'purchases'
      }]
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        transaction_id: transactionId
      });
    }

    const timeline = transaction.getProcessingTimeline();
    const raceConditionSummary = transaction.getRaceConditionSummary();

    res.json({
      success: true,
      data: {
        transaction_id: transactionId,
        current_status: transaction.payment_status,
        processing_timeline: timeline,
        race_condition_summary: raceConditionSummary,
        status_history: transaction.status_history || [],
        audit_retrieved_at: new Date().toISOString(),
        transaction_details: {
          created_at: transaction.created_at,
          completed_at: transaction.completed_at,
          total_amount: transaction.total_amount,
          payplus_page_uid: transaction.payplus_page_uid,
          purchase_count: transaction.purchases ? transaction.purchases.length : 0
        }
      }
    });

  } catch (error) {
    console.error(`❌ Failed to get audit trail for transaction ${req.params.transactionId}:`, error);
    res.status(500).json({
      error: 'Failed to get audit trail',
      message: error.message,
      transaction_id: req.params.transactionId
    });
  }
}));

// Emergency sync for user payments (useful for fixing issues like ozeromri@gmail.com)
router.post('/emergency-sync/user/:userId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🚨 EMERGENCY SYNC: Triggered for user: ${userId}`);

    // Find recent transactions for this user
    const recentTransactions = await models.Transaction.findAll({
      where: {
        created_at: {
          [Op.gte]: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) // Last 7 days
        }
      },
      include: [{
        model: models.Purchase,
        as: 'purchases',
        where: {
          buyer_user_id: userId
        },
        required: true
      }],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    console.log(`🔍 EMERGENCY SYNC: Found ${recentTransactions.length} recent transactions for user ${userId}`);

    const results = {
      user_id: userId,
      transactions_checked: 0,
      completions_processed: 0,
      already_processed: 0,
      errors: 0,
      transaction_details: []
    };

    // Check each transaction
    for (const transaction of recentTransactions) {
      try {
        if (!transaction.payplus_page_uid) {
          console.log(`⚠️ EMERGENCY SYNC: Transaction ${transaction.id} has no PayPlus UID, skipping`);
          continue;
        }

        results.transactions_checked++;
        console.log(`🔍 EMERGENCY SYNC: Checking transaction ${transaction.id} (status: ${transaction.payment_status})`);

        // Only check non-completed transactions
        if (!['completed', 'failed'].includes(transaction.payment_status)) {
          const checkResult = await pollingService.checkSpecificTransaction(transaction.id);

          if (checkResult.completionsProcessed > 0) {
            results.completions_processed++;
          } else if (checkResult.alreadyProcessed > 0) {
            results.already_processed++;
          }

          results.transaction_details.push({
            transaction_id: transaction.id,
            status: transaction.payment_status,
            amount: transaction.total_amount,
            check_result: checkResult
          });
        } else {
          console.log(`✅ EMERGENCY SYNC: Transaction ${transaction.id} already ${transaction.payment_status}`);
          results.transaction_details.push({
            transaction_id: transaction.id,
            status: transaction.payment_status,
            amount: transaction.total_amount,
            check_result: 'already_final_status'
          });
        }

      } catch (transactionError) {
        console.error(`❌ EMERGENCY SYNC: Failed to check transaction ${transaction.id}:`, transactionError);
        results.errors++;
        results.transaction_details.push({
          transaction_id: transaction.id,
          status: transaction.payment_status,
          error: transactionError.message
        });
      }
    }

    console.log(`✅ EMERGENCY SYNC: Completed for user ${userId}:`, results);

    res.json({
      success: true,
      message: 'Emergency user sync completed',
      data: {
        sync_timestamp: new Date().toISOString(),
        ...results
      }
    });

  } catch (error) {
    console.error(`❌ Emergency sync failed for user ${req.params.userId}:`, error);
    res.status(500).json({
      error: 'Emergency sync failed',
      message: error.message,
      user_id: req.params.userId
    });
  }
}));

// Force completion for specific transaction (admin emergency action)
router.post('/force-complete/:transactionId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { payplus_data, reason } = req.body;

    console.log(`🚨 FORCE COMPLETION: Triggered for transaction: ${transactionId}, reason: ${reason}`);

    if (!reason) {
      return res.status(400).json({
        error: 'Reason required for force completion',
        message: 'Please provide a reason for manually completing this transaction'
      });
    }

    // Use the completion service to force complete
    const completionResult = await completionService.processCompletion(
      transactionId,
      payplus_data || {
        force_completed: true,
        force_completion_reason: reason,
        force_completed_at: new Date().toISOString(),
        force_completed_by: 'manual_admin_action'
      },
      'manual'
    );

    res.json({
      success: true,
      message: 'Transaction force completed',
      data: {
        transaction_id: transactionId,
        force_completion_reason: reason,
        completion_result: completionResult,
        completed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ Force completion failed for transaction ${req.params.transactionId}:`, error);
    res.status(500).json({
      error: 'Force completion failed',
      message: error.message,
      transaction_id: req.params.transactionId
    });
  }
}));

export default router;