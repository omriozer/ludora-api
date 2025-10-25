'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create subscription table
    await queryInterface.createTable('subscription', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        }
      },
      subscription_plan_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'subscriptionplan',
          key: 'id',
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        }
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'transaction',
          key: 'id',
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        }
      },

      // Subscription Status & Lifecycle
      status: {
        type: Sequelize.ENUM('pending', 'active', 'cancelled', 'expired', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },

      // Billing & Dates
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      next_billing_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // PayPlus Integration
      payplus_subscription_uid: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      payplus_status: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Pricing (snapshot at subscription time)
      monthly_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      billing_period: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isIn: [['monthly', 'yearly']]
        }
      },

      // Metadata for additional data
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      // Standard timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('subscription', ['user_id'], {
      name: 'idx_subscription_user_id'
    });
    await queryInterface.addIndex('subscription', ['subscription_plan_id'], {
      name: 'idx_subscription_plan_id'
    });
    await queryInterface.addIndex('subscription', ['status'], {
      name: 'idx_subscription_status'
    });
    await queryInterface.addIndex('subscription', ['payplus_subscription_uid'], {
      name: 'idx_subscription_payplus_uid'
    });
    await queryInterface.addIndex('subscription', ['next_billing_date'], {
      name: 'idx_subscription_next_billing'
    });
    await queryInterface.addIndex('subscription', ['created_at'], {
      name: 'idx_subscription_created_at'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the table and all its indexes
    await queryInterface.dropTable('subscription');
  }
};