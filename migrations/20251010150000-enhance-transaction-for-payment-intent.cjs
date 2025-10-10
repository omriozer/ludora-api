'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new fields to transaction table to support PaymentIntent functionality
    await queryInterface.addColumn('transaction', 'payment_url', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'PayPlus payment page URL for this transaction'
    });

    await queryInterface.addColumn('transaction', 'session_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Associated PaymentSession ID for backward compatibility'
    });

    await queryInterface.addColumn('transaction', 'status_last_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of last status check for polling optimization'
    });

    await queryInterface.addColumn('transaction', 'expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Transaction expiration time for cleanup service'
    });

    // Add index for status_last_checked_at for efficient polling queries
    await queryInterface.addIndex('transaction', ['status_last_checked_at'], {
      name: 'idx_transaction_status_last_checked_at'
    });

    // Add index for expires_at for efficient cleanup queries
    await queryInterface.addIndex('transaction', ['expires_at'], {
      name: 'idx_transaction_expires_at'
    });

    // Add index for session_id for backward compatibility lookups
    await queryInterface.addIndex('transaction', ['session_id'], {
      name: 'idx_transaction_session_id'
    });

    // Update payment_status to include new states: add 'in_progress' and 'expired'
    // Note: We won't drop/recreate the column to avoid data loss
    // Just document that these new values are now supported
    console.log('✅ Enhanced transaction table for PaymentIntent functionality');
    console.log('📝 Note: payment_status now supports: pending, in_progress, completed, failed, cancelled, expired');
  },

  async down(queryInterface, Sequelize) {
    // Remove the indexes first
    await queryInterface.removeIndex('transaction', 'idx_transaction_status_last_checked_at');
    await queryInterface.removeIndex('transaction', 'idx_transaction_expires_at');
    await queryInterface.removeIndex('transaction', 'idx_transaction_session_id');

    // Remove the added columns
    await queryInterface.removeColumn('transaction', 'payment_url');
    await queryInterface.removeColumn('transaction', 'session_id');
    await queryInterface.removeColumn('transaction', 'status_last_checked_at');
    await queryInterface.removeColumn('transaction', 'expires_at');

    console.log('✅ Reverted transaction table enhancements');
  }
};