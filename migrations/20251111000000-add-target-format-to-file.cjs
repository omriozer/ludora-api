'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('📄 Adding target_format column to file table...');

      // Check if column already exists
      const tableInfo = await queryInterface.describeTable('file');
      if (tableInfo.target_format) {
        console.log('⚠️ target_format column already exists, skipping...');
        return;
      }

      // Add target_format column to file table
      await queryInterface.addColumn('file', 'target_format', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'File format orientation matching system_templates.target_format for template filtering'
      });

      console.log('✅ Added target_format column to file table');

      // Add check constraint for valid values
      await queryInterface.sequelize.query(`
        ALTER TABLE file
        ADD CONSTRAINT chk_file_target_format
        CHECK (target_format IN ('pdf-a4-portrait', 'pdf-a4-landscape', 'svg-lessonplan', 'unknown'))
      `);

      console.log('✅ Added check constraint for target_format values');

      // Add index for target_format column for better query performance
      await queryInterface.addIndex('file', ['target_format'], {
        name: 'idx_file_target_format'
      });

      console.log('✅ Added index for target_format column');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('📄 Removing target_format column from file table...');

      // Remove index first
      await queryInterface.removeIndex('file', 'idx_file_target_format');
      console.log('✅ Removed target_format index');

      // Remove check constraint
      await queryInterface.sequelize.query(`
        ALTER TABLE file
        DROP CONSTRAINT IF EXISTS chk_file_target_format
      `);
      console.log('✅ Removed target_format check constraint');

      // Remove column
      await queryInterface.removeColumn('file', 'target_format');
      console.log('✅ Removed target_format column from file table');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};