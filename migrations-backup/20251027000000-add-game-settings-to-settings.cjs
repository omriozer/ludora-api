'use strict';

/**
 * Migration: Add game access settings to settings table
 *
 * Changes:
 * - Adds `default_game_access_days` DECIMAL field (default: 365)
 * - Adds `game_lifetime_access` BOOLEAN field (default: true)
 *
 * Context:
 * Adds game-specific access settings to match the pattern of other product types
 * (files, courses, workshops) for consistent admin configuration.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if columns exist before adding
      const tableDescription = await queryInterface.describeTable('settings');

      if (!tableDescription.default_game_access_days) {
        console.log('📝 Adding default_game_access_days column to settings table...');

        await queryInterface.addColumn('settings', 'default_game_access_days', {
          type: Sequelize.DECIMAL,
          allowNull: true,
          defaultValue: 365,
          comment: 'Default access days for game products'
        });

        console.log('✅ default_game_access_days column added successfully');
      } else {
        console.log('ℹ️  Column default_game_access_days already exists, skipping');
      }

      if (!tableDescription.game_lifetime_access) {
        console.log('📝 Adding game_lifetime_access column to settings table...');

        await queryInterface.addColumn('settings', 'game_lifetime_access', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: true,
          comment: 'Whether game products have lifetime access by default'
        });

        console.log('✅ game_lifetime_access column added successfully');
      } else {
        console.log('ℹ️  Column game_lifetime_access already exists, skipping');
      }

      // Set defaults for existing settings rows
      console.log('📝 Setting default values for existing settings...');

      await queryInterface.sequelize.query(`
        UPDATE settings
        SET
          default_game_access_days = 365,
          game_lifetime_access = true
        WHERE
          default_game_access_days IS NULL
          OR game_lifetime_access IS NULL;
      `);

      console.log('✅ Game settings migration completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('settings');

      if (tableDescription.default_game_access_days) {
        console.log('📝 Removing default_game_access_days from settings table...');
        await queryInterface.removeColumn('settings', 'default_game_access_days');
        console.log('✅ default_game_access_days column removed successfully');
      } else {
        console.log('ℹ️  Column default_game_access_days does not exist, skipping');
      }

      if (tableDescription.game_lifetime_access) {
        console.log('📝 Removing game_lifetime_access from settings table...');
        await queryInterface.removeColumn('settings', 'game_lifetime_access');
        console.log('✅ game_lifetime_access column removed successfully');
      } else {
        console.log('ℹ️  Column game_lifetime_access does not exist, skipping');
      }

      console.log('✅ Game settings rollback completed successfully');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};