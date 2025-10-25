'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // This migration was made redundant by the cleanup migration (20251023140002)
    // which already handles the complete table restructuring.
    // The cleanup migration now does both cleanup AND finalization in one step.

    console.log('Transaction table finalization - SKIPPED (already completed by cleanup migration)');

    // Verify the table structure is correct
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('transaction')
    );

    if (tableExists) {
      const tableDescription = await queryInterface.describeTable('transaction');
      const hasCorrectStructure = tableDescription['amount'] &&
                                 tableDescription['provider_response'] &&
                                 !tableDescription['total_amount'] &&
                                 !tableDescription['payplus_response'];

      if (hasCorrectStructure) {
        console.log('✅ Transaction table structure verified - cleanup migration was successful');
      } else {
        console.log('⚠️ Transaction table structure may need attention');
      }
    }
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