/**
 * Unified SVG Template Merge Utility
 *
 * Applies templates (branding OR watermark - identical rendering logic) to SVG files
 * Using the same template structure and positioning as the visual editor and PDF system
 *
 * UNIFIED APPROACH: Uses shared template utilities and matches PDF functionality
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import fs from 'fs';
import path from 'path';
import {
  processTemplateElements,
  parseColor,
  rgbToHex,
  shouldApplyRotation,
  normalizeRotation,
  calculateTextLines,
  calculateRotatedPosition,
  calculateLineEndpoints
} from './templateUtils.js';
import { loadLogo } from './AssetManager.js';
import { createFontSelector } from './FontSelector.js';
import { getCanvasDimensions } from './canvasDimensions.js';

/**
 * Apply template to SVG - UNIFIED for both branding and watermark templates
 * @param {string} svgContent - Original SVG content
 * @param {Object} templateSettings - Template settings with unified elements structure
 * @param {Object} variables - Variables for text substitution
 * @param {Object} options - Options (future extensibility)
 * @returns {Promise<string>} - SVG with template applied
 */
async function mergeSvgTemplate(svgContent, templateSettings, variables = {}, options = {}) {
  try {
    if (!templateSettings || typeof templateSettings !== 'object') {
      return svgContent;
    }

    if (!svgContent) {
      return svgContent; // Return early if no content
    }

    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    if (!svgElement || svgElement.tagName !== 'svg') {
      throw new Error('Invalid SVG content: No root SVG element found');
    }

    // Get SVG dimensions and viewBox
    const svgDimensions = extractSvgDimensions(svgElement);

    // Create template group container
    const templateGroup = createTemplateGroup(svgDoc);

    // Create font selector for text elements (SVG doesn't need actual font loading)
    const fontSelector = createFontSelector({}, {}); // Empty font objects for SVG

    // Prepare page info for shared template processing
    const pageInfo = {
      width: svgDimensions.viewBox.width,
      height: svgDimensions.viewBox.height,
      pageNumber: 1,
      totalPages: 1
    };

    // Custom render function for SVG elements
    async function renderSvgElement(elementType, element, elementInfo, pageVariables) {
      try {
        // Convert coordinates to SVG coordinate system
        const svgCoords = convertToSvgCoordinates(elementInfo, svgDimensions);

        switch (elementType) {
          case 'logo':
          case 'watermark-logo':
            await createSvgLogo(svgDoc, templateGroup, element, svgCoords, elementInfo);
            break;

          case 'text':
          case 'copyright-text':
          case 'free-text':
          case 'user-info':
          case 'watermark-text':
            await createSvgText(svgDoc, templateGroup, element, svgCoords, elementInfo, pageVariables);
            break;

          case 'url':
            await createSvgUrl(svgDoc, templateGroup, element, svgCoords, elementInfo, pageVariables);
            break;

          case 'box':
            await createSvgBox(svgDoc, templateGroup, element, svgCoords, elementInfo);
            break;

          case 'circle':
            await createSvgCircle(svgDoc, templateGroup, element, svgCoords, elementInfo);
            break;

          case 'line':
          case 'dotted-line':
            await createSvgLine(svgDoc, templateGroup, element, svgCoords, elementInfo);
            break;

          default:
            // Skip unknown element types silently
            break;
        }

      } catch (error) {
        throw new Error(`Failed to render ${elementType} element: ${error.message}`);
      }
    }

    // Use shared template processing utilities
    await processTemplateElements(
      templateSettings,
      renderSvgElement,
      pageInfo,
      variables,
      fontSelector
    );

    // Insert template group into SVG
    svgElement.appendChild(templateGroup);

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgDoc);

  } catch (error) {
    throw new Error(`SVG template merge failed: ${error.message}`);
  }
}

/**
 * Extract SVG dimensions and viewBox information
 * @param {Element} svgElement - SVG root element
 * @returns {Object} - Dimensions and scaling info
 */
function extractSvgDimensions(svgElement) {
  // Get fallback dimensions for SVG slides
  const fallbackDimensions = getCanvasDimensions('svg-lessonplan');
  const width = parseFloat(svgElement.getAttribute('width')) || fallbackDimensions.width;
  const height = parseFloat(svgElement.getAttribute('height')) || fallbackDimensions.height;

  const viewBox = svgElement.getAttribute('viewBox');
  let viewBoxData = { x: 0, y: 0, width, height };

  if (viewBox) {
    const values = viewBox.split(/\s+|,/).map(Number);
    if (values.length === 4) {
      viewBoxData = {
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3]
      };
    }
  }

  return {
    width,
    height,
    viewBox: viewBoxData,
    scaleX: viewBoxData.width / width,
    scaleY: viewBoxData.height / height
  };
}

/**
 * Create template group container (equivalent to watermark group)
 * @param {Document} svgDoc - SVG document
 * @returns {Element} - Template group element
 */
function createTemplateGroup(svgDoc) {
  const group = svgDoc.createElement('g');
  group.setAttribute('id', 'ludora-templates');
  group.setAttribute('class', 'template-layer');
  return group;
}

/**
 * Convert shared coordinate system to SVG coordinates
 * @param {Object} elementInfo - Element information from shared utilities
 * @param {Object} svgDimensions - SVG dimensions
 * @returns {Object} - SVG coordinate information
 */
function convertToSvgCoordinates(elementInfo, svgDimensions) {
  // The shared utilities provide PDF coordinates (Y=0 at bottom)
  // SVG uses Y=0 at top, so we need to convert

  // Convert from PDF coordinate system to SVG coordinate system
  // In PDF: Y=0 is at bottom, Y increases upward
  // In SVG: Y=0 is at top, Y increases downward

  const svgX = elementInfo.x;
  const svgY = svgDimensions.viewBox.height - elementInfo.y; // Flip Y axis

  return {
    x: svgX,
    y: svgY,
    originalPdfX: elementInfo.x,
    originalPdfY: elementInfo.y
  };
}

/**
 * Create SVG text element
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - Text element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 * @param {Object} variables - Variables for substitution
 */
async function createSvgText(svgDoc, templateGroup, element, svgCoords, elementInfo, variables) {
  if (!elementInfo.content || !elementInfo.content.trim()) {
    return; // Skip empty content
  }

  const { style, shadowSettings } = elementInfo;

  // Handle multi-line text if content is long or contains line breaks
  if (elementInfo.content.length > 50 || elementInfo.content.includes('\n')) {
    await createMultiLineSvgText(svgDoc, templateGroup, elementInfo.content, svgCoords, style, elementInfo);
  } else {
    // Render shadow text first if enabled
    if (shadowSettings) {
      const shadowTextEl = svgDoc.createElement('text');
      shadowTextEl.setAttribute('x', svgCoords.x + shadowSettings.offsetX);
      shadowTextEl.setAttribute('y', svgCoords.y + shadowSettings.offsetY);
      shadowTextEl.setAttribute('text-anchor', 'middle');
      shadowTextEl.setAttribute('dominant-baseline', 'middle');

      // Apply shadow styling (same as main text but with shadow color/opacity)
      applySvgTextStyle(shadowTextEl, {
        ...style,
        color: shadowSettings.color,
        opacity: shadowSettings.opacity
      });

      // Apply rotation if needed
      if (shouldApplyRotation(elementInfo.rotation)) {
        const rotation = normalizeRotation(elementInfo.rotation);
        shadowTextEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
      }

      shadowTextEl.textContent = elementInfo.content;
      templateGroup.appendChild(shadowTextEl);
    }

    // Single line text (main text on top of shadow)
    const textEl = svgDoc.createElement('text');

    textEl.setAttribute('x', svgCoords.x);
    textEl.setAttribute('y', svgCoords.y);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');

    // Apply styling
    applySvgTextStyle(textEl, style);

    // Apply rotation if needed
    if (shouldApplyRotation(elementInfo.rotation)) {
      const rotation = normalizeRotation(elementInfo.rotation); // SVG uses same rotation as CSS
      textEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
    }

    // Set text content
    textEl.textContent = elementInfo.content;

    templateGroup.appendChild(textEl);
  }
}

/**
 * Create SVG URL element (similar to text but with link if possible)
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - URL element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 * @param {Object} variables - Variables for substitution
 */
async function createSvgUrl(svgDoc, templateGroup, element, svgCoords, elementInfo, variables) {
  if (!elementInfo.content || !elementInfo.content.trim()) {
    return; // Skip empty content
  }

  const { style, shadowSettings } = elementInfo;

  // Render shadow text first if enabled
  if (shadowSettings) {
    const shadowTextEl = svgDoc.createElement('text');
    shadowTextEl.setAttribute('x', svgCoords.x + shadowSettings.offsetX);
    shadowTextEl.setAttribute('y', svgCoords.y + shadowSettings.offsetY);
    shadowTextEl.setAttribute('text-anchor', 'middle');
    shadowTextEl.setAttribute('dominant-baseline', 'middle');

    // Apply shadow styling
    applySvgTextStyle(shadowTextEl, {
      ...style,
      color: shadowSettings.color,
      opacity: shadowSettings.opacity
    });

    // Apply rotation if needed
    if (shouldApplyRotation(elementInfo.rotation)) {
      const rotation = normalizeRotation(elementInfo.rotation);
      shadowTextEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
    }

    shadowTextEl.textContent = elementInfo.content;
    templateGroup.appendChild(shadowTextEl);
  }

  // Create main text element for URL (SVG links are complex, just render as text for now)
  const textEl = svgDoc.createElement('text');

  textEl.setAttribute('x', svgCoords.x);
  textEl.setAttribute('y', svgCoords.y);
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('dominant-baseline', 'middle');

  // Apply URL-specific styling (similar to text but with URL defaults)
  applySvgTextStyle(textEl, style);

  // Apply rotation if needed
  if (shouldApplyRotation(elementInfo.rotation)) {
    const rotation = normalizeRotation(elementInfo.rotation);
    textEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
  }

  textEl.textContent = elementInfo.content;

  templateGroup.appendChild(textEl);
}

/**
 * Create SVG drop shadow filter for proper shadow rendering
 * @param {Document} svgDoc - SVG document
 * @param {Object} shadowSettings - Shadow configuration from element
 * @param {number} _elementOpacity - Opacity of the main element (unused, kept for API compatibility)
 * @returns {string} - Filter ID to reference in elements
 */
function createSvgDropShadowFilter(svgDoc, shadowSettings, _elementOpacity) {
  // Generate unique filter ID based on shadow settings
  const filterId = `shadow-${Math.random().toString(36).substr(2, 9)}`;

  // Get or create SVG defs section
  let defs = svgDoc.getElementsByTagName('defs')[0];
  if (!defs) {
    defs = svgDoc.createElement('defs');
    svgDoc.documentElement.insertBefore(defs, svgDoc.documentElement.firstChild);
  }

  // Create filter element
  const filter = svgDoc.createElement('filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');

  // feGaussianBlur: Create the blur for the shadow
  const blur = svgDoc.createElement('feGaussianBlur');
  blur.setAttribute('in', 'SourceAlpha');
  blur.setAttribute('stdDeviation', shadowSettings.blur || 0);
  blur.setAttribute('result', 'blur');

  // feOffset: Offset the shadow by the specified amounts
  const offset = svgDoc.createElement('feOffset');
  offset.setAttribute('in', 'blur');
  offset.setAttribute('dx', shadowSettings.offsetX || 0);
  offset.setAttribute('dy', shadowSettings.offsetY || 0);
  offset.setAttribute('result', 'offsetBlur');

  // feFlood: Set the shadow color
  const flood = svgDoc.createElement('feFlood');
  flood.setAttribute('flood-color', shadowSettings.color || '#000000');
  flood.setAttribute('flood-opacity', (shadowSettings.opacity || 50) / 100);
  flood.setAttribute('result', 'shadowColor');

  // feComposite: Combine the shadow color with the offset blur
  const composite = svgDoc.createElement('feComposite');
  composite.setAttribute('in', 'shadowColor');
  composite.setAttribute('in2', 'offsetBlur');
  composite.setAttribute('operator', 'in');
  composite.setAttribute('result', 'shadow');

  // feMerge: Layer the shadow behind the original graphic
  const merge = svgDoc.createElement('feMerge');

  const mergeShadow = svgDoc.createElement('feMergeNode');
  mergeShadow.setAttribute('in', 'shadow');

  const mergeOriginal = svgDoc.createElement('feMergeNode');
  mergeOriginal.setAttribute('in', 'SourceGraphic');

  merge.appendChild(mergeShadow);
  merge.appendChild(mergeOriginal);

  // Assemble the filter
  filter.appendChild(blur);
  filter.appendChild(offset);
  filter.appendChild(flood);
  filter.appendChild(composite);
  filter.appendChild(merge);

  defs.appendChild(filter);

  return filterId;
}

/**
 * Create SVG logo element
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - Logo element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 */
async function createSvgLogo(svgDoc, templateGroup, element, svgCoords, elementInfo) {
  try {
    const { style, shadowSettings } = elementInfo;
    const logoSize = style.size || 80;

    // Use AssetManager for logo loading (same as PDF)
    const logoAsset = await loadLogo({
      source: 'file', // Support for different sources: file, url, base64
      size: logoSize
    });

    // Handle logo rendering based on asset type
    if (logoAsset && !logoAsset.fallback && logoAsset.data) {
      try {
        // Convert logo data to data URL for SVG embedding
        let dataUrl;
        if (logoAsset.type === 'png') {
          dataUrl = `data:image/png;base64,${logoAsset.data.toString('base64')}`;
        } else if (logoAsset.type === 'jpeg') {
          dataUrl = `data:image/jpeg;base64,${logoAsset.data.toString('base64')}`;
        } else {
          throw new Error(`Unsupported image format: ${logoAsset.type}`);
        }

        // Create SVG filter for proper drop shadow if shadow is enabled
        let filterId = null;
        if (shadowSettings) {
          filterId = createSvgDropShadowFilter(svgDoc, shadowSettings, elementInfo.opacity);
        }

        // Create main SVG image element with shadow filter
        const imageEl = svgDoc.createElement('image');

        // Position centered at coordinates
        imageEl.setAttribute('x', svgCoords.x - (logoSize / 2));
        imageEl.setAttribute('y', svgCoords.y - (logoSize / 2));
        imageEl.setAttribute('width', logoSize);
        imageEl.setAttribute('height', logoSize);
        imageEl.setAttribute('opacity', elementInfo.opacity);

        // Apply shadow filter if created
        if (filterId) {
          imageEl.setAttribute('filter', `url(#${filterId})`);
        }

        imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);

        // Apply rotation if needed
        if (shouldApplyRotation(elementInfo.rotation)) {
          const rotation = normalizeRotation(elementInfo.rotation);
          imageEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
        }

        templateGroup.appendChild(imageEl);
        return; // Successfully rendered image

      } catch (imageError) {
        // Fall through to text fallback
      }
    }

    // Fallback: render text placeholder
    if (logoAsset && logoAsset.fallback) {
      const logoText = logoAsset.text || 'LOGO';
      const fontSize = logoSize / 4;

      // Use fallback color from AssetManager
      const fallbackColor = rgbToHex(
        logoAsset.color?.r || 0.2,
        logoAsset.color?.g || 0.4,
        logoAsset.color?.b || 0.8
      );

      // Create SVG filter for text shadow if enabled
      let filterId = null;
      if (shadowSettings) {
        filterId = createSvgDropShadowFilter(svgDoc, shadowSettings, elementInfo.opacity);
      }

      // Render main fallback text with shadow filter
      const textEl = svgDoc.createElement('text');
      textEl.setAttribute('x', svgCoords.x);
      textEl.setAttribute('y', svgCoords.y);
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('dominant-baseline', 'middle');
      textEl.setAttribute('font-family', 'Arial, sans-serif');
      textEl.setAttribute('font-size', fontSize);
      textEl.setAttribute('font-weight', 'bold');
      textEl.setAttribute('opacity', elementInfo.opacity);
      textEl.setAttribute('fill', fallbackColor);

      // Apply shadow filter if created
      if (filterId) {
        textEl.setAttribute('filter', `url(#${filterId})`);
      }

      // Apply rotation if needed
      if (shouldApplyRotation(elementInfo.rotation)) {
        const rotation = normalizeRotation(elementInfo.rotation);
        textEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
      }

      textEl.textContent = logoText;
      templateGroup.appendChild(textEl);
    }

  } catch (error) {
    throw new Error(`SVG Logo render failed: ${error.message}`);
  }
}

/**
 * Create SVG box (rectangle) element
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - Box element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 */
async function createSvgBox(svgDoc, templateGroup, element, svgCoords, elementInfo) {
  const { style, shadowSettings } = elementInfo;

  // Render shadow box first if enabled
  if (shadowSettings) {
    const shadowRectEl = svgDoc.createElement('rect');
    shadowRectEl.setAttribute('x', svgCoords.x - (style.width / 2) + shadowSettings.offsetX);
    shadowRectEl.setAttribute('y', svgCoords.y - (style.height / 2) + shadowSettings.offsetY);
    shadowRectEl.setAttribute('width', style.width);
    shadowRectEl.setAttribute('height', style.height);
    shadowRectEl.setAttribute('fill', style.fillColor || 'none');
    shadowRectEl.setAttribute('stroke', shadowSettings.color);
    shadowRectEl.setAttribute('stroke-width', style.borderWidth || 2);
    shadowRectEl.setAttribute('opacity', shadowSettings.opacity / 100);

    // Apply rotation if needed
    if (shouldApplyRotation(elementInfo.rotation)) {
      const rotation = normalizeRotation(elementInfo.rotation);
      shadowRectEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
    }

    templateGroup.appendChild(shadowRectEl);
  }

  // Create main box element
  const rectEl = svgDoc.createElement('rect');

  // Position centered at coordinates
  rectEl.setAttribute('x', svgCoords.x - (style.width / 2));
  rectEl.setAttribute('y', svgCoords.y - (style.height / 2));
  rectEl.setAttribute('width', style.width);
  rectEl.setAttribute('height', style.height);

  // Apply styling
  rectEl.setAttribute('fill', style.fillColor || 'none');
  rectEl.setAttribute('stroke', style.color || '#000000');
  rectEl.setAttribute('stroke-width', style.borderWidth || 2);
  rectEl.setAttribute('opacity', elementInfo.opacity);

  // Apply rotation if needed
  if (shouldApplyRotation(elementInfo.rotation)) {
    const rotation = normalizeRotation(elementInfo.rotation);
    rectEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
  }

  templateGroup.appendChild(rectEl);
}

/**
 * Create SVG circle element
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - Circle element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 */
async function createSvgCircle(svgDoc, templateGroup, element, svgCoords, elementInfo) {
  const { style, shadowSettings } = elementInfo;

  // Render shadow circle first if enabled
  if (shadowSettings) {
    const shadowCircleEl = svgDoc.createElement('circle');
    shadowCircleEl.setAttribute('cx', svgCoords.x + shadowSettings.offsetX);
    shadowCircleEl.setAttribute('cy', svgCoords.y + shadowSettings.offsetY);
    shadowCircleEl.setAttribute('r', style.radius);
    shadowCircleEl.setAttribute('fill', style.fillColor || 'none');
    shadowCircleEl.setAttribute('stroke', shadowSettings.color);
    shadowCircleEl.setAttribute('stroke-width', style.borderWidth || 2);
    shadowCircleEl.setAttribute('opacity', shadowSettings.opacity / 100);

    // Note: Circles don't typically need rotation, but SVG supports it if needed
    if (shouldApplyRotation(elementInfo.rotation)) {
      const rotation = normalizeRotation(elementInfo.rotation);
      shadowCircleEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
    }

    templateGroup.appendChild(shadowCircleEl);
  }

  // Create main circle element
  const circleEl = svgDoc.createElement('circle');

  // Position centered at coordinates
  circleEl.setAttribute('cx', svgCoords.x);
  circleEl.setAttribute('cy', svgCoords.y);
  circleEl.setAttribute('r', style.radius);

  // Apply styling
  circleEl.setAttribute('fill', style.fillColor || 'none');
  circleEl.setAttribute('stroke', style.color || '#000000');
  circleEl.setAttribute('stroke-width', style.borderWidth || 2);
  circleEl.setAttribute('opacity', elementInfo.opacity);

  // Note: Circles don't typically need rotation, but SVG supports it if needed
  if (shouldApplyRotation(elementInfo.rotation)) {
    const rotation = normalizeRotation(elementInfo.rotation);
    circleEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
  }

  templateGroup.appendChild(circleEl);
}

/**
 * Create SVG line element (solid or dotted)
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {Object} element - Line element configuration
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} elementInfo - Element info from shared utilities
 */
async function createSvgLine(svgDoc, templateGroup, element, svgCoords, elementInfo) {
  const { style, shadowSettings } = elementInfo;

  // Calculate line endpoints using shared utility
  const endpoints = calculateLineEndpoints(
    svgCoords.originalPdfX, // Use original PDF coordinates for calculation
    svgCoords.originalPdfY,
    style.length,
    elementInfo.rotation
  );

  // Convert endpoints to SVG coordinate system
  const svgStart = {
    x: endpoints.start.x,
    y: svgCoords.y - (endpoints.start.y - svgCoords.originalPdfY) // Apply Y-flip for SVG
  };
  const svgEnd = {
    x: endpoints.end.x,
    y: svgCoords.y - (endpoints.end.y - svgCoords.originalPdfY) // Apply Y-flip for SVG
  };

  // Render shadow line first if enabled
  if (shadowSettings) {
    const shadowLineEl = svgDoc.createElement('line');
    shadowLineEl.setAttribute('x1', svgStart.x + shadowSettings.offsetX);
    shadowLineEl.setAttribute('y1', svgStart.y + shadowSettings.offsetY);
    shadowLineEl.setAttribute('x2', svgEnd.x + shadowSettings.offsetX);
    shadowLineEl.setAttribute('y2', svgEnd.y + shadowSettings.offsetY);
    shadowLineEl.setAttribute('stroke', shadowSettings.color);
    shadowLineEl.setAttribute('stroke-width', style.thickness || 2);
    shadowLineEl.setAttribute('opacity', shadowSettings.opacity / 100);

    // Handle dotted line
    if (element.type === 'dotted-line') {
      shadowLineEl.setAttribute('stroke-dasharray', '3,3');
    }

    templateGroup.appendChild(shadowLineEl);
  }

  // Create main line element
  const lineEl = svgDoc.createElement('line');

  // Set line coordinates
  lineEl.setAttribute('x1', svgStart.x);
  lineEl.setAttribute('y1', svgStart.y);
  lineEl.setAttribute('x2', svgEnd.x);
  lineEl.setAttribute('y2', svgEnd.y);

  // Apply styling
  lineEl.setAttribute('stroke', style.color || '#000000');
  lineEl.setAttribute('stroke-width', style.thickness || 2);
  lineEl.setAttribute('opacity', elementInfo.opacity);

  // Handle dotted line
  if (element.type === 'dotted-line') {
    lineEl.setAttribute('stroke-dasharray', '3,3');
  }

  templateGroup.appendChild(lineEl);
}

/**
 * Create multi-line SVG text with word wrapping
 * @param {Document} svgDoc - SVG document
 * @param {Element} templateGroup - Template container group
 * @param {string} content - Text content
 * @param {Object} svgCoords - SVG coordinates
 * @param {Object} style - Text styling
 * @param {Object} elementInfo - Element info from shared utilities
 */
async function createMultiLineSvgText(svgDoc, templateGroup, content, svgCoords, style, elementInfo) {
  const { shadowSettings } = elementInfo;

  // For SVG, we need a simple text width measurement function
  // This is an approximation since we don't have actual font metrics in SVG processing
  const approximateTextWidth = (text, fontSize) => {
    // Rough approximation: average character width is about 0.6 * fontSize
    return text.length * fontSize * 0.6;
  };

  // Use shared text line calculation
  const textLayout = calculateTextLines(
    content,
    style.fontSize,
    style.width,
    approximateTextWidth
  );

  // Render shadow text first if enabled
  if (shadowSettings) {
    const shadowTextEl = svgDoc.createElement('text');
    shadowTextEl.setAttribute('x', svgCoords.x + shadowSettings.offsetX);
    shadowTextEl.setAttribute('y', svgCoords.y - (textLayout.totalHeight / 2) + shadowSettings.offsetY);
    shadowTextEl.setAttribute('text-anchor', 'middle');

    // Apply shadow styling
    applySvgTextStyle(shadowTextEl, {
      ...style,
      color: shadowSettings.color,
      opacity: shadowSettings.opacity
    });

    // Apply rotation if needed
    if (shouldApplyRotation(elementInfo.rotation)) {
      const rotation = normalizeRotation(elementInfo.rotation);
      shadowTextEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
    }

    // Add each line as a tspan element
    for (let i = 0; i < textLayout.lines.length; i++) {
      const line = textLayout.lines[i];
      const tspanEl = svgDoc.createElement('tspan');

      tspanEl.setAttribute('x', svgCoords.x + shadowSettings.offsetX);
      tspanEl.setAttribute('dy', i === 0 ? '0.8em' : '1.2em');

      tspanEl.textContent = line;
      shadowTextEl.appendChild(tspanEl);
    }

    templateGroup.appendChild(shadowTextEl);
  }

  // Create main SVG text element with multiple tspan elements for each line
  const textEl = svgDoc.createElement('text');
  textEl.setAttribute('x', svgCoords.x);
  textEl.setAttribute('y', svgCoords.y - (textLayout.totalHeight / 2)); // Start from top of text block
  textEl.setAttribute('text-anchor', 'middle');

  // Apply styling to parent text element
  applySvgTextStyle(textEl, style);

  // Apply rotation if needed
  if (shouldApplyRotation(elementInfo.rotation)) {
    const rotation = normalizeRotation(elementInfo.rotation);
    textEl.setAttribute('transform', `rotate(${rotation} ${svgCoords.x} ${svgCoords.y})`);
  }

  // Add each line as a tspan element
  for (let i = 0; i < textLayout.lines.length; i++) {
    const line = textLayout.lines[i];
    const tspanEl = svgDoc.createElement('tspan');

    tspanEl.setAttribute('x', svgCoords.x);
    tspanEl.setAttribute('dy', i === 0 ? '0.8em' : '1.2em'); // First line offset, then line height

    tspanEl.textContent = line;
    textEl.appendChild(tspanEl);
  }

  templateGroup.appendChild(textEl);
}

/**
 * Apply text styling to SVG text element
 * @param {Element} textEl - SVG text element
 * @param {Object} style - Text styling options
 */
function applySvgTextStyle(textEl, style) {
  textEl.setAttribute('font-family', 'Arial, sans-serif'); // Default font for SVG
  textEl.setAttribute('font-size', style.fontSize || 12);
  textEl.setAttribute('fill', style.color || '#000000');
  textEl.setAttribute('opacity', (style.opacity || 100) / 100);

  if (style.bold) {
    textEl.setAttribute('font-weight', 'bold');
  }

  if (style.italic) {
    textEl.setAttribute('font-style', 'italic');
  }
}

export {
  mergeSvgTemplate
};