/**
 * Migration Script: Convert old presentation file references to new direct storage
 *
 * This script migrates lesson plans from the old system where presentation slides
 * were stored as Files table references to the new system where slides are stored
 * directly in the LessonPlan file_configs.presentation array.
 */

import models from '../models/index.js';
import { sequelize } from '../models/index.js';

/**
 * Migrate a single lesson plan from old to new presentation format
 */
async function migrateLessonPlan(lessonPlan, transaction) {
  console.log(`\n📋 Migrating lesson plan: ${lessonPlan.id}`);

  const fileConfigs = lessonPlan.file_configs || { files: [] };

  // Find presentation files (old format)
  const presentationFiles = fileConfigs.files.filter(f => f.file_role === 'presentation');

  if (presentationFiles.length === 0) {
    console.log(`   ✅ No presentation files to migrate`);
    return { migrated: false, reason: 'No presentation files found' };
  }

  console.log(`   📊 Found ${presentationFiles.length} presentation files to migrate`);

  // Get the corresponding Files from the database
  const fileIds = presentationFiles.map(f => f.file_id);
  const files = await models.File.findAll({
    where: { id: fileIds },
    transaction
  });

  console.log(`   📁 Found ${files.length} File records in database`);

  // Create new presentation slides array
  const newPresentationSlides = [];

  for (const presentationFile of presentationFiles) {
    const fileRecord = files.find(f => f.id === presentationFile.file_id);

    if (!fileRecord) {
      console.warn(`   ⚠️ File record not found for file_id: ${presentationFile.file_id}`);
      continue;
    }

    // Generate new slide ID
    const slideId = `slide_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create new slide format
    const newSlide = {
      id: slideId,
      filename: fileRecord.file_name || `slide_${presentationFile.slide_order}.svg`,
      s3_key: fileRecord.s3_key || `migrated/slide_${presentationFile.slide_order}`,
      title: fileRecord.title || `Slide ${presentationFile.slide_order}`,
      slide_order: presentationFile.slide_order,
      upload_date: fileRecord.created_at?.toISOString() || new Date().toISOString(),
      file_size: fileRecord.file_size || 0,
      // Store original file_id for reference
      migrated_from_file_id: presentationFile.file_id
    };

    newPresentationSlides.push(newSlide);
    console.log(`   ✅ Converted slide ${presentationFile.slide_order}: ${fileRecord.file_name}`);
  }

  // Sort slides by slide_order
  newPresentationSlides.sort((a, b) => a.slide_order - b.slide_order);

  // Remove old presentation files from files array
  const nonPresentationFiles = fileConfigs.files.filter(f => f.file_role !== 'presentation');

  // Create new file_configs structure
  const newFileConfigs = {
    files: nonPresentationFiles,
    presentation: newPresentationSlides
  };

  // Update lesson plan
  lessonPlan.file_configs = newFileConfigs;
  lessonPlan.changed('file_configs', true);

  await lessonPlan.save({ transaction });

  console.log(`   🎉 Migration completed: ${newPresentationSlides.length} slides converted to new format`);

  return {
    migrated: true,
    slidesConverted: newPresentationSlides.length,
    slideIds: newPresentationSlides.map(s => s.id)
  };
}

/**
 * Main migration function
 */
async function migratePresentationSlides() {
  console.log('🚀 Starting Presentation Slides Migration');
  console.log('=' .repeat(60));

  const transaction = await sequelize.transaction();

  try {
    // Find all lesson plans with presentation files
    const lessonPlans = await models.LessonPlan.findAll({
      where: {
        file_configs: {
          files: {
            [sequelize.Sequelize.Op.contains]: [{ file_role: 'presentation' }]
          }
        }
      },
      transaction
    });

    console.log(`📊 Found ${lessonPlans.length} lesson plans with presentation files`);

    if (lessonPlans.length === 0) {
      console.log('✅ No lesson plans need migration');
      await transaction.commit();
      return { total: 0, migrated: 0, errors: 0 };
    }

    let migrated = 0;
    let errors = 0;
    const results = [];

    for (const lessonPlan of lessonPlans) {
      try {
        const result = await migrateLessonPlan(lessonPlan, transaction);
        results.push({ id: lessonPlan.id, ...result });

        if (result.migrated) {
          migrated++;
        }
      } catch (error) {
        console.error(`   ❌ Error migrating lesson plan ${lessonPlan.id}:`, error.message);
        errors++;
        results.push({ id: lessonPlan.id, migrated: false, error: error.message });
      }
    }

    if (errors === 0) {
      await transaction.commit();
      console.log('\n🎉 Migration completed successfully!');
    } else {
      await transaction.rollback();
      console.error(`\n❌ Migration failed with ${errors} errors. Rolling back.`);
      throw new Error(`Migration failed with ${errors} errors`);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total lesson plans: ${lessonPlans.length}`);
    console.log(`   Successfully migrated: ${migrated}`);
    console.log(`   Errors: ${errors}`);

    return { total: lessonPlans.length, migrated, errors, results };

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Dry run - preview what would be migrated without making changes
 */
async function dryRunMigration() {
  console.log('🔍 Dry Run: Preview Presentation Slides Migration');
  console.log('=' .repeat(60));

  try {
    // Find all lesson plans with presentation files
    const lessonPlans = await models.LessonPlan.findAll({
      where: {
        file_configs: {
          files: {
            [sequelize.Sequelize.Op.contains]: [{ file_role: 'presentation' }]
          }
        }
      }
    });

    console.log(`📊 Found ${lessonPlans.length} lesson plans with presentation files`);

    for (const lessonPlan of lessonPlans) {
      console.log(`\n📋 Lesson Plan: ${lessonPlan.id}`);

      const fileConfigs = lessonPlan.file_configs || { files: [] };
      const presentationFiles = fileConfigs.files.filter(f => f.file_role === 'presentation');

      console.log(`   📊 Presentation files: ${presentationFiles.length}`);

      for (const pFile of presentationFiles.slice(0, 3)) { // Show first 3
        console.log(`   - Slide ${pFile.slide_order}: File ID ${pFile.file_id}`);
      }

      if (presentationFiles.length > 3) {
        console.log(`   ... and ${presentationFiles.length - 3} more slides`);
      }
    }

    return { total: lessonPlans.length };

  } catch (error) {
    console.error('❌ Dry run failed:', error.message);
    throw error;
  }
}

// Export functions for use
export { migratePresentationSlides, dryRunMigration };

// CLI execution
if (process.argv[2] === 'run') {
  migratePresentationSlides()
    .then(result => {
      console.log('✅ Migration script completed successfully:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
} else if (process.argv[2] === 'dry-run') {
  dryRunMigration()
    .then(result => {
      console.log('✅ Dry run completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Dry run failed:', error);
      process.exit(1);
    });
} else {
  console.log(`
Usage:
  node migrations/migrate-presentation-slides.js dry-run    # Preview changes
  node migrations/migrate-presentation-slides.js run       # Execute migration
`);
}