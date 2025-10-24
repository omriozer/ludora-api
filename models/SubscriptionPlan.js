import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.DECIMAL, allowNull: true },
    billing_period: { type: DataTypes.STRING, allowNull: true },
    has_discount: { type: DataTypes.BOOLEAN, allowNull: true },
    discount_type: { type: DataTypes.STRING, allowNull: true },
    discount_value: { type: DataTypes.DECIMAL, allowNull: true },
    discount_valid_until: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true },
    is_default: { type: DataTypes.BOOLEAN, allowNull: true },
    plan_type: { type: DataTypes.STRING, allowNull: true },
    benefits: { type: DataTypes.JSONB, allowNull: true },
    sort_order: { type: DataTypes.DECIMAL, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'subscriptionplan',
    indexes: [
      {
        fields: ['is_active'],
      },
    ],
  });

  SubscriptionPlan.associate = function(models) {
    // Define associations here
    // Note: subscription_plan_id field doesn't exist in current Purchase schema
    // SubscriptionPlan.hasMany(models.Purchase, { foreignKey: 'subscription_plan_id' });
  };

  return SubscriptionPlan;
}