'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Starting migration: Consolidate branding_overrides data into branding_settings for consistency');

    // Check if both columns exist
    const tableDescription = await queryInterface.describeTable('file');
    const hasBrandingOverrides = !!tableDescription.branding_overrides;
    const hasBrandingSettings = !!tableDescription.branding_settings;

    console.log('Current state:', { hasBrandingOverrides, hasBrandingSettings });

    if (hasBrandingOverrides && hasBrandingSettings) {
      // Copy data from branding_overrides to branding_settings where branding_settings is null
      console.log('Copying data from branding_overrides to branding_settings...');
      await queryInterface.sequelize.query(`
        UPDATE file
        SET branding_settings = branding_overrides
        WHERE branding_settings IS NULL
        AND branding_overrides IS NOT NULL
      `);
      console.log('✓ Copied non-null branding_overrides data to branding_settings');

      // Drop the old column
      await queryInterface.removeColumn('file', 'branding_overrides');
      console.log('✓ Removed branding_overrides column');

      // Drop the old index if it exists
      try {
        await queryInterface.removeIndex('file', 'idx_file_branding_overrides');
        console.log('✓ Removed old index idx_file_branding_overrides');
      } catch (error) {
        console.log('(Index idx_file_branding_overrides did not exist)');
      }
    } else if (hasBrandingOverrides && !hasBrandingSettings) {
      // Rename column as originally planned
      await queryInterface.renameColumn('file', 'branding_overrides', 'branding_settings');
      console.log('✓ Renamed branding_overrides column to branding_settings');

      // Drop the old index
      try {
        await queryInterface.removeIndex('file', 'idx_file_branding_overrides');
        console.log('✓ Removed old index idx_file_branding_overrides');
      } catch (error) {
        console.log('(Index idx_file_branding_overrides did not exist)');
      }
    }

    // Create new index with updated name (if it doesn't exist)
    try {
      await queryInterface.addIndex('file', ['branding_settings'], {
        name: 'idx_file_branding_settings'
      });
      console.log('✓ Created new index idx_file_branding_settings');
    } catch (error) {
      console.log('(Index idx_file_branding_settings already exists)');
    }

    // Update column comment for clarity
    await queryInterface.changeColumn('file', 'branding_settings', {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File-specific branding settings (positioning, styling). Content comes from SystemTemplate.'
    });
    console.log('✓ Updated column comment for branding_settings');

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Starting rollback: Recreate branding_overrides column from branding_settings');

    // Check if branding_settings column exists
    const tableDescription = await queryInterface.describeTable('file');
    const hasBrandingSettings = !!tableDescription.branding_settings;

    if (!hasBrandingSettings) {
      console.log('branding_settings column does not exist, nothing to rollback');
      return;
    }

    // Create branding_overrides column
    await queryInterface.addColumn('file', 'branding_overrides', {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File-specific branding overrides (positioning, styling). Content comes from SystemTemplate.'
    });
    console.log('✓ Created branding_overrides column');

    // Copy data from branding_settings to branding_overrides
    await queryInterface.sequelize.query(`
      UPDATE file
      SET branding_overrides = branding_settings
      WHERE branding_settings IS NOT NULL
    `);
    console.log('✓ Copied data from branding_settings to branding_overrides');

    // Drop the new index
    try {
      await queryInterface.removeIndex('file', 'idx_file_branding_settings');
      console.log('✓ Removed index idx_file_branding_settings');
    } catch (error) {
      console.log('(Index idx_file_branding_settings did not exist)');
    }

    // Drop branding_settings column
    await queryInterface.removeColumn('file', 'branding_settings');
    console.log('✓ Removed branding_settings column');

    // Recreate original index
    await queryInterface.addIndex('file', ['branding_overrides'], {
      name: 'idx_file_branding_overrides'
    });
    console.log('✓ Recreated original index idx_file_branding_overrides');

    console.log('Rollback completed successfully');
  }
};