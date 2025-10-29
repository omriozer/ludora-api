'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('transaction')
    );

    if (!tableExists) {
      console.log('Transaction table does not exist, skipping cleanup');
      return;
    }

    // Start by clearing all existing data and related foreign key references
    console.log('Clearing all transaction data and related references...');

    // Clear tables that reference transaction table first
    await queryInterface.sequelize.query('DELETE FROM subscription WHERE transaction_id IS NOT NULL;');
    await queryInterface.sequelize.query('DELETE FROM webhook_log WHERE transaction_id IS NOT NULL;');

    // Now safe to clear transaction table
    await queryInterface.sequelize.query('DELETE FROM transaction;');

    // Get table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('transaction');

    // Drop columns if they exist
    const columnsToRemove = [
      'payment_url',
      'session_id',
      'status_last_checked_at',
      'expires_at',
      'processing_source',
      'processing_started_at',
      'processing_completed_at',
      'status_history',
      'processing_attempts',
      'race_condition_winner',
      'last_polling_check_at',
      'webhook_received_at'
    ];

    for (const column of columnsToRemove) {
      if (tableDescription[column]) {
        console.log(`Removing column: ${column}`);
        await queryInterface.removeColumn('transaction', column);
      } else {
        console.log(`Column ${column} does not exist, skipping`);
      }
    }

    // Update environment column to be enum
    if (tableDescription['environment']) {
      console.log('Updating environment column to enum');

      try {
        await queryInterface.changeColumn('transaction', 'environment', {
          type: Sequelize.ENUM('production', 'staging'),
          allowNull: true
        });
      } catch (error) {
        console.log('Environment column conversion error:', error.message);
        throw error;
      }
    }

    // Update payment_status enum to remove 'in_progress' and 'expired'
    if (tableDescription['payment_status']) {
      console.log('Updating payment_status enum');

      try {
        await queryInterface.changeColumn('transaction', 'payment_status', {
          type: Sequelize.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
          allowNull: true,
          defaultValue: 'pending'
        });
      } catch (error) {
        console.log('Payment status column conversion error:', error.message);
        throw error;
      }
    }

    // Add missing columns if they don't exist
    const requiredColumns = {
      'user_id': { type: Sequelize.STRING, allowNull: true },
      'amount': { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      'currency': { type: Sequelize.STRING, allowNull: true, defaultValue: 'ILS' },
      'payment_method': { type: Sequelize.STRING, allowNull: true },
      'transaction_id': { type: Sequelize.STRING, allowNull: true },
      'description': { type: Sequelize.TEXT, allowNull: true },
      'metadata': { type: Sequelize.JSONB, allowNull: true },
      'provider_transaction_id': { type: Sequelize.STRING, allowNull: true },
      'provider_response': { type: Sequelize.JSONB, allowNull: true },
      'failure_reason': { type: Sequelize.TEXT, allowNull: true }
    };

    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!tableDescription[columnName]) {
        console.log(`Adding missing column: ${columnName}`);
        await queryInterface.addColumn('transaction', columnName, columnDef);
      }
    }

    console.log('Transaction table cleanup completed');
  },

  async down(queryInterface, Sequelize) {
    // Rollback - restore the columns and old enums
    console.log('Rolling back transaction table changes...');

    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('transaction')
    );

    if (!tableExists) {
      console.log('Transaction table does not exist for rollback');
      return;
    }

    // Add back the removed columns
    const columnsToRestore = [
      { name: 'payment_url', type: Sequelize.STRING },
      { name: 'session_id', type: Sequelize.STRING },
      { name: 'status_last_checked_at', type: Sequelize.DATE },
      { name: 'expires_at', type: Sequelize.DATE },
      { name: 'processing_source', type: Sequelize.STRING },
      { name: 'processing_started_at', type: Sequelize.DATE },
      { name: 'processing_completed_at', type: Sequelize.DATE },
      { name: 'status_history', type: Sequelize.JSONB },
      { name: 'processing_attempts', type: Sequelize.INTEGER },
      { name: 'race_condition_winner', type: Sequelize.BOOLEAN },
      { name: 'last_polling_check_at', type: Sequelize.DATE },
      { name: 'webhook_received_at', type: Sequelize.DATE }
    ];

    for (const column of columnsToRestore) {
      await queryInterface.addColumn('transaction', column.name, {
        type: column.type,
        allowNull: true
      });
    }

    // Restore old payment_status enum
    await queryInterface.changeColumn('transaction', 'payment_status', {
      type: Sequelize.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded', 'in_progress', 'expired'),
      allowNull: true,
      defaultValue: 'pending'
    });

    // Restore environment as string
    await queryInterface.changeColumn('transaction', 'environment', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};