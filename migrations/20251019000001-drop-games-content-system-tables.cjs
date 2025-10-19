'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🗑️  Starting to drop game content system tables...');

    // Define all tables to drop in correct order (considering foreign key dependencies)
    const tablesToDrop = [
      // Drop tables with foreign key dependencies first
      'GameContentRuleInstances',
      'GameContentUsages',
      'GameContentUsageTemplates',
      'ContentRelationships',
      'GameContentRules',
      'GameContentTags',
      'GameAudioSettings',
      'GameMemorySettings',
      'GameScatterSettings',
      'GameWisdomMazeSettings',
      'GameSessions',
      'GameTypeContentRestrictions',
      'ManualMemoryPairs',
      'MemoryPairingRules',

      // Drop independent tables last
      'Attributes',
      'ContentLists',
      'ContentTags',
      'Grammars',
      'Images',
      'QAs',
      'Words',
      'WordENs'
    ];

    // Drop each table if it exists
    for (const tableName of tablesToDrop) {
      try {
        // Check if table exists first
        const tableExists = await queryInterface.describeTable(tableName).then(() => true).catch(() => false);

        if (tableExists) {
          console.log(`🗑️  Dropping table: ${tableName}`);
          await queryInterface.dropTable(tableName);
          console.log(`✅ Successfully dropped table: ${tableName}`);
        } else {
          console.log(`⏭️  Table ${tableName} does not exist, skipping`);
        }
      } catch (error) {
        console.error(`❌ Error dropping table ${tableName}:`, error.message);
        // Continue with other tables even if one fails
      }
    }

    console.log('✅ Completed dropping game content system tables');
  },

  async down(queryInterface, Sequelize) {
    console.log('⚠️  This migration cannot be reversed - tables were permanently dropped');
    console.log('⚠️  To restore these tables, you would need to:');
    console.log('   1. Restore the deleted model files');
    console.log('   2. Run original table creation migrations');
    console.log('   3. Restore any seed data');

    // We cannot reverse this migration as we deleted the model files
    // This is intentional - the tables should stay dropped
    return Promise.resolve();
  }
};