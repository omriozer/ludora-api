/**
 * Coordinate Converter for Template System
 *
 * Abstracts the complex coordinate system conversion between visual editor and PDF
 * Handles Y-axis inversion, rotation calculations, and positioning logic
 */

/**
 * Coordinate Converter class for handling template positioning
 */
export class CoordinateConverter {
  /**
   * Create a coordinate converter
   * @param {number} pageWidth - Page width in points/pixels
   * @param {number} pageHeight - Page height in points/pixels
   */
  constructor(pageWidth, pageHeight) {
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
  }

  /**
   * Convert percentage position from visual editor to PDF coordinates
   *
   * CRITICAL COORDINATE SYSTEM ANALYSIS:
   * - Visual Editor: Y=0 at TOP, Y=100 at BOTTOM (percentage from top)
   * - PDF lib: Y=0 at BOTTOM, Y=height at TOP (coordinate from bottom)
   * - Conversion: PDF_Y = height - (height * editorY% / 100)
   *
   * @param {number} xPercent - X position as percentage (0-100)
   * @param {number} yPercent - Y position as percentage (0-100)
   * @returns {Object} PDF coordinates {x, y}
   */
  percentageToPdf(xPercent, yPercent) {
    const x = (this.pageWidth * xPercent / 100);
    const y = this.pageHeight - (this.pageHeight * yPercent / 100);

    return { x, y };
  }

  /**
   * Convert PDF coordinates to percentage position for visual editor
   * @param {number} x - PDF X coordinate
   * @param {number} y - PDF Y coordinate
   * @returns {Object} Percentage coordinates {xPercent, yPercent}
   */
  pdfToPercentage(x, y) {
    const xPercent = (x / this.pageWidth) * 100;
    const yPercent = ((this.pageHeight - y) / this.pageHeight) * 100;

    return { xPercent, yPercent };
  }

  /**
   * Apply rotation transformation for centered elements
   * Handles the complexity of rotating around element center in PDF coordinate system
   *
   * @param {Object} position - Element position {x, y}
   * @param {Object} size - Element size {width, height}
   * @param {number} rotation - Rotation in degrees
   * @returns {Object} Transformed position for PDF rendering
   */
  applyRotationTransform(position, size, rotation) {
    // Normalize rotation to avoid precision issues
    const normalizedRotation = this.normalizeRotation(rotation);

    // For very small rotations, return simple centered position
    if (Math.abs(normalizedRotation) < 0.1) {
      return {
        x: position.x - (size.width / 2),
        y: position.y - (size.height / 2),
        rotation: 0
      };
    }

    // Calculate center-based rotation transformation
    const centerX = position.x;
    const centerY = position.y;

    // Calculate text origin that will center the element at (centerX, centerY) BEFORE rotation
    const originX = centerX - (size.width / 2);
    const originY = centerY - (size.height / 2);

    // Calculate the offset from the desired center to the element origin
    const offsetX = originX - centerX;
    const offsetY = originY - centerY;

    // Apply rotation transformation to find where the origin should be
    // so that after PDF-lib rotates around it, the element appears centered
    const rotationRad = (normalizedRotation * Math.PI) / 180;
    const cosTheta = Math.cos(rotationRad);
    const sinTheta = Math.sin(rotationRad);

    // Reverse rotation to find original position
    const finalX = centerX + (offsetX * cosTheta + offsetY * sinTheta);
    const finalY = centerY + (-offsetX * sinTheta + offsetY * cosTheta);

    return {
      x: finalX,
      y: finalY,
      rotation: normalizedRotation
    };
  }

  /**
   * Normalize rotation to handle coordinate system differences
   * PDF-lib and CSS have opposite rotation directions
   *
   * @param {number} rotation - Original rotation in degrees
   * @returns {number} Normalized rotation for PDF
   */
  normalizeRotation(rotation) {
    // CSS: positive angles rotate clockwise
    // PDF-lib: positive angles rotate counter-clockwise
    // Solution: Negate the rotation to match CSS behavior
    let finalRotation = -rotation;

    // Force zero for very small values to avoid precision issues
    if (Math.abs(rotation) < 0.01) {
      finalRotation = 0;
    }

    return finalRotation;
  }

  /**
   * Calculate shadow offset position
   * @param {Object} position - Original position {x, y}
   * @param {Object} shadowOffset - Shadow offset {offsetX, offsetY}
   * @param {Object} size - Element size {width, height}
   * @returns {Object} Shadow position
   */
  calculateShadowPosition(position, shadowOffset, size) {
    return {
      x: position.x + shadowOffset.offsetX - (size.width / 2),
      y: position.y - shadowOffset.offsetY - (size.height / 2)
    };
  }

  /**
   * Apply rotation to shadow position
   * @param {Object} position - Original position {x, y}
   * @param {Object} shadowOffset - Shadow offset {offsetX, offsetY}
   * @param {Object} size - Element size {width, height}
   * @param {number} rotation - Rotation in degrees
   * @returns {Object} Rotated shadow position
   */
  applyShadowRotation(position, shadowOffset, size, rotation) {
    const normalizedRotation = this.normalizeRotation(rotation);
    const centerX = position.x;
    const centerY = position.y;

    const shadowOriginX = centerX + shadowOffset.offsetX - (size.width / 2);
    const shadowOriginY = centerY - shadowOffset.offsetY - (size.height / 2);

    const shadowOffsetX = shadowOriginX - centerX;
    const shadowOffsetY = shadowOriginY - centerY;

    const rotationRad = (normalizedRotation * Math.PI) / 180;
    const cosTheta = Math.cos(rotationRad);
    const sinTheta = Math.sin(rotationRad);

    const finalShadowX = centerX + (shadowOffsetX * cosTheta + shadowOffsetY * sinTheta);
    const finalShadowY = centerY + (-shadowOffsetX * sinTheta + shadowOffsetY * cosTheta);

    return {
      x: finalShadowX,
      y: finalShadowY,
      rotation: normalizedRotation
    };
  }

  /**
   * Calculate line endpoints with rotation
   * @param {Object} position - Center position {x, y}
   * @param {number} length - Line length
   * @param {number} rotation - Rotation in degrees
   * @returns {Object} Line endpoints {start: {x, y}, end: {x, y}}
   */
  calculateLineEndpoints(position, length, rotation) {
    const centerX = position.x;
    const centerY = position.y;
    const normalizedRotation = this.normalizeRotation(rotation);

    // Calculate horizontal line endpoints (before rotation)
    let startX = centerX - (length / 2);
    let endX = centerX + (length / 2);
    let startY = centerY;
    let endY = centerY;

    // Apply rotation if needed
    if (Math.abs(normalizedRotation) > 0.1) {
      const rotationRad = (normalizedRotation * Math.PI) / 180;
      const cosTheta = Math.cos(rotationRad);
      const sinTheta = Math.sin(rotationRad);

      // Rotate start point
      const startOffsetX = startX - centerX;
      const startOffsetY = startY - centerY;
      startX = centerX + (startOffsetX * cosTheta - startOffsetY * sinTheta);
      startY = centerY + (startOffsetX * sinTheta + startOffsetY * cosTheta);

      // Rotate end point
      const endOffsetX = endX - centerX;
      const endOffsetY = endY - centerY;
      endX = centerX + (endOffsetX * cosTheta - endOffsetY * sinTheta);
      endY = centerY + (endOffsetX * sinTheta + endOffsetY * cosTheta);
    }

    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    };
  }

  /**
   * Get debug information for positioning
   * @param {Object} element - Element with position data
   * @param {string} elementType - Type of element
   * @returns {Object} Debug information
   */
  getPositionDebug(element, elementType) {
    const elementXPercent = element.position?.x || 50;
    const elementYPercent = element.position?.y || 50;
    const pdfCoords = this.percentageToPdf(elementXPercent, elementYPercent);

    return {
      elementId: element.id,
      elementType: elementType,
      templatePosition: { x: elementXPercent, y: elementYPercent },
      pageSize: { width: this.pageWidth, height: this.pageHeight },
      calculatedPdfCoords: pdfCoords,
      coordinateInfo: {
        xPercent: `${elementXPercent}% from left`,
        yPercent: `${elementYPercent}% from top`,
        pdfX: `${pdfCoords.x.toFixed(1)} pixels from left`,
        pdfY: `${pdfCoords.y.toFixed(1)} pixels from bottom`
      }
    };
  }

  /**
   * Create a new converter with different page dimensions
   * @param {number} width - New page width
   * @param {number} height - New page height
   * @returns {CoordinateConverter} New converter instance
   */
  withDimensions(width, height) {
    return new CoordinateConverter(width, height);
  }
}

/**
 * Create coordinate converter for standard page formats
 */
export const PAGE_FORMATS = {
  A4_PORTRAIT: { width: 595, height: 842 },
  A4_LANDSCAPE: { width: 842, height: 595 },
  SVG_LESSONPLAN: { width: 800, height: 600 }
};

/**
 * Create coordinate converter for a specific format
 * @param {string} format - Format name ('a4-portrait', 'a4-landscape', 'svg')
 * @returns {CoordinateConverter} Converter for the format
 */
export function createConverter(format) {
  switch (format) {
    case 'pdf-a4-portrait':
      return new CoordinateConverter(PAGE_FORMATS.A4_PORTRAIT.width, PAGE_FORMATS.A4_PORTRAIT.height);
    case 'pdf-a4-landscape':
      return new CoordinateConverter(PAGE_FORMATS.A4_LANDSCAPE.width, PAGE_FORMATS.A4_LANDSCAPE.height);
    case 'svg':
    case 'svg-lessonplan':
      return new CoordinateConverter(PAGE_FORMATS.SVG_LESSONPLAN.width, PAGE_FORMATS.SVG_LESSONPLAN.height);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export default CoordinateConverter;