'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check and add polling_attempts field to Purchase table
    const tableDescription = await queryInterface.describeTable('purchase');

    if (!tableDescription.polling_attempts) {
      await queryInterface.addColumn('purchase', 'polling_attempts', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of polling attempts made for this payment'
      });
      console.log('✅ Added polling_attempts column to purchase table');
    } else {
      console.log('⚠️ polling_attempts column already exists, skipping');
    }

    // Check and add last_polled_at field to Purchase table
    if (!tableDescription.last_polled_at) {
      await queryInterface.addColumn('purchase', 'last_polled_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last polling attempt'
      });
      console.log('✅ Added last_polled_at column to purchase table');
    } else {
      console.log('⚠️ last_polled_at column already exists, skipping');
    }

    // Check and add resolution_method field to Purchase table (using VARCHAR for broader compatibility)
    if (!tableDescription.resolution_method) {
      await queryInterface.addColumn('purchase', 'resolution_method', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Method used to resolve the payment status (webhook, polling, manual, abandoned_after_polling)'
      });
      console.log('✅ Added resolution_method column to purchase table');
    } else {
      console.log('⚠️ resolution_method column already exists, skipping');
    }

    // Create indexes if they don't exist
    try {
      await queryInterface.addIndex('purchase', ['payment_status', 'polling_attempts', 'created_at'], {
        name: 'idx_purchase_polling_status'
      });
      console.log('✅ Created index idx_purchase_polling_status for efficient polling queries');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Index idx_purchase_polling_status already exists, skipping');
      } else {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex('purchase', ['resolution_method'], {
        name: 'idx_purchase_resolution_method'
      });
      console.log('✅ Created index idx_purchase_resolution_method for reporting');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Index idx_purchase_resolution_method already exists, skipping');
      } else {
        throw error;
      }
    }

    console.log('🎯 Migration completed: Payment polling fields added to purchase table');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('purchase', 'idx_purchase_polling_status');
    console.log('❌ Removed index idx_purchase_polling_status');

    await queryInterface.removeIndex('purchase', 'idx_purchase_resolution_method');
    console.log('❌ Removed index idx_purchase_resolution_method');

    // Remove columns
    await queryInterface.removeColumn('purchase', 'resolution_method');
    console.log('❌ Removed resolution_method column from purchase table');

    await queryInterface.removeColumn('purchase', 'last_polled_at');
    console.log('❌ Removed last_polled_at column from purchase table');

    await queryInterface.removeColumn('purchase', 'polling_attempts');
    console.log('❌ Removed polling_attempts column from purchase table');

    console.log('🔄 Migration rollback completed: Payment polling fields removed from purchase table');
  }
};