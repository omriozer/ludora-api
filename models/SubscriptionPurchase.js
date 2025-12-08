import { DataTypes } from 'sequelize';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';

export default function(sequelize) {
  const SubscriptionPurchase = sequelize.define('SubscriptionPurchase', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
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
    claimed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the product was claimed via subscription'
    },
    month_year: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Format: YYYY-MM (e.g., 2025-11) for monthly allowance tracking'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      comment: 'Status: active, expired, cancelled'
    },
    usage_tracking: {
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
  });

  SubscriptionPurchase.associate = function(models) {
    // Belongs to Subscription
    SubscriptionPurchase.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });

    // Belongs to Product
    SubscriptionPurchase.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product'
    });
  };

  // Helper methods for usage tracking
  SubscriptionPurchase.prototype.recordUsage = async function(usageData = {}) {
    const currentUsage = this.usage_tracking || {};

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
      usage_tracking: updatedUsage,
      updated_at: new Date()
    });
  };

  // Get usage statistics
  SubscriptionPurchase.prototype.getUsageStats = function() {
    const usage = this.usage_tracking || {};
    return {
      times_used: usage.times_used || 0,
      total_usage_minutes: usage.total_usage_minutes || 0,
      last_used_at: usage.last_used_at || null,
      first_used_at: usage.first_used_at || null,
      sessions_count: (usage.sessions || []).length
    };
  };

  // Class methods for querying
  SubscriptionPurchase.findByProduct = function(productType, productId, options = {}) {
    return this.findAll({
      where: {
        product_type: productType,
        product_id: productId
      },
      ...options
    });
  };

  return SubscriptionPurchase;
}