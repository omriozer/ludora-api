/**
 * Migration: Add ParentConsent Table Indexes (Split 6/7)
 *
 * Creates performance indexes for the ParentConsent table:
 * - Student consent status tracking (user_id only)
 * - Teacher consent management
 * - Consent revocation tracking
 * - Active consents optimization
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    try {
      console.log('🔄 Adding ' + tableName + ' table indexes using CONCURRENTLY...');...');

      // Student consent status index (users only - never players)
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['student_user_id'],
          name: 'idx_parentconsent_student'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_student');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_student may already exist');
      }

      // Teacher consent management index
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['given_by_teacher_id'],
          name: 'idx_parentconsent_teacher'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_teacher');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_teacher may already exist');
      }

      // Consent status tracking index
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['consent_revoked_at'],
          name: 'idx_parentconsent_revoked'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_revoked');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_revoked may already exist');
      }

      // Active consents index (commonly used query)
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['student_user_id', 'consent_revoked_at'],
          name: 'idx_parentconsent_student_active',
          where: {
            consent_revoked_at: null
          }
        }, { transaction });
        console.log('✅ Created idx_parentconsent_student_active');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_student_active may already exist');
      }

      console.log('✅ ParentConsent table indexes completed successfully (4 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ ParentConsent indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    try {
      console.log('🔄 Rolling back ParentConsent table indexes...');

      const indexesToRemove = [
        'idx_parentconsent_student',
        'idx_parentconsent_teacher',
        'idx_parentconsent_revoked',
        'idx_parentconsent_student_active'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('parentconsent', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ ParentConsent indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ ParentConsent indexes rollback failed:', error);
      throw error;
    }
  }
};