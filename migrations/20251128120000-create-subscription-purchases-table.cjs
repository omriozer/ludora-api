'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_purchase', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        defaultValue: Sequelize.literal("('sub_purch_' || substr(gen_random_uuid()::text, 1, 8))")
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'subscription',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Type of product: file, workshop, course, game, tool'
      },
      product_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'ID of the specific product entity'
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      month_year: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Format: YYYY-MM (e.g., 2025-11) for monthly allowance tracking'
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active',
        comment: 'Status: active, expired, cancelled'
      },
      usage_tracking: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Flexible usage tracking: times_used, total_usage_minutes, sessions, metadata'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex('subscription_purchase', {
      name: 'idx_subscription_purchase_user_month',
      fields: ['user_id', 'month_year']
    });

    await queryInterface.addIndex('subscription_purchase', {
      name: 'idx_subscription_purchase_product',
      fields: ['product_type', 'product_id']
    });

    await queryInterface.addIndex('subscription_purchase', {
      name: 'idx_subscription_purchase_subscription',
      fields: ['subscription_id']
    });

    await queryInterface.addIndex('subscription_purchase', {
      name: 'idx_subscription_purchase_status',
      fields: ['status']
    });

    await queryInterface.addIndex('subscription_purchase', {
      name: 'idx_subscription_purchase_claimed_at',
      fields: ['claimed_at']
    });

    // Add unique constraint to prevent duplicate claims
    await queryInterface.addConstraint('subscription_purchase', {
      name: 'unique_subscription_purchase_per_month',
      type: 'unique',
      fields: ['user_id', 'subscription_id', 'product_type', 'product_id', 'month_year']
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription_purchase');
  }
};