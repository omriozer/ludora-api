const { DataTypes } = require('sequelize');

/**
 * Migration: Unify Footer Settings Storage
 *
 * Resolves footer settings duplication between File and Settings entities by:
 * 1. Creating single source of truth in Settings table for complete footer configuration
 * 2. Converting File table to store only overrides instead of full footer settings
 * 3. Simplifying merge logic by eliminating redundant storage
 *
 * This addresses the footer settings duplication issue identified in the file reference audit
 * and completes Phase 3 of the standardization roadmap.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting footer settings unification...');

      // Step 1: Add footer_overrides field to File table
      console.log('📝 Adding footer_overrides field to File table...');

      await queryInterface.addColumn('file', 'footer_overrides', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'File-specific footer overrides (positioning, styling). Content comes from Settings.'
      }, { transaction });

      // Step 2: Analyze existing File footer_settings to extract overrides
      console.log('🔄 Analyzing existing File footer settings...');

      const [fileCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM file WHERE footer_settings IS NOT NULL',
        { transaction }
      );
      console.log(`📊 Processing ${fileCount[0].count} files with footer settings...`);

      // Step 3: Get system-wide default footer settings from Settings
      const [systemSettings] = await queryInterface.sequelize.query(
        'SELECT footer_settings FROM settings LIMIT 1',
        { transaction }
      );

      const defaultFooterSettings = systemSettings[0]?.footer_settings || {
        logo: {
          visible: true,
          position: { x: 50, y: 95 },
          style: { size: 80, opacity: 100 }
        },
        text: {
          visible: true,
          position: { x: 50, y: 90 },
          style: {
            fontSize: 12,
            color: "#000000",
            bold: false,
            italic: false,
            opacity: 80,
            width: 300
          }
        },
        url: {
          visible: true,
          position: { x: 50, y: 85 },
          style: {
            fontSize: 12,
            color: "#0066cc",
            bold: false,
            italic: false,
            opacity: 100
          }
        }
      };

      console.log('📋 Default footer settings loaded for comparison');

      // Step 4: Convert File footer_settings to footer_overrides
      // Get all files with footer_settings
      const [filesWithFooterSettings] = await queryInterface.sequelize.query(
        'SELECT id, footer_settings FROM file WHERE footer_settings IS NOT NULL',
        { transaction }
      );

      let migratedCount = 0;

      for (const file of filesWithFooterSettings) {
        const fileFooterSettings = file.footer_settings;
        const overrides = {};

        // Extract only the differences from default settings
        if (fileFooterSettings.logo) {
          const logoOverrides = {};
          if (fileFooterSettings.logo.visible !== defaultFooterSettings.logo.visible) {
            logoOverrides.visible = fileFooterSettings.logo.visible;
          }
          if (JSON.stringify(fileFooterSettings.logo.position) !== JSON.stringify(defaultFooterSettings.logo.position)) {
            logoOverrides.position = fileFooterSettings.logo.position;
          }
          if (JSON.stringify(fileFooterSettings.logo.style) !== JSON.stringify(defaultFooterSettings.logo.style)) {
            logoOverrides.style = fileFooterSettings.logo.style;
          }
          if (Object.keys(logoOverrides).length > 0) {
            overrides.logo = logoOverrides;
          }
        }

        if (fileFooterSettings.text) {
          const textOverrides = {};
          if (fileFooterSettings.text.visible !== defaultFooterSettings.text.visible) {
            textOverrides.visible = fileFooterSettings.text.visible;
          }
          if (JSON.stringify(fileFooterSettings.text.position) !== JSON.stringify(defaultFooterSettings.text.position)) {
            textOverrides.position = fileFooterSettings.text.position;
          }
          if (JSON.stringify(fileFooterSettings.text.style) !== JSON.stringify(defaultFooterSettings.text.style)) {
            textOverrides.style = fileFooterSettings.text.style;
          }
          // Note: content is not stored in overrides - it comes from Settings
          if (Object.keys(textOverrides).length > 0) {
            overrides.text = textOverrides;
          }
        }

        if (fileFooterSettings.url) {
          const urlOverrides = {};
          if (fileFooterSettings.url.visible !== defaultFooterSettings.url.visible) {
            urlOverrides.visible = fileFooterSettings.url.visible;
          }
          if (JSON.stringify(fileFooterSettings.url.position) !== JSON.stringify(defaultFooterSettings.url.position)) {
            urlOverrides.position = fileFooterSettings.url.position;
          }
          if (JSON.stringify(fileFooterSettings.url.style) !== JSON.stringify(defaultFooterSettings.url.style)) {
            urlOverrides.style = fileFooterSettings.url.style;
          }
          // Note: href is not stored in overrides - it comes from Settings
          if (Object.keys(urlOverrides).length > 0) {
            overrides.url = urlOverrides;
          }
        }

        // Store overrides only if there are actual differences
        const overridesJson = Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null;

        await queryInterface.sequelize.query(
          'UPDATE file SET footer_overrides = :overrides WHERE id = :id',
          {
            replacements: {
              overrides: overridesJson,
              id: file.id
            },
            transaction
          }
        );

        migratedCount++;
      }

      console.log(`✅ Migrated ${migratedCount} file footer settings to override format`);

      // Step 5: Ensure Settings table has complete default footer configuration
      console.log('📝 Ensuring Settings table has complete footer defaults...');

      // Update settings to have complete footer configuration if it doesn't exist
      const [settingsUpdateResult] = await queryInterface.sequelize.query(
        `UPDATE settings
         SET footer_settings = :defaultSettings
         WHERE footer_settings IS NULL OR footer_settings = '{}'`,
        {
          replacements: {
            defaultSettings: JSON.stringify(defaultFooterSettings)
          },
          transaction
        }
      );

      console.log(`✅ Updated ${settingsUpdateResult.affectedRows || 0} settings records with default footer configuration`);

      // Step 6: Add deprecation comment to File footer_settings field
      console.log('📝 Adding deprecation comment to File footer_settings...');

      await queryInterface.changeColumn('file', 'footer_settings', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'DEPRECATED: Use footer_overrides instead. Complete footer config now in Settings. Kept for backward compatibility.'
      }, { transaction });

      // Step 7: Update Settings footer_settings comment for clarity
      await queryInterface.changeColumn('settings', 'footer_settings', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Complete footer configuration (logo, text, url). File-specific overrides stored in file.footer_overrides.'
      }, { transaction });

      // Step 8: Create performance indexes
      console.log('📝 Creating performance indexes...');

      await queryInterface.addIndex('file', ['footer_overrides'], {
        name: 'idx_file_footer_overrides',
        transaction
      });

      // Step 9: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [verificationResults] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total_files,
           COUNT(CASE WHEN footer_overrides IS NOT NULL THEN 1 END) as files_with_overrides,
           COUNT(CASE WHEN footer_settings IS NOT NULL THEN 1 END) as files_with_legacy_settings,
           COUNT(CASE WHEN add_copyrights_footer = true THEN 1 END) as files_with_footer_enabled
         FROM file`,
        { transaction }
      );

      const [settingsVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total_settings,
           COUNT(CASE WHEN footer_settings IS NOT NULL THEN 1 END) as settings_with_footer,
           COUNT(CASE WHEN copyright_footer_text IS NOT NULL THEN 1 END) as settings_with_text
         FROM settings`,
        { transaction }
      );

      const fileStats = verificationResults[0];
      const settingsStats = settingsVerification[0];

      console.log('📊 File migration verification:');
      console.log(`   Total files: ${fileStats.total_files}`);
      console.log(`   Files with footer overrides: ${fileStats.files_with_overrides}`);
      console.log(`   Files with legacy footer settings: ${fileStats.files_with_legacy_settings}`);
      console.log(`   Files with footer enabled: ${fileStats.files_with_footer_enabled}`);

      console.log('📊 Settings verification:');
      console.log(`   Total settings: ${settingsStats.total_settings}`);
      console.log(`   Settings with footer config: ${settingsStats.settings_with_footer}`);
      console.log(`   Settings with copyright text: ${settingsStats.settings_with_text}`);

      await transaction.commit();
      console.log('✅ Footer settings unification completed successfully!');
      console.log('🎉 Phase 3 of file reference standardization is now 100% complete!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting footer settings unification...');

      // Step 1: Remove index
      console.log('🗑️ Removing footer overrides index...');

      try {
        await queryInterface.removeIndex('file', 'idx_file_footer_overrides', { transaction });
      } catch (e) {
        console.log('Index idx_file_footer_overrides not found, skipping...');
      }

      // Step 2: Restore original field comments
      console.log('🔄 Restoring original field comments...');

      await queryInterface.changeColumn('file', 'footer_settings', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Footer configuration (positions, styles, visibility). Text content comes from settings.'
      }, { transaction });

      await queryInterface.changeColumn('settings', 'footer_settings', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Complete footer configuration including logo URL and text content'
      }, { transaction });

      // Step 3: Remove footer_overrides field
      console.log('🗑️ Removing footer_overrides field...');

      await queryInterface.removeColumn('file', 'footer_overrides', { transaction });

      await transaction.commit();
      console.log('✅ Footer settings unification reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};