#!/usr/bin/env node

/**
 * Orphaned File Cleanup Script
 * Main script to detect and move orphaned S3 files to trash
 * Production deployment ready
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
import { collectAllFileReferences } from './utils/databaseReferenceCollector.js';
import { listS3Files, detectOrphans, formatFilesForDisplay, generateBatchPlan } from './utils/s3FileAnalyzer.js';
import { initS3Client, getBucketName, moveToTrash, formatBytes } from './utils/trashManager.js';
import { ProgressTracker } from './utils/progressTracker.js';
import { FileCheckCache } from './utils/fileCheckCache.js';
import {
  askYesNo,
  askBatchContinuation,
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
    batchSize: 100,
    force: false,
    resume: false,
    checkThreshold: '24h'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--env=')) {
      config.environment = arg.split('=')[1];
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--force') {
      config.force = true;
    } else if (arg === '--resume') {
      config.resume = true;
    } else if (arg.startsWith('--check-threshold=')) {
      config.checkThreshold = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      displayHelp();
      process.exit(0);
    }
  }

  // Validate required arguments
  if (!config.environment) {
    console.error('❌ Error: --env parameter is required');
    console.error('Usage: node cleanup-orphaned-files.js --env=development|staging|production [options]');
    process.exit(1);
  }

  if (!['development', 'staging', 'production'].includes(config.environment)) {
    console.error('❌ Error: Invalid environment. Use development, staging, or production');
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
🧹 Ludora Orphaned File Cleanup Script

USAGE:
  node cleanup-orphaned-files.js --env=<environment> [options]

REQUIRED:
  --env=<env>           Environment: development, staging, or production

OPTIONS:
  --batch-size=<size>   Files per batch (default: 100, max: 1000)
  --force              Skip interactive prompts (for automation)
  --resume             Continue from last checkpoint
  --check-threshold=<age> Skip files checked within threshold (default: 24h)
  --help, -h           Show this help

EXAMPLES:
  # Interactive cleanup in development
  node cleanup-orphaned-files.js --env=development

  # Custom batch size
  node cleanup-orphaned-files.js --env=production --batch-size=200

  # Resume interrupted session
  node cleanup-orphaned-files.js --env=development --resume

  # Automated cleanup (no prompts)
  node cleanup-orphaned-files.js --env=staging --force

AGE FORMATS:
  24h = 24 hours, 7d = 7 days, 30d = 30 days

SAFETY:
  - Files are moved to trash, not deleted
  - Production requires additional confirmation
  - All operations can be resumed if interrupted
  - Comprehensive logging and progress tracking
`);
}

/**
 * Process a batch of files
 */
async function processBatch(s3Client, bucketName, environment, files, progressTracker, config) {
  const { force } = config;

  const batchResults = {
    filesProcessed: files.length,
    orphansFound: 0,
    orphansProcessed: 0,
    bytesFreed: 0,
    successful: [],
    failed: []
  };

  if (files.length === 0) {
    return batchResults;
  }

  // Display files to be processed
  if (!force) {
    displayFileTable(files, `Files to be moved to trash`, 10);

    const moveConfirmed = await askYesNo(
      `🗑️  Move these ${files.length} orphaned files to trash?`,
      false
    );

    if (!moveConfirmed) {
      console.log('⏭️  Skipping this batch...');
      return batchResults;
    }
  }

  // Process files
  const stopProgress = showProgressDots(`Processing ${files.length} files`);

  for (const file of files) {
    try {
      const result = await moveToTrash(s3Client, bucketName, file.key);

      if (result.success) {
        batchResults.successful.push(result);
        batchResults.bytesFreed += file.size;
        batchResults.orphansProcessed++;
      } else {
        batchResults.failed.push(result);
      }
    } catch (error) {
      batchResults.failed.push({
        success: false,
        originalKey: file.key,
        error: error.message,
        message: `Failed to move ${file.key}: ${error.message}`
      });
    }
  }

  stopProgress();

  // Display results
  if (!force) {
    displayOperationResults({
      successful: batchResults.successful,
      failed: batchResults.failed,
      totalProcessed: files.length,
      totalSize: formatBytes(batchResults.bytesFreed)
    }, 'move to trash');
  }

  return batchResults;
}

/**
 * Main cleanup function
 */
async function runCleanup() {
  const config = parseArguments();
  const { environment, batchSize, force, resume, checkThreshold } = config;

  // Display startup banner
  displayStartupBanner({
    environment,
    operation: 'cleanup',
    batchSize,
    mode: 'Interactive (move to trash)'
  });

  // Environment warning for production
  if (!force) {
    const confirmed = await displayEnvironmentWarning(environment, 'move orphaned files to trash');
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      process.exit(0);
    }
  }

  // Initialize components
  console.log('🔧 Initializing cleanup components...');
  const s3Client = initS3Client(environment);
  const bucketName = getBucketName(environment);
  const progressTracker = new ProgressTracker(environment, 'cleanup');
  const fileCheckCache = new FileCheckCache(checkThreshold);

  // Check for resumption
  if (resume) {
    const resumptionInfo = progressTracker.getResumptionInfo();
    if (resumptionInfo.canResume) {
      console.log(`📂 Resuming from batch ${resumptionInfo.processedBatches + 1}...`);
      console.log(`   Last run: ${resumptionInfo.lastRun}`);
    } else {
      console.log('ℹ️  No previous session found to resume from');
    }
  }

  try {
    // Step 1: Collect database references
    console.log('\n📋 Step 1: Collecting database file references...');
    const stopDbProgress = showProgressDots('Scanning database');
    const databaseReferences = await collectAllFileReferences(environment);
    stopDbProgress();

    if (databaseReferences.length === 0) {
      console.log('⚠️  Warning: No database references found. This might indicate a problem.');
      if (!force) {
        const proceed = await askYesNo('Continue anyway?', false);
        if (!proceed) {
          console.log('❌ Operation cancelled');
          process.exit(0);
        }
      }
    }

    console.log(`✅ Found ${databaseReferences.length.toLocaleString()} database file references`);

    // Step 2: Scan S3 files and process in batches
    console.log('\n📡 Step 2: Scanning S3 files and detecting orphans...');

    let continuationToken = resume ? progressTracker.state.lastContinuationToken : null;
    let batchNumber = resume ? progressTracker.state.processedBatches : 0;
    let totalOrphansFound = resume ? progressTracker.state.orphansFound : 0;
    let totalOrphansProcessed = resume ? progressTracker.state.orphansProcessed : 0;
    let totalBytesFreed = resume ? progressTracker.state.bytesFreed : 0;

    let shouldContinue = true;
    while (shouldContinue) {
      // List S3 files
      const s3Result = await listS3Files(s3Client, bucketName, environment, continuationToken, 1000);

      if (!s3Result.success) {
        console.error(`❌ Error listing S3 files: ${s3Result.error}`);
        break;
      }

      if (s3Result.files.length === 0) {
        console.log('✅ No more files to process');
        break;
      }

      // Filter out recently checked files
      const { needsCheck, skipCheck } = fileCheckCache.filterRecentlyChecked(s3Result.files, environment);

      if (skipCheck.length > 0) {
        console.log(`⏭️  Skipping ${skipCheck.length} recently checked files`);
      }

      if (needsCheck.length === 0) {
        console.log('⏭️  All files in this batch were recently checked');
        continuationToken = s3Result.nextContinuationToken;
        continue;
      }

      // Detect orphans
      const detection = detectOrphans(needsCheck, databaseReferences);
      const orphans = detection.orphans;

      // Mark all files as checked
      fileCheckCache.markBatchChecked(
        needsCheck.map(f => f.key),
        environment,
        needsCheck.map(f => ({ isOrphan: orphans.some(o => o.key === f.key), size: f.size, lastModified: f.lastModified }))
      );

      // Update totals
      totalOrphansFound += orphans.length;

      // Process orphans in user-defined batches
      if (orphans.length > 0) {
        const batchPlan = generateBatchPlan(orphans.length, batchSize);
        progressTracker.setTotals(batchPlan.totalBatches, orphans.length);

        for (const batch of batchPlan.batches) {
          batchNumber++;
          const batchFiles = orphans.slice(batch.startIndex, batch.endIndex + 1);

          progressTracker.displayProgress();

          // Process this batch
          const batchResults = await processBatch(
            s3Client, bucketName, environment, batchFiles, progressTracker, config
          );

          // Update progress
          batchResults.continuationToken = s3Result.nextContinuationToken;
          progressTracker.updateBatchProgress(batchNumber, batchResults);

          totalOrphansProcessed += batchResults.orphansProcessed;
          totalBytesFreed += batchResults.bytesFreed;

          // Ask for continuation (unless force mode)
          if (!force && batch.batchNumber < batchPlan.totalBatches) {
            const action = await askBatchContinuation(
              batch.batchNumber,
              batchPlan.totalBatches,
              batchResults
            );

            if (action === 'n' || action === 'q') {
              shouldContinue = false;
              break;
            } else if (action === 's') {
              // Show details - already displayed in displayOperationResults
              console.log('📋 Batch details shown above');
            }
          }
        }
      } else {
        console.log(`✅ No orphans found in this batch (${needsCheck.length} files checked)`);
      }

      // Check if we should continue to next S3 batch
      if (!s3Result.isTruncated || !shouldContinue) {
        break;
      }

      continuationToken = s3Result.nextContinuationToken;

      // Ask about continuing to next S3 batch (unless force mode)
      if (!force) {
        const continueS3 = await askYesNo('Continue scanning more S3 files?', true);
        if (!continueS3) {
          shouldContinue = false;
        }
      }
    }

    // Save cache and display final summary
    fileCheckCache.cleanup();

    const sessionSummary = {
      environment,
      totalFiles: progressTracker.state.processedFiles,
      orphansFound: totalOrphansFound,
      orphansProcessed: totalOrphansProcessed,
      timeElapsed: progressTracker.calculateETA(100, Date.now() - new Date(progressTracker.startTime).getTime()),
      spaceSaved: formatBytes(totalBytesFreed)
    };

    progressTracker.displaySummary();

    if (!force) {
      await displayFinalSummary(sessionSummary);
    }

  } catch (error) {
    console.error(`❌ Cleanup failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    fileCheckCache.cleanup();
  }
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown() {
  const cleanup = () => {
    console.log('\n🛑 Shutting down gracefully...');
    console.log('💾 Progress has been saved. Use --resume to continue later.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  setupGracefulShutdown();
  runCleanup().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}