/**
 * S3 Path Construction Utilities
 *
 * Centralizes all S3 path construction logic to ensure consistency
 * across upload and download operations.
 * Enhanced with Hebrew filename support for Israeli users.
 */

import { generateHebrewSafeS3Key } from './hebrewFilenameUtils.js';

/**
 * Construct S3 path for any asset
 *
 * Path format: {privacy}/{assetType}/{entityType}/{entityId}/{filename}
 * NOTE: No environment prefix - each environment uses separate buckets
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool, etc.)
 * @param {string} entityId - ID of the entity
 * @param {string} assetType - Type of asset (marketing-video, content-video, document)
 * @param {string} filename - Filename (e.g., "video.mp4" or "document.pdf")
 * @returns {string} Full S3 key path
 *
 * @example
 * constructS3Path('file', 'test_file_001', 'document', 'sample.pdf')
 * // => "private/document/file/test_file_001/sample.pdf"
 *
 * constructS3Path('workshop', 'abc123', 'marketing-video', 'video.mp4')
 * // => "public/marketing-video/workshop/abc123/video.mp4"
 */
export function constructS3Path(entityType, entityId, assetType, filename) {
  // Each environment has its own bucket - NO environment prefix needed in S3 keys
  // Buckets: ludora-files-dev, ludora-files-staging, ludora-files-prod

  // Determine privacy level based on asset type
  const privacy = (assetType === 'marketing-video' || assetType === 'image') ? 'public' : 'private';

  // Sanitize filename using Hebrew-aware utilities for Israeli users
  const sanitizedFilename = generateHebrewSafeS3Key(filename);

  return `${privacy}/${assetType}/${entityType}/${entityId}/${sanitizedFilename}`;
}

/**
 * Parse S3 path to extract components
 * NOTE: No environment prefix - paths are relative to environment-specific buckets
 *
 * @param {string} s3Path - S3 path to parse
 * @returns {Object} Parsed components
 */
export function parseS3Path(s3Path) {
  const parts = s3Path.split('/');

  if (parts.length < 5) {
    throw new Error(`Invalid S3 path format: ${s3Path}`);
  }

  return {
    privacy: parts[0],
    assetType: parts[1],
    entityType: parts[2],
    entityId: parts[3],
    filename: parts.slice(4).join('/') // Handle filenames with slashes
  };
}

/**
 * Get standard filename for asset type
 *
 * @param {string} assetType - Type of asset
 * @param {string} originalFilename - Original filename (optional)
 * @returns {string} Standard filename
 */
export function getStandardFilename(assetType, originalFilename = null) {
  switch (assetType) {
    case 'marketing-video':
    case 'content-video':
      return 'video.mp4';
    case 'document':
      return originalFilename || 'document.pdf';
    default:
      return originalFilename || 'file.dat';
  }
}