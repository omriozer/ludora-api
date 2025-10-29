'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscriptionhistory', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Unique identifier for subscription history record'
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'ID of the user this history record belongs to'
      },
      subscription_plan_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'ID of the subscription plan involved in this action'
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID of the subscription record if linked to new subscription system'
      },
      action_type: {
        type: Sequelize.ENUM('started', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired', 'failed'),
        allowNull: false,
        comment: 'Type of subscription action performed'
      },
      previous_plan_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID of the previous subscription plan (for upgrades/downgrades)'
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Start date of the subscription action'
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'End date of the subscription (for cancellations)'
      },
      purchased_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price paid for this subscription action'
      },
      payplus_subscription_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'PayPlus subscription UID for recurring payments'
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID of the transaction associated with this action'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about this subscription action'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional metadata for this subscription history record'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Timestamp when this history record was created'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Timestamp when this history record was last updated'
      }
    });

    // Add indexes for common queries
    await queryInterface.addIndex('subscriptionhistory', ['user_id'], {
      name: 'idx_subscriptionhistory_user_id'
    });

    await queryInterface.addIndex('subscriptionhistory', ['subscription_plan_id'], {
      name: 'idx_subscriptionhistory_plan_id'
    });

    await queryInterface.addIndex('subscriptionhistory', ['subscription_id'], {
      name: 'idx_subscriptionhistory_subscription_id'
    });

    await queryInterface.addIndex('subscriptionhistory', ['action_type'], {
      name: 'idx_subscriptionhistory_action_type'
    });

    await queryInterface.addIndex('subscriptionhistory', ['payplus_subscription_uid'], {
      name: 'idx_subscriptionhistory_payplus_uid'
    });

    await queryInterface.addIndex('subscriptionhistory', ['created_at'], {
      name: 'idx_subscriptionhistory_created_at'
    });

    // Composite index for user history queries
    await queryInterface.addIndex('subscriptionhistory', ['user_id', 'created_at'], {
      name: 'idx_subscriptionhistory_user_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscriptionhistory');
  }
};