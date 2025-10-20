import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import AccessControlService from '../services/AccessControlService.js';
import models from '../models/index.js';
import PaymentService from '../services/PaymentService.js';
import PaymentIntentService from '../services/PaymentIntentService.js';

const router = express.Router();

// GET /access/check/:entityType/:entityId - Check if user has access to entity
router.get('/check/:entityType/:entityId', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;
  const userId = req.user.id;

  try {
    const accessInfo = await AccessControlService.checkAccess(userId, entityType, entityId);
    res.json(accessInfo);
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /access/my-purchases - Get all purchases for authenticated user
router.get('/my-purchases', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { entityType, activeOnly } = req.query;

  try {
    // 1. Check and update pending transactions before returning purchases
    await checkAndUpdatePendingTransactions(userId);

    const options = {
      entityType: entityType || undefined,
      activeOnly: activeOnly === 'true'
    };

    const purchases = await AccessControlService.getUserPurchases(userId, options);
    res.json(purchases);
  } catch (error) {
    console.error('Error getting user purchases:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /access/entity/:entityType/:entityId/users - Get users with access to entity (admin only)
router.get('/entity/:entityType/:entityId/users', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;
  
  // TODO: Add admin role check
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Admin access required' });
  // }

  try {
    const users = await AccessControlService.getEntityUsers(entityType, entityId);
    res.json(users);
  } catch (error) {
    console.error('Error getting entity users:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /access/entity/:entityType/:entityId/stats - Get access statistics for entity (admin only)
router.get('/entity/:entityType/:entityId/stats', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;
  
  // TODO: Add admin role check
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Admin access required' });
  // }

  try {
    const stats = await AccessControlService.getEntityAccessStats(entityType, entityId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting entity stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /access/grant - Grant access to user (admin only)
router.post('/grant', authenticateToken, async (req, res) => {
  const { userEmail, entityType, entityId, accessDays, isLifetimeAccess, price } = req.body;
  
  // TODO: Add admin role check
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Admin access required' });
  // }

  // Validation
  if (!userEmail || !entityType || !entityId) {
    return res.status(400).json({ 
      error: 'userEmail, entityType, and entityId are required' 
    });
  }

  try {
    const purchase = await AccessControlService.grantAccess(
      userEmail, 
      entityType, 
      entityId, 
      {
        accessDays,
        isLifetimeAccess: isLifetimeAccess || false,
        price: price || 0,
        createdBy: req.user.uid
      }
    );

    res.status(201).json({
      message: 'Access granted successfully',
      purchase: {
        id: purchase.id,
        userEmail,
        entityType,
        entityId,
        isLifetimeAccess: purchase.purchased_lifetime_access,
        expiresAt: purchase.access_expires_at
      }
    });
  } catch (error) {
    console.error('Error granting access:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /access/revoke - Revoke access from user (admin only)
router.delete('/revoke', authenticateToken, async (req, res) => {
  const { userEmail, entityType, entityId } = req.body;
  
  // TODO: Add admin role check
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({ error: 'Admin access required' });
  // }

  // Validation
  if (!userEmail || !entityType || !entityId) {
    return res.status(400).json({ 
      error: 'userEmail, entityType, and entityId are required' 
    });
  }

  try {
    const result = await AccessControlService.revokeAccess(userEmail, entityType, entityId);
    
    if (result.revoked) {
      res.json({
        message: 'Access revoked successfully',
        userEmail,
        entityType,
        entityId,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(404).json({
        error: 'No active access found for this user and entity'
      });
    }
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check and update pending transactions for a user by querying PayPlus API
 * This is called before returning user purchases to ensure up-to-date status
 */
async function checkAndUpdatePendingTransactions(userId) {
  try {
    console.log('🔍 Checking pending transactions for user:', userId);

    // Find all pending/in_progress transactions for this user
    const pendingTransactions = await models.Transaction.findAll({
      where: {
        payment_status: ['pending', 'in_progress']
      },
      include: [{
        model: models.Purchase,
        as: 'purchases',
        where: {
          buyer_user_id: userId
        },
        required: true
      }]
    });

    if (pendingTransactions.length === 0) {
      console.log('✅ No pending transactions found for user:', userId);
      return;
    }

    console.log(`🔍 Found ${pendingTransactions.length} pending transactions for user ${userId}, checking status...`);

    const paymentIntentService = new PaymentIntentService();

    // Check each transaction's status via PayPlus API
    for (const transaction of pendingTransactions) {
      try {
        if (!transaction.payplus_page_uid) {
          console.log(`⚠️ Transaction ${transaction.id} has no PayPlus UID, skipping status check`);
          continue;
        }

        console.log(`🔍 Checking PayPlus status for transaction ${transaction.id} (UID: ${transaction.payplus_page_uid?.substring(0, 8)}...)`);

        // Use PaymentService to check transaction status
        const statusResult = await PaymentService.checkTransactionStatus(transaction.payplus_page_uid);

        if (!statusResult.success) {
          console.warn(`⚠️ Could not check status for transaction ${transaction.id}:`, statusResult);
          continue;
        }

        const payplusStatus = statusResult.status;
        console.log(`📊 PayPlus status for transaction ${transaction.id}: ${payplusStatus} (current: ${transaction.payment_status})`);

        // Map PayPlus status to our transaction status
        let newStatus = null;
        switch (payplusStatus) {
          case 'approved':
          case 'completed':
            newStatus = 'completed';
            break;
          case 'failed':
          case 'declined':
          case 'cancelled':
            newStatus = 'failed';
            break;
          case 'expired':
            newStatus = 'expired';
            break;
          case 'pending':
          case 'in_progress':
            // Status hasn't changed, no update needed
            break;
          default:
            console.log(`⚠️ Unknown PayPlus status '${payplusStatus}' for transaction ${transaction.id}`);
        }

        // Update transaction status if it changed
        if (newStatus && newStatus !== transaction.payment_status) {
          console.log(`🔄 Updating transaction ${transaction.id} status from '${transaction.payment_status}' to '${newStatus}'`);

          await paymentIntentService.updatePaymentStatus(transaction.id, newStatus, {
            api_status_check: true,
            payplus_status: payplusStatus,
            status_checked_at: new Date().toISOString(),
            last_payplus_amount: statusResult.amount,
            approval_number: statusResult.approvalNumber
          });

          console.log(`✅ Transaction ${transaction.id} status updated successfully`);
        } else {
          console.log(`📋 Transaction ${transaction.id} status unchanged (${transaction.payment_status})`);
        }

      } catch (transactionError) {
        console.error(`❌ Error checking transaction ${transaction.id}:`, transactionError.message);
        // Continue with other transactions instead of failing completely
      }
    }

    console.log(`✅ Completed status check for ${pendingTransactions.length} transactions for user ${userId}`);

  } catch (error) {
    console.error('❌ Error checking pending transactions:', error);
    // Don't throw error - we still want to return purchases even if status check fails
  }
}

export default router;