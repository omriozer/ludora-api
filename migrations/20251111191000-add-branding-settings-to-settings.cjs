'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding branding_settings field to settings table...');

      // Check if the column already exists
      const tableInfo = await queryInterface.describeTable('settings');

      if (!tableInfo.branding_settings) {
        // Add branding_settings column
        await queryInterface.addColumn('settings', 'branding_settings', {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Complete branding configuration including logo, text, URL, and custom elements'
        }, { transaction });

        console.log('✅ Added branding_settings column to settings table');
      } else {
        console.log('ℹ️ branding_settings column already exists');
      }

      await transaction.commit();
      console.log('🎉 Successfully completed adding branding_settings field');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error adding branding_settings field:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Removing branding_settings field from settings table...');

      // Check if the column exists before removing
      const tableInfo = await queryInterface.describeTable('settings');

      if (tableInfo.branding_settings) {
        await queryInterface.removeColumn('settings', 'branding_settings', { transaction });
        console.log('✅ Removed branding_settings column from settings table');
      } else {
        console.log('ℹ️ branding_settings column does not exist');
      }

      await transaction.commit();
      console.log('🎉 Successfully removed branding_settings field');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error removing branding_settings field:', error);
      throw error;
    }
  }
};