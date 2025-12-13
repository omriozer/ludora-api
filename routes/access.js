import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { haveAdminAccess } from '../constants/adminAccess.js';
import AccessControlService from '../services/AccessControlService.js';
import models from '../models/index.js';
import { requireStudentConsent } from '../middleware/consentEnforcement.js';


const router = express.Router();

// GET /access/check/:entityType/:entityId - Check if user has access to entity
router.get('/check/:entityType/:entityId', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;
  const userId = req.user.id;

  try {
    // CRITICAL FIX: Find Product ID using entity ID, since AccessControlService expects Product ID
    const product = await models.Product.findOne({
      where: {
        product_type: entityType,
        entity_id: entityId
      },
      attributes: ['id']
    });

    if (!product) {
      // No Product record exists for this entity - this means it's not a claimable product
      // Return no access instead of error to handle system files, templates, etc.
      return res.json({
        hasAccess: false,
        accessType: 'none',
        reason: 'Entity is not a claimable product (no Product record)',
        entityNotProduct: true
      });
    }

    // Call AccessControlService with Product ID (not entity ID)
    const accessInfo = await AccessControlService.checkAccess(userId, entityType, product.id);

    // Add debug info to the response (temporary for debugging)
    const responseWithDebug = {
      ...accessInfo,
      _debug: {
        entityId,
        productId: product.id,
        entityType,
        userId
      }
    };

    res.json(responseWithDebug);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /access/my-purchases - Get all purchases for authenticated user
router.get('/my-purchases', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { entityType, activeOnly } = req.query;

  try {
    const options = {
      entityType: entityType || undefined,
      activeOnly: activeOnly === 'true'
    };

    const purchases = await AccessControlService.getUserPurchases(userId, options);
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /access/entity/:entityType/:entityId/users - Get users with access to entity (admin only)
router.get('/entity/:entityType/:entityId/users', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;

  if (!haveAdminAccess(req.user.role, 'entity_users_access')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const users = await AccessControlService.getEntityUsers(entityType, entityId);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /access/entity/:entityType/:entityId/stats - Get access statistics for entity (admin only)
router.get('/entity/:entityType/:entityId/stats', authenticateToken, async (req, res) => {
  const { entityType, entityId } = req.params;

  if (!haveAdminAccess(req.user.role, 'entity_stats_access')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const stats = await AccessControlService.getEntityAccessStats(entityType, entityId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /access/grant - Grant access to user (admin only)
router.post('/grant', authenticateToken, async (req, res) => {
  const { userEmail, entityType, entityId, accessDays, isLifetimeAccess, price } = req.body;

  if (!haveAdminAccess(req.user.role, 'access_grant')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

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
        createdBy: req.user.id
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
    res.status(500).json({ error: error.message });
  }
});


export default router;