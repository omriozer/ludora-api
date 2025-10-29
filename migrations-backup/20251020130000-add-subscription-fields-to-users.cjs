'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add subscription-related fields to user table
    await queryInterface.addColumn('user', 'current_subscription_plan_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'subscriptionplan',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to the user\'s current subscription plan'
    });

    await queryInterface.addColumn('user', 'subscription_status', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'free_plan',
      comment: 'Current subscription status: free_plan, pending, active, cancelled, expired'
    });

    await queryInterface.addColumn('user', 'subscription_start_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the current subscription started'
    });

    await queryInterface.addColumn('user', 'subscription_end_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the current subscription ends/expires'
    });

    await queryInterface.addColumn('user', 'subscription_status_updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the subscription status was last updated'
    });

    await queryInterface.addColumn('user', 'payplus_subscription_uid', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'PayPlus recurring subscription UID for automatic renewals'
    });

    // Add indexes for performance
    await queryInterface.addIndex('user', ['current_subscription_plan_id'], {
      name: 'idx_user_current_subscription_plan_id'
    });

    await queryInterface.addIndex('user', ['subscription_status'], {
      name: 'idx_user_subscription_status'
    });

    await queryInterface.addIndex('user', ['subscription_end_date'], {
      name: 'idx_user_subscription_end_date'
    });

    await queryInterface.addIndex('user', ['payplus_subscription_uid'], {
      name: 'idx_user_payplus_subscription_uid'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('user', 'idx_user_payplus_subscription_uid');
    await queryInterface.removeIndex('user', 'idx_user_subscription_end_date');
    await queryInterface.removeIndex('user', 'idx_user_subscription_status');
    await queryInterface.removeIndex('user', 'idx_user_current_subscription_plan_id');

    // Remove columns
    await queryInterface.removeColumn('user', 'payplus_subscription_uid');
    await queryInterface.removeColumn('user', 'subscription_status_updated_at');
    await queryInterface.removeColumn('user', 'subscription_end_date');
    await queryInterface.removeColumn('user', 'subscription_start_date');
    await queryInterface.removeColumn('user', 'subscription_status');
    await queryInterface.removeColumn('user', 'current_subscription_plan_id');
  }
};