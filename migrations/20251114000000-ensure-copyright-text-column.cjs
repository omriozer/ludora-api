'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Ensuring copyright_text column exists in settings table...');

      // Check if the column already exists
      const tableInfo = await queryInterface.describeTable('settings');

      if (!tableInfo.copyright_text) {
        // Add copyright_text column if it doesn't exist
        await queryInterface.addColumn('settings', 'copyright_text', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Copyright text for branding footer'
        }, { transaction });

        console.log('✅ Added copyright_text column to settings table');
      } else {
        console.log('ℹ️ copyright_text column already exists');
      }

      await transaction.commit();
      console.log('🎉 Successfully ensured copyright_text column exists');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error ensuring copyright_text column:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Removing copyright_text column from settings table...');

      // Check if the column exists before removing
      const tableInfo = await queryInterface.describeTable('settings');

      if (tableInfo.copyright_text) {
        await queryInterface.removeColumn('settings', 'copyright_text', { transaction });
        console.log('✅ Removed copyright_text column from settings table');
      } else {
        console.log('ℹ️ copyright_text column does not exist');
      }

      await transaction.commit();
      console.log('🎉 Successfully removed copyright_text column');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error removing copyright_text column:', error);
      throw error;
    }
  }
};