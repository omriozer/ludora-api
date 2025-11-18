/**
 * Shared Template Processing Utilities
 *
 * Contains all the logic that can be shared between PDF and SVG template processing:
 * - Template structure validation
 * - Element processing loops
 * - Content preparation and variable substitution
 * - Multi-line text processing calculations
 * - Element property extraction and styling
 * - Page variables setup
 *
 * File-type-specific rendering functions (PDF vs SVG) are in their respective files.
 */

import { substituteVariables } from './variableSubstitution.js';
import { getElementRotation, getElementShadow } from './elementHelpers.js';
import { createConverter } from './CoordinateConverter.js';
import { getDefaultContent, getUrlConfig } from '../config/templateConfig.js';

/**
 * Validate template structure - ensures unified structure is used
 * @param {Object} templateSettings - Template settings to validate
 * @returns {boolean} - Whether template has valid unified structure
 */
export function validateTemplateStructure(templateSettings) {
  if (!templateSettings || typeof templateSettings !== 'object') {
    return false;
  }

  if (!templateSettings.elements || typeof templateSettings.elements !== 'object') {
    return false;
  }

  return true;
}

/**
 * Process all elements in a unified template structure
 * @param {Object} templateSettings - Template settings with elements structure
 * @param {Function} renderFunction - Function to call for each element (elementType, element, coordinates, styling)
 * @param {Object} pageInfo - Page information (width, height, pageNumber, totalPages)
 * @param {Object} variables - Variables for substitution
 * @param {Object} fontSelector - Font selection utility (optional, for text elements)
 * @returns {Promise<void>}
 */
export async function processTemplateElements(templateSettings, renderFunction, pageInfo, variables, fontSelector = null) {
  // Validate template structure
  if (!validateTemplateStructure(templateSettings)) {
    throw new Error('Template must use unified structure with "elements" object. Please update template to new format.');
  }

  // Create coordinate converter for this page
  const coordinateConverter = createConverter('pdf-a4-portrait');
  // Override with actual page dimensions if different from A4
  if (pageInfo.width !== 595 || pageInfo.height !== 842) {
    coordinateConverter.pageWidth = pageInfo.width;
    coordinateConverter.pageHeight = pageInfo.height;
  }

  // Add page number and URL variables using configuration
  const urlConfig = getUrlConfig();
  const pageVariables = {
    ...variables,
    page: pageInfo.pageNumber,
    pageNumber: pageInfo.pageNumber,
    totalPages: pageInfo.totalPages || 1,
    FRONTEND_URL: urlConfig.frontend
  };

  // Process all element types in the unified structure
  for (const [elementType, elementArray] of Object.entries(templateSettings.elements)) {
    if (Array.isArray(elementArray)) {
      for (const element of elementArray) {
        if (element && element.visible !== false && !element.hidden) {
          // Prepare element coordinates and styling
          const elementInfo = prepareElementInfo(element, elementType, coordinateConverter, pageVariables, fontSelector);

          // Call the file-type-specific render function
          await renderFunction(elementType, element, elementInfo, pageVariables);
        }
      }
    }
  }
}

/**
 * Prepare element positioning, styling, and content information
 * @param {Object} element - Element configuration
 * @param {string} elementType - Element type
 * @param {Object} coordinateConverter - Coordinate conversion utility
 * @param {Object} variables - Variables for content substitution
 * @param {Object} fontSelector - Font selection utility (optional)
 * @returns {Object} - Prepared element information
 */
export function prepareElementInfo(element, elementType, coordinateConverter, variables, fontSelector = null) {
  // Calculate positioning
  const elementXPercent = element.position?.x || 50;
  const elementYPercent = element.position?.y || 50;

  // Convert percentage positions to absolute coordinates
  const { x: elementX, y: elementY } = coordinateConverter.percentageToPdf(elementXPercent, elementYPercent);


  // Extract common style properties
  const opacity = (element.style?.opacity || 100) / 100;
  const rotation = getElementRotation(element, elementType);

  // Get shadow settings
  const shadowSettings = getElementShadow(element, elementType);

  // Prepare content with variable substitution
  let content = element.content || '';

  // Default content for special element types using configuration
  if (elementType === 'user-info' && !content) {
    content = getDefaultContent('user-info', 'hebrew');
  } else if (elementType === 'url' && !content) {
    const urlConfig = getUrlConfig();
    content = element.href || urlConfig.default;
  }

  // Apply variable substitution if there's content
  if (content) {
    content = substituteVariables(content, variables, {
      supportSystemTemplates: true,
      enableLogging: true
    });
  }

  // Extract style properties based on element type
  const style = extractElementStyle(element, elementType);

  // Font selection for text-based elements
  let fontInfo = null;
  if ((elementType.includes('text') || elementType === 'url') && fontSelector && content) {
    fontInfo = fontSelector.selectFont(content, {
      bold: style.bold,
      italic: style.italic
    });
  }

  return {
    // Position
    x: elementX,
    y: elementY,

    // Style
    opacity,
    rotation,
    shadowSettings,
    style,

    // Content
    content,

    // Font (for text elements)
    fontInfo,

    // Coordinate converter for advanced calculations
    coordinateConverter
  };
}

/**
 * Extract style properties based on element type
 * @param {Object} element - Element configuration
 * @param {string} elementType - Element type
 * @returns {Object} - Extracted style properties
 */
export function extractElementStyle(element, elementType) {
  const style = element.style || {};

  // Common properties for all element types
  const baseStyle = {
    opacity: style.opacity || 100,
    rotation: style.rotation || 0
  };

  // Text-based elements (text, url)
  if (elementType.includes('text') || elementType === 'url') {
    return {
      ...baseStyle,
      fontSize: style.fontSize || 12,
      color: style.color || (elementType === 'url' ? '#0066cc' : '#000000'),
      bold: style.bold || false,
      italic: style.italic || false,
      width: style.width || 300 // For text wrapping
    };
  }

  // Logo elements
  if (elementType === 'logo' || elementType === 'watermark-logo') {
    return {
      ...baseStyle,
      size: style.size || 80
    };
  }

  // Shape elements
  if (elementType === 'box') {
    return {
      ...baseStyle,
      width: style.width || 100,
      height: style.height || 100,
      color: style.color || '#000000',
      borderWidth: style.borderWidth || 2,
      fillColor: style.fillColor || null
    };
  }

  if (elementType === 'circle') {
    return {
      ...baseStyle,
      radius: (style.size || style.radius || 50) / 2,
      color: style.color || '#000000',
      borderWidth: style.borderWidth || 2,
      fillColor: style.fillColor || null
    };
  }

  // Line elements
  if (elementType === 'line' || elementType === 'dotted-line') {
    return {
      ...baseStyle,
      length: style.length || 100,
      thickness: style.thickness || style.borderWidth || 2,
      color: style.color || '#000000'
    };
  }

  // Default style for unknown element types
  return baseStyle;
}

/**
 * Calculate multi-line text wrapping (shared between PDF and SVG)
 * @param {string} content - Text content
 * @param {number} fontSize - Font size
 * @param {number} maxWidth - Maximum width for wrapping
 * @param {Function} measureTextWidth - Function to measure text width (font.widthOfTextAtSize for PDF)
 * @returns {Object} - Lines and layout information
 */
export function calculateTextLines(content, fontSize, maxWidth, measureTextWidth) {
  const lineHeight = fontSize * 1.2; // 120% line height
  const words = content.split(/\s+/);
  const lines = [];
  let currentLine = '';

  // Simple word wrapping
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWidth(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than maxWidth, add it anyway
        lines.push(word);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return {
    lines,
    lineHeight,
    totalHeight: lines.length * lineHeight
  };
}

/**
 * Calculate rotation transformation for center-based rotation (shared math)
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} rotation - Rotation in degrees
 * @param {number} offsetX - Initial X offset from center
 * @param {number} offsetY - Initial Y offset from center
 * @returns {Object} - Final transformed coordinates
 */
export function calculateRotatedPosition(x, y, rotation, offsetX, offsetY) {
  // Convert to radians and apply coordinate system fix (negate for CSS direction match)
  const rotationRad = (-rotation * Math.PI) / 180;
  const cosTheta = Math.cos(rotationRad);
  const sinTheta = Math.sin(rotationRad);

  // Apply rotation transformation
  const finalX = x + (offsetX * cosTheta + offsetY * sinTheta);
  const finalY = y + (-offsetX * sinTheta + offsetY * cosTheta);

  return { x: finalX, y: finalY };
}

/**
 * Calculate line endpoints with rotation (shared between PDF and SVG)
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} length - Line length
 * @param {number} rotation - Rotation in degrees
 * @returns {Object} - Start and end coordinates
 */
export function calculateLineEndpoints(centerX, centerY, length, rotation) {
  // Calculate horizontal line endpoints centered at (centerX, centerY)
  const startX = centerX - (length / 2);
  const endX = centerX + (length / 2);
  const lineY = centerY;

  // Apply rotation if needed
  if (Math.abs(rotation) > 0.1) {
    const startPos = calculateRotatedPosition(centerX, centerY, rotation, startX - centerX, lineY - centerY);
    const endPos = calculateRotatedPosition(centerX, centerY, rotation, endX - centerX, lineY - centerY);

    return {
      start: { x: startPos.x, y: startPos.y },
      end: { x: endPos.x, y: endPos.y }
    };
  } else {
    return {
      start: { x: startX, y: lineY },
      end: { x: endX, y: lineY }
    };
  }
}

/**
 * Parse hex color to RGB values (returns normalized 0-1 values)
 * @param {string} hex - Hex color string
 * @returns {Object} - RGB values as {r, g, b} normalized to 0-1
 */
export function parseColor(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    };
  }
  return { r: 0, g: 0, b: 0 }; // Fallback to black
}

/**
 * Convert normalized RGB to hex format (for SVG)
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 * @returns {string} - Hex color string
 */
export function rgbToHex(r, g, b) {
  const rHex = Math.round(r * 255).toString(16).padStart(2, '0');
  const gHex = Math.round(g * 255).toString(16).padStart(2, '0');
  const bHex = Math.round(b * 255).toString(16).padStart(2, '0');
  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Check if rotation should be applied (avoids precision issues)
 * @param {number} rotation - Rotation value in degrees
 * @returns {boolean} - Whether to apply rotation
 */
export function shouldApplyRotation(rotation) {
  return Math.abs(rotation) > 0.1;
}

/**
 * Normalize rotation for consistent behavior (coordinate system fix)
 * @param {number} rotation - Original rotation in degrees
 * @returns {number} - Normalized rotation
 */
export function normalizeRotation(rotation) {
  // PDF-lib and CSS have opposite rotation directions
  // CSS: positive angles rotate clockwise
  // PDF-lib: positive angles rotate counter-clockwise
  // SVG: positive angles rotate clockwise (same as CSS)
  // Solution: Return negative for PDF, positive for SVG

  // This function returns the CSS-compatible rotation
  // PDF functions should negate this value, SVG functions should use it directly
  return Math.abs(rotation) < 0.01 ? 0 : rotation;
}