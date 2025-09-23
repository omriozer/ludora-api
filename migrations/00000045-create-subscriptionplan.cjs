'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('subscriptionplan', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.STRING
      },
      price: {
        type: DataTypes.DECIMAL
      },
      billing_period: {
        type: DataTypes.STRING
      },
      has_discount: {
        type: DataTypes.BOOLEAN
      },
      discount_type: {
        type: DataTypes.STRING
      },
      discount_value: {
        type: DataTypes.DECIMAL
      },
      discount_valid_until: {
        type: DataTypes.STRING
      },
      is_active: {
        type: DataTypes.BOOLEAN
      },
      is_default: {
        type: DataTypes.BOOLEAN
      },
      plan_type: {
        type: DataTypes.STRING
      },
      benefits: {
        type: DataTypes.JSONB
      },
      sort_order: {
        type: DataTypes.DECIMAL
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
    await queryInterface.dropTable('subscriptionplan');
  }
};