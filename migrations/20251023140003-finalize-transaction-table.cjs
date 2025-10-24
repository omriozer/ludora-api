'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('transaction')
    );

    if (!tableExists) {
      console.log('Transaction table does not exist, skipping restructure');
      return;
    }

    console.log('Finalizing transaction table structure...');

    // Create temporary table with final structure
    await queryInterface.createTable('transaction_final', {
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
        type: 'enum_transaction_payment_status',
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
        type: 'enum_transaction_environment',
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

    // Copy data from original table to final table
    await queryInterface.sequelize.query(`
      INSERT INTO transaction_final (
        id, amount, currency, payment_method, payment_status,
        provider_response, environment,
        created_at, updated_at
      )
      SELECT
        id,
        CASE WHEN total_amount IS NOT NULL THEN total_amount
             WHEN payplus_page_uid IS NOT NULL THEN 0
             ELSE NULL END,
        'ILS',
        payment_method,
        payment_status,
        payplus_response,
        environment,
        created_at,
        updated_at
      FROM transaction;
    `);

    // Drop original table and rename final table
    await queryInterface.dropTable('transaction');
    await queryInterface.renameTable('transaction_final', 'transaction');

    console.log('Transaction table finalization completed');
  },

  async down(queryInterface, Sequelize) {
    // Rollback - restore the old structure
    console.log('Rolling back transaction table finalization...');

    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('transaction')
    );

    if (!tableExists) {
      console.log('Transaction table does not exist for rollback');
      return;
    }

    // Create table with old structure
    await queryInterface.createTable('transaction_old', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      payplus_page_uid: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      payment_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'payplus'
      },
      payplus_response: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      environment: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'production'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Copy data back
    await queryInterface.sequelize.query(`
      INSERT INTO transaction_old (
        id, total_amount, payment_status, payment_method,
        payplus_response, environment, created_at, updated_at
      )
      SELECT
        id, amount, payment_status, payment_method,
        provider_response, environment, created_at, updated_at
      FROM transaction;
    `);

    // Replace table
    await queryInterface.dropTable('transaction');
    await queryInterface.renameTable('transaction_old', 'transaction');
  }
};