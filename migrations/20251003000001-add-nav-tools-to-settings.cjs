'use strict';

/**
 * Migration: Add navigation tools configuration to settings table
 *
 * Changes:
 * - Adds `nav_tools_text` field for custom text
 * - Adds `nav_tools_icon` field for custom icon
 * - Adds `nav_tools_visibility` field with default 'admin_only'
 * - Adds `nav_tools_enabled` field with default true
 *
 * Context:
 * Adds missing nav_tools configuration fields to support visibility-based
 * route protection for the tools section, completing the nav_*_visibility
 * system for all navigation items.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('settings');

      // Add nav_tools_text if it doesn't exist
      if (!tableDescription.nav_tools_text) {
        console.log('📝 Adding nav_tools_text column to settings table...');
        await queryInterface.addColumn('settings', 'nav_tools_text', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Custom text for tools navigation item'
        });
      }

      // Add nav_tools_icon if it doesn't exist
      if (!tableDescription.nav_tools_icon) {
        console.log('📝 Adding nav_tools_icon column to settings table...');
        await queryInterface.addColumn('settings', 'nav_tools_icon', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Custom icon for tools navigation item'
        });
      }

      // Add nav_tools_visibility if it doesn't exist
      if (!tableDescription.nav_tools_visibility) {
        console.log('📝 Adding nav_tools_visibility column to settings table...');
        await queryInterface.addColumn('settings', 'nav_tools_visibility', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'admin_only',
          comment: 'Visibility setting for tools navigation item (public, logged_in_users, admin_only, admins_and_creators, hidden)'
        });
      }

      // Add nav_tools_enabled if it doesn't exist
      if (!tableDescription.nav_tools_enabled) {
        console.log('📝 Adding nav_tools_enabled column to settings table...');
        await queryInterface.addColumn('settings', 'nav_tools_enabled', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: true,
          comment: 'Whether tools navigation item is enabled'
        });
      }

      // Set default values for existing settings rows
      console.log('📝 Setting default values for existing settings...');
      await queryInterface.sequelize.query(`
        UPDATE settings
        SET
          nav_tools_visibility = 'admin_only',
          nav_tools_enabled = true
        WHERE nav_tools_visibility IS NULL OR nav_tools_enabled IS NULL;
      `);

      console.log('✅ Navigation tools fields added successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('settings');

      console.log('📝 Removing nav_tools fields from settings table...');

      if (tableDescription.nav_tools_text) {
        await queryInterface.removeColumn('settings', 'nav_tools_text');
      }

      if (tableDescription.nav_tools_icon) {
        await queryInterface.removeColumn('settings', 'nav_tools_icon');
      }

      if (tableDescription.nav_tools_visibility) {
        await queryInterface.removeColumn('settings', 'nav_tools_visibility');
      }

      if (tableDescription.nav_tools_enabled) {
        await queryInterface.removeColumn('settings', 'nav_tools_enabled');
      }

      console.log('✅ Navigation tools fields removed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};