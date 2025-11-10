'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Renaming footer_overrides to branding_overrides...');

    try {
      // Rename footer_overrides to branding_overrides
      await queryInterface.renameColumn('file', 'footer_overrides', 'branding_overrides');
      console.log('✅ Renamed footer_overrides to branding_overrides');

      console.log('🎉 Footer overrides column updated successfully!');

    } catch (error) {
      console.error('❌ Error renaming footer_overrides column:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Reverting branding_overrides to footer_overrides...');

    try {
      // Revert branding_overrides back to footer_overrides
      await queryInterface.renameColumn('file', 'branding_overrides', 'footer_overrides');
      console.log('✅ Reverted branding_overrides to footer_overrides');

    } catch (error) {
      console.error('❌ Error reverting branding_overrides column:', error);
      throw error;
    }
  }
};