import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SubscriptionHistory = sequelize.define('SubscriptionHistory', {
    ...baseFields,
    user_id: { type: DataTypes.STRING, allowNull: true },
    subscription_plan_id: { type: DataTypes.STRING, allowNull: true },
    action_type: { type: DataTypes.STRING, allowNull: true },
    previous_plan_id: { type: DataTypes.STRING, allowNull: true },
    start_date: { type: DataTypes.DATE, allowNull: true },
    end_date: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
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