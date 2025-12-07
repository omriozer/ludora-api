import { DataTypes, Op } from 'sequelize';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';

export default function(sequelize) {
  const SubscriptionPurchase = sequelize.define('SubscriptionPurchase', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'subscription',
        key: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    },
    product_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [ALL_PRODUCT_TYPES]
      },
      comment: 'Type of product: file, workshop, course, game, tool, lesson_plan'
    },
    product_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the specific product entity'
    },
    usage: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Flexible usage tracking: times_used, total_usage_minutes, sessions, metadata'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'subscription_purchases',
    timestamps: false,
    indexes: [
      {
        fields: ['product_type', 'product_id'],
        name: 'idx_subscription_purchase_product'
      },
      {
        fields: ['subscription_id'],
        name: 'idx_subscription_purchase_subscription'
      },
      {
        fields: ['status'],
        name: 'idx_subscription_purchase_status'
      },
      {
        fields: ['claimed_at'],
        name: 'idx_subscription_purchase_claimed_at'
      },
    ],
  });

  SubscriptionPurchase.associate = function(models) {
    // Belongs to Subscription
    SubscriptionPurchase.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });

    // Belongs to Product (correct association)
    SubscriptionPurchase.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product'
    });
  };

  // Helper methods for usage tracking
  SubscriptionPurchase.prototype.recordUsage = async function(usageData = {}) {
    const currentUsage = this.usage || {};

    // Initialize usage fields if not present
    const updatedUsage = {
      times_used: (currentUsage.times_used || 0) + 1,
      last_used_at: new Date().toISOString(),
      first_used_at: currentUsage.first_used_at || new Date().toISOString(),
      total_usage_minutes: (currentUsage.total_usage_minutes || 0) + (usageData.duration_minutes || 0),
      sessions: currentUsage.sessions || [],
      metadata: currentUsage.metadata || {}
    };

    // Add session record if provided
    if (usageData.session) {
      updatedUsage.sessions.push({
        timestamp: new Date().toISOString(),
        duration_minutes: usageData.duration_minutes || 0,
        session_type: usageData.session_type || 'unknown',
        completion_percent: usageData.completion_percent || 0,
        ...usageData.session
      });

      // Keep only last 20 sessions to prevent unbounded growth
      if (updatedUsage.sessions.length > 20) {
        updatedUsage.sessions = updatedUsage.sessions.slice(-20);
      }
    }

    // Merge additional metadata
    if (usageData.metadata) {
      updatedUsage.metadata = {
        ...updatedUsage.metadata,
        ...usageData.metadata
      };
    }

    return this.update({
      usage: updatedUsage,
      updated_at: new Date()
    });
  };

  // Check if subscription purchase is still valid
  SubscriptionPurchase.prototype.isValid = function() {
    return this.status === 'active';
  };

  // Get usage statistics
  SubscriptionPurchase.prototype.getUsageStats = function() {
    const usage = this.usage || {};
    return {
      times_used: usage.times_used || 0,
      total_usage_minutes: usage.total_usage_minutes || 0,
      last_used_at: usage.last_used_at || null,
      first_used_at: usage.first_used_at || null,
      sessions_count: (usage.sessions || []).length
    };
  };

  // Class methods for querying
  SubscriptionPurchase.findBySubscriptionAndMonth = function(subscriptionId, monthYear, options = {}) {
    // Parse monthYear to get date range
    const [year, month] = monthYear.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1); // Month is 0-indexed
    const endOfMonth = new Date(year, month, 0, 23, 59, 59); // Last day of month

    return this.findAll({
      where: {
        subscription_id: subscriptionId,
        created_at: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      },
      ...options
    });
  };

  SubscriptionPurchase.findByProduct = function(productType, productId, options = {}) {
    return this.findAll({
      where: {
        product_type: productType,
        product_id: productId
      },
      ...options
    });
  };

  // Generate month_year string from date
  SubscriptionPurchase.getMonthYear = function(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  return SubscriptionPurchase;
}