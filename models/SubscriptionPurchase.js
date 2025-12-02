import { DataTypes, Op } from 'sequelize';
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
    },
    month_year: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
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
        fields: ['user_id', 'month_year'],
        name: 'idx_subscription_purchase_user_month'
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
    // Belongs to User
    SubscriptionPurchase.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    // Belongs to Subscription
    SubscriptionPurchase.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });

    // Polymorphic associations to product entities
    SubscriptionPurchase.belongsTo(models.Workshop, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'workshop' },
      as: 'workshop'
    });
    SubscriptionPurchase.belongsTo(models.Course, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'course' },
      as: 'course'
    });
    SubscriptionPurchase.belongsTo(models.File, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'file' },
      as: 'file'
    });
    SubscriptionPurchase.belongsTo(models.Tool, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'tool' },
      as: 'tool'
    });
    SubscriptionPurchase.belongsTo(models.Game, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'game' },
      as: 'game'
    });
    SubscriptionPurchase.belongsTo(models.LessonPlan, {
      foreignKey: 'product_id',
      constraints: false,
      scope: { product_type: 'lesson_plan' },
      as: 'lessonPlan'
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

    return await this.update({
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
    return this.findAll({
      where: {
        subscription_id: subscriptionId,
        month_year: monthYear
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