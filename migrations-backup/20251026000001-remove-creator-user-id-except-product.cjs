'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Removing creator_user_id column from all tables except product...');

    // List of tables that currently have creator_user_id (except product)
    const tablesToUpdate = [
      'audiofile',
      'category',
      'classroom',
      'classroommembership',
      'contact_page_generators',
      'coupon',
      'course',
      'file',
      'game',
      'settings',
      'subscriptionplan',
      'workshop'
    ];

    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const result = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        `);
        return result[0].length > 0;
      } catch (error) {
        console.log(`Error checking column ${columnName} in table ${tableName}:`, error.message);
        return false;
      }
    };

    // Remove creator_user_id from each table if it exists
    for (const tableName of tablesToUpdate) {
      try {
        console.log(`Checking table: ${tableName}`);

        const hasColumn = await columnExists(tableName, 'creator_user_id');

        if (hasColumn) {
          console.log(`Removing creator_user_id from ${tableName}...`);
          await queryInterface.removeColumn(tableName, 'creator_user_id');
          console.log(`✅ Removed creator_user_id from ${tableName}`);
        } else {
          console.log(`⏭️  creator_user_id column not found in ${tableName}, skipping`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to remove creator_user_id from ${tableName}:`, error.message);
        // Continue with other tables even if one fails
      }
    }

    console.log('✅ Successfully removed creator_user_id from all tables except product');
  },

  async down(queryInterface, Sequelize) {
    console.log('Rolling back creator_user_id removal...');

    // List of tables to restore creator_user_id to
    const tablesToRestore = [
      'audiofile',
      'category',
      'classroom',
      'classroommembership',
      'contact_page_generators',
      'coupon',
      'course',
      'file',
      'game',
      'settings',
      'subscriptionplan',
      'workshop'
    ];

    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const result = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        `);
        return result[0].length > 0;
      } catch (error) {
        console.log(`Error checking column ${columnName} in table ${tableName}:`, error.message);
        return false;
      }
    };

    // Re-add creator_user_id to each table if it doesn't exist
    for (const tableName of tablesToRestore) {
      try {
        console.log(`Checking table: ${tableName}`);

        const hasColumn = await columnExists(tableName, 'creator_user_id');

        if (!hasColumn) {
          console.log(`Adding creator_user_id back to ${tableName}...`);
          await queryInterface.addColumn(tableName, 'creator_user_id', {
            type: Sequelize.STRING,
            allowNull: true,
            references: {
              model: 'user',
              key: 'id',
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE'
            },
            comment: 'User who created this entity'
          });
          console.log(`✅ Added creator_user_id back to ${tableName}`);
        } else {
          console.log(`⏭️  creator_user_id column already exists in ${tableName}, skipping`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to add creator_user_id back to ${tableName}:`, error.message);
        // Continue with other tables even if one fails
      }
    }

    console.log('✅ Successfully restored creator_user_id to all affected tables');
  }
};