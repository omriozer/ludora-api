'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Adding payment_provider column to customer_token table...');

    // Check if the column already exists
    const tableDescription = await queryInterface.describeTable('customer_token');

    if (tableDescription.payment_provider) {
      console.log('⚠️  payment_provider column already exists, skipping');
      return;
    }

    // Add payment_provider column
    await queryInterface.addColumn('customer_token', 'payment_provider', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'payplus',
      comment: 'Payment provider identifier (payplus, stripe, etc.)'
    });

    // Add index for performance
    await queryInterface.addIndex('customer_token', ['payment_provider'], {
      name: 'idx_customer_token_payment_provider'
    });

    console.log('✅ payment_provider column added successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔧 Removing payment_provider column from customer_token table...');

    // Remove index first
    await queryInterface.removeIndex('customer_token', 'idx_customer_token_payment_provider');

    // Remove column
    await queryInterface.removeColumn('customer_token', 'payment_provider');

    console.log('✅ payment_provider column removed successfully');
  }
};