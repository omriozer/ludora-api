/**
 * S3 File Analyzer
 * Handles S3 file listing, metadata collection, and orphan detection
 */

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

/**
 * Format a date as "X days ago", "X months ago", etc.
 * @param {Date|string} date - Date to format
 * @returns {string} Human-readable relative time
 */
function formatRelativeTime(date) {
  const targetDate = new Date(date);
  const now = new Date();
  const diffMs = now - targetDate;

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } else if (months > 0) {
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
}

/**
 * List S3 objects with metadata for orphan detection
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} environment - Environment name
 * @param {string} continuationToken - S3 continuation token for pagination
 * @param {number} maxKeys - Maximum keys per request (default 1000)
 * @returns {Promise<Object>} List result with files and pagination info
 */
async function listS3Files(s3Client, bucketName, environment, continuationToken = null, maxKeys = 1000) {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: `${environment}/`, // Only scan files for the specific environment
      MaxKeys: maxKeys
    };

    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    console.log(`📡 Scanning S3: s3://${bucketName}/${environment}/...`);
    const result = await s3Client.listObjectsV2(params).promise();

    const files = result.Contents
      .filter(obj => !obj.Key.startsWith(`trash/`)) // Exclude trash files
      .map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        sizeFormatted: formatBytes(obj.Size),
        ageFormatted: formatRelativeTime(obj.LastModified),
        s3Url: `s3://${bucketName}/${obj.Key}`
      }));

    return {
      success: true,
      files,
      isTruncated: result.IsTruncated,
      nextContinuationToken: result.NextContinuationToken,
      count: files.length,
      totalScanned: result.KeyCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      files: [],
      count: 0,
      totalScanned: 0
    };
  }
}

/**
 * Detect orphaned files by comparing S3 files with database references
 * @param {Array} s3Files - Array of S3 file objects
 * @param {Array} databaseReferences - Array of S3 keys referenced in database
 * @returns {Object} Orphan detection results
 */
function detectOrphans(s3Files, databaseReferences) {
  console.log(`🔍 Analyzing ${s3Files.length} S3 files against ${databaseReferences.length} database references...`);

  // Create a Set for faster lookup
  const referencedKeys = new Set(databaseReferences);

  const orphans = [];
  const referenced = [];

  for (const file of s3Files) {
    if (referencedKeys.has(file.key)) {
      referenced.push(file);
    } else {
      orphans.push(file);
    }
  }

  const orphanSize = orphans.reduce((sum, file) => sum + file.size, 0);
  const referencedSize = referenced.reduce((sum, file) => sum + file.size, 0);

  return {
    orphans,
    referenced,
    stats: {
      totalFiles: s3Files.length,
      orphanFiles: orphans.length,
      referencedFiles: referenced.length,
      orphanSize,
      referencedSize,
      orphanSizeFormatted: formatBytes(orphanSize),
      referencedSizeFormatted: formatBytes(referencedSize),
      orphanPercentage: s3Files.length > 0 ? ((orphans.length / s3Files.length) * 100).toFixed(1) : '0'
    }
  };
}

/**
 * Format file list for display in a table
 * @param {Array} files - Array of file objects
 * @param {number} maxDisplay - Maximum number of files to display (default 50)
 * @returns {Array} Formatted file data for table display
 */
function formatFilesForDisplay(files, maxDisplay = 50) {
  const filesToShow = files.slice(0, maxDisplay);

  return filesToShow.map(file => ({
    'S3 Location': file.s3Url,
    'Size': file.sizeFormatted,
    'Last Modified': file.ageFormatted
  }));
}

/**
 * Generate batch processing plan for S3 files
 * @param {number} totalFiles - Total number of files to process
 * @param {number} batchSize - Files per batch
 * @returns {Object} Batch processing plan
 */
function generateBatchPlan(totalFiles, batchSize) {
  const totalBatches = Math.ceil(totalFiles / batchSize);

  return {
    totalFiles,
    batchSize,
    totalBatches,
    estimatedTime: `${Math.ceil(totalBatches * 0.5)} minutes`, // Estimate 30 seconds per batch
    batches: Array.from({ length: totalBatches }, (_, i) => ({
      batchNumber: i + 1,
      startIndex: i * batchSize,
      endIndex: Math.min((i + 1) * batchSize - 1, totalFiles - 1),
      filesInBatch: Math.min(batchSize, totalFiles - i * batchSize)
    }))
  };
}

/**
 * Get S3 file statistics for an environment
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} environment - Environment name
 * @returns {Promise<Object>} S3 statistics
 */
async function getS3Stats(s3Client, bucketName, environment) {
  try {
    let totalFiles = 0;
    let totalSize = 0;
    let continuationToken = null;

    console.log(`📊 Collecting S3 statistics for ${environment}...`);

    do {
      const result = await listS3Files(s3Client, bucketName, environment, continuationToken);
      if (!result.success) {
        throw new Error(result.error);
      }

      totalFiles += result.count;
      totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
      continuationToken = result.nextContinuationToken;
    } while (continuationToken);

    return {
      success: true,
      environment,
      totalFiles,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      averageFileSize: totalFiles > 0 ? totalSize / totalFiles : 0,
      averageFileSizeFormatted: totalFiles > 0 ? formatBytes(totalSize / totalFiles) : '0B'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      environment,
      totalFiles: 0,
      totalSize: 0
    };
  }
}

/**
 * Validate that files exist in S3 (used for testing)
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {Array} s3Keys - Array of S3 keys to check
 * @returns {Promise<Object>} Validation results
 */
async function validateS3Files(s3Client, bucketName, s3Keys) {
  console.log(`🔍 Validating ${s3Keys.length} S3 files...`);

  const results = {
    existing: [],
    missing: [],
    errors: []
  };

  // Process in batches to avoid overwhelming S3
  const batchSize = 100;
  for (let i = 0; i < s3Keys.length; i += batchSize) {
    const batch = s3Keys.slice(i, i + batchSize);

    const batchPromises = batch.map(async (key) => {
      try {
        await s3Client.headObject({
          Bucket: bucketName,
          Key: key
        }).promise();
        return { key, status: 'exists' };
      } catch (error) {
        if (error.code === 'NotFound') {
          return { key, status: 'missing' };
        } else {
          return { key, status: 'error', error: error.message };
        }
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'exists') {
        results.existing.push(result.key);
      } else if (result.status === 'missing') {
        results.missing.push(result.key);
      } else {
        results.errors.push({ key: result.key, error: result.error });
      }
    }

    // Progress update
    console.log(`   Validated ${Math.min(i + batchSize, s3Keys.length)}/${s3Keys.length} files...`);
  }

  return {
    success: true,
    total: s3Keys.length,
    existing: results.existing.length,
    missing: results.missing.length,
    errors: results.errors.length,
    missingFiles: results.missing,
    errorFiles: results.errors
  };
}

/**
 * Get detailed file information from S3
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} s3Key - S3 key
 * @returns {Promise<Object>} Detailed file information
 */
async function getFileDetails(s3Client, bucketName, s3Key) {
  try {
    const result = await s3Client.headObject({
      Bucket: bucketName,
      Key: s3Key
    }).promise();

    return {
      success: true,
      key: s3Key,
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      metadata: result.Metadata,
      sizeFormatted: formatBytes(result.ContentLength),
      ageFormatted: formatRelativeTime(result.LastModified),
      s3Url: `s3://${bucketName}/${s3Key}`
    };
  } catch (error) {
    return {
      success: false,
      key: s3Key,
      error: error.message
    };
  }
}

export {
  listS3Files,
  detectOrphans,
  formatFilesForDisplay,
  generateBatchPlan,
  getS3Stats,
  validateS3Files,
  getFileDetails
};