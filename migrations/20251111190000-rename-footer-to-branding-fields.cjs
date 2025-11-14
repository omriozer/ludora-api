'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Renaming footer fields to branding fields in settings table...');

      // Check if the old columns exist before renaming
      const tableInfo = await queryInterface.describeTable('settings');

      if (tableInfo.footer_settings) {
        // Rename footer_settings to branding_settings
        await queryInterface.renameColumn('settings', 'footer_settings', 'branding_settings', { transaction });
        console.log('✅ Renamed footer_settings → branding_settings');
      } else {
        console.log('ℹ️ footer_settings column already renamed or does not exist');
      }

      if (tableInfo.copyright_footer_text) {
        // Rename copyright_footer_text to copyright_text
        await queryInterface.renameColumn('settings', 'copyright_footer_text', 'copyright_text', { transaction });
        console.log('✅ Renamed copyright_footer_text → copyright_text');
      } else {
        console.log('ℹ️ copyright_footer_text column already renamed or does not exist');
      }

      await transaction.commit();
      console.log('🎉 Successfully completed footer → branding field renaming');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error during footer → branding field renaming:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting branding fields back to footer fields in settings table...');

      // Check if the new columns exist before reverting
      const tableInfo = await queryInterface.describeTable('settings');

      if (tableInfo.branding_settings) {
        // Revert branding_settings to footer_settings
        await queryInterface.renameColumn('settings', 'branding_settings', 'footer_settings', { transaction });
        console.log('✅ Reverted branding_settings → footer_settings');
      }

      if (tableInfo.copyright_text) {
        // Revert copyright_text to copyright_footer_text
        await queryInterface.renameColumn('settings', 'copyright_text', 'copyright_footer_text', { transaction });
        console.log('✅ Reverted copyright_text → copyright_footer_text');
      }

      await transaction.commit();
      console.log('🎉 Successfully reverted branding → footer field renaming');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error during branding → footer field reversion:', error);
      throw error;
    }
  }
};