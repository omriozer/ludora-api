/**
 * SVG Watermark Processing Engine
 *
 * Processes SVG content to inject template-based watermarks for preview mode.
 * Supports text elements, logo elements, multiple patterns, and preserves original SVG structure.
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import fs from 'fs';
import path from 'path';

/**
 * SVG Watermark Processor Class
 */
class SvgWatermarkProcessor {
  constructor() {
    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
  }

  /**
   * Apply watermarks to SVG content based on template
   * @param {string} svgContent - Original SVG content
   * @param {Object} watermarkTemplate - Template data with textElements and logoElements
   * @param {Object} variables - Variables to substitute in text content (e.g., {{filename}})
   * @returns {Promise<string>} - Watermarked SVG content
   */
  async applyWatermarks(svgContent, watermarkTemplate, variables = {}) {
    try {
      // Parse SVG content
      const svgDoc = this.parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      if (!svgElement || svgElement.tagName !== 'svg') {
        throw new Error('Invalid SVG content: No root SVG element found');
      }

      // Get SVG dimensions and viewBox
      const svgDimensions = this.extractSvgDimensions(svgElement);

      // Create watermark group
      const watermarkGroup = this.createWatermarkGroup(svgDoc, watermarkTemplate.globalSettings);

      // Process text elements
      if (watermarkTemplate.textElements) {
        for (const textElement of watermarkTemplate.textElements) {
          if (textElement.visible) {
            await this.addTextWatermarks(svgDoc, watermarkGroup, textElement, svgDimensions, variables);
          }
        }
      }

      // Process logo elements
      if (watermarkTemplate.logoElements) {
        for (const logoElement of watermarkTemplate.logoElements) {
          if (logoElement.visible) {
            await this.addLogoWatermarks(svgDoc, watermarkGroup, logoElement, svgDimensions);
          }
        }
      }

      // Insert watermark group into SVG
      const insertPosition = watermarkTemplate.globalSettings?.layerBehindContent ? 'first' : 'last';
      this.insertWatermarkGroup(svgElement, watermarkGroup, insertPosition);

      // Serialize back to string
      return this.serializer.serializeToString(svgDoc);

    } catch (error) {
      console.error('Error applying SVG watermarks:', error);
      throw new Error(`SVG watermark processing failed: ${error.message}`);
    }
  }

  /**
   * Extract SVG dimensions and viewBox information
   * @param {Element} svgElement - SVG root element
   * @returns {Object} - Dimensions and scaling info
   */
  extractSvgDimensions(svgElement) {
    const width = parseFloat(svgElement.getAttribute('width')) || 800;
    const height = parseFloat(svgElement.getAttribute('height')) || 600;

    let viewBox = svgElement.getAttribute('viewBox');
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
   * Create watermark group container
   * @param {Document} svgDoc - SVG document
   * @param {Object} globalSettings - Global watermark settings
   * @returns {Element} - Watermark group element
   */
  createWatermarkGroup(svgDoc, globalSettings = {}) {
    const group = svgDoc.createElement('g');
    group.setAttribute('id', 'ludora-watermarks');
    group.setAttribute('class', 'watermark-layer');

    if (globalSettings.layerBehindContent) {
      group.setAttribute('opacity', '0.6');
    }

    return group;
  }

  /**
   * Add text watermarks based on element configuration
   * @param {Document} svgDoc - SVG document
   * @param {Element} watermarkGroup - Watermark container group
   * @param {Object} textElement - Text element configuration
   * @param {Object} svgDimensions - SVG dimensions info
   * @param {Object} variables - Variables for text substitution
   */
  async addTextWatermarks(svgDoc, watermarkGroup, textElement, svgDimensions, variables) {
    const content = this.substituteVariables(textElement.content, variables);
    const positions = this.calculateElementPositions(textElement, svgDimensions);

    for (const position of positions) {
      const textEl = this.createTextElement(svgDoc, content, textElement.style, position);
      watermarkGroup.appendChild(textEl);
    }
  }

  /**
   * Add logo watermarks based on element configuration
   * @param {Document} svgDoc - SVG document
   * @param {Element} watermarkGroup - Watermark container group
   * @param {Object} logoElement - Logo element configuration
   * @param {Object} svgDimensions - SVG dimensions info
   */
  async addLogoWatermarks(svgDoc, watermarkGroup, logoElement, svgDimensions) {
    const positions = this.calculateElementPositions(logoElement, svgDimensions);

    for (const position of positions) {
      const logoEl = await this.createLogoElement(svgDoc, logoElement, position);
      if (logoEl) {
        watermarkGroup.appendChild(logoEl);
      }
    }
  }

  /**
   * Calculate element positions based on pattern type
   * @param {Object} element - Element configuration
   * @param {Object} svgDimensions - SVG dimensions
   * @returns {Array} - Array of position objects
   */
  calculateElementPositions(element, svgDimensions) {
    const basePosition = {
      x: (element.position.x / 100) * svgDimensions.viewBox.width,
      y: (element.position.y / 100) * svgDimensions.viewBox.height
    };

    switch (element.pattern) {
      case 'grid':
        return this.generateGridPositions(basePosition, svgDimensions, element);

      case 'scattered':
        return this.generateScatteredPositions(basePosition, svgDimensions, element);

      case 'single':
      default:
        return [basePosition];
    }
  }

  /**
   * Generate grid pattern positions
   * @param {Object} basePosition - Base position
   * @param {Object} svgDimensions - SVG dimensions
   * @param {Object} element - Element configuration
   * @returns {Array} - Grid positions
   */
  generateGridPositions(basePosition, svgDimensions, element) {
    const positions = [];
    const spacing = {
      x: 200, // Default spacing
      y: 150
    };

    // Override spacing if specified in element or global settings
    if (element.gridSpacing) {
      spacing.x = element.gridSpacing.x;
      spacing.y = element.gridSpacing.y;
    }

    const cols = Math.ceil(svgDimensions.viewBox.width / spacing.x);
    const rows = Math.ceil(svgDimensions.viewBox.height / spacing.y);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions.push({
          x: col * spacing.x + (spacing.x / 2),
          y: row * spacing.y + (spacing.y / 2)
        });
      }
    }

    return positions;
  }

  /**
   * Generate scattered pattern positions
   * @param {Object} basePosition - Base position
   * @param {Object} svgDimensions - SVG dimensions
   * @param {Object} element - Element configuration
   * @returns {Array} - Scattered positions
   */
  generateScatteredPositions(basePosition, svgDimensions, element) {
    const positions = [];
    const density = element.scatterDensity || 0.3;
    const area = svgDimensions.viewBox.width * svgDimensions.viewBox.height;
    const count = Math.floor((area / 50000) * density); // Adjust count based on area

    for (let i = 0; i < count; i++) {
      positions.push({
        x: Math.random() * svgDimensions.viewBox.width,
        y: Math.random() * svgDimensions.viewBox.height
      });
    }

    return positions;
  }

  /**
   * Create SVG text element
   * @param {Document} svgDoc - SVG document
   * @param {string} content - Text content
   * @param {Object} style - Text styling
   * @param {Object} position - Element position
   * @returns {Element} - SVG text element
   */
  createTextElement(svgDoc, content, style, position) {
    const textEl = svgDoc.createElement('text');

    textEl.setAttribute('x', position.x);
    textEl.setAttribute('y', position.y);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');

    // Apply styling
    textEl.setAttribute('font-family', style.fontFamily || 'Arial, sans-serif');
    textEl.setAttribute('font-size', style.fontSize || 16);
    textEl.setAttribute('fill', style.color || '#000000');
    textEl.setAttribute('opacity', (style.opacity || 100) / 100);

    if (style.rotation && style.rotation !== 0) {
      textEl.setAttribute('transform', `rotate(${style.rotation} ${position.x} ${position.y})`);
    }

    if (style.bold) {
      textEl.setAttribute('font-weight', 'bold');
    }

    if (style.italic) {
      textEl.setAttribute('font-style', 'italic');
    }

    // Set text content
    textEl.textContent = content;

    return textEl;
  }

  /**
   * Create SVG logo element (image)
   * @param {Document} svgDoc - SVG document
   * @param {Object} logoElement - Logo configuration
   * @param {Object} position - Element position
   * @returns {Promise<Element>} - SVG image element
   */
  async createLogoElement(svgDoc, logoElement, position) {
    try {
      const imageEl = svgDoc.createElement('image');
      const size = logoElement.style.size || 100;

      imageEl.setAttribute('x', position.x - size/2);
      imageEl.setAttribute('y', position.y - size/2);
      imageEl.setAttribute('width', size);
      imageEl.setAttribute('height', size);
      imageEl.setAttribute('opacity', (logoElement.style.opacity || 100) / 100);

      // Handle different logo sources
      let imageUrl = logoElement.url;

      if (logoElement.source === 'system-logo') {
        imageUrl = await this.resolveSystemLogo();
      }

      if (imageUrl.startsWith('/')) {
        // Convert relative path to absolute for better compatibility
        imageUrl = `https://ludora.app${imageUrl}`;
      }

      imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', imageUrl);

      if (logoElement.style.rotation && logoElement.style.rotation !== 0) {
        imageEl.setAttribute('transform', `rotate(${logoElement.style.rotation} ${position.x} ${position.y})`);
      }

      return imageEl;

    } catch (error) {
      console.error('Error creating logo element:', error);
      return null; // Return null if logo creation fails
    }
  }

  /**
   * Resolve system logo to appropriate URL or base64
   * @returns {Promise<string>} - Logo URL or base64 data
   */
  async resolveSystemLogo() {
    try {
      // Try to read logo from assets directory
      const logoPath = path.join(process.cwd(), 'assets', 'images', 'logo.png');

      if (fs.existsSync(logoPath)) {
        // Convert to base64 for embedding
        const logoBuffer = fs.readFileSync(logoPath);
        return `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }

      // Fallback to API endpoint
      return '/api/assets/image/settings/logo.png';

    } catch (error) {
      console.error('Error resolving system logo:', error);
      return '/api/assets/image/settings/logo.png'; // Fallback
    }
  }

  /**
   * Insert watermark group into SVG at appropriate position
   * @param {Element} svgElement - SVG root element
   * @param {Element} watermarkGroup - Watermark group to insert
   * @param {string} position - 'first' or 'last'
   */
  insertWatermarkGroup(svgElement, watermarkGroup, position = 'last') {
    if (position === 'first' && svgElement.firstChild) {
      svgElement.insertBefore(watermarkGroup, svgElement.firstChild);
    } else {
      svgElement.appendChild(watermarkGroup);
    }
  }

  /**
   * Substitute variables in text content
   * @param {string} content - Text content with variable placeholders
   * @param {Object} variables - Variable values
   * @returns {string} - Content with substituted variables
   */
  substituteVariables(content, variables = {}) {
    let result = content;

    // Default variables
    const defaultVars = {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      year: new Date().getFullYear()
    };

    const allVariables = { ...defaultVars, ...variables };

    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(allVariables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * Validate watermark template structure
   * @param {Object} template - Watermark template to validate
   * @returns {boolean} - True if valid
   */
  validateTemplate(template) {
    if (!template || typeof template !== 'object') {
      return false;
    }

    // Check for at least one element type
    if (!template.textElements && !template.logoElements) {
      return false;
    }

    // Validate text elements
    if (template.textElements) {
      if (!Array.isArray(template.textElements)) return false;

      for (const textEl of template.textElements) {
        if (!textEl.content || !textEl.position || !textEl.style) {
          return false;
        }
      }
    }

    // Validate logo elements
    if (template.logoElements) {
      if (!Array.isArray(template.logoElements)) return false;

      for (const logoEl of template.logoElements) {
        if (!logoEl.source || !logoEl.position || !logoEl.style) {
          return false;
        }
      }
    }

    return true;
  }
}

/**
 * Convenience function to apply watermarks to SVG content
 * @param {string} svgContent - Original SVG content
 * @param {Object} watermarkTemplate - Watermark template
 * @param {Object} variables - Variables for substitution
 * @returns {Promise<string>} - Watermarked SVG content
 */
export async function applyWatermarksToSvg(svgContent, watermarkTemplate, variables = {}) {
  const processor = new SvgWatermarkProcessor();

  if (!processor.validateTemplate(watermarkTemplate)) {
    throw new Error('Invalid watermark template structure');
  }

  return await processor.applyWatermarks(svgContent, watermarkTemplate, variables);
}

/**
 * Create a simple text watermark for quick use
 * @param {string} svgContent - Original SVG content
 * @param {string} text - Watermark text
 * @param {Object} options - Styling options
 * @returns {Promise<string>} - Watermarked SVG content
 */
export async function addSimpleTextWatermark(svgContent, text = 'PREVIEW ONLY', options = {}) {
  const template = {
    textElements: [{
      id: 'simple-watermark',
      content: text,
      position: { x: 50, y: 50 },
      style: {
        fontSize: options.fontSize || 32,
        color: options.color || '#FF6B6B',
        opacity: options.opacity || 30,
        rotation: options.rotation || 45,
        fontFamily: 'Arial, sans-serif'
      },
      pattern: options.pattern || 'single',
      visible: true
    }],
    globalSettings: {
      layerBehindContent: options.layerBehind || false
    }
  };

  return await applyWatermarksToSvg(svgContent, template, options.variables || {});
}

export { SvgWatermarkProcessor };
export default SvgWatermarkProcessor;