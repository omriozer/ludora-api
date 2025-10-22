'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		console.log('🗑️  Starting to drop game content system tables...');

		// Define all tables to drop - order doesn't matter as no interdependencies exist
		const tablesToDrop = [
			'contentlist',
			'attribute',
			'contentrelationship',
			'contenttag',
			'game_content_rule',
			'game_content_rule_instance',
			'gamesession',
			'image',
			'manual_memory_pairs',
			'memory_pairing_rules',
			'word',
			'worden'
		];

		let droppedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		// Drop each table if it exists
		for (const tableName of tablesToDrop) {
			try {
				// Check if table exists first
				const tableExists = await queryInterface
					.describeTable(tableName)
					.then(() => true)
					.catch(() => false);

				if (tableExists) {
					console.log(`🗑️  Dropping table: ${tableName}`);

					// Use CASCADE to handle any remaining dependencies
					await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);

					console.log(`✅ Successfully dropped table: ${tableName}`);
					droppedCount++;
				} else {
					console.log(`⏭️  Table ${tableName} does not exist, skipping`);
					skippedCount++;
				}
			} catch (error) {
				console.error(`❌ Error dropping table ${tableName}:`, error.message);
				console.error(`❌ Full error:`, error);
				errorCount++;
				// Continue with other tables even if one fails
			}
		}

		console.log(`✅ Migration completed:`);
		console.log(`   - Tables dropped: ${droppedCount}`);
		console.log(`   - Tables skipped: ${skippedCount}`);
		console.log(`   - Errors encountered: ${errorCount}`);

		if (errorCount > 0) {
			throw new Error(`Migration completed with ${errorCount} errors. Check logs above for details.`);
		}
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
	},
};
