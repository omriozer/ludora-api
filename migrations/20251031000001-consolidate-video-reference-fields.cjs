const { DataTypes } = require('sequelize');

/**
 * Migration: Consolidate Video Reference Fields
 *
 * Addresses video field inconsistencies identified in the file reference audit.
 * This migration standardizes how Workshop and Course entities store video references by:
 *
 * 1. Adding standardized has_video and video_filename fields to Workshop entity
 * 2. Migrating existing video_file_url data to the new format
 * 3. Adding course video standardization fields
 * 4. Preserving legacy video_file_url for backward compatibility during transition
 *
 * This resolves audit issue #1: "Multiple fields for same concept"
 * and issue #2: "Inconsistent URL vs filename storage"
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting video reference field consolidation...');

      // Step 1: Add standardized video fields to Workshop entity
      console.log('📝 Adding standardized video fields to Workshop...');

      await queryInterface.addColumn('workshop', 'has_video', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for content video existence'
      }, { transaction });

      await queryInterface.addColumn('workshop', 'video_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized video filename storage (replaces video_file_url)'
      }, { transaction });

      // Step 2: Add standardized video fields to Course entity
      console.log('📝 Adding standardized video fields to Course...');

      await queryInterface.addColumn('course', 'has_video', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for content video existence'
      }, { transaction });

      await queryInterface.addColumn('course', 'video_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized video filename storage for course content'
      }, { transaction });

      // Step 3: Migrate existing Workshop video_file_url data
      console.log('🔄 Migrating existing Workshop video data...');

      // Count workshops for progress tracking
      const [workshopCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM workshop',
        { transaction }
      );
      console.log(`📊 Processing ${workshopCount[0].count} workshop records...`);

      // Migrate workshops with video_file_url to standardized format
      const [workshopResults] = await queryInterface.sequelize.query(
        `UPDATE workshop
         SET video_filename = 'video.mp4',
             has_video = true
         WHERE video_file_url IS NOT NULL
           AND video_file_url != ''
           AND video_file_url != 'null'`,
        { transaction }
      );
      console.log(`✅ Migrated ${workshopResults.affectedRows || 0} workshop video records`);

      // Step 4: Set has_video = false for workshops without videos
      const [workshopEmptyResults] = await queryInterface.sequelize.query(
        `UPDATE workshop
         SET has_video = false,
             video_filename = NULL
         WHERE video_file_url IS NULL OR video_file_url = '' OR video_file_url = 'null'`,
        { transaction }
      );
      console.log(`✅ Cleaned up ${workshopEmptyResults.affectedRows || 0} empty workshop video records`);

      // Step 5: Handle Course entities (they don't have direct video fields, but prepare for module videos)
      console.log('🔄 Preparing Course entities for video standardization...');

      // Courses don't have direct video URLs but use course_modules JSONB
      // For now, just set has_video = false since videos are in modules
      const [courseResults] = await queryInterface.sequelize.query(
        `UPDATE course
         SET has_video = false,
             video_filename = NULL`,
        { transaction }
      );
      console.log(`✅ Initialized ${courseResults.affectedRows || 0} course video fields`);

      // Step 6: Add database comments for legacy fields
      console.log('📝 Adding deprecation comments to legacy video fields...');

      await queryInterface.changeColumn('workshop', 'video_file_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'DEPRECATED: Use has_video and video_filename instead. Kept for backward compatibility.'
      }, { transaction });

      // Step 7: Create indexes for performance
      console.log('📝 Creating performance indexes...');

      await queryInterface.addIndex('workshop', ['has_video'], {
        name: 'idx_workshop_has_video',
        transaction
      });

      await queryInterface.addIndex('workshop', ['video_filename'], {
        name: 'idx_workshop_video_filename',
        transaction
      });

      await queryInterface.addIndex('course', ['has_video'], {
        name: 'idx_course_has_video',
        transaction
      });

      await queryInterface.addIndex('course', ['video_filename'], {
        name: 'idx_course_video_filename',
        transaction
      });

      // Step 8: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [workshopVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_video = true THEN 1 END) as with_video,
           COUNT(CASE WHEN video_filename IS NOT NULL THEN 1 END) as with_filename,
           COUNT(CASE WHEN video_file_url IS NOT NULL AND video_file_url != '' THEN 1 END) as legacy_urls
         FROM workshop`,
        { transaction }
      );

      const [courseVerification] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_video = true THEN 1 END) as with_video,
           COUNT(CASE WHEN video_filename IS NOT NULL THEN 1 END) as with_filename
         FROM course`,
        { transaction }
      );

      const workshopStats = workshopVerification[0];
      const courseStats = courseVerification[0];

      console.log('📊 Workshop migration verification:');
      console.log(`   Total workshops: ${workshopStats.total}`);
      console.log(`   With videos: ${workshopStats.with_video}`);
      console.log(`   With filenames: ${workshopStats.with_filename}`);
      console.log(`   Legacy URLs remaining: ${workshopStats.legacy_urls}`);

      console.log('📊 Course migration verification:');
      console.log(`   Total courses: ${courseStats.total}`);
      console.log(`   With videos: ${courseStats.with_video}`);
      console.log(`   With filenames: ${courseStats.with_filename}`);

      await transaction.commit();
      console.log('✅ Video reference field consolidation completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting video reference field consolidation...');

      // Step 1: Remove indexes first
      console.log('🗑️ Removing performance indexes...');

      const indexesToRemove = [
        { table: 'workshop', index: 'idx_workshop_has_video' },
        { table: 'workshop', index: 'idx_workshop_video_filename' },
        { table: 'course', index: 'idx_course_has_video' },
        { table: 'course', index: 'idx_course_video_filename' }
      ];

      for (const { table, index } of indexesToRemove) {
        try {
          await queryInterface.removeIndex(table, index, { transaction });
        } catch (e) {
          console.log(`Index ${index} not found on ${table}, skipping...`);
        }
      }

      // Step 2: Restore original video_file_url field comment
      console.log('🔄 Restoring original field comments...');

      await queryInterface.changeColumn('workshop', 'video_file_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL for workshop content video'
      }, { transaction });

      // Step 3: Remove standardized fields
      console.log('🗑️ Removing standardized video fields...');

      // Remove from Workshop
      await queryInterface.removeColumn('workshop', 'video_filename', { transaction });
      await queryInterface.removeColumn('workshop', 'has_video', { transaction });

      // Remove from Course
      await queryInterface.removeColumn('course', 'video_filename', { transaction });
      await queryInterface.removeColumn('course', 'has_video', { transaction });

      await transaction.commit();
      console.log('✅ Video reference field consolidation reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};