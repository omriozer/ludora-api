import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const PendingSubscription = sequelize.define('PendingSubscription', {
    ...baseFields,
    payplus_page_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'PayPlus payment page UID for tracking'
    },
    plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Reference to the subscription plan'
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Reference to the user creating the subscription'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Subscription amount'
    },
    payment_page_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'PayPlus payment page URL'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Status of the pending subscription (pending, processed, cancelled)'
    }
  }, {
    ...baseOptions,
    tableName: 'pendingsubscription',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['plan_id'],
      },
      {
        fields: ['payplus_page_uid'],
      },
      {
        fields: ['status'],
      },
    ],
  });

  PendingSubscription.associate = function(models) {
    // Define associations
    PendingSubscription.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'plan_id',
      as: 'SubscriptionPlan'
    });
    PendingSubscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
    PendingSubscription.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'Creator'
    });
  };

  return PendingSubscription;
}