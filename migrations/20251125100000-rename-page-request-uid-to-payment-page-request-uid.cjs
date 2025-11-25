'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename column in Transaction table
    await queryInterface.renameColumn('transaction', 'page_request_uid', 'payment_page_request_uid');
    console.log('✅ Renamed page_request_uid to payment_page_request_uid in transaction table');

    // Rename column in WebhookLog table
    await queryInterface.renameColumn('webhook_log', 'page_request_uid', 'payment_page_request_uid');
    console.log('✅ Renamed page_request_uid to payment_page_request_uid in webhook_log table');

    // Update indexes to reflect the new column names

    // Remove old indexes
    await queryInterface.removeIndex('transaction', 'idx_transaction_page_request_uid');
    console.log('✅ Removed old index idx_transaction_page_request_uid');

    await queryInterface.removeIndex('webhook_log', 'idx_webhook_log_page_request_uid');
    console.log('✅ Removed old index idx_webhook_log_page_request_uid');

    // Create new indexes with updated names
    await queryInterface.addIndex('transaction', ['payment_page_request_uid'], {
      name: 'idx_transaction_payment_page_request_uid'
    });
    console.log('✅ Created new index idx_transaction_payment_page_request_uid');

    await queryInterface.addIndex('webhook_log', ['payment_page_request_uid'], {
      name: 'idx_webhook_log_payment_page_request_uid'
    });
    console.log('✅ Created new index idx_webhook_log_payment_page_request_uid');

    console.log('🎯 Migration completed: All page_request_uid fields renamed to payment_page_request_uid');
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes - rename columns back and restore original indexes

    // Remove new indexes
    await queryInterface.removeIndex('transaction', 'idx_transaction_payment_page_request_uid');
    console.log('❌ Removed new index idx_transaction_payment_page_request_uid');

    await queryInterface.removeIndex('webhook_log', 'idx_webhook_log_payment_page_request_uid');
    console.log('❌ Removed new index idx_webhook_log_payment_page_request_uid');

    // Rename columns back
    await queryInterface.renameColumn('transaction', 'payment_page_request_uid', 'page_request_uid');
    console.log('❌ Renamed payment_page_request_uid back to page_request_uid in transaction table');

    await queryInterface.renameColumn('webhook_log', 'payment_page_request_uid', 'page_request_uid');
    console.log('❌ Renamed payment_page_request_uid back to page_request_uid in webhook_log table');

    // Restore original indexes
    await queryInterface.addIndex('transaction', ['page_request_uid'], {
      name: 'idx_transaction_page_request_uid'
    });
    console.log('❌ Restored original index idx_transaction_page_request_uid');

    await queryInterface.addIndex('webhook_log', ['page_request_uid'], {
      name: 'idx_webhook_log_page_request_uid'
    });
    console.log('❌ Restored original index idx_webhook_log_page_request_uid');

    console.log('🔄 Migration rollback completed: All payment_page_request_uid fields renamed back to page_request_uid');
  }
};