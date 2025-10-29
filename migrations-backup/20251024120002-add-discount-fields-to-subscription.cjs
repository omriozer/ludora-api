'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add discount-related fields to subscription table
    await queryInterface.addColumn('subscription', 'original_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Original price before discounts'
    });

    await queryInterface.addColumn('subscription', 'discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Discount amount applied to this subscription'
    });

    // Add index for pricing queries
    await queryInterface.addIndex('subscription', ['original_price'], {
      name: 'idx_subscription_original_price'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeIndex('subscription', 'idx_subscription_original_price');
    await queryInterface.removeColumn('subscription', 'discount_amount');
    await queryInterface.removeColumn('subscription', 'original_price');
  }
};