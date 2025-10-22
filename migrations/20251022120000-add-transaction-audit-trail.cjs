'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add enhanced audit trail fields to transaction table
    await queryInterface.addColumn('transaction', 'processing_source', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Source that processed the payment: webhook, polling, manual'
    });

    await queryInterface.addColumn('transaction', 'processing_started_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When payment processing began'
    });

    await queryInterface.addColumn('transaction', 'processing_completed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When payment processing finished'
    });

    await queryInterface.addColumn('transaction', 'status_history', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of status changes with timestamps and sources'
    });

    await queryInterface.addColumn('transaction', 'processing_attempts', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Number of processing attempts (for retry tracking)'
    });

    await queryInterface.addColumn('transaction', 'race_condition_winner', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Which method won the race condition: webhook or polling'
    });

    await queryInterface.addColumn('transaction', 'last_polling_check_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last time polling service checked this transaction'
    });

    await queryInterface.addColumn('transaction', 'webhook_received_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When webhook was received for this transaction'
    });

    // Add indexes for audit trail fields
    await queryInterface.addIndex('transaction', ['processing_source'], {
      name: 'idx_transaction_processing_source'
    });

    await queryInterface.addIndex('transaction', ['processing_started_at'], {
      name: 'idx_transaction_processing_started_at'
    });

    await queryInterface.addIndex('transaction', ['race_condition_winner'], {
      name: 'idx_transaction_race_winner'
    });

    await queryInterface.addIndex('transaction', ['last_polling_check_at'], {
      name: 'idx_transaction_last_polling_check'
    });

    console.log('✅ Added comprehensive audit trail fields to transaction table');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('transaction', 'idx_transaction_processing_source');
    await queryInterface.removeIndex('transaction', 'idx_transaction_processing_started_at');
    await queryInterface.removeIndex('transaction', 'idx_transaction_race_winner');
    await queryInterface.removeIndex('transaction', 'idx_transaction_last_polling_check');

    // Remove columns
    await queryInterface.removeColumn('transaction', 'processing_source');
    await queryInterface.removeColumn('transaction', 'processing_started_at');
    await queryInterface.removeColumn('transaction', 'processing_completed_at');
    await queryInterface.removeColumn('transaction', 'status_history');
    await queryInterface.removeColumn('transaction', 'processing_attempts');
    await queryInterface.removeColumn('transaction', 'race_condition_winner');
    await queryInterface.removeColumn('transaction', 'last_polling_check_at');
    await queryInterface.removeColumn('transaction', 'webhook_received_at');

    console.log('✅ Removed audit trail fields from transaction table');
  }
};