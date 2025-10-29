'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding missing fields to subscriptionhistory table...');

    // Check if table exists before attempting to modify it
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('subscriptionhistory')
    );

    if (!tableExists) {
      console.error('❌ subscriptionhistory table does not exist. Please run the create-subscriptionhistory migration first.');
      throw new Error('subscriptionhistory table does not exist');
    }

    // Get existing columns to check which fields already exist
    const tableDescription = await queryInterface.describeTable('subscriptionhistory');
    const existingColumns = Object.keys(tableDescription);

    console.log(`📋 Existing columns in subscriptionhistory: ${existingColumns.join(', ')}`);

    // Add payplus_subscription_uid field if it doesn't exist
    if (!existingColumns.includes('payplus_subscription_uid')) {
      await queryInterface.addColumn('subscriptionhistory', 'payplus_subscription_uid', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'PayPlus subscription UID for tracking recurring payments'
      });
      console.log('✅ Added payplus_subscription_uid column');
    } else {
      console.log('ℹ️ payplus_subscription_uid column already exists, skipping');
    }

    // Add purchased_price field if it doesn't exist
    if (!existingColumns.includes('purchased_price')) {
      await queryInterface.addColumn('subscriptionhistory', 'purchased_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price paid for this subscription action'
      });
      console.log('✅ Added purchased_price column');
    } else {
      console.log('ℹ️ purchased_price column already exists, skipping');
    }

    // Add metadata field if it doesn't exist
    if (!existingColumns.includes('metadata')) {
      await queryInterface.addColumn('subscriptionhistory', 'metadata', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '{}',
        comment: 'Additional metadata about the subscription action (payment details, webhook data, etc.)'
      });
      console.log('✅ Added metadata column');
    } else {
      console.log('ℹ️ metadata column already exists, skipping');
    }

    // Add cancellation_reason field if it doesn't exist
    if (!existingColumns.includes('cancellation_reason')) {
      await queryInterface.addColumn('subscriptionhistory', 'cancellation_reason', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Reason for subscription cancellation (user_request, payment_failed, admin_action, etc.)'
      });
      console.log('✅ Added cancellation_reason column');
    } else {
      console.log('ℹ️ cancellation_reason column already exists, skipping');
    }

    // Add notes field if it doesn't exist
    if (!existingColumns.includes('notes')) {
      await queryInterface.addColumn('subscriptionhistory', 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about this subscription action'
      });
      console.log('✅ Added notes column');
    } else {
      console.log('ℹ️ notes column already exists, skipping');
    }

    // Add next_billing_date field if it doesn't exist
    if (!existingColumns.includes('next_billing_date')) {
      await queryInterface.addColumn('subscriptionhistory', 'next_billing_date', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the next billing cycle should occur for active subscriptions'
      });
      console.log('✅ Added next_billing_date column');
    } else {
      console.log('ℹ️ next_billing_date column already exists, skipping');
    }

    // Add cancelled_at field if it doesn't exist
    if (!existingColumns.includes('cancelled_at')) {
      await queryInterface.addColumn('subscriptionhistory', 'cancelled_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when the subscription was cancelled'
      });
      console.log('✅ Added cancelled_at column');
    } else {
      console.log('ℹ️ cancelled_at column already exists, skipping');
    }

    // Add useful indexes for the new fields
    console.log('🔄 Adding indexes for new fields...');

    // Index for PayPlus subscription UID lookup
    try {
      await queryInterface.addIndex('subscriptionhistory', ['payplus_subscription_uid'], {
        name: 'idx_subscriptionhistory_payplus_subscription_uid'
      });
      console.log('✅ Added index for payplus_subscription_uid');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Index for payplus_subscription_uid already exists, skipping');
      } else {
        throw error;
      }
    }

    // Index for cancellation tracking
    try {
      await queryInterface.addIndex('subscriptionhistory', ['cancellation_reason'], {
        name: 'idx_subscriptionhistory_cancellation_reason'
      });
      console.log('✅ Added index for cancellation_reason');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Index for cancellation_reason already exists, skipping');
      } else {
        throw error;
      }
    }

    // Index for next billing date queries
    try {
      await queryInterface.addIndex('subscriptionhistory', ['next_billing_date'], {
        name: 'idx_subscriptionhistory_next_billing_date'
      });
      console.log('✅ Added index for next_billing_date');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Index for next_billing_date already exists, skipping');
      } else {
        throw error;
      }
    }

    // Index for cancelled subscriptions
    try {
      await queryInterface.addIndex('subscriptionhistory', ['cancelled_at'], {
        name: 'idx_subscriptionhistory_cancelled_at'
      });
      console.log('✅ Added index for cancelled_at');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Index for cancelled_at already exists, skipping');
      } else {
        throw error;
      }
    }

    // Composite index for active subscription queries
    try {
      await queryInterface.addIndex('subscriptionhistory', ['user_id', 'status', 'next_billing_date'], {
        name: 'idx_subscriptionhistory_user_status_billing'
      });
      console.log('✅ Added composite index for user_id, status, next_billing_date');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Composite index for user_id, status, next_billing_date already exists, skipping');
      } else {
        throw error;
      }
    }

    console.log('✅ Successfully added all missing fields and indexes to subscriptionhistory table');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Removing added fields from subscriptionhistory table...');

    // Check if table exists
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('subscriptionhistory')
    );

    if (!tableExists) {
      console.log('ℹ️ subscriptionhistory table does not exist, nothing to rollback');
      return;
    }

    // Get existing columns
    const tableDescription = await queryInterface.describeTable('subscriptionhistory');
    const existingColumns = Object.keys(tableDescription);

    // Remove indexes first
    console.log('🔄 Removing indexes...');

    const indexesToRemove = [
      'idx_subscriptionhistory_payplus_subscription_uid',
      'idx_subscriptionhistory_cancellation_reason',
      'idx_subscriptionhistory_next_billing_date',
      'idx_subscriptionhistory_cancelled_at',
      'idx_subscriptionhistory_user_status_billing'
    ];

    for (const indexName of indexesToRemove) {
      try {
        await queryInterface.removeIndex('subscriptionhistory', indexName);
        console.log(`✅ Removed index ${indexName}`);
      } catch (error) {
        console.log(`ℹ️ Index ${indexName} does not exist or already removed, skipping`);
      }
    }

    // Remove columns in reverse order
    const columnsToRemove = [
      'cancelled_at',
      'next_billing_date',
      'notes',
      'cancellation_reason',
      'metadata',
      'purchased_price',
      'payplus_subscription_uid'
    ];

    for (const columnName of columnsToRemove) {
      if (existingColumns.includes(columnName)) {
        try {
          await queryInterface.removeColumn('subscriptionhistory', columnName);
          console.log(`✅ Removed column ${columnName}`);
        } catch (error) {
          console.error(`❌ Failed to remove column ${columnName}:`, error.message);
        }
      } else {
        console.log(`ℹ️ Column ${columnName} does not exist, skipping removal`);
      }
    }

    console.log('✅ Successfully removed all added fields and indexes from subscriptionhistory table');
  }
};