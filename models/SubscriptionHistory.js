import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SubscriptionHistory = sequelize.define('SubscriptionHistory', {
    ...baseFields,
    user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the user this subscription action belongs to'
    },
    subscription_plan_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the subscription plan'
    },
    action_type: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Type of subscription action: started, ended, upgraded, downgraded, cancelled, onboarding_selection'
    },
    previous_plan_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the previous subscription plan (for upgrades/downgrades)'
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the subscription period started'
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the subscription period ended'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Current status: active, inactive, cancelled, expired'
    },
    // PayPlus Integration Fields
    payplus_subscription_uid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'PayPlus subscription UID for tracking recurring payments'
    },
    purchased_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Price paid for this subscription action'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about the subscription action (payment details, webhook data, etc.)'
    },
    cancellation_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Reason for subscription cancellation (user_request, payment_failed, admin_action, etc.)'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about this subscription action'
    },
    next_billing_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the next billing cycle should occur for active subscriptions'
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when the subscription was cancelled'
    }
  }, {
    ...baseOptions,
    tableName: 'subscriptionhistory',
  });

  SubscriptionHistory.associate = function(models) {
    // Define associations here
    SubscriptionHistory.belongsTo(models.User, { foreignKey: 'user_id' });
    SubscriptionHistory.belongsTo(models.SubscriptionPlan, { foreignKey: 'subscription_plan_id' });
    SubscriptionHistory.belongsTo(models.SubscriptionPlan, { foreignKey: 'previous_plan_id', as: 'PreviousPlan' });
  };

  return SubscriptionHistory;
}