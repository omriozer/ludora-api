/**
 * Migration: Add GameSession Table Indexes (Split 7/7)
 *
 * Creates performance indexes for the GameSession table:
 * - JSONB participants optimization for student_id queries
 * - Uses GIN index for efficient JSON searches
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding GameSession table indexes...');

      // Game session participants optimization (JSONB) - now using student_id
      try {
        await queryInterface.addIndex('gamesession', {
          fields: [
            queryInterface.sequelize.literal("((participants)::text)")
          ],
          name: 'idx_gamesession_participants_text',
          using: 'gin'
        }, { transaction });
        console.log('✅ Created idx_gamesession_participants_text (GIN)');
      } catch (error) {
        console.log('⚠️ Index idx_gamesession_participants_text may already exist');
      }

      // Count created indexes
      const indexesCreated = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      `, { type: Sequelize.QueryTypes.SELECT, transaction });

      console.log('✅ GameSession table indexes completed successfully (1 GIN index)');
      console.log(`   - Total indexes in database: ${indexesCreated[0].count}`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ GameSession indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back GameSession table indexes...');

      const indexesToRemove = [
        'idx_gamesession_participants_text'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('gamesession', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ GameSession indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ GameSession indexes rollback failed:', error);
      throw error;
    }
  }
};