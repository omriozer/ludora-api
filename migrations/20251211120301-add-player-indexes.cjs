/**
 * Migration: Add Player Table Indexes (Split 1/7)
 *
 * Creates performance indexes for the Player table:
 * - Teacher management and activity tracking
 * - Online status and last seen tracking
 * - Display name search functionality
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding Player table indexes...');

      // Player teacher management index (for teachers viewing their players)
      try {
        await queryInterface.addIndex('player', {
          fields: ['teacher_id', 'is_active'],
          name: 'idx_player_teacher_active'
        }, { transaction });
        console.log('✅ Created idx_player_teacher_active');
      } catch (error) {
        console.log('⚠️ Index idx_player_teacher_active may already exist');
      }

      // Player online status index (for real-time features)
      try {
        await queryInterface.addIndex('player', {
          fields: ['is_online'],
          name: 'idx_player_online'
        }, { transaction });
        console.log('✅ Created idx_player_online');
      } catch (error) {
        console.log('⚠️ Index idx_player_online may already exist');
      }

      // Player last seen index (for activity tracking)
      try {
        await queryInterface.addIndex('player', {
          fields: ['last_seen'],
          name: 'idx_player_last_seen'
        }, { transaction });
        console.log('✅ Created idx_player_last_seen');
      } catch (error) {
        console.log('⚠️ Index idx_player_last_seen may already exist');
      }

      // Teacher + online status compound index (for teacher dashboard)
      try {
        await queryInterface.addIndex('player', {
          fields: ['teacher_id', 'is_online'],
          name: 'idx_player_teacher_online'
        }, { transaction });
        console.log('✅ Created idx_player_teacher_online');
      } catch (error) {
        console.log('⚠️ Index idx_player_teacher_online may already exist');
      }

      // Player display name index (for search functionality)
      try {
        await queryInterface.addIndex('player', {
          fields: ['display_name'],
          name: 'idx_player_display_name'
        }, { transaction });
        console.log('✅ Created idx_player_display_name');
      } catch (error) {
        console.log('⚠️ Index idx_player_display_name may already exist');
      }

      console.log('✅ Player table indexes completed successfully (5 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Player indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back Player table indexes...');

      const indexesToRemove = [
        'idx_player_teacher_active',
        'idx_player_online',
        'idx_player_last_seen',
        'idx_player_teacher_online',
        'idx_player_display_name'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('player', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ Player indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Player indexes rollback failed:', error);
      throw error;
    }
  }
};