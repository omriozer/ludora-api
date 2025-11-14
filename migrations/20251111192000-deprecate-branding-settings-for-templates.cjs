'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Deprecating branding_settings field in favor of SystemTemplate approach...');

      const tableInfo = await queryInterface.describeTable('settings');

      if (tableInfo.branding_settings) {
        // Remove the branding_settings column since we use SystemTemplate now
        await queryInterface.removeColumn('settings', 'branding_settings', { transaction });
        console.log('✅ Removed deprecated branding_settings column - now using SystemTemplate');
      } else {
        console.log('ℹ️ branding_settings column does not exist or already removed');
      }

      await transaction.commit();
      console.log('🎉 Successfully completed deprecation of branding_settings in favor of SystemTemplate');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error deprecating branding_settings field:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Restoring branding_settings field (reverting deprecation)...');

      const tableInfo = await queryInterface.describeTable('settings');

      if (!tableInfo.branding_settings) {
        // Re-add branding_settings column
        await queryInterface.addColumn('settings', 'branding_settings', {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'DEPRECATED: Complete branding configuration - use SystemTemplate instead'
        }, { transaction });

        console.log('✅ Restored branding_settings column (rollback)');
      } else {
        console.log('ℹ️ branding_settings column already exists');
      }

      await transaction.commit();
      console.log('🎉 Successfully restored branding_settings field');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error restoring branding_settings field:', error);
      throw error;
    }
  }
};