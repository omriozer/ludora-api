import models from '../models/index.js';
import { Op } from 'sequelize';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

class AccessControlService {
  constructor() {
    this.models = models;
  }

  // Check if user has access to a specific entity
  async checkAccess(userEmail, entityType, entityId) {
    try {
      // Get the purchase record for this user and entity
      const purchase = await this.models.Purchase.findOne({
        where: {
          buyer_email: userEmail,
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed', // Only successful payments
          [Op.or]: [
            { access_expires_at: null }, // Lifetime access
            { access_expires_at: { [Op.gt]: new Date() } } // Not expired
          ]
        }
      });

      return {
        hasAccess: !!purchase,
        purchase: purchase,
        isLifetimeAccess: purchase ? !purchase.access_expires_at : false,
        expiresAt: purchase ? purchase.access_expires_at : null
      };
    } catch (error) {
      console.error('Error checking access:', error);
      throw new Error(`Failed to check access: ${error.message}`);
    }
  }

  // Get all purchases for a user
  async getUserPurchases(userEmail, options = {}) {
    try {
      const whereClause = {
        buyer_email: userEmail,
        payment_status: 'completed',
        purchasable_type: { [Op.not]: null } // Only polymorphic purchases
      };

      // Filter by entity type if specified
      if (options.entityType) {
        whereClause.purchasable_type = options.entityType;
      }

      // Filter by access status
      if (options.activeOnly) {
        whereClause[Op.or] = [
          { access_expires_at: null }, // Lifetime access
          { access_expires_at: { [Op.gt]: new Date() } } // Not expired
        ];
      }

      const purchases = await this.models.Purchase.findAll({
        where: whereClause,
        include: this.buildEntityIncludes(),
        order: [['created_at', 'DESC']]
      });

      return purchases.map(purchase => this.formatPurchaseWithEntity(purchase));
    } catch (error) {
      console.error('Error getting user purchases:', error);
      throw new Error(`Failed to get user purchases: ${error.message}`);
    }
  }

  // Get all users who have access to a specific entity
  async getEntityUsers(entityType, entityId) {
    try {
      const purchases = await this.models.Purchase.findAll({
        where: {
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed',
          [Op.or]: [
            { access_expires_at: null }, // Lifetime access
            { access_expires_at: { [Op.gt]: new Date() } } // Not expired
          ]
        },
        attributes: ['buyer_email', 'access_expires_at', 'created_at'],
        order: [['created_at', 'DESC']]
      });

      return purchases.map(purchase => ({
        email: purchase.buyer_email,
        purchasedAt: purchase.created_at,
        isLifetimeAccess: !purchase.access_expires_at,
        expiresAt: purchase.access_expires_at
      }));
    } catch (error) {
      console.error('Error getting entity users:', error);
      throw new Error(`Failed to get entity users: ${error.message}`);
    }
  }

  // Create a new purchase and grant access
  async grantAccess(userEmail, entityType, entityId, options = {}) {
    try {
      const { 
        accessDays = null, 
        isLifetimeAccess = false,
        price = 0,
        orderId = null,
        createdBy = null 
      } = options;

      // Calculate access expiration
      let accessExpiresAt = null;
      if (!isLifetimeAccess && accessDays && accessDays > 0) {
        accessExpiresAt = new Date();
        accessExpiresAt.setDate(accessExpiresAt.getDate() + accessDays);
      }

      // Create purchase record
      const purchaseData = {
        id: this.generatePurchaseId(),
        buyer_email: userEmail,
        purchasable_type: entityType,
        purchasable_id: entityId,
        payment_status: 'completed',
        payment_amount: price,
        original_price: price,
        purchased_access_days: accessDays,
        purchased_lifetime_access: isLifetimeAccess,
        access_expires_at: accessExpiresAt,
        order_number: orderId,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: createdBy
      };

      const purchase = await this.models.Purchase.create(purchaseData);
      return purchase;
    } catch (error) {
      console.error('Error granting access:', error);
      throw new Error(`Failed to grant access: ${error.message}`);
    }
  }

  // Revoke access for a user to an entity
  async revokeAccess(userEmail, entityType, entityId) {
    try {
      const deletedCount = await this.models.Purchase.destroy({
        where: {
          buyer_email: userEmail,
          purchasable_type: entityType,
          purchasable_id: entityId
        }
      });

      return { revoked: deletedCount > 0, deletedCount };
    } catch (error) {
      console.error('Error revoking access:', error);
      throw new Error(`Failed to revoke access: ${error.message}`);
    }
  }

  // Get access statistics for an entity
  async getEntityAccessStats(entityType, entityId) {
    try {
      const stats = await this.models.Purchase.findAll({
        where: {
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed'
        },
        attributes: [
          [this.models.sequelize.fn('COUNT', this.models.sequelize.col('id')), 'totalPurchases'],
          [this.models.sequelize.fn('COUNT', this.models.sequelize.literal('CASE WHEN access_expires_at IS NULL THEN 1 END')), 'lifetimeAccess'],
          [this.models.sequelize.fn('COUNT', this.models.sequelize.literal('CASE WHEN access_expires_at > NOW() THEN 1 END')), 'activeAccess'],
          [this.models.sequelize.fn('SUM', this.models.sequelize.col('payment_amount')), 'totalRevenue']
        ],
        raw: true
      });

      return stats[0] || {
        totalPurchases: 0,
        lifetimeAccess: 0,
        activeAccess: 0,
        totalRevenue: 0
      };
    } catch (error) {
      console.error('Error getting entity access stats:', error);
      throw new Error(`Failed to get entity access stats: ${error.message}`);
    }
  }

  // Build includes for different entity types
  buildEntityIncludes() {
    return [
      {
        model: this.models.Workshop,
        as: 'workshop',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Course,
        as: 'course',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.File,
        as: 'file',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Tool,
        as: 'tool',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Game,
        as: 'game',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      }
    ];
  }

  // Format purchase with entity information
  formatPurchaseWithEntity(purchase) {
    const entityData = purchase.workshop || purchase.course || purchase.file || 
                      purchase.tool || purchase.game;
    
    return {
      id: purchase.id,
      entityType: purchase.purchasable_type,
      entityId: purchase.purchasable_id,
      entity: entityData,
      purchasedAt: purchase.created_at,
      isLifetimeAccess: !purchase.access_expires_at,
      expiresAt: purchase.access_expires_at,
      paymentAmount: purchase.payment_amount,
      isActive: !purchase.access_expires_at || purchase.access_expires_at > new Date()
    };
  }

  // Generate unique purchase ID
  generatePurchaseId() {
    return 'pur_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}

export default new AccessControlService();