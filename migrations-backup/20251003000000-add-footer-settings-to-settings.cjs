'use strict';

/**
 * Migration: Add comprehensive footer_settings to settings table
 *
 * Changes:
 * - Adds `footer_settings` JSONB field to settings
 * - Migrates existing copyright_footer_text to new structure
 * - Sets up default footer configuration matching frontend tool
 *
 * Context:
 * Replaces simple copyright text with full footer configuration including
 * logo, text, URL, and custom elements (box, line, dotted-line) with
 * positioning, styling, and visibility settings.
 */

const DEFAULT_FOOTER_SETTINGS = {
  logo: {
    visible: true,
    url: 'https://ludora.app/logo.png', // This will be dynamically set from logoUrl
    position: { x: 50, y: 95 },
    style: {
      size: 80,
      opacity: 100
    }
  },
  text: {
    visible: true,
    content: 'כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.',
    position: { x: 50, y: 90 },
    style: {
      fontSize: 12,
      color: '#000000',
      bold: false,
      italic: false,
      opacity: 80,
      width: 300
    }
  },
  url: {
    visible: true,
    href: 'https://ludora.app',
    position: { x: 50, y: 85 },
    style: {
      fontSize: 12,
      color: '#0066cc',
      bold: false,
      italic: false,
      opacity: 100
    }
  },
  customElements: {}
};

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column exists before adding
      const tableDescription = await queryInterface.describeTable('settings');

      if (!tableDescription.footer_settings) {
        console.log('📝 Adding footer_settings JSONB column to settings table...');

        await queryInterface.addColumn('settings', 'footer_settings', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: DEFAULT_FOOTER_SETTINGS,
          comment: 'Complete footer configuration including logo, text, URL, and custom elements'
        });

        // Migrate existing copyright_footer_text to new structure
        console.log('📝 Migrating existing copyright text to new footer settings...');

        const [results] = await queryInterface.sequelize.query(`
          SELECT id, copyright_footer_text FROM settings WHERE copyright_footer_text IS NOT NULL;
        `);

        for (const row of results) {
          const footerSettings = {
            ...DEFAULT_FOOTER_SETTINGS,
            text: {
              ...DEFAULT_FOOTER_SETTINGS.text,
              content: row.copyright_footer_text || DEFAULT_FOOTER_SETTINGS.text.content
            }
          };

          await queryInterface.sequelize.query(`
            UPDATE settings
            SET footer_settings = :footerSettings
            WHERE id = :id;
          `, {
            replacements: {
              footerSettings: JSON.stringify(footerSettings),
              id: row.id
            }
          });
        }

        // Set default for any settings rows without footer_settings
        await queryInterface.sequelize.query(`
          UPDATE settings
          SET footer_settings = :defaultSettings
          WHERE footer_settings IS NULL;
        `, {
          replacements: { defaultSettings: JSON.stringify(DEFAULT_FOOTER_SETTINGS) }
        });

        console.log('✅ Footer settings column added and data migrated successfully');
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
      const tableDescription = await queryInterface.describeTable('settings');

      if (tableDescription.footer_settings) {
        console.log('📝 Removing footer_settings from settings table...');

        await queryInterface.removeColumn('settings', 'footer_settings');

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