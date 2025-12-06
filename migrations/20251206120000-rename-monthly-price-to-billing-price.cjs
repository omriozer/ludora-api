'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename column in Subscription table
    await queryInterface.renameColumn('subscription', 'monthly_price', 'billing_price');
    console.log('✅ Renamed monthly_price to billing_price in subscription table');

    // Update the column comment for better clarity
    await queryInterface.changeColumn('subscription', 'billing_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Price for this subscription billing period after discounts'
    });
    console.log('✅ Updated billing_price column comment for clarity');

    console.log('🎯 Migration completed: monthly_price field renamed to billing_price with updated documentation');
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes - rename column back and restore original comment

    // Rename column back
    await queryInterface.renameColumn('subscription', 'billing_price', 'monthly_price');
    console.log('❌ Renamed billing_price back to monthly_price in subscription table');

    // Restore original column comment
    await queryInterface.changeColumn('subscription', 'monthly_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Final price for this subscription after discounts'
    });
    console.log('❌ Restored original monthly_price column comment');

    console.log('🔄 Migration rollback completed: billing_price field renamed back to monthly_price');
  }
};