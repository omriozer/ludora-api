'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Creating PaymentMethods table for token capture system...');

    // Create PaymentMethods table (SINGLE TABLE approach)
    await queryInterface.createTable('PaymentMethods', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Primary key with pm_ prefix for payment method identification'
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        comment: 'ID of the user who owns this payment method'
      },
      payplus_token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'PayPlus payment token for direct charging'
      },
      card_last4: {
        type: Sequelize.STRING(4),
        allowNull: false,
        comment: 'Last 4 digits of the card for display purposes'
      },
      card_brand: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Card brand (visa, mastercard, amex, etc.)'
      },
      card_expiry_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Card expiry month (1-12)'
      },
      card_expiry_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Card expiry year (YYYY)'
      },
      card_holder_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Cardholder name if available'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is the user\'s default payment method'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this payment method is active (for soft deletion)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When this payment method was created'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When this payment method was last updated'
      }
    });

    // Create indexes for efficient queries
    await queryInterface.addIndex('PaymentMethods', ['user_id', 'is_active'], {
      name: 'idx_payment_methods_user_active'
    });

    await queryInterface.addIndex('PaymentMethods', ['user_id', 'is_default', 'is_active'], {
      name: 'idx_payment_methods_user_default'
    });

    await queryInterface.addIndex('PaymentMethods', ['payplus_token'], {
      name: 'idx_payment_methods_token',
      unique: false // Tokens can be duplicated if user manually re-adds same card
    });

    console.log('✅ Created PaymentMethods table with indexes');

    // Add payment_method_id column to transaction table
    const transactionTableExists = await queryInterface.describeTable('transaction');
    if (!transactionTableExists.payment_method_id) {
      await queryInterface.addColumn('transaction', 'payment_method_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'PaymentMethods',
          key: 'id',
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        comment: 'Reference to the payment method used for this transaction'
      });

      console.log('✅ Added payment_method_id column to transaction table');
    } else {
      console.log('⚠️ payment_method_id column already exists in transaction table');
    }

    // Create index on transaction.payment_method_id for efficient lookups
    try {
      await queryInterface.addIndex('transaction', ['payment_method_id'], {
        name: 'idx_transaction_payment_method_id'
      });
      console.log('✅ Created index on transaction.payment_method_id');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Index on transaction.payment_method_id already exists');
      } else {
        throw error;
      }
    }

    console.log('🎯 PaymentMethods table creation completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back PaymentMethods table creation...');

    // Remove index first
    await queryInterface.removeIndex('transaction', 'idx_transaction_payment_method_id');
    console.log('❌ Removed index on transaction.payment_method_id');

    // Remove column from transaction table
    await queryInterface.removeColumn('transaction', 'payment_method_id');
    console.log('❌ Removed payment_method_id column from transaction table');

    // Drop PaymentMethods table
    await queryInterface.dropTable('PaymentMethods');
    console.log('❌ Dropped PaymentMethods table');

    console.log('🔄 PaymentMethods table rollback completed');
  }
};