/**
 * Progress Tracker Utility
 * Handles progress display, state persistence, and session management
 */

import fs from 'fs';
import path from 'path';

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string like "1.2MB"
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

const STATE_FILE_PATH = path.join(process.cwd(), 'scripts', '.cleanup-state.json');

/**
 * Progress Tracker Class
 */
class ProgressTracker {
  constructor(environment, operation = 'cleanup') {
    this.environment = environment;
    this.operation = operation;
    this.startTime = new Date();
    this.state = this.loadState();

    // Initialize state if new session
    if (!this.state || this.state.environment !== environment || this.state.operation !== operation) {
      this.resetState();
    }
  }

  /**
   * Load persistent state from file
   * @returns {Object|null} Loaded state or null
   */
  loadState() {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const data = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`Warning: Could not load state file: ${error.message}`);
    }
    return null;
  }

  /**
   * Save current state to file
   */
  saveState() {
    try {
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error(`Error saving state: ${error.message}`);
    }
  }

  /**
   * Reset state for new session
   */
  resetState() {
    this.state = {
      sessionId: Date.now(),
      environment: this.environment,
      operation: this.operation,
      startTime: this.startTime.toISOString(),
      lastRun: new Date().toISOString(),

      // Progress tracking
      processedBatches: 0,
      totalBatches: 0,
      processedFiles: 0,
      totalFiles: 0,

      // Results tracking
      orphansFound: 0,
      orphansProcessed: 0,
      bytesFreed: 0,

      // S3 pagination
      lastContinuationToken: null,

      // File check optimization
      fileCheckHistory: {},

      // Operation-specific data
      operationData: {}
    };
    this.saveState();
  }

  /**
   * Update total counts
   * @param {number} totalBatches - Total number of batches
   * @param {number} totalFiles - Total number of files
   */
  setTotals(totalBatches, totalFiles) {
    this.state.totalBatches = totalBatches;
    this.state.totalFiles = totalFiles;
    this.saveState();
  }

  /**
   * Update batch progress
   * @param {number} batchNumber - Current batch number
   * @param {Object} batchResults - Results from processing this batch
   */
  updateBatchProgress(batchNumber, batchResults) {
    this.state.processedBatches = batchNumber;
    this.state.processedFiles += batchResults.filesProcessed || 0;
    this.state.orphansFound += batchResults.orphansFound || 0;
    this.state.orphansProcessed += batchResults.orphansProcessed || 0;
    this.state.bytesFreed += batchResults.bytesFreed || 0;
    this.state.lastContinuationToken = batchResults.continuationToken || null;
    this.state.lastRun = new Date().toISOString();

    this.saveState();
  }

  /**
   * Display current progress
   */
  displayProgress() {
    const { processedBatches, totalBatches, processedFiles, totalFiles, orphansFound, bytesFreed } = this.state;

    // Calculate percentages
    const batchProgress = totalBatches > 0 ? (processedBatches / totalBatches) * 100 : 0;
    const fileProgress = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;

    // Create progress bar
    const barLength = 20;
    const filledLength = Math.round((batchProgress / 100) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    // Calculate ETA
    const elapsedMs = Date.now() - new Date(this.startTime).getTime();
    const eta = this.calculateETA(batchProgress, elapsedMs);

    console.log('\n' + '='.repeat(60));
    console.log(`🧹 Orphan Cleanup - ${this.environment.charAt(0).toUpperCase() + this.environment.slice(1)} Environment`);
    console.log(`📊 Progress: [${progressBar}] ${batchProgress.toFixed(1)}% (${processedBatches}/${totalBatches} batches)`);

    if (totalFiles > 0) {
      console.log(`📁 Files: ${processedFiles.toLocaleString()}/${totalFiles.toLocaleString()} processed`);
    }

    console.log(`⏱️  ETA: ${eta}`);
    console.log(`📈 Stats: ${orphansFound} orphans found (${formatBytes(bytesFreed)} processed)`);

    if (this.state.operation === 'cleanup') {
      console.log(`🔄 Current: Processing batch ${processedBatches + 1}/${totalBatches}...`);
    }

    console.log('='.repeat(60));
  }

  /**
   * Calculate estimated time of arrival
   * @param {number} progressPercent - Progress percentage (0-100)
   * @param {number} elapsedMs - Elapsed time in milliseconds
   * @returns {string} Human-readable ETA
   */
  calculateETA(progressPercent, elapsedMs) {
    if (progressPercent <= 0) {
      return 'Calculating...';
    }

    if (progressPercent >= 100) {
      return 'Complete';
    }

    const remainingPercent = 100 - progressPercent;
    const avgMsPerPercent = elapsedMs / progressPercent;
    const etaMs = remainingPercent * avgMsPerPercent;

    const etaMinutes = Math.round(etaMs / (1000 * 60));

    if (etaMinutes < 1) {
      return 'Less than 1 minute';
    } else if (etaMinutes < 60) {
      return `${etaMinutes} minute${etaMinutes > 1 ? 's' : ''} remaining`;
    } else {
      const hours = Math.floor(etaMinutes / 60);
      const minutes = etaMinutes % 60;
      return `${hours}h ${minutes}m remaining`;
    }
  }

  /**
   * Display session summary
   */
  displaySummary() {
    const { processedFiles, orphansFound, orphansProcessed, bytesFreed } = this.state;
    const elapsedMs = Date.now() - new Date(this.startTime).getTime();
    const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SESSION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Files Processed: ${processedFiles.toLocaleString()}`);
    console.log(`🔍 Orphans Found: ${orphansFound.toLocaleString()}`);
    console.log(`🗑️  Orphans Processed: ${orphansProcessed.toLocaleString()}`);
    console.log(`💾 Space Freed: ${formatBytes(bytesFreed)}`);
    console.log(`⏱️  Total Time: ${elapsedMinutes} minutes`);
    console.log(`🎯 Environment: ${this.environment}`);
    console.log('='.repeat(60));
  }

  /**
   * Check if file was recently checked (for optimization)
   * @param {string} s3Key - S3 key to check
   * @param {string} thresholdAge - Age threshold (e.g., "24h", "7d")
   * @returns {boolean} True if file was recently checked
   */
  wasRecentlyChecked(s3Key, thresholdAge = '24h') {
    if (!this.state.fileCheckHistory[s3Key]) {
      return false;
    }

    const lastChecked = new Date(this.state.fileCheckHistory[s3Key]);
    const now = new Date();

    // Parse threshold (simple implementation for hours/days)
    let thresholdMs;
    if (thresholdAge.endsWith('h')) {
      thresholdMs = parseInt(thresholdAge) * 60 * 60 * 1000;
    } else if (thresholdAge.endsWith('d')) {
      thresholdMs = parseInt(thresholdAge) * 24 * 60 * 60 * 1000;
    } else {
      thresholdMs = 24 * 60 * 60 * 1000; // Default 24 hours
    }

    return (now - lastChecked) < thresholdMs;
  }

  /**
   * Mark file as checked
   * @param {string} s3Key - S3 key that was checked
   */
  markFileChecked(s3Key) {
    this.state.fileCheckHistory[s3Key] = new Date().toISOString();

    // Clean up old entries (keep only last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const [key, timestamp] of Object.entries(this.state.fileCheckHistory)) {
      if (new Date(timestamp) < thirtyDaysAgo) {
        delete this.state.fileCheckHistory[key];
      }
    }

    this.saveState();
  }

  /**
   * Mark files in batch as checked
   * @param {Array} s3Keys - Array of S3 keys that were checked
   */
  markBatchChecked(s3Keys) {
    const timestamp = new Date().toISOString();
    for (const key of s3Keys) {
      this.state.fileCheckHistory[key] = timestamp;
    }
    this.saveState();
  }

  /**
   * Get resumption information
   * @returns {Object} Information about where to resume
   */
  getResumptionInfo() {
    return {
      canResume: this.state.processedBatches > 0,
      processedBatches: this.state.processedBatches,
      totalBatches: this.state.totalBatches,
      lastContinuationToken: this.state.lastContinuationToken,
      lastRun: this.state.lastRun
    };
  }

  /**
   * Clean up state file
   */
  cleanup() {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        fs.unlinkSync(STATE_FILE_PATH);
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up state file: ${error.message}`);
    }
  }
}

export {
  ProgressTracker
};