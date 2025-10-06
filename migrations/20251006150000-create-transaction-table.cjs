'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Create Transaction table
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
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraint and column from purchase table
    await queryInterface.removeIndex('purchase', 'idx_purchase_transaction_id');
    await queryInterface.removeColumn('purchase', 'transaction_id');

    // Drop transaction table
    await queryInterface.dropTable('transaction');

    console.log('Reverted transaction table and purchase table changes');
  }
};