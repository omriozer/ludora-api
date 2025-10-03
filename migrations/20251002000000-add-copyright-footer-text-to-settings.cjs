'use strict';

/**
 * Migration: Add copyright_footer_text to settings table
 *
 * Changes:
 * - Adds `copyright_footer_text` TEXT field to settings
 * - Sets default value to standard Hebrew copyright text
 *
 * Context:
 * Stores the copyright text that will be dynamically merged into PDF files
 * when downloaded. This allows admins to update the text globally.
 */

const DEFAULT_COPYRIGHT_TEXT = 'כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column exists before adding
      const tableDescription = await queryInterface.describeTable('settings');

      if (!tableDescription.copyright_footer_text) {
        console.log('📝 Adding copyright_footer_text to settings table...');

        await queryInterface.addColumn('settings', 'copyright_footer_text', {
          type: Sequelize.TEXT,
          allowNull: true,
          defaultValue: DEFAULT_COPYRIGHT_TEXT,
          comment: 'Copyright text to be dynamically merged into PDF files'
        });

        // Set the default value for existing settings row
        await queryInterface.sequelize.query(`
          UPDATE settings
          SET copyright_footer_text = :defaultText
          WHERE copyright_footer_text IS NULL;
        `, {
          replacements: { defaultText: DEFAULT_COPYRIGHT_TEXT }
        });

        console.log('✅ Column added successfully');
      } else {
        console.log('ℹ️  Column copyright_footer_text already exists, skipping migration');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('settings');

      if (tableDescription.copyright_footer_text) {
        console.log('📝 Removing copyright_footer_text from settings table...');

        await queryInterface.removeColumn('settings', 'copyright_footer_text');

        console.log('✅ Column removed successfully');
      } else {
        console.log('ℹ️  Column copyright_footer_text does not exist, skipping rollback');
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
