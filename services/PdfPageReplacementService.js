/**
 * PDF Page Replacement Service
 *
 * Handles selective page access control for PDFs:
 * - Replaces restricted pages with placeholders while maintaining document structure
 * - Applies template-based watermarks to accessible pages
 * - Preserves page numbering and navigation
 * - Optimized for memory efficiency with large documents
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import fontkit from '../utils/fontkit.js';
import { mergePdfTemplate } from '../utils/pdfTemplateMerge.js';
import { substituteVariables } from '../utils/variableSubstitution.js';
import { cerror } from '../lib/utils.js';

/**
 * PDF Page Replacement Service Class
 */
class PdfPageReplacementService {
  constructor() {
    this.placeholderPdfPath = path.join(process.cwd(), 'assets', 'placeholders', 'preview-not-available.pdf');
    this.placeholderPdfBuffer = null;
  }

  /**
   * Process PDF with selective page access and watermarks
   * @param {Buffer} originalPdfBuffer - Original PDF buffer
   * @param {Array|null} accessiblePages - Array of page numbers (1-based) that user can access, null for all
   * @param {Object|null} watermarkTemplate - Watermark template for accessible pages
   * @param {Object} variables - Variables for watermark text substitution
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} - Processed PDF buffer
   */
  async processSelectiveAccess(originalPdfBuffer, accessiblePages = null, watermarkTemplate = null, variables = {}, options = {}) {
    try {
      // Load original PDF
      const originalPdf = await PDFDocument.load(originalPdfBuffer);
      const totalPages = originalPdf.getPageCount();

      // If no restrictions, apply watermarks and return
      if (!accessiblePages || accessiblePages.length === 0) {
        return await this.applyWatermarksToFullPdf(originalPdf, watermarkTemplate, variables);
      }

      // Validate accessible pages
      const validAccessiblePages = this.validateAccessiblePages(accessiblePages, totalPages);

      // Create new PDF with selective pages
      const processedPdf = await this.createSelectivePdf(originalPdf, validAccessiblePages, watermarkTemplate, variables, options);

      return await processedPdf.save();

    } catch (error) {
      cerror('❌ PDF page replacement failed:', error);
      throw new Error(`PDF selective access processing failed: ${error.message}`);
    }
  }

  /**
   * Validate and sanitize accessible pages array
   * @param {Array} accessiblePages - User-provided accessible pages
   * @param {number} totalPages - Total pages in document
   * @returns {Array} - Valid page numbers (1-based)
   */
  validateAccessiblePages(accessiblePages, totalPages) {
    if (!Array.isArray(accessiblePages)) {
      throw new Error('Accessible pages must be an array');
    }

    return accessiblePages
      .filter(page => Number.isInteger(page) && page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }

  /**
   * Create PDF with selective page access
   * @param {PDFDocument} originalPdf - Original PDF document
   * @param {Array} accessiblePages - Valid accessible pages (1-based)
   * @param {Object} watermarkTemplate - Watermark template
   * @param {Object} variables - Variables for substitution
   * @param {Object} options - Processing options
   * @returns {Promise<PDFDocument>} - Processed PDF document
   */
  async createSelectivePdf(originalPdf, accessiblePages, watermarkTemplate, variables, options) {
    const totalPages = originalPdf.getPageCount();
    const newPdf = await PDFDocument.create();

    // Load placeholder PDF once
    const placeholderPdf = await this.getPlaceholderPdf();


    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (accessiblePages.includes(pageNum)) {
        // Copy accessible page and apply watermarks
        await this.copyAccessiblePage(originalPdf, newPdf, pageNum - 1, watermarkTemplate, variables, options);
      } else {
        // Insert placeholder page
        await this.insertPlaceholderPage(newPdf, placeholderPdf, pageNum, totalPages, variables);
      }
    }

    return newPdf;
  }

  /**
   * Copy accessible page with optional watermarks
   * @param {PDFDocument} originalPdf - Source PDF
   * @param {PDFDocument} newPdf - Destination PDF
   * @param {number} pageIndex - Page index (0-based)
   * @param {Object} watermarkTemplate - Watermark template
   * @param {Object} variables - Variables for substitution
   * @param {Object} options - Processing options
   */
  async copyAccessiblePage(originalPdf, newPdf, pageIndex, watermarkTemplate, variables, options) {
    try {
      // Copy page from original PDF
      const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
      newPdf.addPage(copiedPage);

      // Apply watermarks if template provided
      if (watermarkTemplate && options.applyWatermarksToAccessible !== false) {
        // Ensure fonts are loaded for the new PDF document
        if (!this.standardFonts || !this.hebrewFonts) {
          await this.loadFontsForPdf(newPdf);
        }
        await this.applyWatermarkToPage(copiedPage, watermarkTemplate, variables, pageIndex + 1);
      }

    } catch (error) {
      // Insert placeholder as fallback
      const placeholderPdf = await this.getPlaceholderPdf();
      await this.insertPlaceholderPage(newPdf, placeholderPdf, pageIndex + 1, originalPdf.getPageCount(), variables);
    }
  }

  /**
   * Insert placeholder page for restricted content
   * @param {PDFDocument} newPdf - Destination PDF
   * @param {PDFDocument} placeholderPdf - Placeholder PDF template
   * @param {number} pageNum - Current page number
   * @param {number} totalPages - Total pages in document
   * @param {Object} variables - Variables for substitution
   */
  async insertPlaceholderPage(newPdf, placeholderPdf, pageNum, totalPages, variables) {
    try {
      // Copy placeholder page
      const [placeholderPage] = await newPdf.copyPages(placeholderPdf, [0]);

      // Add page-specific information
      const customizedPage = await this.customizePlaceholderPage(placeholderPage, pageNum, totalPages, variables);
      newPdf.addPage(customizedPage);

    } catch (error) {
      // Create minimal placeholder page as fallback
      const fallbackPage = newPdf.addPage([612, 792]);
      await this.createMinimalPlaceholder(fallbackPage, pageNum);
    }
  }

  /**
   * Customize placeholder page with page-specific information
   * @param {PDFPage} placeholderPage - Placeholder page to customize
   * @param {number} pageNum - Current page number
   * @param {number} totalPages - Total pages in document
   * @param {Object} variables - Variables for substitution
   * @returns {PDFPage} - Customized placeholder page
   */
  async customizePlaceholderPage(placeholderPage, pageNum, totalPages, variables) {
    try {
      const { width, height } = placeholderPage.getSize();

      // Add page number information
      placeholderPage.drawText(`Page ${pageNum} of ${totalPages}`, {
        x: width - 100,
        y: 30,
        size: 10,
        color: rgb(0.68, 0.71, 0.74), // Light gray
      });

      // Add filename if available
      if (variables.filename) {
        placeholderPage.drawText(variables.filename, {
          x: 50,
          y: 30,
          size: 10,
          color: rgb(0.68, 0.71, 0.74),
        });
      }

      return placeholderPage;

    } catch (error) {
      return placeholderPage; // Return unchanged if customization fails
    }
  }

  /**
   * Create minimal placeholder page as fallback
   * @param {PDFPage} page - Page to modify
   * @param {number} pageNum - Page number
   */
  async createMinimalPlaceholder(page, pageNum) {
    const { width, height } = page.getSize();

    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.98, 0.98, 0.98),
    });

    // Main message
    page.drawText('Content Restricted', {
      x: width / 2 - 80,
      y: height / 2,
      size: 24,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Page number
    page.drawText(`Page ${pageNum}`, {
      x: width / 2 - 30,
      y: height / 2 - 40,
      size: 14,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  /**
   * Apply watermarks to full PDF (no page restrictions) - UNIFIED APPROACH
   * Uses the same rendering logic as branding templates
   * @param {PDFDocument} pdfDoc - PDF document
   * @param {Object} watermarkTemplate - Watermark template (same structure as branding templates)
   * @param {Object} variables - Variables for substitution
   * @returns {Promise<Buffer>} - Watermarked PDF buffer
   */
  async applyWatermarksToFullPdf(pdfDoc, watermarkTemplate, variables) {
    try {
      if (!watermarkTemplate) {
        return await pdfDoc.save();
      }

      // Convert PDFDocument back to Buffer for unified processing
      const originalPdfBuffer = await pdfDoc.save();

      // Use the UNIFIED mergePdfTemplate function - NO DIFFERENCE between branding and watermark rendering
      const watermarkedPdfBuffer = await mergePdfTemplate(originalPdfBuffer, watermarkTemplate, variables);

      return watermarkedPdfBuffer;

    } catch (error) {
      // Fallback to original PDF if watermarking fails
      return await pdfDoc.save();
    }
  }

  /**
   * Load fonts for a PDF document
   * @param {PDFDocument} pdfDoc - PDF document to load fonts for
   */
  async loadFontsForPdf(pdfDoc) {
    try {
      // Register fontkit
      pdfDoc.registerFontkit(fontkit);

      // Embed standard fonts
      this.standardFonts = {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
      };

      // Load Hebrew fonts
      this.hebrewFonts = {};
      const hebrewFontPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Regular.ttf');
      const hebrewBoldFontPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Bold.ttf');

      if (fs.existsSync(hebrewFontPath)) {
        const hebrewFontBytes = fs.readFileSync(hebrewFontPath);
        this.hebrewFonts.regular = await pdfDoc.embedFont(hebrewFontBytes);
      }

      if (fs.existsSync(hebrewBoldFontPath)) {
        const hebrewBoldFontBytes = fs.readFileSync(hebrewBoldFontPath);
        this.hebrewFonts.bold = await pdfDoc.embedFont(hebrewBoldFontBytes);
      }

    } catch (error) {
      cerror('❌ Failed to load fonts:', error);
      // Initialize empty objects to prevent errors
      this.standardFonts = this.standardFonts || {};
      this.hebrewFonts = this.hebrewFonts || {};
    }
  }

  /**
   * Apply watermark template to a specific PDF page
   * Uses the same template structure as branding templates (logo, text, url, customElements)
   * @param {PDFPage} page - PDF page
   * @param {Object} watermarkTemplate - Watermark template with logo/text/url/customElements structure
   * @param {Object} variables - Variables for substitution
   * @param {number} pageNumber - Current page number
   */
  async applyWatermarkToPage(page, watermarkTemplate, variables, pageNumber) {
    try {
      const { width, height } = page.getSize();

      // Add page number to variables
      const pageVariables = {
        ...variables,
        page: pageNumber,
        pageNumber: pageNumber,
        FRONTEND_URL: process.env.FRONTEND_URL || 'https://ludora.app'
      };

      // Apply main logo element
      if (watermarkTemplate.logo && watermarkTemplate.logo.visible) {
        await this.addWatermarkElement(page, 'logo', watermarkTemplate.logo, pageVariables, width, height);
      }

      // Apply main text element
      if (watermarkTemplate.text && watermarkTemplate.text.visible) {
        await this.addWatermarkElement(page, 'text', watermarkTemplate.text, pageVariables, width, height);
      }

      // Apply main URL element
      if (watermarkTemplate.url && watermarkTemplate.url.visible) {
        await this.addWatermarkElement(page, 'url', watermarkTemplate.url, pageVariables, width, height);
      }

      // Apply custom elements
      if (watermarkTemplate.customElements) {
        for (const [elementId, element] of Object.entries(watermarkTemplate.customElements)) {
          // Use consistent visibility logic: render unless explicitly hidden
          if (element.visible !== false && !element.hidden) {
            await this.addWatermarkElement(page, element.type, element, pageVariables, width, height);
          }
        }
      }

    } catch (error) {
      // Continue processing other pages
    }
  }

  /**
   * Add watermark element to PDF page (unified method for all element types)
   * Uses the same rendering logic as the PDF branding merge function
   * @param {PDFPage} page - PDF page
   * @param {string} elementType - Element type ('logo', 'text', 'url', 'free-text', 'user-info', etc.)
   * @param {Object} element - Element configuration
   * @param {Object} variables - Variables for substitution
   * @param {number} width - Page width
   * @param {number} height - Page height
   */
  async addWatermarkElement(page, elementType, element, variables, width, height) {
    try {
      // Convert percentage positions to actual coordinates (same logic as pdfBrandingMerge.js)
      const elementXPercent = element.position?.x || 50;
      const elementYPercent = element.position?.y || 50;

      // Calculate center position coordinates matching frontend exactly
      // Frontend: element center is at X% from left, Y% from top
      // PDF: convert Y% from top to Y coordinate from bottom
      const elementX = (width * elementXPercent / 100);
      const elementY = height - (height * elementYPercent / 100);


      // Get opacity
      const opacity = (element.style?.opacity || 100) / 100;

      switch (elementType) {
        case 'logo':
        case 'watermark-logo':
          await this.renderLogoElement(page, element, elementX, elementY, opacity);
          break;

        case 'text':
        case 'free-text':
        case 'copyright-text':
        case 'user-info':
          await this.renderTextElement(page, element, elementX, elementY, opacity, variables);
          break;

        case 'url':
          await this.renderUrlElement(page, element, elementX, elementY, opacity, variables);
          break;

        default:
          // Unknown element type - skip
      }

    } catch (error) {
      // Error adding watermark element - continue processing
    }
  }

  /**
   * Render logo element (simplified version for watermarks)
   */
  async renderLogoElement(page, element, x, y, opacity) {
    try {
      // For now, render a safe text placeholder - use only ASCII characters
      const logoSize = element.style?.size || 50;
      const rotation = element.rotation || 0;

      // Ensure we have a standard font available
      if (!this.standardFonts?.regular) {
        return;
      }

      // Use only ASCII characters that all fonts can encode
      page.drawText('LOGO', {
        x: x - (logoSize / 4),
        y: y - (logoSize / 4),
        size: logoSize / 4, // Smaller text size for "LOGO" placeholder
        opacity: opacity,
        color: rgb(0.4, 0.5, 0.8),
        rotate: degrees(rotation),
        font: this.standardFonts.regular // Explicitly use standard font
      });

    } catch (error) {
      // Error rendering logo element - continue processing
    }
  }

  /**
   * Check if text contains Hebrew characters
   * @param {string} text - Input text to check
   * @returns {boolean} True if text contains Hebrew characters
   */
  containsHebrew(text) {
    if (!text) return false;
    // Hebrew Unicode range: \u0590-\u05FF
    return /[\u0590-\u05FF]/.test(text);
  }

  /**
   * Render text element using Hebrew fonts when needed
   */
  async renderTextElement(page, element, x, y, opacity, variables) {
    try {
      // Get content and apply variable substitution
      let content = element.content || '';
      if (element.type === 'user-info') {
        content = content || 'קובץ זה נוצר עבור {{user.email}}';
      }

      // Use centralized variable substitution with system template support and Hebrew RTL protection
      content = substituteVariables(content, variables, {
        supportSystemTemplates: true,
        enableLogging: false
      });

      if (!content.trim()) {
        return;
      }

      // Check if text contains Hebrew characters
      const hasHebrew = this.containsHebrew(content);

      // Get text style
      const fontSize = element.style?.fontSize || 16;
      const colorHex = element.style?.color || '#000000';
      const rotation = element.rotation || 0;
      const isBold = element.style?.bold || false;

      // Select appropriate font
      let selectedFont;

      // Force use of Hebrew font for Hebrew text only if it's actually available
      if (hasHebrew && this.hebrewFonts?.regular && this.hebrewFonts.regular !== null) {
        selectedFont = isBold && this.hebrewFonts.bold ? this.hebrewFonts.bold : this.hebrewFonts.regular;
      } else if (hasHebrew && (!this.hebrewFonts?.regular || this.hebrewFonts.regular === null)) {
        // For Hebrew text without Hebrew fonts, replace with transliteration or skip
        content = '[Hebrew text - font not available]';
        selectedFont = this.standardFonts?.regular;
      } else if (this.standardFonts?.regular) {
        selectedFont = isBold && this.standardFonts.bold ? this.standardFonts.bold : this.standardFonts.regular;
      } else {
        return;
      }

      if (!selectedFont) {
        return;
      }

      // Parse color
      const color = this.hexToRgb(colorHex);

      // For watermarks, we typically use single-line rendering
      page.drawText(content, {
        x: x,
        y: y,
        size: fontSize,
        font: selectedFont,
        color: color,
        opacity: opacity,
        rotate: degrees(rotation)
      });

    } catch (error) {
      // Error in text rendering - continue processing
    }
  }

  /**
   * Render URL element
   */
  async renderUrlElement(page, element, x, y, opacity, variables) {
    try {
      // Get URL and apply variable substitution
      const urlHref = substituteVariables(element.href || 'https://ludora.app', variables, {
        supportSystemTemplates: true
      });

      // Get URL style
      const fontSize = element.style?.fontSize || 12;
      const colorHex = element.style?.color || '#0066cc';
      const rotation = element.rotation || 0;
      const isBold = element.style?.bold || false;

      // Parse color
      const color = this.hexToRgb(colorHex);

      // Select appropriate font (URLs are typically not in Hebrew)
      let selectedFont = this.standardFonts?.regular;
      if (isBold && this.standardFonts?.bold) {
        selectedFont = this.standardFonts.bold;
      }

      page.drawText(urlHref, {
        x: x,
        y: y,
        size: fontSize,
        color: color,
        opacity: opacity,
        rotate: degrees(rotation),
        font: selectedFont // Explicitly specify font
      });

    } catch (error) {
      // Error in URL rendering - continue processing
    }
  }

  /**
   * Calculate element positions for PDF based on pattern type
   * @param {Object} element - Element configuration
   * @param {number} width - Page width
   * @param {number} height - Page height
   * @returns {Array} - Array of position objects
   */
  calculatePdfElementPositions(element, width, height) {
    const basePosition = {
      x: (element.position.x / 100) * width,
      y: height - (element.position.y / 100) * height // PDF coordinates start from bottom
    };

    switch (element.pattern) {
      case 'grid':
        return this.generatePdfGridPositions(width, height, element);
      case 'scattered':
        return this.generatePdfScatteredPositions(width, height, element);
      case 'single':
      default:
        return [basePosition];
    }
  }

  /**
   * Generate grid positions for PDF
   * @param {number} width - Page width
   * @param {number} height - Page height
   * @param {Object} element - Element configuration
   * @returns {Array} - Grid positions
   */
  generatePdfGridPositions(width, height, element) {
    const positions = [];
    const spacing = { x: 200, y: 150 };

    const cols = Math.ceil(width / spacing.x);
    const rows = Math.ceil(height / spacing.y);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions.push({
          x: col * spacing.x + (spacing.x / 2),
          y: height - (row * spacing.y + (spacing.y / 2)) // Flip Y for PDF coordinates
        });
      }
    }

    return positions;
  }

  /**
   * Generate scattered positions for PDF
   * @param {number} width - Page width
   * @param {number} height - Page height
   * @param {Object} element - Element configuration
   * @returns {Array} - Scattered positions
   */
  generatePdfScatteredPositions(width, height, element) {
    const positions = [];
    const density = element.scatterDensity || 0.3;
    const area = width * height;
    const count = Math.floor((area / 50000) * density);

    for (let i = 0; i < count; i++) {
      positions.push({
        x: Math.random() * width,
        y: Math.random() * height
      });
    }

    return positions;
  }

  /**
   * Get placeholder PDF (cached)
   * @returns {Promise<PDFDocument>} - Placeholder PDF document
   */
  async getPlaceholderPdf() {
    if (!this.placeholderPdfBuffer) {
      if (fs.existsSync(this.placeholderPdfPath)) {
        this.placeholderPdfBuffer = fs.readFileSync(this.placeholderPdfPath);
      } else {
        throw new Error('Placeholder PDF not found. Run generate-pdf-placeholder.js first.');
      }
    }

    return await PDFDocument.load(this.placeholderPdfBuffer);
  }


  /**
   * Convert hex color to RGB values for pdf-lib
   * @param {string} hex - Hex color string
   * @returns {Object} - RGB color object for pdf-lib
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      );
    }
    return rgb(0, 0, 0); // Fallback to black
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} - Radians
   */
  degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }
}

/**
 * Convenience function for PDF selective access processing
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Array} accessiblePages - Accessible page numbers (1-based)
 * @param {Object} watermarkTemplate - Watermark template
 * @param {Object} variables - Variables for substitution
 * @param {Object} options - Processing options
 * @returns {Promise<Buffer>} - Processed PDF buffer
 */
export async function processSelectiveAccessPdf(pdfBuffer, accessiblePages, watermarkTemplate, variables = {}, options = {}) {
  const service = new PdfPageReplacementService();
  return await service.processSelectiveAccess(pdfBuffer, accessiblePages, watermarkTemplate, variables, options);
}

export { PdfPageReplacementService };
export default PdfPageReplacementService;