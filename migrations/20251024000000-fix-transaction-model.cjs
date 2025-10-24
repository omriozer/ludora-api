'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove fields that are no longer needed
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop indexes for fields we're removing
      try {
        await queryInterface.removeIndex('transaction', 'idx_transaction_transaction_id', { transaction });
      } catch (error) {
        console.log('Index idx_transaction_transaction_id may not exist, continuing...');
      }

      try {
        await queryInterface.removeIndex('transaction', 'idx_transaction_provider_transaction_id', { transaction });
      } catch (error) {
        console.log('Index idx_transaction_provider_transaction_id may not exist, continuing...');
      }

      // Remove unwanted columns
      try {
        await queryInterface.removeColumn('transaction', 'transaction_id', { transaction });
      } catch (error) {
        console.log('Column transaction_id may not exist, continuing...');
      }

      try {
        await queryInterface.removeColumn('transaction', 'description', { transaction });
      } catch (error) {
        console.log('Column description may not exist, continuing...');
      }

      try {
        await queryInterface.removeColumn('transaction', 'provider_transaction_id', { transaction });
      } catch (error) {
        console.log('Column provider_transaction_id may not exist, continuing...');
      }

      // Add new required columns
      await queryInterface.addColumn('transaction', 'page_request_uid', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('transaction', 'payment_page_link', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      // Add indexes for new fields
      await queryInterface.addIndex('transaction', ['page_request_uid'], {
        name: 'idx_transaction_page_request_uid',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove new columns
      await queryInterface.removeColumn('transaction', 'page_request_uid', { transaction });
      await queryInterface.removeColumn('transaction', 'payment_page_link', { transaction });

      // Add back removed columns
      await queryInterface.addColumn('transaction', 'transaction_id', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('transaction', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('transaction', 'provider_transaction_id', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      // Restore indexes
      await queryInterface.addIndex('transaction', ['transaction_id'], {
        name: 'idx_transaction_transaction_id',
        transaction
      });

      await queryInterface.addIndex('transaction', ['provider_transaction_id'], {
        name: 'idx_transaction_provider_transaction_id',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};