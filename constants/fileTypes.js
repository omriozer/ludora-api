// Unified file type configuration for uploads
// This is the single source of truth for all file upload validations

export const FILE_TYPES = {
  // File product type (PDF only)
  file: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 500 * 1024 * 1024, // 500MB
    displayName: 'PDF'
  },

  // Preview files (PDF only)
  preview_file: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 100 * 1024 * 1024, // 100MB
    displayName: 'PDF'
  },

  // Images
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    displayName: 'Image'
  },

  // Videos
  video: {
    extensions: ['.mp4', '.mov', '.avi'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    maxSize: 500 * 1024 * 1024, // 500MB
    displayName: 'Video'
  },

  // Workshop videos
  workshop_video: {
    extensions: ['.mp4', '.mov', '.avi'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    maxSize: 500 * 1024 * 1024, // 500MB
    displayName: 'Video'
  },

  // Marketing videos
  marketing_video: {
    extensions: ['.mp4', '.mov', '.avi'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    maxSize: 500 * 1024 * 1024, // 500MB
    displayName: 'Video'
  }
};

/**
 * Get all allowed MIME types across all upload types
 * Used for general multer file filter configuration
 */
export function getAllAllowedMimeTypes() {
  const allMimes = new Set();
  Object.values(FILE_TYPES).forEach(type => {
    type.mimeTypes.forEach(mime => allMimes.add(mime));
  });
  return Array.from(allMimes);
}

/**
 * Get file type configuration for a specific upload type
 * @param {string} uploadType - The type of upload (file, preview_file, image, video, etc.)
 * @returns {object|null} Configuration object or null if not found
 */
export function getFileTypeConfig(uploadType) {
  return FILE_TYPES[uploadType] || null;
}

/**
 * Detect file type category from MIME type
 * Used for setting the file_type field in database
 * @param {string} mimetype - The MIME type of the uploaded file
 * @returns {string} File type category
 */
export function detectFileTypeFromMime(mimetype) {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('word')) return 'docx';
  if (mimetype.includes('powerpoint')) return 'ppt';
  if (mimetype.includes('excel') || mimetype.includes('sheet')) return 'xlsx';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.includes('zip')) return 'zip';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'text/plain') return 'text';
  return 'other';
}

/**
 * Format file types configuration for frontend consumption
 * This is included in the Settings API response
 * @returns {object} Frontend-friendly configuration object
 */
export function getFileTypesForFrontend() {
  const config = {};
  Object.keys(FILE_TYPES).forEach(key => {
    config[key] = {
      extensions: FILE_TYPES[key].extensions,
      accept: FILE_TYPES[key].extensions.join(','),
      mimeTypes: FILE_TYPES[key].mimeTypes,
      displayName: FILE_TYPES[key].displayName,
      maxSizeMB: Math.floor(FILE_TYPES[key].maxSize / (1024 * 1024))
    };
  });
  return config;
}
