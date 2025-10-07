'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if transaction table already exists
    try {
      await queryInterface.describeTable('transaction');
      console.log('Transaction table already exists, skipping creation...');
    } catch (error) {
      // Table doesn't exist, create it
      await queryInterface.createTable('transaction', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      payplus_page_uid: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10,2),
        allowNull: false,
      },
      payment_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'completed', 'failed', 'cancelled']]
        }
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'payplus',
      },
      payplus_response: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      environment: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'production',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    }, {
      indexes: [
        {
          fields: ['payplus_page_uid'],
          name: 'idx_transaction_payplus_page_uid'
        },
        {
          fields: ['payment_status'],
          name: 'idx_transaction_payment_status'
        },
        {
          fields: ['created_at'],
          name: 'idx_transaction_created_at'
        },
      ],
      });

      console.log('Transaction table created successfully');
    }

    // Check if transaction_id column already exists in purchase table
    const purchaseTableInfo = await queryInterface.describeTable('purchase');

    if (!purchaseTableInfo.transaction_id) {
      // Add transaction_id column to purchase table
      await queryInterface.addColumn('purchase', 'transaction_id', {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
          model: 'transaction',
          key: 'id',
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        }
      });

      // Add index for transaction_id in purchase table
      await queryInterface.addIndex('purchase', {
        fields: ['transaction_id'],
        name: 'idx_purchase_transaction_id'
      });

      console.log('Added transaction_id column to purchase table with foreign key constraint');
    } else {
      console.log('transaction_id column already exists in purchase table, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Check if transaction_id column exists in purchase table
      const purchaseTableInfo = await queryInterface.describeTable('purchase');

      if (purchaseTableInfo.transaction_id) {
        // Remove index if it exists
        try {
          await queryInterface.removeIndex('purchase', 'idx_purchase_transaction_id');
        } catch (error) {
          console.log('Index idx_purchase_transaction_id does not exist, skipping removal');
        }

        // Remove foreign key constraint and column from purchase table
        await queryInterface.removeColumn('purchase', 'transaction_id');
        console.log('Removed transaction_id column from purchase table');
      } else {
        console.log('transaction_id column does not exist in purchase table, skipping removal');
      }
    } catch (error) {
      console.log('Error checking purchase table schema:', error.message);
    }

    try {
      // Drop transaction table if it exists
      await queryInterface.dropTable('transaction');
      console.log('Dropped transaction table');
    } catch (error) {
      console.log('Transaction table does not exist or error dropping:', error.message);
    }

    console.log('Reverted transaction table and purchase table changes');
  }
};