'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if configuration table exists and settings doesn't
    try {
      await queryInterface.describeTable('configuration');
    } catch (error) {
      console.log('⏭️  Configuration table does not exist, skipping rename');
      return;
    }

    try {
      await queryInterface.describeTable('settings');
      console.log('⏭️  Settings table already exists, skipping rename');
      return;
    } catch (error) {
      // settings doesn't exist, proceed with rename
    }

    console.log('🔄 Renaming configuration table to settings...');
    await queryInterface.renameTable('configuration', 'settings');

    // Update index names to match settings
    console.log('🔄 Updating index names for settings...');

    try {
      await queryInterface.removeIndex('settings', 'idx_configuration_key');
      await queryInterface.addIndex('settings', ['key'], {
        unique: true,
        name: 'idx_settings_key'
      });
    } catch (error) {
      console.log('Note: key index update skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('settings', 'idx_configuration_value_type');
      await queryInterface.addIndex('settings', ['value_type'], {
        name: 'idx_settings_value_type'
      });
    } catch (error) {
      console.log('Note: value_type index update skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('settings', 'idx_configuration_created_at');
      await queryInterface.addIndex('settings', ['created_at'], {
        name: 'idx_settings_created_at'
      });
    } catch (error) {
      console.log('Note: created_at index update skipped:', error.message);
    }

    console.log('✅ Configuration table successfully renamed to settings with updated indexes');
  },

  async down(queryInterface, Sequelize) {
    // Check if settings table exists
    try {
      await queryInterface.describeTable('settings');
    } catch (error) {
      console.log('⏭️  Settings table does not exist, skipping restore');
      return;
    }

    console.log('🔄 Restoring settings table back to configuration...');
    await queryInterface.renameTable('settings', 'configuration');

    // Restore original index names
    console.log('🔄 Restoring original index names...');

    try {
      await queryInterface.removeIndex('configuration', 'idx_settings_key');
      await queryInterface.addIndex('configuration', ['key'], {
        unique: true,
        name: 'idx_configuration_key'
      });
    } catch (error) {
      console.log('Note: key index restore skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('configuration', 'idx_settings_value_type');
      await queryInterface.addIndex('configuration', ['value_type'], {
        name: 'idx_configuration_value_type'
      });
    } catch (error) {
      console.log('Note: value_type index restore skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('configuration', 'idx_settings_created_at');
      await queryInterface.addIndex('configuration', ['created_at'], {
        name: 'idx_configuration_created_at'
      });
    } catch (error) {
      console.log('Note: created_at index restore skipped:', error.message);
    }

    console.log('✅ Settings table successfully restored to configuration');
  }
};