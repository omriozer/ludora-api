/**
 * S3 Path Construction Utilities
 *
 * Centralizes all S3 path construction logic to ensure consistency
 * across upload and download operations.
 */

/**
 * Construct S3 path for any asset
 *
 * Path format: {env}/{privacy}/{assetType}/{entityType}/{entityId}/{filename}
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool, etc.)
 * @param {string} entityId - ID of the entity
 * @param {string} assetType - Type of asset (marketing-video, content-video, document)
 * @param {string} filename - Filename (e.g., "video.mp4" or "document.pdf")
 * @returns {string} Full S3 key path
 *
 * @example
 * constructS3Path('file', 'test_file_001', 'document', 'sample.pdf')
 * // => "development/private/document/file/test_file_001/sample.pdf"
 *
 * constructS3Path('workshop', 'abc123', 'marketing-video', 'video.mp4')
 * // => "development/public/marketing-video/workshop/abc123/video.mp4"
 */
export function constructS3Path(entityType, entityId, assetType, filename) {
  const env = process.env.ENVIRONMENT || 'development';

  // Determine privacy level based on asset type
  const privacy = (assetType === 'marketing-video' || assetType === 'image') ? 'public' : 'private';

  // Sanitize filename to avoid S3 issues while preserving Unicode characters (like Hebrew)
  // Only replace truly problematic characters, preserve Unicode letters and numbers
  const sanitizedFilename = filename
    .replace(/[<>:"|?*]/g, '-') // Replace Windows/filesystem forbidden chars
    .replace(/[\x00-\x1f\x7f]/g, '-') // Replace control characters
    .replace(/[/\\]/g, '-') // Replace path separators
    .replace(/\s+/g, ' ') // Normalize whitespace to single spaces
    .replace(/-+/g, '-') // Replace multiple consecutive dashes with single dash
    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    .trim(); // Remove leading/trailing whitespace

  return `${env}/${privacy}/${assetType}/${entityType}/${entityId}/${sanitizedFilename}`;
}

/**
 * Parse S3 path to extract components
 *
 * @param {string} s3Path - S3 path to parse
 * @returns {Object} Parsed components
 */
export function parseS3Path(s3Path) {
  const parts = s3Path.split('/');

  if (parts.length < 6) {
    throw new Error(`Invalid S3 path format: ${s3Path}`);
  }

  return {
    environment: parts[0],
    privacy: parts[1],
    assetType: parts[2],
    entityType: parts[3],
    entityId: parts[4],
    filename: parts.slice(5).join('/') // Handle filenames with slashes
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