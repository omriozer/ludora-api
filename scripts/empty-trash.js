#!/usr/bin/env node

/**
 * Empty Trash Script
 * Permanently delete files from trash based on age criteria
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

// Set up path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add project root to module path for imports
process.chdir(join(__dirname, '..'));

// Import utilities
import { initS3Client, getBucketName, deleteFromTrash, listTrashFiles, formatBytes } from './utils/trashManager.js';
import { filterFilesByAge, isValidAgeString, formatRelativeTime } from './utils/ageCalculator.js';
import { ProgressTracker } from './utils/progressTracker.js';
import {
  askYesNo,
  askMultipleChoice,
  displayEnvironmentWarning,
  displayStartupBanner,
  displayFileTable,
  displayOperationSummary,
  displayOperationResults,
  displayFinalSummary,
  showProgressDots
} from './utils/interactivePrompts.js';

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    environment: null,
    olderThan: '30d',
    forceAll: false,
    batchSize: 100,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--env=')) {
      config.environment = arg.split('=')[1];
    } else if (arg.startsWith('--older-than=')) {
      config.olderThan = arg.split('=')[1];
    } else if (arg === '--force-all') {
      config.forceAll = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      displayHelp();
      process.exit(0);
    }
  }

  // Validate required arguments
  if (!config.environment) {
    console.error('❌ Error: --env parameter is required');
    console.error('Usage: node empty-trash.js --env=development|staging|production|all [options]');
    process.exit(1);
  }

  if (!['development', 'staging', 'production', 'all'].includes(config.environment)) {
    console.error('❌ Error: Invalid environment. Use development, staging, production, or all');
    process.exit(1);
  }

  if (!config.forceAll && !isValidAgeString(config.olderThan)) {
    console.error(`❌ Error: Invalid age format: ${config.olderThan}. Use format like "30d", "6m", "1y"`);
    process.exit(1);
  }

  if (isNaN(config.batchSize) || config.batchSize < 1 || config.batchSize > 1000) {
    console.error('❌ Error: Batch size must be between 1 and 1000');
    process.exit(1);
  }

  return config;
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
🗑️  Ludora Trash Cleanup Script

USAGE:
  node empty-trash.js --env=<environment> [options]

REQUIRED:
  --env=<env>           Environment: development, staging, production, or all

OPTIONS:
  --older-than=<age>    Delete files older than age (default: 30d)
  --force-all          Delete ALL files in trash regardless of age
  --batch-size=<size>   Files per batch (default: 100, max: 1000)
  --dry-run            Show what would be deleted without deleting
  --help, -h           Show this help

EXAMPLES:
  # Delete dev trash older than 30 days (default)
  node empty-trash.js --env=development

  # Delete prod trash older than 60 days
  node empty-trash.js --env=production --older-than=60d

  # Delete ALL trash from all environments older than 7 days
  node empty-trash.js --env=all --older-than=7d

  # Emergency: delete everything in dev trash regardless of age
  node empty-trash.js --env=development --force-all

  # See what would be deleted without actually deleting
  node empty-trash.js --env=production --dry-run

AGE FORMATS:
  7d = 7 days, 30d = 30 days, 6m = 6 months, 1y = 1 year

SAFETY:
  - Production requires additional confirmation
  - --dry-run mode shows what would be deleted
  - Interactive confirmation for each batch
  - Files are permanently deleted (cannot be recovered)
`);
}

/**
 * Get list of environments to process
 */
function getEnvironmentsToProcess(environment) {
  if (environment === 'all') {
    return ['development', 'staging', 'production'];
  }
  return [environment];
}

/**
 * Collect trash files for an environment
 */
async function collectTrashFiles(s3Client, bucketName, environment) {
  console.log(`📡 Scanning trash for ${environment}...`);

  const allFiles = [];
  let continuationToken = null;

  do {
    const result = await listTrashFiles(s3Client, bucketName, environment, continuationToken);

    if (!result.success) {
      throw new Error(`Failed to list trash files: ${result.error}`);
    }

    allFiles.push(...result.files);
    continuationToken = result.nextContinuationToken;

    if (result.files.length > 0) {
      process.stdout.write('.');
    }
  } while (continuationToken);

  console.log(`\n✅ Found ${allFiles.length.toLocaleString()} files in ${environment} trash`);

  return allFiles;
}

/**
 * Process a batch of files for deletion
 */
async function processBatch(s3Client, bucketName, filesToDelete, config) {
  const { dryRun } = config;

  const batchResults = {
    filesProcessed: filesToDelete.length,
    successful: [],
    failed: [],
    totalSize: 0
  };

  if (filesToDelete.length === 0) {
    return batchResults;
  }

  if (dryRun) {
    // Dry run mode - just record what would be deleted
    for (const file of filesToDelete) {
      batchResults.successful.push({
        success: true,
        trashKey: file.key,
        originalPath: file.originalPath,
        message: `[DRY-RUN] Would delete ${file.key}`,
        size: file.size
      });
      batchResults.totalSize += file.size;
    }
    return batchResults;
  }

  // Actual deletion
  const stopProgress = showProgressDots(`Permanently deleting ${filesToDelete.length} files`);

  for (const file of filesToDelete) {
    try {
      const result = await deleteFromTrash(s3Client, bucketName, file.key);

      if (result.success) {
        batchResults.successful.push({
          ...result,
          size: file.size
        });
        batchResults.totalSize += file.size;
      } else {
        batchResults.failed.push(result);
      }
    } catch (error) {
      batchResults.failed.push({
        success: false,
        trashKey: file.key,
        error: error.message,
        message: `Failed to delete ${file.key}: ${error.message}`
      });
    }
  }

  stopProgress();

  return batchResults;
}

/**
 * Process trash cleanup for a single environment
 */
async function processEnvironment(environment, config) {
  const { olderThan, forceAll, batchSize, dryRun } = config;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🗑️  Processing ${environment.toUpperCase()} Environment`);
  console.log(`${'='.repeat(60)}`);

  // Initialize S3 client for this environment
  const s3Client = initS3Client(environment);
  const bucketName = getBucketName(environment);

  // Collect trash files
  const allTrashFiles = await collectTrashFiles(s3Client, bucketName, environment);

  if (allTrashFiles.length === 0) {
    console.log(`✅ No trash files found in ${environment}`);
    return {
      environment,
      totalFiles: 0,
      deletedFiles: 0,
      totalSize: 0,
      deletedSize: 0
    };
  }

  // Filter files by age criteria
  let filesToDelete;
  if (forceAll) {
    filesToDelete = allTrashFiles;
    console.log(`⚠️  FORCE-ALL mode: Will delete ALL ${filesToDelete.length} files regardless of age`);
  } else {
    filesToDelete = filterFilesByAge(allTrashFiles, olderThan);
    console.log(`📅 Found ${filesToDelete.length} files older than ${olderThan}`);

    if (filesToDelete.length === 0) {
      console.log(`✅ No files meet age criteria in ${environment}`);
      return {
        environment,
        totalFiles: allTrashFiles.length,
        deletedFiles: 0,
        totalSize: allTrashFiles.reduce((sum, f) => sum + f.size, 0),
        deletedSize: 0
      };
    }
  }

  // Calculate totals
  const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, 0);

  // Display summary
  console.log(`\n📋 ${dryRun ? 'Files that would be deleted' : 'Files to be permanently deleted'}:`);
  console.log(`   Count: ${filesToDelete.length.toLocaleString()} files`);
  console.log(`   Size: ${formatBytes(totalSize)}`);

  if (filesToDelete.length > 0) {
    // Show sample files
    displayFileTable(
      filesToDelete.slice(0, 10).map(file => ({
        'Trash Location': file.key.replace('trash/', ''),
        'Size': file.sizeFormatted,
        'Moved to Trash': formatRelativeTime(file.lastModified)
      })),
      `Sample files (showing first 10 of ${filesToDelete.length})`,
      10
    );

    if (filesToDelete.length > 10) {
      console.log(`... and ${filesToDelete.length - 10} more files\n`);
    }
  }

  // Confirmation
  const action = dryRun ? 'show in dry-run' : 'PERMANENTLY DELETE';
  const confirmed = await askYesNo(
    `⚠️  ${action} these ${filesToDelete.length} files?`,
    false
  );

  if (!confirmed) {
    console.log('⏭️  Skipping this environment...');
    return {
      environment,
      totalFiles: allTrashFiles.length,
      deletedFiles: 0,
      totalSize: allTrashFiles.reduce((sum, f) => sum + f.size, 0),
      deletedSize: 0
    };
  }

  // Process files in batches
  let totalDeleted = 0;
  let totalDeletedSize = 0;

  for (let i = 0; i < filesToDelete.length; i += batchSize) {
    const batch = filesToDelete.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(filesToDelete.length / batchSize);

    console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);

    const batchResults = await processBatch(s3Client, bucketName, batch, config);

    totalDeleted += batchResults.successful.length;
    totalDeletedSize += batchResults.totalSize;

    // Display batch results
    if (!dryRun || batchResults.successful.length > 0) {
      displayOperationResults({
        successful: batchResults.successful,
        failed: batchResults.failed,
        totalProcessed: batch.length,
        totalSize: formatBytes(batchResults.totalSize)
      }, dryRun ? 'dry-run simulation' : 'permanent deletion');
    }

    // Ask for continuation if there are more batches
    if (batchNumber < totalBatches) {
      const choices = [
        { key: 'Y', description: 'Yes, continue to next batch' },
        { key: 'n', description: 'No, stop here' },
        { key: 'q', description: 'Quit cleanup' }
      ];

      const action = await askMultipleChoice(
        `Continue to batch ${batchNumber + 1}/${totalBatches}?`,
        choices,
        'Y'
      );

      if (action === 'n' || action === 'q') {
        break;
      }
    }
  }

  return {
    environment,
    totalFiles: allTrashFiles.length,
    deletedFiles: totalDeleted,
    totalSize: allTrashFiles.reduce((sum, f) => sum + f.size, 0),
    deletedSize: totalDeletedSize
  };
}

/**
 * Main trash cleanup function
 */
async function runTrashCleanup() {
  const config = parseArguments();
  const { environment, olderThan, forceAll, dryRun } = config;

  // Display startup banner
  displayStartupBanner({
    environment,
    operation: 'trash cleanup',
    batchSize: config.batchSize,
    mode: dryRun ? 'DRY-RUN (simulation only)' : forceAll ? 'FORCE-ALL (delete everything)' : `Delete files older than ${olderThan}`
  });

  // Environment warning for production
  if (environment === 'production' || environment === 'all') {
    const confirmed = await displayEnvironmentWarning(
      environment,
      dryRun ? 'run trash cleanup simulation on' : 'permanently delete trash files from'
    );
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      process.exit(0);
    }
  }

  const environments = getEnvironmentsToProcess(environment);
  const results = [];

  try {
    for (const env of environments) {
      const envResult = await processEnvironment(env, config);
      results.push(envResult);
    }

    // Display final summary
    console.log(`\n${'🎉'.repeat(20)}`);
    console.log(dryRun ? 'DRY-RUN COMPLETE' : 'TRASH CLEANUP COMPLETE');
    console.log(`${'🎉'.repeat(20)}`);

    let totalFiles = 0;
    let totalDeleted = 0;
    let totalSize = 0;
    let totalDeletedSize = 0;

    for (const result of results) {
      console.log(`\n${result.environment.toUpperCase()}:`);
      console.log(`  Total trash files: ${result.totalFiles.toLocaleString()}`);
      console.log(`  ${dryRun ? 'Would delete' : 'Deleted'}: ${result.deletedFiles.toLocaleString()} files`);
      console.log(`  ${dryRun ? 'Would free' : 'Freed'}: ${formatBytes(result.deletedSize)}`);

      totalFiles += result.totalFiles;
      totalDeleted += result.deletedFiles;
      totalSize += result.totalSize;
      totalDeletedSize += result.deletedSize;
    }

    console.log(`\nTOTALS:`);
    console.log(`  Files in trash: ${totalFiles.toLocaleString()}`);
    console.log(`  ${dryRun ? 'Would delete' : 'Deleted'}: ${totalDeleted.toLocaleString()} files`);
    console.log(`  ${dryRun ? 'Would free' : 'Space freed'}: ${formatBytes(totalDeletedSize)}`);
    console.log(`${'🎉'.repeat(20)}`);

  } catch (error) {
    console.error(`❌ Trash cleanup failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown() {
  const cleanup = () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  setupGracefulShutdown();
  runTrashCleanup().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}