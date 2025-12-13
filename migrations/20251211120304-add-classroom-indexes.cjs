/**
 * Migration: Add Classroom Table Indexes (Split 4/7)
 *
 * Creates performance indexes for the Classroom table:
 * - Teacher active classroom management
 * - Invitation code lookup optimization
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

      // Teacher active classrooms index
      try {
        await queryInterface.addIndex('classroom', {
          fields: ['teacher_id', 'is_active'],
          name: 'idx_classroom_teacher_active'
        }, { transaction });
        console.log('✅ Created idx_classroom_teacher_active');
      } catch (error) {
        console.log('⚠️ Index idx_classroom_teacher_active may already exist');
      }

      // Classroom invitation code index (for student signup)
      try {
        await queryInterface.addIndex('classroom', {
          fields: ['teacher_invitation_code'],
          name: 'idx_classroom_invitation_code'
        }, { transaction });
        console.log('✅ Created idx_classroom_invitation_code');
      } catch (error) {
        console.log('⚠️ Index idx_classroom_invitation_code may already exist');
      }

      console.log('✅ Classroom table indexes completed successfully (2 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Classroom indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    try {
      console.log('🔄 Rolling back Classroom table indexes...');

      const indexesToRemove = [
        'idx_classroom_teacher_active',
        'idx_classroom_invitation_code'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('classroom', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ Classroom indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Classroom indexes rollback failed:', error);
      throw error;
    }
  }
};