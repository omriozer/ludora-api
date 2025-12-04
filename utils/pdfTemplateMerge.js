/**
 * Unified PDF Template Merge Utility
 *
 * Applies templates (branding OR watermark - identical rendering logic) to PDF files
 * Using the same template structure and positioning as the visual editor
 *
 * REFACTORED: Now uses centralized utilities for better maintainability:
 * - AssetManager for logo/font loading
 * - CoordinateConverter for positioning calculations
 * - FontSelector for font selection logic
 * - Template configuration for all hardcoded values
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fontkit from './fontkit.js';
import fs from 'fs';
import path from 'path';
import { substituteVariables } from './variableSubstitution.js';
import { getElementRotation, getElementShadow, getPdfShadowParams } from './elementHelpers.js';
import { loadFonts, loadLogo } from './AssetManager.js';
import { createConverter } from './CoordinateConverter.js';
import { createFontSelector } from './FontSelector.js';
import { getDefaultContent, getUrlConfig } from '../config/templateConfig.js';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * Apply template to PDF - UNIFIED for both branding and watermark templates
 * NOW INCLUDES: Optional page replacement for preview mode
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} templateSettings - Template settings with logo/text/url/customElements structure
 * @param {Object} variables - Variables for text substitution
 * @param {Object} options - Options including optional accessiblePages for page replacement
 * @returns {Promise<Buffer>} - PDF with template applied
 */
async function mergePdfTemplate(pdfBuffer, templateSettings, variables = {}, options = {}) {
  try {
    if (!templateSettings || typeof templateSettings !== 'object') {
      return pdfBuffer;
    }

    // Check if page replacement is needed
    const accessiblePages = options.accessiblePages;
    const needsPageReplacement = accessiblePages && Array.isArray(accessiblePages);

    if (needsPageReplacement) {
      return await processWithPageReplacement(pdfBuffer, templateSettings, variables, accessiblePages);
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Register fontkit for Hebrew font support
    pdfDoc.registerFontkit(fontkit);

    // Load fonts using AssetManager
    const standardFonts = await loadStandardFonts(pdfDoc);
    const customFonts = await loadFonts(pdfDoc, ['english', 'hebrew']);

    // Create font selector for intelligent font selection
    const fontSelector = createFontSelector(standardFonts, customFonts);


    // Process each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      // Create coordinate converter for this page
      const coordinateConverter = createConverter('pdf-a4-portrait');
      // Override with actual page dimensions if different
      if (width !== 595 || height !== 842) {
        coordinateConverter.pageWidth = width;
        coordinateConverter.pageHeight = height;
      }

      // Add page number and URL variables using configuration
      const urlConfig = getUrlConfig();
      const pageVariables = {
        ...variables,
        page: pageIndex + 1,
        pageNumber: pageIndex + 1,
        totalPages: pages.length,
        FRONTEND_URL: urlConfig.frontend
      };

      // UNIFIED STRUCTURE ONLY: Process all element arrays
      // Ensure template has unified structure
      if (!templateSettings.elements || typeof templateSettings.elements !== 'object') {
        throw new Error('Template must use unified structure with "elements" object. Please update template to new format.');
      }

      // Process all element types in the unified structure
      for (const [elementType, elementArray] of Object.entries(templateSettings.elements)) {
        if (Array.isArray(elementArray)) {
          for (const element of elementArray) {
            if (element && element.visible !== false && !element.hidden) {
              await addTemplateElement(page, elementType, element, pageVariables, coordinateConverter, fontSelector);
            }
          }
        }
      }
    }

    // Save and return processed PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);

  } catch (error) {
    throw new Error(`PDF template merge failed: ${error.message}`);
  }
}

/**
 * Load standard fonts for PDF
 * @param {PDFDocument} pdfDoc - PDF document
 * @returns {Object} - Standard fonts object
 */
async function loadStandardFonts(pdfDoc) {
  try {
    return {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
    };
  } catch (error) {
    return {};
  }
}

// Legacy function removed - now handled by AssetManager.loadFonts()

/**
 * Add template element to PDF page - UNIFIED LOGIC for all template types
 * REFACTORED: Now uses utilities for positioning, font selection, and asset loading
 * @param {PDFPage} page - PDF page
 * @param {string} elementType - Element type
 * @param {Object} element - Element configuration
 * @param {Object} variables - Variables for substitution
 * @param {CoordinateConverter} coordinateConverter - Coordinate conversion utility
 * @param {FontSelector} fontSelector - Font selection utility
 */
async function addTemplateElement(page, elementType, element, variables, coordinateConverter, fontSelector) {
  try {
    // Use CoordinateConverter for positioning calculations
    const elementXPercent = element.position?.x || 50;
    const elementYPercent = element.position?.y || 50;

    // Convert percentage positions to PDF coordinates using utility
    const { x: elementX, y: elementY } = coordinateConverter.percentageToPdf(elementXPercent, elementYPercent);



    // Get common style properties
    const opacity = (element.style?.opacity || 100) / 100;

    // Use unified rotation helper to eliminate duplication and ensure consistency
    const rotation = getElementRotation(element, elementType);

    // Get shadow settings for the element
    const shadowSettings = getElementShadow(element, elementType);
    const shadowParams = getPdfShadowParams(shadowSettings);

    switch (elementType) {
      case 'logo':
      case 'watermark-logo':
        await renderLogoElement(page, element, elementX, elementY, opacity, rotation, shadowParams);
        break;

      case 'text':
      case 'copyright-text':
      case 'free-text':
      case 'user-info':
      case 'watermark-text':
        await renderTextElement(page, element, elementX, elementY, opacity, rotation, variables, fontSelector, shadowParams);
        break;

      case 'url':
        await renderUrlElement(page, element, elementX, elementY, opacity, rotation, variables, fontSelector, shadowParams);
        break;

      case 'box':
        await renderBoxElement(page, element, elementX, elementY, opacity, rotation, shadowParams);
        break;

      case 'circle':
        await renderCircleElement(page, element, elementX, elementY, opacity, rotation, shadowParams);
        break;

      case 'line':
      case 'dotted-line':
        await renderLineElement(page, element, elementX, elementY, opacity, rotation, shadowParams);
        break;

      default:
        // Unknown element type - skip rendering
    }

  } catch (error) {
    // Element render failed - continue with other elements
  }
}

/**
 * Render logo element - UNIFIED for branding and watermark
 * REFACTORED: Now uses AssetManager for configurable logo loading
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Logo element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderLogoElement(page, element, x, y, opacity, rotation, shadowParams = null) {
  try {
    const logoSize = element.style?.size || 80;

    // Use AssetManager for configurable logo loading
    const logoAsset = await loadLogo({
      source: 'file', // Support for different sources: file, url, base64
      size: logoSize
    });

    // Handle logo rendering based on asset type
    if (logoAsset && !logoAsset.fallback && logoAsset.data) {
      try {
        let logoImage;

        // Embed image based on detected type
        if (logoAsset.type === 'png') {
          logoImage = await page.doc.embedPng(logoAsset.data);
        } else if (logoAsset.type === 'jpeg') {
          logoImage = await page.doc.embedJpg(logoAsset.data);
        } else {
          throw new Error(`Unsupported image format: ${logoAsset.type}`);
        }

        // Scale logo to match visual editor size
        // logoSize is in pixels as shown in editor, calculate proper scale factor
        const targetWidth = logoSize; // Target width in pixels (from editor)
        const originalWidth = logoImage.width;
        const scaleFactor = targetWidth / originalWidth;
        const logoDims = logoImage.scale(scaleFactor);

        // COORDINATE SYSTEM FIX: Apply same direction fix for logos
        let finalLogoRotation = -rotation; // Negate to match CSS direction

        // Only apply rotation if there's actually rotation to avoid precision issues
        if (Math.abs(rotation) < 0.01) {
          finalLogoRotation = 0; // Force zero for very small values
        }

        // Render shadow first (if enabled) - shadow goes behind the logo
        if (shadowParams) {
          const shadowX = x + shadowParams.offsetX - (logoDims.width / 2);
          const shadowY = y - shadowParams.offsetY - (logoDims.height / 2);

          page.drawImage(logoImage, {
            x: shadowX,
            y: shadowY,
            width: logoDims.width,
            height: logoDims.height,
            opacity: shadowParams.opacity,
            rotate: degrees(finalLogoRotation),
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b)
          });
        }

        // Draw main image centered at the specified position (on top of shadow)
        page.drawImage(logoImage, {
          x: x - (logoDims.width / 2), // Center horizontally
          y: y - (logoDims.height / 2), // Center vertically
          width: logoDims.width,
          height: logoDims.height,
          opacity: opacity,
          rotate: degrees(finalLogoRotation)
        });

        return; // Successfully rendered image, exit function

      } catch (imageError) {
        // Fall through to text fallback
      }
    }

    // Fallback: render configured fallback text if image loading failed
    if (logoAsset && logoAsset.fallback) {
      try {
        // Use fallback configuration from AssetManager
        const logoText = logoAsset.text || getDefaultContent('logo');
        const fontSize = logoSize / 4;

        // Load standard fonts for fallback rendering
        const standardFonts = await loadStandardFonts(page.doc);
        if (standardFonts.regular) {
          const textWidth = standardFonts.regular.widthOfTextAtSize(logoText, fontSize);

          // COORDINATE SYSTEM FIX: Apply same direction fix for logo text fallback
          let finalLogoTextRotation = -rotation; // Negate to match CSS direction

          // Only apply rotation if there's actually rotation to avoid precision issues
          if (Math.abs(rotation) < 0.01) {
            finalLogoTextRotation = 0; // Force zero for very small values
          }

          // Render text shadow first (if enabled)
          if (shadowParams) {
            const shadowX = x + shadowParams.offsetX - (textWidth / 2);
            const shadowY = y - shadowParams.offsetY - (fontSize / 2);

            page.drawText(logoText, {
              x: shadowX,
              y: shadowY,
              size: fontSize,
              opacity: shadowParams.opacity,
              color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
              rotate: degrees(finalLogoTextRotation),
              font: standardFonts.regular
            });
          }

          // Render main text (on top of shadow)
          page.drawText(logoText, {
            x: x - (textWidth / 2), // Center horizontally
            y: y - (fontSize / 2), // Center vertically
            size: fontSize,
            opacity: opacity,
            color: rgb(logoAsset.color?.r || 0.2, logoAsset.color?.g || 0.4, logoAsset.color?.b || 0.8),
            rotate: degrees(finalLogoTextRotation),
            font: standardFonts.regular
          });
        }
      } catch (fallbackError) {
        // Logo fallback rendering failed
      }
    }

  } catch (error) {
    // Logo render failed
  }
}

/**
 * Render text element with Hebrew support - UNIFIED for branding and watermark
 * REFACTORED: Now uses FontSelector for intelligent font selection
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Text element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} variables - Variables for substitution
 * @param {FontSelector} fontSelector - Font selection utility
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderTextElement(page, element, x, y, opacity, rotation, variables, fontSelector, shadowParams = null) {
  try {
    // Get content and apply variable substitution
    let content = element.content || '';

    // Default content for special element types using configuration
    if (element.type === 'user-info' && !content) {
      content = getDefaultContent('user-info', 'hebrew');
    }

    content = substituteVariables(content, variables, {
      supportSystemTemplates: true,
      enableLogging: true
    });

    if (!content.trim()) {
      return;
    }

    // Get text style
    const fontSize = element.style?.fontSize || 12;
    const colorHex = element.style?.color || '#000000';
    const isBold = element.style?.bold || false;
    const isItalic = element.style?.italic || false;
    const textWidth = element.style?.width || 300; // For multi-line text wrapping

    // Use FontSelector for intelligent font selection
    const fontInfo = fontSelector.selectFont(content, { bold: isBold, italic: isItalic });

    if (!fontInfo.font) {
      return;
    }

    const selectedFont = fontInfo.font;

    // Parse color
    const color = hexToRgb(colorHex);

    // Handle multi-line text wrapping for longer content
    if (content.length > 50 || content.includes('\n')) {
      await renderMultiLineText(page, content, x, y, fontSize, selectedFont, color, opacity, rotation, textWidth, shadowParams);
    } else {
      // Single line text - center it with proper rotation around center
      const actualTextWidth = selectedFont.widthOfTextAtSize(content, fontSize);

      // COORDINATE SYSTEM FIX: PDF-lib and CSS have opposite rotation directions
      // CSS: positive angles rotate clockwise
      // PDF-lib: positive angles rotate counter-clockwise
      // Solution: Negate the rotation to match CSS behavior

      let finalRotation = -rotation; // Negate to match CSS direction

      // Only apply rotation if there's actually rotation to avoid precision issues
      if (Math.abs(rotation) < 0.01) {
        finalRotation = 0; // Force zero for very small values
      }

      if (Math.abs(finalRotation) < 0.1) {
        // For no rotation or very small angles, use simple centering

        // Render text shadow first (if enabled)
        if (shadowParams) {
          const shadowX = x + shadowParams.offsetX - (actualTextWidth / 2);
          const shadowY = y - shadowParams.offsetY - (fontSize / 2);

          page.drawText(content, {
            x: shadowX,
            y: shadowY,
            size: fontSize,
            font: selectedFont,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(0)
          });
        }

        // Render main text (on top of shadow)
        page.drawText(content, {
          x: x - (actualTextWidth / 2), // Center horizontally
          y: y - (fontSize / 2), // Center vertically
          size: fontSize,
          font: selectedFont,
          color: color,
          opacity: opacity,
          rotate: degrees(0) // No rotation needed
        });
      } else {
        // For actual rotation, apply center-based rotation transformation
        // Step 1: Calculate text origin that will center the text at (x,y) BEFORE rotation
        const textOriginX = x - (actualTextWidth / 2);
        const textOriginY = y - (fontSize / 2);

        // Step 2: Calculate the offset from the desired center to the text origin
        const offsetX = textOriginX - x;
        const offsetY = textOriginY - y;

        // Step 3: Apply rotation transformation to find where the text origin should be
        // so that after pdf-lib rotates around it, the text appears centered at (x,y)
        const rotationRad = (finalRotation * Math.PI) / 180;
        const cosTheta = Math.cos(rotationRad);
        const sinTheta = Math.sin(rotationRad);

        // Reverse rotation to find original position
        const finalTextX = x + (offsetX * cosTheta + offsetY * sinTheta);
        const finalTextY = y + (-offsetX * sinTheta + offsetY * cosTheta);

        // Render text shadow first (if enabled) with rotation
        if (shadowParams) {
          const shadowOriginX = x + shadowParams.offsetX - (actualTextWidth / 2);
          const shadowOriginY = y - shadowParams.offsetY - (fontSize / 2);

          const shadowOffsetX = shadowOriginX - x;
          const shadowOffsetY = shadowOriginY - y;

          const finalShadowX = x + (shadowOffsetX * cosTheta + shadowOffsetY * sinTheta);
          const finalShadowY = y + (-shadowOffsetX * sinTheta + shadowOffsetY * cosTheta);

          page.drawText(content, {
            x: finalShadowX,
            y: finalShadowY,
            size: fontSize,
            font: selectedFont,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(finalRotation)
          });
        }

        // Render main text (on top of shadow)
        page.drawText(content, {
          x: finalTextX,
          y: finalTextY,
          size: fontSize,
          font: selectedFont,
          color: color,
          opacity: opacity,
          rotate: degrees(finalRotation)
        });
      }
    }

  } catch (error) {
    // Text render failed for element
  }
}

/**
 * Render URL element - UNIFIED for branding and watermark
 * REFACTORED: Now uses FontSelector and configurable URLs
 * @param {PDFPage} page - PDF page
 * @param {Object} element - URL element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} variables - Variables for substitution
 * @param {FontSelector} fontSelector - Font selection utility
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderUrlElement(page, element, x, y, opacity, rotation, variables, fontSelector, shadowParams = null) {
  try {
    // Get URL and apply variable substitution using configuration
    const urlConfig = getUrlConfig();
    const urlContent = element.content || element.href || urlConfig.default;
    const urlHref = substituteVariables(urlContent, variables, {
      supportSystemTemplates: true,
      enableLogging: true
    });


    // Get URL style
    const fontSize = element.style?.fontSize || 12;
    const colorHex = element.style?.color || '#0066cc';
    const isBold = element.style?.bold || false;
    const isItalic = element.style?.italic || false;

    // Parse color
    const color = hexToRgb(colorHex);

    // Use FontSelector for intelligent font selection (same as text elements)
    const fontInfo = fontSelector.selectFont(urlHref, { bold: isBold, italic: isItalic });

    if (!fontInfo.font) {
      return;
    }

    const selectedFont = fontInfo.font;

    if (selectedFont) {
      // Center the URL text with proper rotation around center
      const textWidth = selectedFont.widthOfTextAtSize(urlHref, fontSize);

      // COORDINATE SYSTEM FIX: Apply same direction fix for URLs
      let finalUrlRotation = -rotation; // Negate to match CSS direction

      // Only apply rotation if there's actually rotation to avoid precision issues
      if (Math.abs(rotation) < 0.01) {
        finalUrlRotation = 0; // Force zero for very small values
      }

      // ADVANCED APPROACH: Apply center-based rotation for URLs too
      if (Math.abs(finalUrlRotation) < 0.1) {
        // For no rotation or very small angles, use simple centering

        // Render URL shadow first (if enabled)
        if (shadowParams) {
          const shadowX = x + shadowParams.offsetX - (textWidth / 2);
          const shadowY = y - shadowParams.offsetY - (fontSize / 2);

          page.drawText(urlHref, {
            x: shadowX,
            y: shadowY,
            size: fontSize,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(0),
            font: selectedFont
          });
        }

        // Render main URL text (on top of shadow)
        page.drawText(urlHref, {
          x: x - (textWidth / 2), // Center horizontally
          y: y - (fontSize / 2), // Center vertically
          size: fontSize,
          color: color,
          opacity: opacity,
          rotate: degrees(0),
          font: selectedFont
        });
      } else {
        // For actual rotation, apply center-based rotation transformation
        const textOriginX = x - (textWidth / 2);
        const textOriginY = y - (fontSize / 2);

        const offsetX = textOriginX - x;
        const offsetY = textOriginY - y;

        const rotationRad = (finalUrlRotation * Math.PI) / 180;
        const cosTheta = Math.cos(rotationRad);
        const sinTheta = Math.sin(rotationRad);

        const finalTextX = x + (offsetX * cosTheta + offsetY * sinTheta);
        const finalTextY = y + (-offsetX * sinTheta + offsetY * cosTheta);

        // Render URL shadow first (if enabled) with rotation
        if (shadowParams) {
          const shadowOriginX = x + shadowParams.offsetX - (textWidth / 2);
          const shadowOriginY = y - shadowParams.offsetY - (fontSize / 2);

          const shadowOffsetX = shadowOriginX - x;
          const shadowOffsetY = shadowOriginY - y;

          const finalShadowX = x + (shadowOffsetX * cosTheta + shadowOffsetY * sinTheta);
          const finalShadowY = y + (-shadowOffsetX * sinTheta + shadowOffsetY * cosTheta);

          page.drawText(urlHref, {
            x: finalShadowX,
            y: finalShadowY,
            size: fontSize,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(finalUrlRotation),
            font: selectedFont
          });
        }

        // Render main URL text (on top of shadow)
        page.drawText(urlHref, {
          x: finalTextX,
          y: finalTextY,
          size: fontSize,
          color: color,
          opacity: opacity,
          rotate: degrees(finalUrlRotation),
          font: selectedFont
        });
      }
    }
  } catch (error) {
    // URL render failed for element
  }
}

/**
 * Render multi-line text with word wrapping
 * @param {PDFPage} page - PDF page
 * @param {string} content - Text content
 * @param {number} x - X coordinate (center)
 * @param {number} y - Y coordinate (center)
 * @param {number} fontSize - Font size
 * @param {Object} font - PDF font
 * @param {Object} color - RGB color
 * @param {number} opacity - Opacity
 * @param {number} rotation - Rotation in degrees
 * @param {number} maxWidth - Maximum width for wrapping
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderMultiLineText(page, content, x, y, fontSize, font, color, opacity, rotation, maxWidth, shadowParams = null) {
  try {
    const lineHeight = fontSize * 1.2; // 120% line height
    const words = content.split(/\s+/);
    const lines = [];
    let currentLine = '';

    // Simple word wrapping
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

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

    // Calculate starting Y position to center the text block
    const totalHeight = lines.length * lineHeight;
    let startY = y + (totalHeight / 2) - (lineHeight / 2);

    // Render each line with proper rotation around center
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const lineY = startY - (i * lineHeight);

      // COORDINATE SYSTEM FIX: Apply same direction fix for multiline text
      let finalLineRotation = -rotation; // Negate to match CSS direction

      // Only apply rotation if there's actually rotation to avoid precision issues
      if (Math.abs(rotation) < 0.01) {
        finalLineRotation = 0; // Force zero for very small values
      }

      // ADVANCED APPROACH: Apply center-based rotation for multiline text too
      if (Math.abs(finalLineRotation) < 0.1) {
        // For no rotation or very small angles, use simple centering

        // Render line shadow first (if enabled)
        if (shadowParams) {
          const shadowX = x + shadowParams.offsetX - (lineWidth / 2);
          const shadowY = lineY - shadowParams.offsetY;

          page.drawText(line, {
            x: shadowX,
            y: shadowY,
            size: fontSize,
            font: font,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(0)
          });
        }

        // Render main line (on top of shadow)
        page.drawText(line, {
          x: x - (lineWidth / 2), // Center horizontally
          y: lineY,
          size: fontSize,
          font: font,
          color: color,
          opacity: opacity,
          rotate: degrees(0)
        });
      } else {
        // For actual rotation, apply center-based rotation transformation
        const lineTextOriginX = x - (lineWidth / 2);
        const lineTextOriginY = lineY;

        const lineOffsetX = lineTextOriginX - x;
        const lineOffsetY = lineTextOriginY - y;

        const rotationRad = (finalLineRotation * Math.PI) / 180;
        const cosTheta = Math.cos(rotationRad);
        const sinTheta = Math.sin(rotationRad);

        const finalLineX = x + (lineOffsetX * cosTheta + lineOffsetY * sinTheta);
        const finalLineY = y + (-lineOffsetX * sinTheta + lineOffsetY * cosTheta);

        // Render line shadow first (if enabled) with rotation
        if (shadowParams) {
          const shadowLineOriginX = x + shadowParams.offsetX - (lineWidth / 2);
          const shadowLineOriginY = lineY - shadowParams.offsetY;

          const shadowLineOffsetX = shadowLineOriginX - x;
          const shadowLineOffsetY = shadowLineOriginY - y;

          const finalShadowLineX = x + (shadowLineOffsetX * cosTheta + shadowLineOffsetY * sinTheta);
          const finalShadowLineY = y + (-shadowLineOffsetX * sinTheta + shadowLineOffsetY * cosTheta);

          page.drawText(line, {
            x: finalShadowLineX,
            y: finalShadowLineY,
            size: fontSize,
            font: font,
            color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
            opacity: shadowParams.opacity,
            rotate: degrees(finalLineRotation)
          });
        }

        // Render main line (on top of shadow)
        page.drawText(line, {
          x: finalLineX,
          y: finalLineY,
          size: fontSize,
          font: font,
          color: color,
          opacity: opacity,
          rotate: degrees(finalLineRotation)
        });
      }

    }

  } catch (error) {
    // Multiline text render failed
  }
}


// Legacy function removed - now handled by FontSelector.containsHebrew()


/**
 * Render box (rectangle) element
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Box element configuration
 * @param {number} x - X coordinate (center)
 * @param {number} y - Y coordinate (center)
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderBoxElement(page, element, x, y, opacity, rotation, shadowParams = null) {
  try {
    const width = element.style?.width || 100;
    const height = element.style?.height || 100;
    const colorHex = element.style?.color || '#000000';
    const borderWidth = element.style?.borderWidth || 2;
    const fillColor = element.style?.fillColor || null;

    const strokeColor = hexToRgb(colorHex);

    // Calculate box coordinates (centered)
    const boxX = x - (width / 2);
    const boxY = y - (height / 2);

    // Apply rotation if needed - use consistent approach with other elements
    let finalRotation = -rotation; // Negate to match CSS direction

    // Only apply rotation if there's actually rotation to avoid precision issues
    if (Math.abs(rotation) < 0.01) {
      finalRotation = 0; // Force zero for very small values
    }

    // For rectangles, pdf-lib doesn't support rotation parameter directly
    // We need to use transformation matrix or skip rotation for boxes
    if (Math.abs(finalRotation) > 0.1) {
      // For rotated rectangles, save current state and apply transformation
      page.pushOperators(
        'q', // Save graphics state
        ...[Math.cos(finalRotation * Math.PI / 180), Math.sin(finalRotation * Math.PI / 180),
            -Math.sin(finalRotation * Math.PI / 180), Math.cos(finalRotation * Math.PI / 180), x, y],
        'cm' // Concat matrix
      );

      // Draw shadow first if enabled (with relative coordinates from center)
      if (shadowParams) {
        const shadowX = shadowParams.offsetX - (width / 2);
        const shadowY = -shadowParams.offsetY - (height / 2);

        page.drawRectangle({
          x: shadowX,
          y: shadowY,
          width: width,
          height: height,
          borderColor: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
          borderWidth: borderWidth,
          opacity: shadowParams.opacity
        });
      }

      // Draw main rectangle (centered at origin)
      const rectOptions = {
        x: -(width / 2),
        y: -(height / 2),
        width: width,
        height: height,
        borderColor: strokeColor,
        borderWidth: borderWidth,
        opacity: opacity
      };

      // Add fill color if specified
      if (fillColor) {
        rectOptions.color = hexToRgb(fillColor);
      }

      page.drawRectangle(rectOptions);

      // Restore graphics state
      page.pushOperators('Q');
    } else {
      // No rotation - use simple approach

      // Draw shadow first if enabled
      if (shadowParams) {
        const shadowX = boxX + shadowParams.offsetX;
        const shadowY = boxY - shadowParams.offsetY;

        page.drawRectangle({
          x: shadowX,
          y: shadowY,
          width: width,
          height: height,
          borderColor: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
          borderWidth: borderWidth,
          opacity: shadowParams.opacity
        });
      }

      // Draw main rectangle
      const rectOptions = {
        x: boxX,
        y: boxY,
        width: width,
        height: height,
        borderColor: strokeColor,
        borderWidth: borderWidth,
        opacity: opacity
      };

      // Add fill color if specified
      if (fillColor) {
        rectOptions.color = hexToRgb(fillColor);
      }

      page.drawRectangle(rectOptions);
    }

  } catch (error) {
    // Box render failed
  }
}

/**
 * Render circle element
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Circle element configuration
 * @param {number} x - X coordinate (center)
 * @param {number} y - Y coordinate (center)
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees (ignored for circles)
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderCircleElement(page, element, x, y, opacity, rotation, shadowParams = null) {
  try {
    const radius = (element.style?.size || element.style?.radius || 50) / 2;
    const colorHex = element.style?.color || '#000000';
    const borderWidth = element.style?.borderWidth || 2;
    const fillColor = element.style?.fillColor || null;

    const strokeColor = hexToRgb(colorHex);

    // Draw shadow first if enabled
    if (shadowParams) {
      const shadowX = x + shadowParams.offsetX;
      const shadowY = y - shadowParams.offsetY;

      page.drawCircle({
        x: shadowX,
        y: shadowY,
        size: radius,
        borderColor: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
        borderWidth: borderWidth,
        opacity: shadowParams.opacity
      });
    }

    // Draw main circle
    const circleOptions = {
      x: x,
      y: y,
      size: radius,
      borderColor: strokeColor,
      borderWidth: borderWidth,
      opacity: opacity
    };

    // Add fill color if specified
    if (fillColor) {
      circleOptions.color = hexToRgb(fillColor);
    }

    page.drawCircle(circleOptions);

  } catch (error) {
    // Circle render failed
  }
}

/**
 * Render line element (solid or dotted)
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Line element configuration
 * @param {number} x - X coordinate (center)
 * @param {number} y - Y coordinate (center)
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderLineElement(page, element, x, y, opacity, rotation, shadowParams = null) {
  try {
    const length = element.style?.length || 100;
    const colorHex = element.style?.color || '#000000';
    const thickness = element.style?.thickness || element.style?.borderWidth || 2;
    const isDotted = element.type === 'dotted-line';

    const strokeColor = hexToRgb(colorHex);

    // Calculate line endpoints (horizontal line centered at x,y)
    const startX = x - (length / 2);
    const endX = x + (length / 2);
    const lineY = y;

    // Apply rotation to line endpoints if needed
    let finalStartX = startX;
    let finalStartY = lineY;
    let finalEndX = endX;
    let finalEndY = lineY;

    if (Math.abs(rotation) > 0.1) {
      const rotationRad = (-rotation * Math.PI) / 180; // Negate for CSS direction match
      const cosTheta = Math.cos(rotationRad);
      const sinTheta = Math.sin(rotationRad);

      // Rotate start point
      const startOffsetX = startX - x;
      const startOffsetY = lineY - y;
      finalStartX = x + (startOffsetX * cosTheta - startOffsetY * sinTheta);
      finalStartY = y + (startOffsetX * sinTheta + startOffsetY * cosTheta);

      // Rotate end point
      const endOffsetX = endX - x;
      const endOffsetY = lineY - y;
      finalEndX = x + (endOffsetX * cosTheta - endOffsetY * sinTheta);
      finalEndY = y + (endOffsetX * sinTheta + endOffsetY * cosTheta);
    }

    // Draw shadow first if enabled
    if (shadowParams) {
      const shadowStartX = finalStartX + shadowParams.offsetX;
      const shadowStartY = finalStartY - shadowParams.offsetY;
      const shadowEndX = finalEndX + shadowParams.offsetX;
      const shadowEndY = finalEndY - shadowParams.offsetY;

      page.drawLine({
        start: { x: shadowStartX, y: shadowStartY },
        end: { x: shadowEndX, y: shadowEndY },
        thickness: thickness,
        color: rgb(shadowParams.color.r, shadowParams.color.g, shadowParams.color.b),
        opacity: shadowParams.opacity,
        dashArray: isDotted ? [3, 3] : undefined
      });
    }

    // Draw main line
    page.drawLine({
      start: { x: finalStartX, y: finalStartY },
      end: { x: finalEndX, y: finalEndY },
      thickness: thickness,
      color: strokeColor,
      opacity: opacity,
      dashArray: isDotted ? [3, 3] : undefined
    });

  } catch (error) {
    // Line render failed
  }
}

/**
 * Convert hex color to RGB values for pdf-lib
 * @param {string} hex - Hex color string
 * @returns {Object} - RGB color object
 */
function hexToRgb(hex) {
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
 * Process PDF with page replacement for preview mode
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} templateSettings - Template settings
 * @param {Object} variables - Variables for substitution
 * @param {Array} accessiblePages - Array of accessible page numbers (1-based)
 * @returns {Promise<Buffer>} - Processed PDF with page replacement
 */
async function processWithPageReplacement(pdfBuffer, templateSettings, variables, accessiblePages) {
  try {
    // Load original PDF
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = originalPdf.getPageCount();

    // Validate accessible pages
    const validAccessiblePages = accessiblePages
      .filter(page => Number.isInteger(page) && page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

    // Detect format and load appropriate placeholder PDF
    const detectedFormat = detectDocumentFormat(templateSettings, originalPdf, variables);
    console.log(`🔍 Detected document format: ${detectedFormat}`);
    const placeholderPdf = await loadPlaceholderPdf(detectedFormat);
    console.log(`📄 Loaded placeholder PDF for format: ${detectedFormat}`);

    // Create new PDF document
    const newPdf = await PDFDocument.create();

    // Register fontkit for templates
    newPdf.registerFontkit(fontkit);

    // Load fonts for template rendering
    const standardFonts = await loadStandardFonts(newPdf);
    const customFonts = await loadFonts(newPdf, ['english', 'hebrew']);
    const fontSelector = createFontSelector(standardFonts, customFonts);

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (validAccessiblePages.includes(pageNum)) {
        console.log(`📄 Processing accessible page ${pageNum}`);
        // Copy accessible page and apply templates
        await copyPageWithTemplates(originalPdf, newPdf, pageNum - 1, templateSettings, variables, fontSelector);
      } else {
        console.log(`🚫 Processing restricted page ${pageNum} - should show placeholder`);
        // Copy placeholder page (no templates)
        await copyPlaceholderPage(newPdf, placeholderPdf, pageNum, totalPages, variables, detectedFormat);
      }
    }

    // Save and return processed PDF
    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);

  } catch (error) {
    throw new Error(`PDF page replacement failed: ${error.message}`);
  }
}

/**
 * Detect document format from template settings and PDF dimensions
 * @param {Object} templateSettings - Template settings
 * @param {PDFDocument} originalPdf - Original PDF document
 * @param {Object} variables - Variables (for future use)
 * @returns {string} - Format: 'portrait-a4', 'landscape-a4', or 'svg-slide'
 */
function detectDocumentFormat(templateSettings, originalPdf, variables) {
  try {
    // Check if this is an SVG-based template (check for SVG-specific settings or variables)
    if (templateSettings.svgTemplate || variables.isSvgTemplate || templateSettings.format === 'svg') {
      return 'svg-slide';
    }

    // Get first page dimensions to detect PDF format
    const firstPage = originalPdf.getPage(0);
    const { width, height } = firstPage.getSize();

    // Standard A4 dimensions in points
    const A4_PORTRAIT_WIDTH = 595; // ~210mm
    const A4_PORTRAIT_HEIGHT = 842; // ~297mm
    const A4_LANDSCAPE_WIDTH = 842;
    const A4_LANDSCAPE_HEIGHT = 595;

    // Tolerance for dimension comparison (allows for slight variations)
    const TOLERANCE = 10;

    // Check for landscape A4
    if (Math.abs(width - A4_LANDSCAPE_WIDTH) <= TOLERANCE && Math.abs(height - A4_LANDSCAPE_HEIGHT) <= TOLERANCE) {
      return 'landscape-a4';
    }

    // Check for portrait A4
    if (Math.abs(width - A4_PORTRAIT_WIDTH) <= TOLERANCE && Math.abs(height - A4_PORTRAIT_HEIGHT) <= TOLERANCE) {
      return 'portrait-a4';
    }

    // Determine by aspect ratio if dimensions don't match exactly
    const aspectRatio = width / height;

    if (aspectRatio > 1.2) {
      // Wider than tall - likely landscape
      return 'landscape-a4';
    } else {
      // Taller than wide or square - default to portrait
      return 'portrait-a4';
    }

  } catch (error) {
    luderror.file('⚠️ Format detection failed, defaulting to portrait-a4:', error.message);
    return 'portrait-a4'; // Safe fallback
  }
}

/**
 * Load placeholder PDF based on detected format
 * @param {string} format - Document format: 'portrait-a4', 'landscape-a4', or 'svg-slide'
 * @returns {Promise<PDFDocument>} - Placeholder PDF document
 */
async function loadPlaceholderPdf(format) {
  // Map formats to placeholder files
  const placeholderFiles = {
    'portrait-a4': 'preview-not-available-portrait.pdf',
    'landscape-a4': 'preview-not-available-landscape.pdf',
    'svg-slide': 'preview-not-available-slide.pdf'
  };

  const placeholderFile = placeholderFiles[format] || placeholderFiles['portrait-a4']; // Fallback
  const placeholderPath = path.join(process.cwd(), 'assets', 'placeholders', placeholderFile);

  if (!fs.existsSync(placeholderPath)) {
    throw new Error(`Placeholder PDF not found for format ${format}: ${placeholderPath}. Ensure static placeholder files exist in assets/placeholders/`);
  }

  console.log(`🔍 Loading placeholder PDF from: ${placeholderPath}`);
  const placeholderBuffer = fs.readFileSync(placeholderPath);
  console.log(`📄 Placeholder PDF buffer size: ${placeholderBuffer.length} bytes`);

  try {
    const placeholderDoc = await PDFDocument.load(placeholderBuffer, {
      ignoreEncryption: true,
      capNumbers: false,
      throwOnInvalidObject: true
    });

    console.log(`✅ Placeholder PDF loaded successfully, ${placeholderDoc.getPageCount()} page(s)`);
    console.log(`📐 Placeholder page size: ${placeholderDoc.getPage(0).getSize().width}x${placeholderDoc.getPage(0).getSize().height}`);

    return placeholderDoc;
  } catch (loadError) {
    throw new Error(`Failed to load placeholder PDF ${placeholderPath}: ${loadError.message}. The PDF file may be corrupted or incompatible with pdf-lib.`);
  }
}

/**
 * Copy page from original PDF and apply templates
 * @param {PDFDocument} originalPdf - Source PDF
 * @param {PDFDocument} newPdf - Destination PDF
 * @param {number} pageIndex - Page index (0-based)
 * @param {Object} templateSettings - Template settings
 * @param {Object} variables - Variables for substitution
 * @param {FontSelector} fontSelector - Font selection utility
 */
async function copyPageWithTemplates(originalPdf, newPdf, pageIndex, templateSettings, variables, fontSelector) {
  try {
    // Copy page from original PDF
    const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
    newPdf.addPage(copiedPage);

    // Apply templates to the copied page
    await applyTemplatesToPage(copiedPage, templateSettings, variables, fontSelector, pageIndex + 1);

  } catch (error) {
    // Create fallback page
    const fallbackPage = newPdf.addPage([612, 792]);
    // Add simple error message
    fallbackPage.drawText(`Page ${pageIndex + 1} - Error loading content`, {
      x: 50,
      y: 400,
      size: 14,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
}

/**
 * Copy placeholder page without templates
 * @param {PDFDocument} newPdf - Destination PDF
 * @param {PDFDocument} placeholderPdf - Placeholder PDF
 * @param {number} pageNum - Current page number (1-based)
 * @param {number} totalPages - Total pages in document
 * @param {Object} variables - Variables for customization
 * @param {string} detectedFormat - Detected document format ('portrait-a4', 'landscape-a4', 'svg-slide')
 */
async function copyPlaceholderPage(newPdf, placeholderPdf, pageNum, totalPages, variables, detectedFormat = 'portrait-a4') {
  console.log(`🔄 Attempting to copy placeholder page ${pageNum} from placeholder PDF`);
  try {
    // Try to copy the placeholder page with detailed error reporting
    let placeholderPage;
    try {
      console.log(`🔄 Copying placeholder page ${pageNum} from placeholder PDF...`);
      console.log(`📋 Placeholder PDF info: ${placeholderPdf.getPageCount()} pages`);
      console.log(`📋 New PDF info: ${newPdf.getPageCount()} pages so far`);

      [placeholderPage] = await newPdf.copyPages(placeholderPdf, [0]);
      console.log(`✅ Successfully copied placeholder page ${pageNum} via copyPages`);
    } catch (copyError) {
      console.log(`🚨 CRITICAL: Failed to copy placeholder PDF for page ${pageNum}`);
      console.log(`🚨 Error details: ${copyError.message}`);
      console.log(`🚨 Error stack: ${copyError.stack}`);
      console.log(`🚨 Placeholder PDF loaded: ${placeholderPdf ? 'yes' : 'no'}`);
      console.log(`🚨 Placeholder pages count: ${placeholderPdf ? placeholderPdf.getPageCount() : 'N/A'}`);

      // Add specific error context
      const errorDetails = {
        pageNumber: pageNum,
        placeholderFormat: detectedFormat,
        errorMessage: copyError.message,
        placeholderLoaded: !!placeholderPdf,
        placeholderPageCount: placeholderPdf ? placeholderPdf.getPageCount() : 0
      };

      // Don't create fallback - fail explicitly so the issue is visible
      throw new Error(`Failed to copy placeholder PDF: ${copyError.message}. Context: ${JSON.stringify(errorDetails)}. This indicates a PDF compatibility issue that needs to be resolved.`);
    }

    // Use placeholder page as-is, without any modifications

    newPdf.addPage(placeholderPage);
    console.log(`✅ Added placeholder page ${pageNum} to final PDF`);

  } catch (error) {
    console.log(`🚨 ERROR copying placeholder page ${pageNum}:`, error.message);

    // Get format-appropriate dimensions for fallback page
    const getDimensionsForFormat = (format) => {
      switch (format) {
        case 'landscape-a4':
          return [842, 595]; // A4 landscape: width=842, height=595
        case 'svg-slide':
          return [800, 600]; // Standard slide format
        default: // portrait-a4
          return [595, 842]; // A4 portrait: width=595, height=842
      }
    };

    const [pageWidth, pageHeight] = getDimensionsForFormat(detectedFormat);

    // Create format-appropriate fallback page
    const fallbackPage = newPdf.addPage([pageWidth, pageHeight]);
    console.log(`⚠️ Created fallback ${detectedFormat} page ${pageNum} (${pageWidth}x${pageHeight}) due to error`);

    // Draw placeholder background
    fallbackPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.95, 0.95, 0.95), // Light gray background
    });

    // Add "Preview Not Available" text in center
    try {
      const fonts = await loadStandardFonts(newPdf);
      if (fonts.bold) {
        const messageText = 'Preview Not Available';
        const fontSize = 24;
        const textWidth = fonts.bold.widthOfTextAtSize(messageText, fontSize);

        fallbackPage.drawText(messageText, {
          x: (pageWidth - textWidth) / 2,
          y: pageHeight / 2,
          size: fontSize,
          font: fonts.bold,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Add page number
        const pageText = `Page ${pageNum} of ${totalPages}`;
        const pageTextSize = 12;
        const pageTextWidth = fonts.regular.widthOfTextAtSize(pageText, pageTextSize);

        fallbackPage.drawText(pageText, {
          x: pageWidth - pageTextWidth - 20,
          y: 20,
          size: pageTextSize,
          font: fonts.regular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
    } catch (textError) {
      // If text rendering fails, just use the gray background
      console.log(`⚠️ Could not add text to fallback page ${pageNum}:`, textError.message);
    }
  }
}

/**
 * Apply templates to a specific page (extracted from main loop for reuse)
 * @param {PDFPage} page - PDF page to apply templates to
 * @param {Object} templateSettings - Template settings
 * @param {Object} variables - Variables for substitution
 * @param {FontSelector} fontSelector - Font selection utility
 * @param {number} pageNumber - Current page number (1-based)
 */
async function applyTemplatesToPage(page, templateSettings, variables, fontSelector, pageNumber) {
  try {
    const { width, height } = page.getSize();

    // Create coordinate converter for this page
    const coordinateConverter = createConverter('pdf-a4-portrait');
    // Override with actual page dimensions if different
    if (width !== 595 || height !== 842) {
      coordinateConverter.pageWidth = width;
      coordinateConverter.pageHeight = height;
    }

    // Add page number and URL variables using configuration
    const urlConfig = getUrlConfig();
    const pageVariables = {
      ...variables,
      page: pageNumber,
      pageNumber: pageNumber,
      FRONTEND_URL: urlConfig.frontend
    };

    // Ensure template has unified structure
    if (!templateSettings.elements || typeof templateSettings.elements !== 'object') {
      return; // Skip template application for invalid structure
    }

    // Process all element types in the unified structure
    for (const [elementType, elementArray] of Object.entries(templateSettings.elements)) {
      if (Array.isArray(elementArray)) {
        for (const element of elementArray) {
          if (element && element.visible !== false && !element.hidden) {
            await addTemplateElement(page, elementType, element, pageVariables, coordinateConverter, fontSelector);
          }
        }
      }
    }

  } catch (error) {
    // Failed to apply templates to page
  }
}

export {
  mergePdfTemplate
};