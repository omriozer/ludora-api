/**
 * Migration: Add User Table Indexes (Split 5/7)
 *
 * Creates performance indexes for the User table:
 * - User type filtering (student/teacher)
 * - Verification status tracking
 * - Active status management
 * - Invitation code lookup
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding User table indexes...');

      // User type index (for student/teacher filtering)
      try {
        await queryInterface.addIndex('user', {
          fields: ['user_type'],
          name: 'idx_user_type'
        }, { transaction });
        console.log('✅ Created idx_user_type');
      } catch (error) {
        console.log('⚠️ Index idx_user_type may already exist');
      }

      // User verification status index
      try {
        await queryInterface.addIndex('user', {
          fields: ['is_verified'],
          name: 'idx_user_verified'
        }, { transaction });
        console.log('✅ Created idx_user_verified');
      } catch (error) {
        console.log('⚠️ Index idx_user_verified may already exist');
      }

      // User active status index
      try {
        await queryInterface.addIndex('user', {
          fields: ['is_active'],
          name: 'idx_user_active'
        }, { transaction });
        console.log('✅ Created idx_user_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_active may already exist');
      }

      // Teacher invitation code index
      try {
        await queryInterface.addIndex('user', {
          fields: ['invitation_code'],
          name: 'idx_user_invitation_code'
        }, { transaction });
        console.log('✅ Created idx_user_invitation_code');
      } catch (error) {
        console.log('⚠️ Index idx_user_invitation_code may already exist');
      }

      console.log('✅ User table indexes completed successfully (4 indexes)');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ User indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back User table indexes...');

      const indexesToRemove = [
        'idx_user_type',
        'idx_user_verified',
        'idx_user_active',
        'idx_user_invitation_code'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('user', indexName, { transaction });
          console.log(`✅ Removed index ${indexName}`);
          removedCount++;
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ User indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ User indexes rollback failed:', error);
      throw error;
    }
  }
};