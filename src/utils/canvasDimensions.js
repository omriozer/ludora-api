/**
 * Canvas dimension configuration for different target formats
 * Centralizes all canvas size definitions to avoid hardcoded values
 */

const CANVAS_DIMENSIONS = {
  // PDF formats - traditional 4:3 aspect ratio
  'pdf-a4-portrait': {
    width: 800,
    height: 600,
    aspectRatio: 4 / 3,
    description: 'PDF Portrait A4'
  },
  'pdf-a4-landscape': {
    width: 800,
    height: 600,
    aspectRatio: 4 / 3,
    description: 'PDF Landscape A4'
  },
  // SVG Lesson Plan - 16:9 aspect ratio based on actual slide dimensions
  'svg-lessonplan': {
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    description: 'SVG Lesson Plan Slides'
  },
  // Default fallback
  'default': {
    width: 800,
    height: 600,
    aspectRatio: 4 / 3,
    description: 'Default Canvas'
  }
};

/**
 * Get canvas dimensions for a given target format
 * @param {string} targetFormat - The target format (e.g., 'svg-lessonplan', 'pdf-a4-portrait')
 * @returns {Object} Canvas dimensions with width, height, aspectRatio, and description
 */
function getCanvasDimensions(targetFormat) {
  const dimensions = CANVAS_DIMENSIONS[targetFormat] || CANVAS_DIMENSIONS.default;

  return dimensions;
}

/**
 * Get scaled dimensions while maintaining aspect ratio
 * @param {string} targetFormat - The target format
 * @param {number} maxWidth - Maximum width constraint
 * @param {number} maxHeight - Maximum height constraint
 * @returns {Object} Scaled dimensions with width and height
 */
function getScaledDimensions(targetFormat, maxWidth, maxHeight) {
  const baseDimensions = getCanvasDimensions(targetFormat);
  const { aspectRatio } = baseDimensions;

  let scaledWidth = maxWidth;
  let scaledHeight = maxWidth / aspectRatio;

  // If height exceeds max, scale by height instead
  if (scaledHeight > maxHeight) {
    scaledHeight = maxHeight;
    scaledWidth = maxHeight * aspectRatio;
  }

  return {
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    scale: scaledWidth / baseDimensions.width
  };
}

/**
 * Check if a target format uses SVG slides
 * @param {string} targetFormat - The target format
 * @returns {boolean} True if format uses SVG slides
 */
function isSVGFormat(targetFormat) {
  return targetFormat === 'svg-lessonplan';
}

/**
 * Check if a target format uses PDF files
 * @param {string} targetFormat - The target format
 * @returns {boolean} True if format uses PDF files
 */
function isPDFFormat(targetFormat) {
  return targetFormat && (targetFormat.startsWith('pdf-') || targetFormat === 'default');
}

module.exports = {
  CANVAS_DIMENSIONS,
  getCanvasDimensions,
  getScaledDimensions,
  isSVGFormat,
  isPDFFormat
};