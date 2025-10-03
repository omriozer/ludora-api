'use strict';

/**
 * Migration: Add footer_settings to file table
 *
 * Changes:
 * - Adds `footer_settings` JSONB field to file table
 * - Stores logo position, text position, URL position, and style settings
 *
 * Context:
 * Footer settings are stored per-file and merged dynamically when the file
 * is downloaded. This allows each file to have custom footer positioning
 * and styling while using the global copyright text from settings.
 *
 * Example structure:
 * {
 *   "logo": {
 *     "visible": true,
 *     "position": { "x": 50, "y": 95 },
 *     "style": { "size": 80, "opacity": 100 }
 *   },
 *   "text": {
 *     "visible": true,
 *     "position": { "x": 50, "y": 90 },
 *     "style": { "fontSize": 12, "color": "#000000", "bold": false, "italic": false, "opacity": 80 }
 *   },
 *   "url": {
 *     "visible": true,
 *     "href": "https://ludora.app",
 *     "position": { "x": 50, "y": 85 },
 *     "style": { "fontSize": 12, "color": "#0066cc", "bold": false, "italic": false, "opacity": 100 }
 *   }
 * }
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column exists before adding
      const tableDescription = await queryInterface.describeTable('file');

      if (!tableDescription.footer_settings) {
        console.log('📝 Adding footer_settings to file table...');

        await queryInterface.addColumn('file', 'footer_settings', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null,
          comment: 'JSON object containing footer configuration (positions, styles, visibility)'
        });

        console.log('✅ Column added successfully');
      } else {
        console.log('ℹ️  Column footer_settings already exists, skipping migration');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('file');

      if (tableDescription.footer_settings) {
        console.log('📝 Removing footer_settings from file table...');

        await queryInterface.removeColumn('file', 'footer_settings');

        console.log('✅ Column removed successfully');
      } else {
        console.log('ℹ️  Column footer_settings does not exist, skipping rollback');
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
