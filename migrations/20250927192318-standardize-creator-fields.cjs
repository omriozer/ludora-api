'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Standardizing creator fields to use creator_user_id across all tables...');

    // 1. Remove redundant created_by fields from baseModel tables
    // Note: Some tables might not have these fields if they were already cleaned
    const baseTablesToClean = [
      'settings', 'user', 'category', 'attribute', 'audiofile',
      'classroom', 'classroommembership', 'contentlist', 'contentrelationship',
      'contenttag', 'coupon', 'emaillog', 'emailtemplate', 'grammar',
      'gamesession', 'gamecontenttag', 'gameaudiosettings', 'image',
      'notification', 'parentconsent', 'pendingsubscription', 'qa',
      'registration', 'school', 'sitetext', 'studentinvitation',
      'subscriptionhistory', 'subscriptionplan', 'supportmessage',
      'word', 'worden', 'webhooklog', 'game_content_usage_template'
    ];

    for (const tableName of baseTablesToClean) {
      try {
        // Check if table exists first
        const tableExists = await queryInterface.describeTable(tableName).catch(() => null);
        if (!tableExists) {
          console.log(`  ⚠️  Table ${tableName} does not exist, skipping...`);
          continue;
        }

        // Remove created_by if it exists (string field, redundant)
        if (tableExists.created_by) {
          console.log(`  🗑️  Removing created_by from ${tableName}`);
          await queryInterface.removeColumn(tableName, 'created_by');
        }

        // Rename created_by_id to creator_user_id if it exists
        if (tableExists.created_by_id && !tableExists.creator_user_id) {
          console.log(`  🔄 Renaming created_by_id to creator_user_id in ${tableName}`);
          await queryInterface.renameColumn(tableName, 'created_by_id', 'creator_user_id');

          // Add foreign key constraint to user table
          await queryInterface.addConstraint(tableName, {
            fields: ['creator_user_id'],
            type: 'foreign key',
            name: `fk_${tableName}_creator_user_id`,
            references: {
              table: 'user',
              field: 'id'
            }
          });

          // Add index for performance
          await queryInterface.addIndex(tableName, ['creator_user_id'], {
            name: `idx_${tableName}_creator_user_id`
          });
        }
      } catch (error) {
        console.log(`  ⚠️  Error processing ${tableName}: ${error.message}`);
      }
    }

    // 2. Standardize Game table - rename content_creator_id to creator_user_id
    try {
      const gameTable = await queryInterface.describeTable('game').catch(() => null);
      if (gameTable && gameTable.content_creator_id && !gameTable.creator_user_id) {
        console.log('  🔄 Renaming content_creator_id to creator_user_id in game table');
        await queryInterface.renameColumn('game', 'content_creator_id', 'creator_user_id');
      }

      // Remove created_by_id from game if it exists (keeping only creator_user_id)
      if (gameTable && gameTable.created_by_id) {
        console.log('  🗑️  Removing redundant created_by_id from game table');
        await queryInterface.removeColumn('game', 'created_by_id');
      }

      // Remove created_by from game if it exists
      if (gameTable && gameTable.created_by) {
        console.log('  🗑️  Removing redundant created_by from game table');
        await queryInterface.removeColumn('game', 'created_by');
      }
    } catch (error) {
      console.log(`  ⚠️  Error processing game table: ${error.message}`);
    }

    // 3. Ensure all entity tables have proper creator_user_id fields
    const entityTables = ['product', 'file', 'tool', 'course', 'workshop'];

    for (const tableName of entityTables) {
      try {
        const tableExists = await queryInterface.describeTable(tableName).catch(() => null);
        if (!tableExists) {
          console.log(`  ⚠️  Table ${tableName} does not exist, skipping...`);
          continue;
        }

        // Ensure creator_user_id exists with proper structure
        if (!tableExists.creator_user_id) {
          console.log(`  ➕ Adding creator_user_id to ${tableName}`);
          await queryInterface.addColumn(tableName, 'creator_user_id', {
            type: Sequelize.STRING,
            allowNull: true,
            references: {
              model: 'user',
              key: 'id'
            }
          });

          // Add index
          await queryInterface.addIndex(tableName, ['creator_user_id'], {
            name: `idx_${tableName}_creator_user_id`
          });
        }

        // Remove any redundant created_by fields
        if (tableExists.created_by) {
          console.log(`  🗑️  Removing redundant created_by from ${tableName}`);
          await queryInterface.removeColumn(tableName, 'created_by');
        }

        if (tableExists.created_by_id) {
          console.log(`  🗑️  Removing redundant created_by_id from ${tableName}`);
          await queryInterface.removeColumn(tableName, 'created_by_id');
        }
      } catch (error) {
        console.log(`  ⚠️  Error processing ${tableName}: ${error.message}`);
      }
    }

    console.log('✅ Creator field standardization completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('⚠️  Rolling back creator field standardization...');

    // Reverse the changes - this is complex due to data migration
    // For safety, we'll add back the old fields but won't remove the new ones

    const baseTablesToRestore = [
      'settings', 'user', 'category', 'attribute', 'audiofile',
      'classroom', 'classroommembership', 'contentlist', 'contentrelationship',
      'contenttag', 'coupon', 'emaillog', 'emailtemplate', 'grammar',
      'gamesession', 'gamecontenttag', 'gameaudiosettings', 'image',
      'notification', 'parentconsent', 'pendingsubscription', 'qa',
      'registration', 'school', 'sitetext', 'studentinvitation',
      'subscriptionhistory', 'subscriptionplan', 'supportmessage',
      'word', 'worden', 'webhooklog', 'game_content_usage_template'
    ];

    for (const tableName of baseTablesToRestore) {
      try {
        const tableExists = await queryInterface.describeTable(tableName).catch(() => null);
        if (!tableExists) continue;

        // Add back created_by and created_by_id if they don't exist
        if (!tableExists.created_by) {
          await queryInterface.addColumn(tableName, 'created_by', {
            type: Sequelize.STRING,
            allowNull: true
          });
        }

        if (!tableExists.created_by_id) {
          await queryInterface.addColumn(tableName, 'created_by_id', {
            type: Sequelize.STRING,
            allowNull: true
          });
        }
      } catch (error) {
        console.log(`  ⚠️  Error restoring ${tableName}: ${error.message}`);
      }
    }

    // Restore game table structure
    try {
      const gameTable = await queryInterface.describeTable('game').catch(() => null);
      if (gameTable) {
        if (!gameTable.content_creator_id && gameTable.creator_user_id) {
          await queryInterface.renameColumn('game', 'creator_user_id', 'content_creator_id');
        }

        if (!gameTable.created_by_id) {
          await queryInterface.addColumn('game', 'created_by_id', {
            type: Sequelize.STRING,
            allowNull: true
          });
        }

        if (!gameTable.created_by) {
          await queryInterface.addColumn('game', 'created_by', {
            type: Sequelize.STRING,
            allowNull: true
          });
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Error restoring game table: ${error.message}`);
    }

    console.log('✅ Creator field standardization rollback completed');
  }
};