'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('subscriptionhistory', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.STRING
      },
      subscription_plan_id: {
        type: DataTypes.STRING
      },
      action_type: {
        type: DataTypes.STRING
      },
      previous_plan_id: {
        type: DataTypes.STRING
      },
      start_date: {
        type: DataTypes.STRING
      },
      end_date: {
        type: DataTypes.STRING
      },
      purchased_price: {
        type: DataTypes.DECIMAL
      },
      payplus_subscription_uid: {
        type: DataTypes.STRING
      },
      cancellation_reason: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.STRING
      },
      is_sample: {
        type: DataTypes.BOOLEAN
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      created_by: {
        type: DataTypes.STRING
      },
      created_by_id: {
        type: DataTypes.STRING
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscriptionhistory');
  }
};