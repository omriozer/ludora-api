const { DataTypes } = require('sequelize');

/**
 * Migration: Standardize Remaining Entity File References
 *
 * Completes the file reference standardization by updating School, AudioFile, and Settings
 * entities to use predictable S3 paths instead of direct URL storage.
 *
 * This migration standardizes:
 * 1. School.logo_url → has_logo + logo_filename
 * 2. AudioFile.file_url → has_file + file_filename
 * 3. Settings.logo_url → has_logo + logo_filename
 *
 * This resolves remaining inconsistencies from the file reference audit and
 * completes Phase 3 of the standardization roadmap.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting remaining entity file reference standardization...');

      // Step 1: Standardize School entity
      console.log('📝 Adding standardized fields to School entity...');

      await queryInterface.addColumn('school', 'has_logo', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for logo image existence'
      }, { transaction });

      await queryInterface.addColumn('school', 'logo_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized logo filename storage (replaces logo_url)'
      }, { transaction });

      // Step 2: Standardize AudioFile entity
      console.log('📝 Adding standardized fields to AudioFile entity...');

      await queryInterface.addColumn('audiofile', 'has_file', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for audio file existence'
      }, { transaction });

      await queryInterface.addColumn('audiofile', 'file_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized audio filename storage (replaces file_url)'
      }, { transaction });

      // Step 3: Standardize Settings entity
      console.log('📝 Adding standardized fields to Settings entity...');

      await queryInterface.addColumn('settings', 'has_logo', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for system logo existence'
      }, { transaction });

      await queryInterface.addColumn('settings', 'logo_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized system logo filename storage (replaces logo_url)'
      }, { transaction });

      // Step 4: Migrate existing School logo_url data
      console.log('🔄 Migrating existing School logo data...');

      const [schoolCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM school',
        { transaction }
      );
      console.log(`📊 Processing ${schoolCount[0].count} school records...`);

      const [schoolResults] = await queryInterface.sequelize.query(
        `UPDATE school
         SET logo_filename = 'logo.jpg',
             has_logo = true
         WHERE logo_url IS NOT NULL
           AND logo_url != ''
           AND logo_url != 'null'`,
        { transaction }
      );
      console.log(`✅ Migrated ${schoolResults.affectedRows || 0} school logo records`);

      // Set has_logo = false for schools without logos
      const [schoolEmptyResults] = await queryInterface.sequelize.query(
        `UPDATE school
         SET has_logo = false,
             logo_filename = NULL
         WHERE logo_url IS NULL OR logo_url = '' OR logo_url = 'null'`,
        { transaction }
      );
      console.log(`✅ Cleaned up ${schoolEmptyResults.affectedRows || 0} empty school logo records`);

      // Step 5: Migrate existing AudioFile file_url data
      console.log('🔄 Migrating existing AudioFile data...');

      const [audioCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM audiofile',
        { transaction }
      );
      console.log(`📊 Processing ${audioCount[0].count} audio file records...`);

      const [audioResults] = await queryInterface.sequelize.query(
        `UPDATE audiofile
         SET file_filename = 'audio.mp3',
             has_file = true
         WHERE file_url IS NOT NULL
           AND file_url != ''
           AND file_url != 'null'`,
        { transaction }
      );
      console.log(`✅ Migrated ${audioResults.affectedRows || 0} audio file records`);

      // Set has_file = false for audio files without content
      const [audioEmptyResults] = await queryInterface.sequelize.query(
        `UPDATE audiofile
         SET has_file = false,
             file_filename = NULL
         WHERE file_url IS NULL OR file_url = '' OR file_url = 'null'`,
        { transaction }
      );
      console.log(`✅ Cleaned up ${audioEmptyResults.affectedRows || 0} empty audio file records`);

      // Step 6: Migrate existing Settings logo_url data
      console.log('🔄 Migrating existing Settings logo data...');

      const [settingsCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM settings',
        { transaction }
      );
      console.log(`📊 Processing ${settingsCount[0].count} settings records...`);

      const [settingsResults] = await queryInterface.sequelize.query(
        `UPDATE settings
         SET logo_filename = 'logo.png',
             has_logo = true
         WHERE logo_url IS NOT NULL
           AND logo_url != ''
           AND logo_url != 'null'`,
        { transaction }
      );
      console.log(`✅ Migrated ${settingsResults.affectedRows || 0} settings logo records`);

      // Set has_logo = false for settings without logos
      const [settingsEmptyResults] = await queryInterface.sequelize.query(
        `UPDATE settings
         SET has_logo = false,
             logo_filename = NULL
         WHERE logo_url IS NULL OR logo_url = '' OR logo_url = 'null'`,
        { transaction }
      );
      console.log(`✅ Cleaned up ${settingsEmptyResults.affectedRows || 0} empty settings logo records`);

      // Step 7: Add deprecation comments to legacy fields
      console.log('📝 Adding deprecation comments to legacy fields...');

      await queryInterface.changeColumn('school', 'logo_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.'
      }, { transaction });

      await queryInterface.changeColumn('audiofile', 'file_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'DEPRECATED: Use has_file and file_filename instead. Kept for backward compatibility.'
      }, { transaction });

      await queryInterface.changeColumn('settings', 'logo_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.'
      }, { transaction });

      // Step 8: Create performance indexes
      console.log('📝 Creating performance indexes...');

      // School indexes
      await queryInterface.addIndex('school', ['has_logo'], {
        name: 'idx_school_has_logo',
        transaction
      });

      await queryInterface.addIndex('school', ['logo_filename'], {
        name: 'idx_school_logo_filename',
        transaction
      });

      // AudioFile indexes
      await queryInterface.addIndex('audiofile', ['has_file'], {
        name: 'idx_audiofile_has_file',
        transaction
      });

      await queryInterface.addIndex('audiofile', ['file_filename'], {
        name: 'idx_audiofile_file_filename',
        transaction
      });

      // Settings indexes
      await queryInterface.addIndex('settings', ['has_logo'], {
        name: 'idx_settings_has_logo',
        transaction
      });

      await queryInterface.addIndex('settings', ['logo_filename'], {
        name: 'idx_settings_logo_filename',
        transaction
      });

      // Step 9: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [schoolVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_logo = true THEN 1 END) as with_logo,
           COUNT(CASE WHEN logo_filename IS NOT NULL THEN 1 END) as with_filename,
           COUNT(CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 1 END) as legacy_urls
         FROM school`,
        { transaction }
      );

      const [audioVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_file = true THEN 1 END) as with_file,
           COUNT(CASE WHEN file_filename IS NOT NULL THEN 1 END) as with_filename,
           COUNT(CASE WHEN file_url IS NOT NULL AND file_url != '' THEN 1 END) as legacy_urls
         FROM audiofile`,
        { transaction }
      );

      const [settingsVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_logo = true THEN 1 END) as with_logo,
           COUNT(CASE WHEN logo_filename IS NOT NULL THEN 1 END) as with_filename,
           COUNT(CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 1 END) as legacy_urls
         FROM settings`,
        { transaction }
      );

      const schoolStats = schoolVerification[0];
      const audioStats = audioVerification[0];
      const settingsStats = settingsVerification[0];

      console.log('📊 School migration verification:');
      console.log(`   Total schools: ${schoolStats.total}`);
      console.log(`   With logos: ${schoolStats.with_logo}`);
      console.log(`   With filenames: ${schoolStats.with_filename}`);
      console.log(`   Legacy URLs remaining: ${schoolStats.legacy_urls}`);

      console.log('📊 AudioFile migration verification:');
      console.log(`   Total audio files: ${audioStats.total}`);
      console.log(`   With files: ${audioStats.with_file}`);
      console.log(`   With filenames: ${audioStats.with_filename}`);
      console.log(`   Legacy URLs remaining: ${audioStats.legacy_urls}`);

      console.log('📊 Settings migration verification:');
      console.log(`   Total settings: ${settingsStats.total}`);
      console.log(`   With logos: ${settingsStats.with_logo}`);
      console.log(`   With filenames: ${settingsStats.with_filename}`);
      console.log(`   Legacy URLs remaining: ${settingsStats.legacy_urls}`);

      await transaction.commit();
      console.log('✅ Entity file reference standardization completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting entity file reference standardization...');

      // Step 1: Remove indexes first
      console.log('🗑️ Removing performance indexes...');

      const indexesToRemove = [
        { table: 'school', index: 'idx_school_has_logo' },
        { table: 'school', index: 'idx_school_logo_filename' },
        { table: 'audiofile', index: 'idx_audiofile_has_file' },
        { table: 'audiofile', index: 'idx_audiofile_file_filename' },
        { table: 'settings', index: 'idx_settings_has_logo' },
        { table: 'settings', index: 'idx_settings_logo_filename' }
      ];

      for (const { table, index } of indexesToRemove) {
        try {
          await queryInterface.removeIndex(table, index, { transaction });
        } catch (e) {
          console.log(`Index ${index} not found on ${table}, skipping...`);
        }
      }

      // Step 2: Restore original field comments
      console.log('🔄 Restoring original field comments...');

      await queryInterface.changeColumn('school', 'logo_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL to school logo image'
      }, { transaction });

      await queryInterface.changeColumn('audiofile', 'file_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL to audio file'
      }, { transaction });

      await queryInterface.changeColumn('settings', 'logo_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL to system logo image'
      }, { transaction });

      // Step 3: Remove standardized fields
      console.log('🗑️ Removing standardized fields...');

      // Remove from School
      await queryInterface.removeColumn('school', 'logo_filename', { transaction });
      await queryInterface.removeColumn('school', 'has_logo', { transaction });

      // Remove from AudioFile
      await queryInterface.removeColumn('audiofile', 'file_filename', { transaction });
      await queryInterface.removeColumn('audiofile', 'has_file', { transaction });

      // Remove from Settings
      await queryInterface.removeColumn('settings', 'logo_filename', { transaction });
      await queryInterface.removeColumn('settings', 'has_logo', { transaction });

      await transaction.commit();
      console.log('✅ Entity file reference standardization reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};