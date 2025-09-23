'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('purchase', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      order_number: {
        type: DataTypes.STRING
      },
      product_id: {
        type: DataTypes.STRING
      },
      workshop_id: {
        type: DataTypes.STRING
      },
      buyer_name: {
        type: DataTypes.STRING
      },
      buyer_email: {
        type: DataTypes.STRING
      },
      buyer_phone: {
        type: DataTypes.STRING
      },
      payment_status: {
        type: DataTypes.STRING
      },
      payment_amount: {
        type: DataTypes.DECIMAL
      },
      original_price: {
        type: DataTypes.DECIMAL
      },
      discount_amount: {
        type: DataTypes.DECIMAL
      },
      coupon_code: {
        type: DataTypes.STRING
      },
      access_until: {
        type: DataTypes.STRING
      },
      purchased_access_days: {
        type: DataTypes.DECIMAL
      },
      purchased_lifetime_access: {
        type: DataTypes.BOOLEAN
      },
      download_count: {
        type: DataTypes.DECIMAL
      },
      first_accessed: {
        type: DataTypes.STRING
      },
      last_accessed: {
        type: DataTypes.STRING
      },
      environment: {
        type: DataTypes.STRING
      },
      is_recording_only: {
        type: DataTypes.BOOLEAN
      },
      is_subscription_renewal: {
        type: DataTypes.BOOLEAN
      },
      subscription_plan_id: {
        type: DataTypes.STRING
      },
      is_subscription_upgrade: {
        type: DataTypes.BOOLEAN
      },
      upgrade_proration_amount: {
        type: DataTypes.STRING
      },
      subscription_cycle_start: {
        type: DataTypes.STRING
      },
      subscription_cycle_end: {
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
      },
      purchasable_type: {
        type: DataTypes.STRING(255)
      },
      purchasable_id: {
        type: DataTypes.STRING(255)
      },
      access_expires_at: {
        type: DataTypes.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase');
  }
};