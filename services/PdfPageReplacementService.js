/**
 * PDF Page Replacement Service
 *
 * Handles selective page access control for PDFs:
 * - Replaces restricted pages with placeholders while maintaining document structure
 * - Applies template-based watermarks to accessible pages
 * - Preserves page numbering and navigation
 * - Optimized for memory efficiency with large documents
 */

import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

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
      console.log('🔧 Starting PDF selective access processing...');

      // Load original PDF
      const originalPdf = await PDFDocument.load(originalPdfBuffer);
      const totalPages = originalPdf.getPageCount();

      console.log(`📄 Original PDF has ${totalPages} pages`);

      // If no restrictions, apply watermarks and return
      if (!accessiblePages || accessiblePages.length === 0) {
        console.log('✅ No page restrictions - applying watermarks to full document');
        return await this.applyWatermarksToFullPdf(originalPdf, watermarkTemplate, variables);
      }

      // Validate accessible pages
      const validAccessiblePages = this.validateAccessiblePages(accessiblePages, totalPages);
      console.log(`🔍 Valid accessible pages: [${validAccessiblePages.join(', ')}]`);

      // Create new PDF with selective pages
      const processedPdf = await this.createSelectivePdf(originalPdf, validAccessiblePages, watermarkTemplate, variables, options);

      console.log('✅ PDF selective access processing completed');
      return await processedPdf.save();

    } catch (error) {
      console.error('❌ PDF page replacement failed:', error);
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

    console.log(`📝 Creating selective PDF: ${accessiblePages.length}/${totalPages} pages accessible`);

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
        await this.applyWatermarkToPage(copiedPage, watermarkTemplate, variables, pageIndex + 1);
      }

    } catch (error) {
      console.error(`❌ Error copying page ${pageIndex + 1}:`, error);
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
      console.error(`❌ Error inserting placeholder for page ${pageNum}:`, error);
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
      console.error('Error customizing placeholder page:', error);
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
   * Apply watermarks to full PDF (no page restrictions)
   * @param {PDFDocument} pdfDoc - PDF document
   * @param {Object} watermarkTemplate - Watermark template
   * @param {Object} variables - Variables for substitution
   * @returns {Promise<Buffer>} - Watermarked PDF buffer
   */
  async applyWatermarksToFullPdf(pdfDoc, watermarkTemplate, variables) {
    if (!watermarkTemplate) {
      return await pdfDoc.save(); // No watermarks to apply
    }

    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      await this.applyWatermarkToPage(pages[i], watermarkTemplate, variables, i + 1);
    }

    return await pdfDoc.save();
  }

  /**
   * Apply watermark template to a specific PDF page
   * @param {PDFPage} page - PDF page
   * @param {Object} watermarkTemplate - Watermark template
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
        pageNumber: pageNumber
      };

      // Apply text elements
      if (watermarkTemplate.textElements) {
        for (const textElement of watermarkTemplate.textElements) {
          if (textElement.visible) {
            await this.addTextWatermarkToPdf(page, textElement, pageVariables, width, height);
          }
        }
      }

      // Apply logo elements
      if (watermarkTemplate.logoElements) {
        for (const logoElement of watermarkTemplate.logoElements) {
          if (logoElement.visible) {
            await this.addLogoWatermarkToPdf(page, logoElement, width, height);
          }
        }
      }

    } catch (error) {
      console.error(`Error applying watermark to page ${pageNumber}:`, error);
      // Continue processing other pages
    }
  }

  /**
   * Add text watermark to PDF page
   * @param {PDFPage} page - PDF page
   * @param {Object} textElement - Text element configuration
   * @param {Object} variables - Variables for substitution
   * @param {number} width - Page width
   * @param {number} height - Page height
   */
  async addTextWatermarkToPdf(page, textElement, variables, width, height) {
    try {
      const content = this.substituteVariables(textElement.content, variables);
      const positions = this.calculatePdfElementPositions(textElement, width, height);

      for (const position of positions) {
        page.drawText(content, {
          x: position.x,
          y: position.y,
          size: textElement.style.fontSize || 16,
          color: this.hexToRgb(textElement.style.color || '#000000'),
          opacity: (textElement.style.opacity || 100) / 100,
          rotate: this.degreesToRadians(textElement.style.rotation || 0),
        });
      }

    } catch (error) {
      console.error('Error adding text watermark:', error);
    }
  }

  /**
   * Add logo watermark to PDF page
   * @param {PDFPage} page - PDF page
   * @param {Object} logoElement - Logo element configuration
   * @param {number} width - Page width
   * @param {number} height - Page height
   */
  async addLogoWatermarkToPdf(page, logoElement, width, height) {
    try {
      // Note: Logo embedding in PDF is complex and requires image data
      // For now, we'll add a text placeholder that can be enhanced later
      const positions = this.calculatePdfElementPositions(logoElement, width, height);

      for (const position of positions) {
        page.drawText('🏢', {
          x: position.x,
          y: position.y,
          size: (logoElement.style.size || 50) / 2,
          opacity: (logoElement.style.opacity || 100) / 100,
          color: rgb(0.4, 0.5, 0.8),
        });
      }

    } catch (error) {
      console.error('Error adding logo watermark:', error);
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
   * Substitute variables in text content
   * @param {string} content - Text content with variables
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