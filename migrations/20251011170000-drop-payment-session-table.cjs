'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🗑️  Dropping payment_session table (legacy system replaced by Transaction-based PaymentIntent)');

    try {
      // Drop payment_session table if it exists
      await queryInterface.dropTable('payment_session');
      console.log('✅ Successfully dropped payment_session table');
    } catch (error) {
      console.log('⚠️  payment_session table does not exist or error dropping:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    console.log('🔄 Recreating payment_session table (rollback)');

    // Recreate payment_session table for rollback
    await queryInterface.createTable('payment_session', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      session_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'created',
      },
      purchase_ids: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      total_amount: {
        type: DataTypes.DECIMAL(10,2),
        allowNull: false,
      },
      original_amount: {
        type: DataTypes.DECIMAL(10,2),
        allowNull: true,
      },
      coupon_discount: {
        type: DataTypes.DECIMAL(10,2),
        allowNull: true,
        defaultValue: 0.00,
      },
      applied_coupons: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      payplus_page_uid: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      payplus_response: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      payment_page_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      return_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      callback_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      environment: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'production',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    }, {
      indexes: [
        {
          fields: ['user_id'],
          name: 'idx_payment_session_user_id'
        },
        {
          fields: ['session_status'],
          name: 'idx_payment_session_status'
        },
        {
          fields: ['payplus_page_uid'],
          name: 'idx_payment_session_payplus_page_uid'
        },
        {
          fields: ['created_at'],
          name: 'idx_payment_session_created_at'
        },
        {
          fields: ['expires_at'],
          name: 'idx_payment_session_expires_at'
        },
        {
          fields: ['user_id', 'session_status'],
          name: 'idx_payment_session_user_status'
        },
      ]
    });

    console.log('✅ Recreated payment_session table for rollback');
  }
};