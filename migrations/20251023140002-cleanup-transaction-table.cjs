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

      // First migrate any 'development' and 'test' values to 'staging'
      await queryInterface.sequelize.query(`
        UPDATE transaction
        SET environment = 'staging'
        WHERE environment IN ('development', 'test');
      `);

      await queryInterface.changeColumn('transaction', 'environment', {
        type: Sequelize.ENUM('production', 'staging'),
        allowNull: true
      });
    }

    // Update payment_status enum to remove 'in_progress' and 'expired'
    if (tableDescription['payment_status'] && tableDescription['payment_status'].type !== 'enum_transaction_payment_status') {
      console.log('Updating payment_status enum');

      // First, update any existing 'in_progress' or 'expired' values to 'pending'
      await queryInterface.sequelize.query(`
        UPDATE transaction
        SET payment_status = 'pending'
        WHERE payment_status IN ('in_progress', 'expired');
      `);

      // Drop the default value first
      await queryInterface.sequelize.query(`
        ALTER TABLE transaction ALTER COLUMN payment_status DROP DEFAULT;
      `);

      // Create the enum type if it doesn't exist
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_transaction_payment_status') THEN
            CREATE TYPE enum_transaction_payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'refunded');
          END IF;
        END $$;
      `);

      // Convert column to enum using raw SQL
      await queryInterface.sequelize.query(`
        ALTER TABLE transaction
        ALTER COLUMN payment_status TYPE enum_transaction_payment_status
        USING payment_status::enum_transaction_payment_status;
      `);

      // Set the default value
      await queryInterface.sequelize.query(`
        ALTER TABLE transaction ALTER COLUMN payment_status SET DEFAULT 'pending';
      `);
    } else {
      console.log('Payment status enum already updated, skipping');
    }

    // Recreate table with proper column order (created_at and updated_at last)
    console.log('Recreating table with proper column order...');

    // Create temporary table with new structure
    await queryInterface.createTable('transaction_temp', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'ILS'
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
        allowNull: true,
        defaultValue: 'pending'
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      environment: {
        type: Sequelize.ENUM('production', 'staging'),
        allowNull: true
      },
      provider_transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      provider_response: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      failure_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Copy data from original table to temp table
    await queryInterface.sequelize.query(`
      INSERT INTO transaction_temp (
        id, amount, currency, payment_method, payment_status,
        provider_response, environment,
        created_at, updated_at
      )
      SELECT
        id, total_amount, 'ILS', payment_method,
        CASE
          WHEN payment_status IN ('in_progress', 'expired') THEN 'pending'
          ELSE payment_status
        END,
        payplus_response,
        CASE
          WHEN environment IN ('development', 'test') THEN 'staging'
          ELSE environment
        END,
        created_at, updated_at
      FROM transaction;
    `);

    // Drop original table and rename temp table
    await queryInterface.dropTable('transaction');
    await queryInterface.renameTable('transaction_temp', 'transaction');

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