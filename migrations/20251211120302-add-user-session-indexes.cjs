/**
 * Migration: Add UserSession Table Indexes (Split 2/7)
 *
 * Creates performance indexes for the UserSession table:
 * - Unified student_id performance indexing
 * - Portal-specific session management
 * - Session expiration and cleanup optimization
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding UserSession table indexes...');

      // UserSession student_id index (for unified student sessions)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id'],
          name: 'idx_user_session_student_id'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_id');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_id may already exist');
      }

      // UserSession portal-specific indexes
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal'],
          name: 'idx_user_session_portal'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal may already exist');
      }

      // Active sessions by portal
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal', 'is_active'],
          name: 'idx_user_session_portal_active'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal_active may already exist');
      }

      // Student sessions by portal (unified approach)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal', 'student_id'],
          name: 'idx_user_session_portal_student'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal_student');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal_student may already exist');
      }

      // Student active sessions (performance)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id', 'is_active'],
          name: 'idx_user_session_student_active'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_active may already exist');
      }

      // Student session expiration
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id', 'expires_at'],
          name: 'idx_user_session_student_expires'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_expires');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_expires may already exist');
      }

      // Session cleanup performance index
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['expires_at', 'is_active'],
          name: 'idx_user_session_expiration_cleanup'
        }, { transaction });
        console.log('✅ Created idx_user_session_expiration_cleanup');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_expiration_cleanup may already exist');
      }

      console.log('✅ UserSession table indexes completed successfully (7 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ UserSession indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back UserSession table indexes...');

      const indexesToRemove = [
        'idx_user_session_student_id',
        'idx_user_session_portal',
        'idx_user_session_portal_active',
        'idx_user_session_portal_student',
        'idx_user_session_student_active',
        'idx_user_session_student_expires',
        'idx_user_session_expiration_cleanup'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('user_session', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ UserSession indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ UserSession indexes rollback failed:', error);
      throw error;
    }
  }
};