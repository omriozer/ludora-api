'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // First, get the current table description to understand the column structure
    const tableDescription = await queryInterface.describeTable('purchase');

    // Check if payment_status column exists
    if (tableDescription.payment_status) {
      console.log('Adding "cart" status to Purchase payment_status validation...');

      // Update the payment_status column to include 'cart' in the enum validation
      // Note: We need to alter the column to update the check constraint
      await queryInterface.changeColumn('purchase', 'payment_status', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'cart', // Change default from 'pending' to 'cart'
        validate: {
          isIn: [['cart', 'pending', 'completed', 'failed', 'refunded']]
        }
      });

      console.log('Updated payment_status column to include "cart" status');

      // Update existing 'pending' purchases to 'cart' status
      // These are likely cart items that haven't entered payment process yet
      const [pendingPurchases] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) as count FROM purchase WHERE payment_status = 'pending'"
      );

      if (pendingPurchases[0].count > 0) {
        console.log(`Migrating ${pendingPurchases[0].count} existing 'pending' purchases to 'cart' status...`);

        await queryInterface.sequelize.query(
          "UPDATE purchase SET payment_status = 'cart' WHERE payment_status = 'pending'"
        );

        console.log('Successfully migrated existing pending purchases to cart status');
      }
    } else {
      console.log('payment_status column not found in purchase table');
    }
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Revert the changes
    const tableDescription = await queryInterface.describeTable('purchase');

    if (tableDescription.payment_status) {
      console.log('Reverting payment_status column changes...');

      // First, update all 'cart' status back to 'pending'
      await queryInterface.sequelize.query(
        "UPDATE purchase SET payment_status = 'pending' WHERE payment_status = 'cart'"
      );

      // Revert the column to original validation
      await queryInterface.changeColumn('purchase', 'payment_status', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pending', // Revert default back to 'pending'
        validate: {
          isIn: [['pending', 'completed', 'failed', 'refunded']]
        }
      });

      console.log('Reverted payment_status column to original state');
    }
  }
};