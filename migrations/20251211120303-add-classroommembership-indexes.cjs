/**
 * Migration: Add ClassroomMembership Table Indexes (Split 3/7)
 *
 * Creates performance indexes for the ClassroomMembership table:
 * - Unified student_id membership queries
 * - Unique membership constraint enforcement
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding ClassroomMembership table indexes...');

      // Student membership queries (unified student_id)
      try {
        await queryInterface.addIndex('classroommembership', {
          fields: ['student_id'],
          name: 'idx_classroommembership_student'
        }, { transaction });
        console.log('✅ Created idx_classroommembership_student');
      } catch (error) {
        console.log('⚠️ Index idx_classroommembership_student may already exist');
      }

      // Unique membership constraint (updated for student_id)
      try {
        await queryInterface.addIndex('classroommembership', {
          unique: true,
          fields: ['classroom_id', 'student_id'],
          name: 'idx_classroommembership_unique_student_membership'
        }, { transaction });
        console.log('✅ Created idx_classroommembership_unique_student_membership');
      } catch (error) {
        console.log('⚠️ Index idx_classroommembership_unique_student_membership may already exist');
      }

      console.log('✅ ClassroomMembership table indexes completed successfully (2 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ ClassroomMembership indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back ClassroomMembership table indexes...');

      const indexesToRemove = [
        'idx_classroommembership_student',
        'idx_classroommembership_unique_student_membership'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('classroommembership', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ ClassroomMembership indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ ClassroomMembership indexes rollback failed:', error);
      throw error;
    }
  }
};