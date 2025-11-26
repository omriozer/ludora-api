/**
 * File Check Cache Utility
 * Optimizes file checking by tracking when files were last checked
 */

import fs from 'fs';
import path from 'path';

/**
 * Parse age string into milliseconds
 * @param {string} ageString - Age string like "30d", "6m", "1y"
 * @returns {number} Milliseconds
 */
function parseAgeString(ageString) {
  const match = ageString.match(/^(\d+)([dmyDMY])$/);
  if (!match) {
    throw new Error(`Invalid age format: ${ageString}. Use format like "30d", "6m", "1y"`);
  }

  const [, amount, unit] = match;
  const num = parseInt(amount, 10);

  switch (unit.toLowerCase()) {
    case 'd': // days
      return num * 24 * 60 * 60 * 1000;
    case 'm': // months (approximate as 30 days)
      return num * 30 * 24 * 60 * 60 * 1000;
    case 'y': // years (approximate as 365 days)
      return num * 365 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid age unit: ${unit}. Use 'd' for days, 'm' for months, 'y' for years`);
  }
}

/**
 * Check if a date is older than the specified age
 * @param {Date|string} date - Date to check
 * @param {string} ageString - Age string like "30d"
 * @returns {boolean} True if date is older than specified age
 */
function isOlderThan(date, ageString) {
  const targetDate = new Date(date);
  const ageMs = parseAgeString(ageString);
  const cutoffDate = new Date(Date.now() - ageMs);

  return targetDate < cutoffDate;
}

const CACHE_FILE_PATH = path.join(process.cwd(), 'scripts', '.file-check-cache.json');

/**
 * File Check Cache Class
 */
class FileCheckCache {
  constructor(cacheExpiryAge = '24h') {
    this.cacheExpiryAge = cacheExpiryAge;
    this.cache = this.loadCache();
    this.dirty = false;
  }

  /**
   * Load cache from file
   * @returns {Object} Cache data
   */
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        const cache = JSON.parse(data);

        // Clean expired entries on load
        this.cleanExpiredEntries(cache);
        return cache;
      }
    } catch (error) {
      console.warn(`Warning: Could not load file check cache: ${error.message}`);
    }

    return {
      version: '1.0',
      lastCleanup: new Date().toISOString(),
      files: {}
    };
  }

  /**
   * Save cache to file
   */
  saveCache() {
    if (!this.dirty) return;

    try {
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.cache.lastUpdate = new Date().toISOString();
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
      this.dirty = false;
    } catch (error) {
      console.error(`Error saving file check cache: ${error.message}`);
    }
  }

  /**
   * Clean expired entries from cache
   * @param {Object} cache - Cache object to clean
   */
  cleanExpiredEntries(cache) {
    if (!cache.files) return;

    let removedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Remove entries older than 30 days

    for (const [key, entry] of Object.entries(cache.files)) {
      if (new Date(entry.lastChecked) < cutoffDate) {
        delete cache.files[key];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      cache.lastCleanup = new Date().toISOString();
    }
  }

  /**
   * Check if file was recently checked
   * @param {string} s3Key - S3 key to check
   * @param {string} environment - Environment name
   * @param {string} customAge - Custom age threshold (optional)
   * @returns {boolean} True if file was recently checked
   */
  wasRecentlyChecked(s3Key, environment, customAge = null) {
    const cacheKey = this.getCacheKey(s3Key, environment);
    const entry = this.cache.files[cacheKey];

    if (!entry) {
      return false;
    }

    const ageThreshold = customAge || this.cacheExpiryAge;
    return !isOlderThan(entry.lastChecked, ageThreshold);
  }

  /**
   * Mark file as checked
   * @param {string} s3Key - S3 key that was checked
   * @param {string} environment - Environment name
   * @param {Object} checkResult - Result of the check (optional)
   */
  markChecked(s3Key, environment, checkResult = null) {
    const cacheKey = this.getCacheKey(s3Key, environment);

    this.cache.files[cacheKey] = {
      s3Key,
      environment,
      lastChecked: new Date().toISOString(),
      checkCount: (this.cache.files[cacheKey]?.checkCount || 0) + 1,
      lastResult: checkResult ? {
        isOrphan: checkResult.isOrphan,
        size: checkResult.size,
        lastModified: checkResult.lastModified
      } : null
    };

    this.dirty = true;
  }

  /**
   * Mark multiple files as checked
   * @param {Array} s3Keys - Array of S3 keys
   * @param {string} environment - Environment name
   * @param {Array} checkResults - Array of check results (optional)
   */
  markBatchChecked(s3Keys, environment, checkResults = null) {
    const timestamp = new Date().toISOString();

    s3Keys.forEach((s3Key, index) => {
      const cacheKey = this.getCacheKey(s3Key, environment);
      const result = checkResults ? checkResults[index] : null;

      this.cache.files[cacheKey] = {
        s3Key,
        environment,
        lastChecked: timestamp,
        checkCount: (this.cache.files[cacheKey]?.checkCount || 0) + 1,
        lastResult: result ? {
          isOrphan: result.isOrphan,
          size: result.size,
          lastModified: result.lastModified
        } : null
      };
    });

    this.dirty = true;
  }

  /**
   * Get cache key for file
   * @param {string} s3Key - S3 key
   * @param {string} environment - Environment name
   * @returns {string} Cache key
   */
  getCacheKey(s3Key, environment) {
    return `${environment}:${s3Key}`;
  }

  /**
   * Get cached result for file
   * @param {string} s3Key - S3 key
   * @param {string} environment - Environment name
   * @returns {Object|null} Cached result or null
   */
  getCachedResult(s3Key, environment) {
    const cacheKey = this.getCacheKey(s3Key, environment);
    const entry = this.cache.files[cacheKey];

    if (!entry || !entry.lastResult) {
      return null;
    }

    // Only return cached result if it's still fresh
    if (this.wasRecentlyChecked(s3Key, environment)) {
      return entry.lastResult;
    }

    return null;
  }

  /**
   * Filter out recently checked files from array
   * @param {Array} s3Files - Array of S3 file objects
   * @param {string} environment - Environment name
   * @returns {Object} Object with needsCheck and skipCheck arrays
   */
  filterRecentlyChecked(s3Files, environment) {
    const needsCheck = [];
    const skipCheck = [];

    for (const file of s3Files) {
      if (this.wasRecentlyChecked(file.key, environment)) {
        skipCheck.push({
          ...file,
          reason: 'recently_checked',
          lastChecked: this.cache.files[this.getCacheKey(file.key, environment)]?.lastChecked
        });
      } else {
        needsCheck.push(file);
      }
    }

    return { needsCheck, skipCheck };
  }

  /**
   * Get cache statistics
   * @param {string} environment - Environment name (optional, for filtering)
   * @returns {Object} Cache statistics
   */
  getStats(environment = null) {
    const allEntries = Object.values(this.cache.files);
    const entries = environment
      ? allEntries.filter(entry => entry.environment === environment)
      : allEntries;

    const now = new Date();
    const recent = entries.filter(entry =>
      !isOlderThan(entry.lastChecked, this.cacheExpiryAge)
    );

    const totalChecks = entries.reduce((sum, entry) => sum + (entry.checkCount || 1), 0);

    return {
      totalEntries: entries.length,
      recentEntries: recent.length,
      expiredEntries: entries.length - recent.length,
      totalChecks,
      cacheHitRate: entries.length > 0 ? (recent.length / entries.length * 100).toFixed(1) : '0',
      lastCleanup: this.cache.lastCleanup,
      cacheExpiryAge: this.cacheExpiryAge
    };
  }

  /**
   * Clear cache for specific environment
   * @param {string} environment - Environment name
   */
  clearEnvironmentCache(environment) {
    let removedCount = 0;

    for (const [key, entry] of Object.entries(this.cache.files)) {
      if (entry.environment === environment) {
        delete this.cache.files[key];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.dirty = true;
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.files = {};
    this.cache.lastCleanup = new Date().toISOString();
    this.dirty = true;
  }

  /**
   * Display cache statistics
   * @param {string} environment - Environment name (optional)
   */
  displayStats(environment = null) {
    const stats = this.getStats(environment);

    console.log('\n📊 File Check Cache Statistics');
    console.log('================================');
    console.log(`Environment: ${environment || 'All environments'}`);
    console.log(`Total entries: ${stats.totalEntries.toLocaleString()}`);
    console.log(`Recent entries: ${stats.recentEntries.toLocaleString()}`);
    console.log(`Expired entries: ${stats.expiredEntries.toLocaleString()}`);
    console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
    console.log(`Total checks performed: ${stats.totalChecks.toLocaleString()}`);
    console.log(`Cache expiry age: ${stats.cacheExpiryAge}`);
    console.log(`Last cleanup: ${stats.lastCleanup}`);
    console.log('================================\n');
  }

  /**
   * Save cache and cleanup
   */
  cleanup() {
    this.saveCache();
  }

  /**
   * Force save cache
   */
  forceSave() {
    this.dirty = true;
    this.saveCache();
  }
}

export {
  FileCheckCache
};