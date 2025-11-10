'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Updating template columns in file and lesson_plan tables...');

    try {
      // Update file table (singular, not files)
      console.log('📄 Updating file table...');

      // Rename footer_template_id to branding_template_id
      await queryInterface.renameColumn('file', 'footer_template_id', 'branding_template_id');
      console.log('✅ Renamed footer_template_id to branding_template_id');

      // Rename footer_settings to branding_settings
      await queryInterface.renameColumn('file', 'footer_settings', 'branding_settings');
      console.log('✅ Renamed footer_settings to branding_settings');

      // Rename add_copyrights_footer to add_branding
      await queryInterface.renameColumn('file', 'add_copyrights_footer', 'add_branding');
      console.log('✅ Renamed add_copyrights_footer to add_branding');

      // lesson_plan table only has watermark_template_id, no footer columns to update
      console.log('📚 lesson_plan table already uses watermark_template_id - no changes needed');

      console.log('🎉 Template columns updated successfully!');

    } catch (error) {
      console.error('❌ Error updating template columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Reverting template column changes...');

    try {
      // Revert file table changes (singular, not files)
      await queryInterface.renameColumn('file', 'branding_template_id', 'footer_template_id');
      await queryInterface.renameColumn('file', 'branding_settings', 'footer_settings');
      await queryInterface.renameColumn('file', 'add_branding', 'add_copyrights_footer');

      console.log('✅ Template column changes reverted');

    } catch (error) {
      console.error('❌ Error reverting template column changes:', error);
      throw error;
    }
  }
};