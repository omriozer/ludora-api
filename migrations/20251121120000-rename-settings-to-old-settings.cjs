'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if settings table exists and old_settings doesn't
    try {
      await queryInterface.describeTable('settings');
    } catch (error) {
      console.log('⏭️  Settings table does not exist, skipping rename');
      return;
    }

    try {
      await queryInterface.describeTable('old_settings');
      console.log('⏭️  Old settings table already exists, skipping rename');
      return;
    } catch (error) {
      // old_settings doesn't exist, proceed with rename
    }

    console.log('🔄 Renaming settings table to old_settings...');
    await queryInterface.renameTable('settings', 'old_settings');

    // Update index names to match old_settings
    console.log('🔄 Updating index names for old_settings...');

    try {
      await queryInterface.removeIndex('old_settings', 'idx_settings_has_logo');
      await queryInterface.addIndex('old_settings', ['has_logo'], {
        name: 'idx_old_settings_has_logo'
      });
    } catch (error) {
      console.log('Note: has_logo index update skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('old_settings', 'idx_settings_logo_filename');
      await queryInterface.addIndex('old_settings', ['logo_filename'], {
        name: 'idx_old_settings_logo_filename'
      });
    } catch (error) {
      console.log('Note: logo_filename index update skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('old_settings', 'idx_settings_maintenance_mode');
      await queryInterface.addIndex('old_settings', ['maintenance_mode'], {
        name: 'idx_old_settings_maintenance_mode'
      });
    } catch (error) {
      console.log('Note: maintenance_mode index update skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('old_settings', 'idx_settings_created_at');
      await queryInterface.addIndex('old_settings', ['created_at'], {
        name: 'idx_old_settings_created_at'
      });
    } catch (error) {
      console.log('Note: created_at index update skipped:', error.message);
    }

    console.log('✅ Settings table successfully renamed to old_settings with updated indexes');
  },

  async down(queryInterface, Sequelize) {
    // Check if old_settings table exists
    try {
      await queryInterface.describeTable('old_settings');
    } catch (error) {
      console.log('⏭️  Old settings table does not exist, skipping restore');
      return;
    }

    console.log('🔄 Restoring old_settings table back to settings...');
    await queryInterface.renameTable('old_settings', 'settings');

    // Restore original index names
    console.log('🔄 Restoring original index names...');

    try {
      await queryInterface.removeIndex('settings', 'idx_old_settings_has_logo');
      await queryInterface.addIndex('settings', ['has_logo'], {
        name: 'idx_settings_has_logo'
      });
    } catch (error) {
      console.log('Note: has_logo index restore skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('settings', 'idx_old_settings_logo_filename');
      await queryInterface.addIndex('settings', ['logo_filename'], {
        name: 'idx_settings_logo_filename'
      });
    } catch (error) {
      console.log('Note: logo_filename index restore skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('settings', 'idx_old_settings_maintenance_mode');
      await queryInterface.addIndex('settings', ['maintenance_mode'], {
        name: 'idx_settings_maintenance_mode'
      });
    } catch (error) {
      console.log('Note: maintenance_mode index restore skipped:', error.message);
    }

    try {
      await queryInterface.removeIndex('settings', 'idx_old_settings_created_at');
      await queryInterface.addIndex('settings', ['created_at'], {
        name: 'idx_settings_created_at'
      });
    } catch (error) {
      console.log('Note: created_at index restore skipped:', error.message);
    }

    console.log('✅ Old settings table successfully restored to settings');
  }
};