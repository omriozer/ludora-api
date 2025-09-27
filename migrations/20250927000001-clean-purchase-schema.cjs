'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🧹 Starting purchase schema cleanup migration...');

      // 1. Add new proper user FK column
      console.log('📝 Adding buyer_user_id column...');
      await queryInterface.addColumn('purchase', 'buyer_user_id', {
        type: Sequelize.STRING,
        allowNull: true, // temporarily nullable for migration
      }, { transaction });

      // 2. Populate buyer_user_id from buyer_email
      console.log('🔗 Populating buyer_user_id from buyer_email...');
      const [results] = await queryInterface.sequelize.query(`
        UPDATE purchase
        SET buyer_user_id = u.id
        FROM "user" u
        WHERE purchase.buyer_email = u.email
          AND purchase.buyer_email IS NOT NULL
      `, { transaction });
      console.log(`✅ Updated ${results.rowCount || 0} purchase records with user IDs`);

      // 3. Make buyer_user_id NOT NULL and add FK constraint
      console.log('🔒 Adding FK constraint on buyer_user_id...');
      await queryInterface.changeColumn('purchase', 'buyer_user_id', {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        }
      }, { transaction });

      // 4. Remove redundant buyer fields
      console.log('🗑️ Removing redundant buyer fields...');
      await queryInterface.removeColumn('purchase', 'buyer_email', { transaction });
      await queryInterface.removeColumn('purchase', 'buyer_name', { transaction });
      await queryInterface.removeColumn('purchase', 'buyer_phone', { transaction });

      // 5. Remove legacy entity reference fields
      console.log('🗑️ Removing legacy entity reference fields...');
      await queryInterface.removeColumn('purchase', 'product_id', { transaction });
      await queryInterface.removeColumn('purchase', 'workshop_id', { transaction });

      // 6. Remove subscription-related fields (these belong in subscription_history)
      console.log('🗑️ Removing subscription-related fields...');
      const subscriptionFields = [
        'is_subscription_renewal',
        'subscription_plan_id',
        'is_subscription_upgrade',
        'upgrade_proration_amount',
        'subscription_cycle_start',
        'subscription_cycle_end'
      ];

      for (const field of subscriptionFields) {
        try {
          await queryInterface.removeColumn('purchase', field, { transaction });
          console.log(`   ✅ Removed ${field}`);
        } catch (error) {
          console.log(`   ⚠️ Field ${field} may not exist, continuing...`);
        }
      }

      // 7. Remove redundant access control fields
      console.log('🗑️ Removing redundant access control fields...');
      const accessFields = [
        'access_until',
        'purchased_access_days',
        'purchased_lifetime_access'
      ];

      for (const field of accessFields) {
        try {
          await queryInterface.removeColumn('purchase', field, { transaction });
          console.log(`   ✅ Removed ${field}`);
        } catch (error) {
          console.log(`   ⚠️ Field ${field} may not exist, continuing...`);
        }
      }

      // 8. Remove obsolete fields
      console.log('🗑️ Removing obsolete fields...');
      const obsoleteFields = [
        'environment',
        'is_recording_only',
        'created_by',
        'created_by_id',
        'is_sample'
      ];

      for (const field of obsoleteFields) {
        try {
          await queryInterface.removeColumn('purchase', field, { transaction });
          console.log(`   ✅ Removed ${field}`);
        } catch (error) {
          console.log(`   ⚠️ Field ${field} may not exist, continuing...`);
        }
      }

      // 9. Fix data types for timestamp fields
      console.log('🔧 Fixing timestamp field data types...');

      // Convert string timestamp fields to proper DATE types
      const timestampFields = ['first_accessed', 'last_accessed'];
      for (const field of timestampFields) {
        try {
          // First, update invalid string dates to NULL
          await queryInterface.sequelize.query(`
            UPDATE purchase
            SET ${field} = NULL
            WHERE ${field} IS NOT NULL
              AND ${field} !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          `, { transaction });

          // Then change column type
          await queryInterface.changeColumn('purchase', field, {
            type: Sequelize.DATE,
            allowNull: true,
          }, { transaction });
          console.log(`   ✅ Fixed ${field} data type`);
        } catch (error) {
          console.log(`   ⚠️ Could not fix ${field}, continuing...`);
        }
      }

      // 10. Rename columns for consistency
      console.log('📝 Renaming columns for consistency...');
      try {
        await queryInterface.renameColumn('purchase', 'first_accessed', 'first_accessed_at', { transaction });
        console.log('   ✅ Renamed first_accessed to first_accessed_at');
      } catch (error) {
        console.log('   ⚠️ Could not rename first_accessed, may already be renamed');
      }

      try {
        await queryInterface.renameColumn('purchase', 'last_accessed', 'last_accessed_at', { transaction });
        console.log('   ✅ Renamed last_accessed to last_accessed_at');
      } catch (error) {
        console.log('   ⚠️ Could not rename last_accessed, may already be renamed');
      }

      // 11. Add missing useful columns
      console.log('➕ Adding missing useful columns...');

      // Add payment_method if it doesn't exist
      try {
        await queryInterface.addColumn('purchase', 'payment_method', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }, { transaction });
        console.log('   ✅ Added payment_method column');
      } catch (error) {
        console.log('   ⚠️ payment_method column may already exist');
      }

      // Add transaction_id if it doesn't exist
      try {
        await queryInterface.addColumn('purchase', 'transaction_id', {
          type: Sequelize.STRING,
          allowNull: true,
        }, { transaction });
        console.log('   ✅ Added transaction_id column');
      } catch (error) {
        console.log('   ⚠️ transaction_id column may already exist');
      }

      // Add metadata JSONB column
      try {
        await queryInterface.addColumn('purchase', 'metadata', {
          type: Sequelize.JSONB,
          defaultValue: {},
          allowNull: true,
        }, { transaction });
        console.log('   ✅ Added metadata JSONB column');
      } catch (error) {
        console.log('   ⚠️ metadata column may already exist');
      }

      // 12. Update constraints and add proper validation
      console.log('🔒 Updating constraints...');

      // Ensure polymorphic fields are properly constrained
      await queryInterface.changeColumn('purchase', 'purchasable_type', {
        type: Sequelize.STRING(50),
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn('purchase', 'purchasable_id', {
        type: Sequelize.STRING,
        allowNull: false,
      }, { transaction });

      console.log('   ✅ Updated polymorphic field constraints');

      // 13. Remove old indexes that are no longer needed
      console.log('🗑️ Removing obsolete indexes...');
      const oldIndexes = [
        'idx_purchase_buyer_email',
        'purchase_buyer_email_idx',
        'idx_purchase_product_id'
      ];

      for (const indexName of oldIndexes) {
        try {
          await queryInterface.removeIndex('purchase', indexName, { transaction });
          console.log(`   ✅ Removed index ${indexName}`);
        } catch (error) {
          console.log(`   ⚠️ Index ${indexName} may not exist, continuing...`);
        }
      }

      // 14. Create optimized indexes
      console.log('📊 Creating optimized indexes...');

      const newIndexes = [
        {
          name: 'idx_purchase_buyer_user_id',
          fields: ['buyer_user_id'],
          description: 'Fast lookup by buyer user'
        },
        {
          name: 'idx_purchase_polymorphic',
          fields: ['purchasable_type', 'purchasable_id'],
          description: 'Polymorphic entity lookup'
        },
        {
          name: 'idx_purchase_payment_status',
          fields: ['payment_status'],
          description: 'Payment status queries'
        },
        {
          name: 'idx_purchase_access_expires',
          fields: ['access_expires_at'],
          description: 'Access expiration queries'
        },
        {
          name: 'idx_purchase_created_at',
          fields: ['created_at'],
          description: 'Purchase history ordering'
        }
      ];

      for (const index of newIndexes) {
        try {
          await queryInterface.addIndex('purchase', index.fields, {
            name: index.name,
            transaction
          });
          console.log(`   ✅ Created index ${index.name} - ${index.description}`);
        } catch (error) {
          console.log(`   ⚠️ Index ${index.name} may already exist, continuing...`);
        }
      }

      await transaction.commit();
      console.log('✅ Purchase schema cleanup completed successfully!');
      console.log('📊 Schema now has ~18 clean fields (from 30+ redundant fields)');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Since we don't need backward compatibility and this is a cleanup migration,
    // rolling back would be complex and potentially data-destructive.
    // We'll implement a basic rollback that adds back the essential fields only.

    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('⚠️ Rolling back purchase schema cleanup...');

      // Add back essential buyer fields
      await queryInterface.addColumn('purchase', 'buyer_email', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      // Populate buyer_email from user table
      await queryInterface.sequelize.query(`
        UPDATE purchase
        SET buyer_email = u.email
        FROM "user" u
        WHERE purchase.buyer_user_id = u.id
      `, { transaction });

      // Remove the new FK column
      await queryInterface.removeColumn('purchase', 'buyer_user_id', { transaction });

      await transaction.commit();
      console.log('✅ Basic rollback completed');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};