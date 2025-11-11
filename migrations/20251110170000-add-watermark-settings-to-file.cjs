'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('📄 Adding watermark_settings column to file table...');

      // Check if column already exists
      const tableInfo = await queryInterface.describeTable('file');
      if (tableInfo.watermark_settings) {
        console.log('⚠️ watermark_settings column already exists, skipping...');
        return;
      }

      // Add watermark_settings column to file table
      await queryInterface.addColumn('file', 'watermark_settings', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Custom watermark settings in JSONB format'
      });

      console.log('✅ Added watermark_settings column to file table');

      // Add index for watermark_settings column for better query performance
      await queryInterface.addIndex('file', ['watermark_settings'], {
        name: 'idx_file_watermark_settings',
        using: 'gin' // GIN index for JSONB columns
      });

      console.log('✅ Added GIN index for watermark_settings column');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('📄 Removing watermark_settings column from file table...');

      // Remove index first
      await queryInterface.removeIndex('file', 'idx_file_watermark_settings');
      console.log('✅ Removed watermark_settings index');

      // Remove column
      await queryInterface.removeColumn('file', 'watermark_settings');
      console.log('✅ Removed watermark_settings column from file table');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};