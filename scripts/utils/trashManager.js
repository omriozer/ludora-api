/**
 * Trash Manager Utility
 * Handles moving files to trash and managing trash operations
 */

import AWS from 'aws-sdk';
import path from 'path';

/**
 * Initialize S3 client with environment-specific configuration
 * @param {string} environment - Environment (development, staging, production)
 * @returns {AWS.S3} Configured S3 client
 */
function initS3Client(environment) {
  // Configure S3 based on environment
  const config = {
    region: process.env.AWS_REGION || 'us-east-1',
  };

  // Add credentials if not using IAM roles
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  }

  return new AWS.S3(config);
}

/**
 * Get bucket name for environment
 * @param {string} environment - Environment name
 * @returns {string} S3 bucket name
 */
function getBucketName(environment) {
  switch (environment) {
    case 'development':
      return process.env.S3_BUCKET_DEV || 'ludora-dev';
    case 'staging':
      return process.env.S3_BUCKET_STAGING || 'ludora-staging';
    case 'production':
      return process.env.S3_BUCKET_PROD || 'ludora-prod';
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

/**
 * Convert original S3 key to trash path
 * @param {string} originalKey - Original S3 key
 * @returns {string} Trash path
 */
function getTrashPath(originalKey) {
  return `trash/${originalKey}`;
}

/**
 * Convert trash path back to original path
 * @param {string} trashKey - Trash S3 key
 * @returns {string} Original path
 */
function getOriginalPath(trashKey) {
  if (!trashKey.startsWith('trash/')) {
    throw new Error(`Invalid trash key: ${trashKey}`);
  }
  return trashKey.substring(6); // Remove 'trash/' prefix
}

/**
 * Check if a key is in trash
 * @param {string} key - S3 key to check
 * @returns {boolean} True if key is in trash
 */
function isInTrash(key) {
  return key.startsWith('trash/');
}

/**
 * Move a file to trash (S3 copy then delete)
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} originalKey - Original S3 key
 * @returns {Promise<Object>} Result object with success status
 */
async function moveToTrash(s3Client, bucketName, originalKey) {
  try {
    const trashKey = getTrashPath(originalKey);

    // Copy to trash location
    await s3Client.copyObject({
      Bucket: bucketName,
      CopySource: `${bucketName}/${originalKey}`,
      Key: trashKey,
      MetadataDirective: 'COPY',
      // Add custom metadata to track when moved to trash
      Metadata: {
        'moved-to-trash': new Date().toISOString(),
        'original-path': originalKey
      }
    }).promise();

    // Delete original file
    await s3Client.deleteObject({
      Bucket: bucketName,
      Key: originalKey
    }).promise();

    return {
      success: true,
      originalKey,
      trashKey,
      message: `Moved ${originalKey} to ${trashKey}`
    };
  } catch (error) {
    return {
      success: false,
      originalKey,
      error: error.message,
      message: `Failed to move ${originalKey} to trash: ${error.message}`
    };
  }
}

/**
 * Permanently delete file from trash
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} trashKey - Trash S3 key
 * @returns {Promise<Object>} Result object with success status
 */
async function deleteFromTrash(s3Client, bucketName, trashKey) {
  try {
    if (!isInTrash(trashKey)) {
      throw new Error(`Key is not in trash: ${trashKey}`);
    }

    await s3Client.deleteObject({
      Bucket: bucketName,
      Key: trashKey
    }).promise();

    return {
      success: true,
      trashKey,
      originalPath: getOriginalPath(trashKey),
      message: `Permanently deleted ${trashKey}`
    };
  } catch (error) {
    return {
      success: false,
      trashKey,
      error: error.message,
      message: `Failed to delete ${trashKey}: ${error.message}`
    };
  }
}

/**
 * Restore file from trash to original location
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} trashKey - Trash S3 key
 * @returns {Promise<Object>} Result object with success status
 */
async function restoreFromTrash(s3Client, bucketName, trashKey) {
  try {
    if (!isInTrash(trashKey)) {
      throw new Error(`Key is not in trash: ${trashKey}`);
    }

    const originalKey = getOriginalPath(trashKey);

    // Copy back to original location
    await s3Client.copyObject({
      Bucket: bucketName,
      CopySource: `${bucketName}/${trashKey}`,
      Key: originalKey,
      MetadataDirective: 'REPLACE',
      Metadata: {
        'restored-from-trash': new Date().toISOString()
      }
    }).promise();

    // Delete from trash
    await s3Client.deleteObject({
      Bucket: bucketName,
      Key: trashKey
    }).promise();

    return {
      success: true,
      trashKey,
      originalKey,
      message: `Restored ${trashKey} to ${originalKey}`
    };
  } catch (error) {
    return {
      success: false,
      trashKey,
      error: error.message,
      message: `Failed to restore ${trashKey}: ${error.message}`
    };
  }
}

/**
 * List files in trash for an environment
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} environment - Environment name (for filtering)
 * @param {string} continuationToken - S3 continuation token for pagination
 * @returns {Promise<Object>} List result with files and pagination info
 */
async function listTrashFiles(s3Client, bucketName, environment, continuationToken = null) {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: `trash/${environment}/`,
      MaxKeys: 1000
    };

    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    const result = await s3Client.listObjectsV2(params).promise();

    const files = result.Contents.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      originalPath: getOriginalPath(obj.Key),
      sizeFormatted: formatBytes(obj.Size)
    }));

    return {
      success: true,
      files,
      isTruncated: result.IsTruncated,
      nextContinuationToken: result.NextContinuationToken,
      count: files.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      files: [],
      count: 0
    };
  }
}

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
 * Get trash statistics for an environment
 * @param {AWS.S3} s3Client - S3 client
 * @param {string} bucketName - S3 bucket name
 * @param {string} environment - Environment name
 * @returns {Promise<Object>} Trash statistics
 */
async function getTrashStats(s3Client, bucketName, environment) {
  try {
    let totalFiles = 0;
    let totalSize = 0;
    let continuationToken = null;

    do {
      const result = await listTrashFiles(s3Client, bucketName, environment, continuationToken);
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
      totalSizeFormatted: formatBytes(totalSize)
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

export {
  initS3Client,
  getBucketName,
  getTrashPath,
  getOriginalPath,
  isInTrash,
  moveToTrash,
  deleteFromTrash,
  restoreFromTrash,
  listTrashFiles,
  formatBytes,
  getTrashStats
};