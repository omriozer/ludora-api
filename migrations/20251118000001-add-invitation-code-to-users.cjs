'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 Adding invitation_code field to user table...');

      // Add invitation_code column to user table
      console.log('🔧 Adding invitation_code field...');
      await queryInterface.addColumn('user', 'invitation_code', {
        type: Sequelize.STRING(8),
        allowNull: true,
        unique: true,
        comment: 'Unique invitation code for teachers to share their catalog with students'
      }, { transaction });

      // Add unique index on invitation_code
      console.log('🔧 Adding unique index on invitation_code...');
      await queryInterface.addIndex('user', ['invitation_code'], {
        name: 'idx_user_invitation_code',
        unique: true,
        transaction
      });

      await transaction.commit();
      console.log('✅ Invitation code field added successfully');
      console.log('📊 Teachers can now have unique invitation codes to share their catalogs');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back invitation_code changes...');

      // Remove unique index on invitation_code
      console.log('🔧 Removing invitation_code index...');
      await queryInterface.removeIndex('user', 'idx_user_invitation_code', { transaction });

      // Remove invitation_code column from user table
      console.log('🔧 Removing invitation_code field...');
      await queryInterface.removeColumn('user', 'invitation_code', { transaction });

      await transaction.commit();
      console.log('✅ Invitation code field rolled back successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};