'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('coupon', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      code: {
        type: DataTypes.STRING
      },
      name: {
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.STRING
      },
      discount_type: {
        type: DataTypes.STRING
      },
      discount_value: {
        type: DataTypes.DECIMAL
      },
      minimum_amount: {
        type: DataTypes.DECIMAL
      },
      usage_limit: {
        type: DataTypes.STRING
      },
      usage_count: {
        type: DataTypes.DECIMAL
      },
      valid_until: {
        type: DataTypes.STRING
      },
      is_visible: {
        type: DataTypes.BOOLEAN
      },
      is_admin_only: {
        type: DataTypes.BOOLEAN
      },
      allow_stacking: {
        type: DataTypes.BOOLEAN
      },
      stackable_with: {
        type: DataTypes.JSONB
      },
      applicable_categories: {
        type: DataTypes.JSONB
      },
      applicable_workshops: {
        type: DataTypes.JSONB
      },
      workshop_types: {
        type: DataTypes.JSONB
      },
      is_active: {
        type: DataTypes.BOOLEAN
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
    await queryInterface.dropTable('coupon');
  }
};