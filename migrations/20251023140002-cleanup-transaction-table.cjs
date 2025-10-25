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

      // First migrate ALL non-production environment values to 'staging'
      await queryInterface.sequelize.query(`
        UPDATE transaction
        SET environment = 'staging'
        WHERE environment != 'production' AND environment IS NOT NULL;
      `);

      // Verify all values are now valid before enum conversion
      const invalidEnvironmentValues = await queryInterface.sequelize.query(`
        SELECT DISTINCT environment
        FROM transaction
        WHERE environment IS NOT NULL
        AND environment NOT IN ('production', 'staging');
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });

      if (invalidEnvironmentValues.length > 0) {
        console.log('Found invalid environment values:', invalidEnvironmentValues.map(row => row.environment));
        // Force convert any remaining invalid values
        await queryInterface.sequelize.query(`
          UPDATE transaction
          SET environment = 'staging'
          WHERE environment IS NOT NULL AND environment NOT IN ('production', 'staging');
        `);
      }

      // Now safely convert to enum
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

      // Clean up ALL invalid payment status values first
      await queryInterface.sequelize.query(`
        UPDATE transaction
        SET payment_status = 'pending'
        WHERE payment_status NOT IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')
        AND payment_status IS NOT NULL;
      `);

      // Verify all values are now valid before enum conversion
      const invalidPaymentStatusValues = await queryInterface.sequelize.query(`
        SELECT DISTINCT payment_status
        FROM transaction
        WHERE payment_status IS NOT NULL
        AND payment_status NOT IN ('pending', 'completed', 'failed', 'cancelled', 'refunded');
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });

      if (invalidPaymentStatusValues.length > 0) {
        console.log('Found invalid payment_status values:', invalidPaymentStatusValues.map(row => row.payment_status));
        // Force convert any remaining invalid values
        await queryInterface.sequelize.query(`
          UPDATE transaction
          SET payment_status = 'pending'
          WHERE payment_status IS NOT NULL
          AND payment_status NOT IN ('pending', 'completed', 'failed', 'cancelled', 'refunded');
        `);
      }

      // Now safely convert to enum
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
    // Check which columns exist for compatibility across environments
    const amountColumn = tableDescription['total_amount'] ? 'total_amount' : 'amount';
    const responseColumn = tableDescription['payplus_response'] ? 'payplus_response' : 'provider_response';
    console.log(`Using amount column: ${amountColumn}, response column: ${responseColumn}`);

    await queryInterface.sequelize.query(`
      INSERT INTO transaction_temp (
        id, amount, currency, payment_method, payment_status,
        provider_response, environment,
        created_at, updated_at
      )
      SELECT
        id, ${amountColumn}, 'ILS', payment_method,
        CASE
          WHEN payment_status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded') THEN payment_status::text
          WHEN payment_status IS NULL THEN NULL
          ELSE 'pending'
        END::enum_transaction_temp_payment_status,
        ${responseColumn},
        CASE
          WHEN environment = 'production' THEN 'production'
          WHEN environment IS NULL THEN NULL
          ELSE 'staging'
        END::enum_transaction_temp_environment,
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