import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SubscriptionHistory = sequelize.define('SubscriptionHistory', {
    ...baseFields,
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the user this history record belongs to'
    },
    subscription_plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the subscription plan involved in this action'
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the subscription record if linked to new subscription system'
    },
    action_type: {
      type: DataTypes.ENUM('started', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired', 'failed'),
      allowNull: false,
      comment: 'Type of subscription action performed'
    },
    previous_plan_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the previous subscription plan (for upgrades/downgrades)'
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Start date of the subscription action'
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'End date of the subscription (for cancellations)'
    },
    purchased_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Price paid for this subscription action'
    },
    payplus_subscription_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'PayPlus subscription UID for recurring payments'
    },
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the transaction associated with this action'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about this subscription action'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional metadata for this subscription history record'
    }
  }, {
    ...baseOptions,
    tableName: 'subscriptionhistory',
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_subscriptionhistory_user_id'
      },
      {
        fields: ['subscription_plan_id'],
        name: 'idx_subscriptionhistory_plan_id'
      },
      {
        fields: ['subscription_id'],
        name: 'idx_subscriptionhistory_subscription_id'
      },
      {
        fields: ['action_type'],
        name: 'idx_subscriptionhistory_action_type'
      },
      {
        fields: ['payplus_subscription_uid'],
        name: 'idx_subscriptionhistory_payplus_uid'
      },
      {
        fields: ['created_at'],
        name: 'idx_subscriptionhistory_created_at'
      },
      {
        fields: ['user_id', 'created_at'],
        name: 'idx_subscriptionhistory_user_date'
      }
    ]
  });

  SubscriptionHistory.associate = function(models) {
    // Define associations here
    SubscriptionHistory.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    SubscriptionHistory.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'subscription_plan_id',
      as: 'subscriptionPlan'
    });

    SubscriptionHistory.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'previous_plan_id',
      as: 'previousPlan'
    });

    SubscriptionHistory.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });

    SubscriptionHistory.belongsTo(models.Transaction, {
      foreignKey: 'transaction_id',
      as: 'transaction'
    });
  };

  // Instance methods for working with subscription history
  SubscriptionHistory.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Parse metadata if it's a string
    if (typeof values.metadata === 'string') {
      try {
        values.metadata = JSON.parse(values.metadata);
      } catch (e) {
        // Leave as string if parsing fails
      }
    }

    return values;
  };

  // Static methods for common queries
  SubscriptionHistory.getUserHistory = async function(userId, options = {}) {
    const { limit = 50, offset = 0, actionType = null } = options;

    const whereClause = { user_id: userId };
    if (actionType) {
      whereClause.action_type = actionType;
    }

    return await this.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.SubscriptionPlan,
          as: 'subscriptionPlan'
        },
        {
          model: sequelize.models.SubscriptionPlan,
          as: 'previousPlan',
          required: false
        },
        {
          model: sequelize.models.Subscription,
          as: 'subscription',
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  SubscriptionHistory.getLatestForUser = async function(userId) {
    return await this.findOne({
      where: { user_id: userId },
      include: [
        {
          model: sequelize.models.SubscriptionPlan,
          as: 'subscriptionPlan'
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  SubscriptionHistory.recordAction = async function(actionData) {
    const {
      userId,
      subscriptionPlanId,
      actionType,
      subscriptionId = null,
      previousPlanId = null,
      startDate = null,
      endDate = null,
      purchasedPrice = null,
      payplusSubscriptionUid = null,
      transactionId = null,
      notes = null,
      metadata = {}
    } = actionData;

    return await this.create({
      id: `subhist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      user_id: userId,
      subscription_plan_id: subscriptionPlanId,
      subscription_id: subscriptionId,
      action_type: actionType,
      previous_plan_id: previousPlanId,
      start_date: startDate,
      end_date: endDate,
      purchased_price: purchasedPrice,
      payplus_subscription_uid: payplusSubscriptionUid,
      transaction_id: transactionId,
      notes: notes,
      metadata: metadata,
      created_at: new Date(),
      updated_at: new Date()
    });
  };

  return SubscriptionHistory;
}