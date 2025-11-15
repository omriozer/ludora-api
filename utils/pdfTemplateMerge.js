/**
 * Unified PDF Template Merge Utility
 *
 * Applies templates (branding OR watermark - identical rendering logic) to PDF files
 * Using the same template structure and positioning as the visual editor
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import fontkit from './fontkit.js';
import { substituteVariables } from './variableSubstitution.js';
import { getElementRotation, debugElementRotation, getElementShadow, getPdfShadowParams } from './elementHelpers.js';

/**
 * Apply template to PDF - UNIFIED for both branding and watermark templates
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} templateSettings - Template settings with logo/text/url/customElements structure
 * @param {Object} variables - Variables for text substitution
 * @returns {Promise<Buffer>} - PDF with template applied
 */
async function mergePdfTemplate(pdfBuffer, templateSettings, variables = {}) {
  try {
    console.log('🔍 mergePdfTemplate called with:');
    console.log('- templateSettings:', JSON.stringify(templateSettings, null, 2));
    console.log('- variables:', JSON.stringify(variables, null, 2));

    if (!templateSettings || typeof templateSettings !== 'object') {
      console.log('❌ No template settings or invalid object, returning original PDF');
      return pdfBuffer;
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Register fontkit for Hebrew font support
    pdfDoc.registerFontkit(fontkit);

    // Load fonts
    const standardFonts = await loadStandardFonts(pdfDoc);
    const customFonts = await loadCustomFonts(pdfDoc);


    // Process each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();


      // Add page number to variables
      const pageVariables = {
        ...variables,
        page: pageIndex + 1,
        pageNumber: pageIndex + 1,
        totalPages: pages.length,
        FRONTEND_URL: process.env.FRONTEND_URL || 'https://ludora.app'
      };

      // Support both unified array structure and legacy structure during transition
      const hasUnifiedStructure = templateSettings.elements;

      if (hasUnifiedStructure) {
        // NEW UNIFIED STRUCTURE: Process all element arrays
        console.log('🔧 Processing unified array structure');

        if (templateSettings.elements) {
          for (const [elementType, elementArray] of Object.entries(templateSettings.elements)) {
            if (Array.isArray(elementArray)) {
              for (const element of elementArray) {
                if (element && element.visible !== false && !element.hidden) {
                  await addTemplateElement(page, elementType, element, pageVariables, width, height, standardFonts, customFonts);
                }
              }
            }
          }
        }
      } else {
        // LEGACY STRUCTURE: Process built-in elements and customElements
        console.log('🔧 Processing legacy structure');

        // Apply main logo element (if visible) - SAME LOGIC for branding AND watermark
        if (templateSettings.logo && templateSettings.logo.visible !== false && !templateSettings.logo.hidden) {
          console.log('🔧 LEGACY: Processing logo element');
          await addTemplateElement(page, 'logo', templateSettings.logo, pageVariables, width, height, standardFonts, customFonts);
        }

        // Apply main text element (if visible) - SAME LOGIC for branding AND watermark
        if (templateSettings.text && templateSettings.text.visible !== false && !templateSettings.text.hidden) {
          console.log('🔧 LEGACY: Processing text element');
          await addTemplateElement(page, 'text', templateSettings.text, pageVariables, width, height, standardFonts, customFonts);
        }

        // Apply main URL element (if visible) - SAME LOGIC for branding AND watermark
        if (templateSettings.url && templateSettings.url.visible !== false && !templateSettings.url.hidden) {
          console.log('🔧 LEGACY: Processing url element');
          await addTemplateElement(page, 'url', templateSettings.url, pageVariables, width, height, standardFonts, customFonts);
        }

        // Apply copyright-text element (if visible) - SAME LOGIC for branding AND watermark
        if (templateSettings['copyright-text'] && templateSettings['copyright-text'].visible !== false && !templateSettings['copyright-text'].hidden) {
          console.log('🔧 LEGACY: Processing copyright-text element');
          await addTemplateElement(page, 'copyright-text', templateSettings['copyright-text'], pageVariables, width, height, standardFonts, customFonts);
        }

        // Apply user-info element (if visible) - SAME LOGIC for branding AND watermark
        if (templateSettings['user-info'] && templateSettings['user-info'].visible !== false && !templateSettings['user-info'].hidden) {
          console.log('🔧 LEGACY: Processing user-info element');
          await addTemplateElement(page, 'user-info', templateSettings['user-info'], pageVariables, width, height, standardFonts, customFonts);
        }

        // Apply custom elements - SAME LOGIC for branding AND watermark
        if (templateSettings.customElements) {
          for (const [elementId, element] of Object.entries(templateSettings.customElements)) {
            if (element.visible !== false && !element.hidden) {
              await addTemplateElement(page, element.type, element, pageVariables, width, height, standardFonts, customFonts);
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

/**
 * Load custom fonts for PDF (Inter for English, NotoSansHebrew for Hebrew)
 * @param {PDFDocument} pdfDoc - PDF document
 * @returns {Object} - Custom fonts object
 */
async function loadCustomFonts(pdfDoc) {
  try {
    const customFonts = {
      english: {},
      hebrew: {}
    };

    // Load English fonts (Inter)
    const englishRegularPath = path.join(process.cwd(), 'fonts', 'Inter-Regular.ttf');
    const englishBoldPath = path.join(process.cwd(), 'fonts', 'Inter-Bold.ttf');

    // Load Hebrew fonts (NotoSansHebrew)
    const hebrewRegularPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Regular.ttf');
    const hebrewBoldPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Bold.ttf');
    const hebrewVariablePath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Variable.ttf');


    // Load English fonts
    if (fs.existsSync(englishRegularPath)) {
      try {
        const englishRegularBytes = fs.readFileSync(englishRegularPath);
        customFonts.english.regular = await pdfDoc.embedFont(englishRegularBytes);
      } catch (embedError) {
        // Failed to embed font
      }
    }

    if (fs.existsSync(englishBoldPath)) {
      try {
        const englishBoldBytes = fs.readFileSync(englishBoldPath);
        customFonts.english.bold = await pdfDoc.embedFont(englishBoldBytes);
      } catch (embedError) {
        // Failed to embed font
      }
    }

    // Load Hebrew fonts
    if (fs.existsSync(hebrewRegularPath)) {
      try {
        const hebrewRegularBytes = fs.readFileSync(hebrewRegularPath);
        customFonts.hebrew.regular = await pdfDoc.embedFont(hebrewRegularBytes);
      } catch (embedError) {
        // Failed to embed font
      }
    }

    if (fs.existsSync(hebrewBoldPath)) {
      try {
        const hebrewBoldBytes = fs.readFileSync(hebrewBoldPath);
        customFonts.hebrew.bold = await pdfDoc.embedFont(hebrewBoldBytes);
      } catch (embedError) {
        // Failed to embed font
      }
    }

    // Load Hebrew variable font for italic and mixed styling support
    if (fs.existsSync(hebrewVariablePath)) {
      try {
        const hebrewVariableBytes = fs.readFileSync(hebrewVariablePath);
        customFonts.hebrew.variable = await pdfDoc.embedFont(hebrewVariableBytes);
        console.log('✅ Hebrew variable font loaded successfully for italic support');
      } catch (embedError) {
        console.log('⚠️ Failed to load Hebrew variable font:', embedError.message);
      }
    }

    return customFonts;
  } catch (error) {
    return { english: {}, hebrew: {} };
  }
}

/**
 * Add template element to PDF page - UNIFIED LOGIC for all template types
 * @param {PDFPage} page - PDF page
 * @param {string} elementType - Element type
 * @param {Object} element - Element configuration
 * @param {Object} variables - Variables for substitution
 * @param {number} width - Page width
 * @param {number} height - Page height
 * @param {Object} standardFonts - Standard fonts object
 * @param {Object} customFonts - Custom fonts object (english/hebrew)
 */
async function addTemplateElement(page, elementType, element, variables, width, height, standardFonts, customFonts) {
  try {
    // Convert percentage positions to actual coordinates
    // This MUST match the visual editor's coordinate system exactly
    const elementXPercent = element.position?.x || 50;
    const elementYPercent = element.position?.y || 50;

    // Calculate coordinates - EXACT MATCH with visual editor positioning
    // CRITICAL COORDINATE SYSTEM ANALYSIS:
    // - Visual Editor: Y=0 at TOP, Y=100 at BOTTOM (percentage from top)
    // - PDF lib: Y=0 at BOTTOM, Y=height at TOP (coordinate from bottom)
    // - Conversion: PDF_Y = height - (height * editorY% / 100)
    const elementX = (width * elementXPercent / 100);
    const elementY = height - (height * elementYPercent / 100);

    console.log(`🎯 POSITIONING DEBUG for ${elementType}:`, {
      elementId: element.id,
      templatePosition: { x: elementXPercent, y: elementYPercent },
      pageSize: { width, height },
      calculatedPdfCoords: { x: elementX, y: elementY },
      coordinateInfo: {
        xPercent: `${elementXPercent}% from left`,
        yPercent: `${elementYPercent}% from top`,
        pdfX: `${elementX.toFixed(1)} pixels from left`,
        pdfY: `${elementY.toFixed(1)} pixels from bottom`
      }
    });


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
        await renderLogoElement(page, element, elementX, elementY, opacity, rotation, standardFonts, shadowParams);
        break;

      case 'text':
      case 'copyright-text':
      case 'free-text':
      case 'user-info':
      case 'watermark-text':
        await renderTextElement(page, element, elementX, elementY, opacity, rotation, variables, standardFonts, customFonts, shadowParams);
        break;

      case 'url':
        await renderUrlElement(page, element, elementX, elementY, opacity, rotation, variables, standardFonts, customFonts, shadowParams);
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
    console.log('❌ Element render failed for type:', elementType, 'Error:', error.message);
    console.log('🔍 Failed element details:', JSON.stringify(element, null, 2));
  }
}

/**
 * Render logo element - UNIFIED for branding and watermark
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Logo element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} standardFonts - Standard fonts object
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderLogoElement(page, element, x, y, opacity, rotation, standardFonts, shadowParams = null) {
  try {
    const logoSize = element.style?.size || 80;

    // SIMPLIFIED: Logos always use static logo file, no URL handling at all
    let logoImageBytes = null;

    const fs = await import('fs');
    const path = await import('path');

    // Use the static logo file
    const logoPath = path.join(process.cwd(), 'assets', 'images', 'logo.png');

    try {
      if (fs.existsSync(logoPath)) {
        logoImageBytes = fs.readFileSync(logoPath);
      }
    } catch (localError) {
      // Failed to load logo
    }

    // If we have logo image data, embed and draw it
    if (logoImageBytes) {
      try {
        let logoImage;
        const logoBuffer = Buffer.from(logoImageBytes);

        // Detect image type and embed accordingly
        if (logoBuffer[0] === 0x89 && logoBuffer[1] === 0x50 && logoBuffer[2] === 0x4E && logoBuffer[3] === 0x47) {
          // PNG image
          logoImage = await page.doc.embedPng(logoImageBytes);
        } else if (logoBuffer[0] === 0xFF && logoBuffer[1] === 0xD8 && logoBuffer[2] === 0xFF) {
          // JPEG image
          logoImage = await page.doc.embedJpg(logoImageBytes);
        } else {
          throw new Error('Unsupported image format (only PNG and JPEG supported)');
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

    // Fallback: render "LOGO" text if image loading failed
    if (standardFonts.regular) {
      const logoText = 'LOGO';
      const fontSize = logoSize / 4;
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
        color: rgb(0.2, 0.4, 0.8), // Blue-ish color for logo placeholder
        rotate: degrees(finalLogoTextRotation),
        font: standardFonts.regular
      });
    }
  } catch (error) {
    // Logo render failed
  }
}

/**
 * Render text element with Hebrew support - UNIFIED for branding and watermark
 * @param {PDFPage} page - PDF page
 * @param {Object} element - Text element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} variables - Variables for substitution
 * @param {Object} standardFonts - Standard fonts object
 * @param {Object} customFonts - Custom fonts object (english/hebrew)
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderTextElement(page, element, x, y, opacity, rotation, variables, standardFonts, customFonts, shadowParams = null) {
  try {
    // Get content and apply variable substitution
    let content = element.content || '';

    // Default content for special element types
    if (element.type === 'user-info' && !content) {
      content = 'קובץ זה נוצר עבור {{user.email}}';
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

    // Check if text contains Hebrew characters
    const hasHebrew = containsHebrew(content);
    // Select appropriate font based on content type
    let selectedFont = null;

    // Mixed content detection for font selection
    const isMixedContent = hasHebrew && content.includes('@');

    if (hasHebrew) {
      // Hebrew text: ALWAYS prioritize Hebrew character support over italic styling
      // Hebrew fonts (NotoSansHebrew) do not support italic - disable italic for consistency
      if (customFonts.hebrew && customFonts.hebrew.regular) {
        // Use Hebrew fonts - prioritize character support over italic styling
        selectedFont = isBold && customFonts.hebrew.bold ? customFonts.hebrew.bold : customFonts.hebrew.regular;
        if (isItalic) {
          console.log('🔤 Hebrew italic requested but disabled - Hebrew fonts do not support italic styling');
        }
        console.log('🔤 Using Hebrew font for Hebrew text (italic disabled for font compatibility)');
      } else if (standardFonts.regular) {
        // Hebrew fonts unavailable - this will likely fail for Hebrew characters, but try anyway
        console.log('⚠️  Warning: Using Helvetica for Hebrew text - may fail to render Hebrew characters');
        if (isBold && isItalic && standardFonts.boldItalic) {
          selectedFont = standardFonts.boldItalic;
        } else if (isBold && standardFonts.bold) {
          selectedFont = standardFonts.bold;
        } else if (isItalic && standardFonts.italic) {
          selectedFont = standardFonts.italic;
        } else {
          selectedFont = standardFonts.regular;
        }
      } else {
        // If no fonts available at all, skip rendering
        return;
      }
    } else {
      // English/other text: use Helvetica fonts directly (matches frontend exactly)
      if (standardFonts.regular) {
        if (isBold && isItalic && standardFonts.boldItalic) {
          selectedFont = standardFonts.boldItalic;
        } else if (isBold && standardFonts.bold) {
          selectedFont = standardFonts.bold;
        } else if (isItalic && standardFonts.italic) {
          selectedFont = standardFonts.italic;
        } else {
          selectedFont = standardFonts.regular;
        }
      }
    }

    if (!selectedFont) {
      return;
    }

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
    console.log('❌ Text render failed for element:', element.type || 'unknown', 'Error:', error.message);
    console.log('🔍 Element details:', JSON.stringify(element, null, 2));
  }
}

/**
 * Render URL element - UNIFIED for branding and watermark
 * @param {PDFPage} page - PDF page
 * @param {Object} element - URL element configuration
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} opacity - Opacity (0-1)
 * @param {number} rotation - Rotation in degrees
 * @param {Object} variables - Variables for substitution
 * @param {Object} standardFonts - Standard fonts object
 * @param {Object} customFonts - Custom fonts object (english/hebrew)
 * @param {Object} shadowParams - Shadow parameters for PDF rendering
 */
async function renderUrlElement(page, element, x, y, opacity, rotation, variables, standardFonts, customFonts, shadowParams = null) {
  try {
    // Get URL and apply variable substitution
    // CRITICAL FIX: Custom URL elements use element.content, built-in URL elements use element.href
    const urlContent = element.content || element.href || 'https://ludora.app';
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

    // Check if URL contains Hebrew characters
    const hasHebrew = containsHebrew(urlHref);

    // Select appropriate font based on content type (same logic as text elements)
    let selectedFont = null;

    if (hasHebrew) {
      // Hebrew text: ALWAYS prioritize Hebrew character support over italic styling
      // Hebrew fonts (NotoSansHebrew) do not support italic - disable italic for consistency
      if (customFonts.hebrew && customFonts.hebrew.regular) {
        // Use Hebrew fonts - prioritize character support over italic styling
        selectedFont = isBold && customFonts.hebrew.bold ? customFonts.hebrew.bold : customFonts.hebrew.regular;
        if (isItalic) {
          console.log('🔤 Hebrew italic URL requested but disabled - Hebrew fonts do not support italic styling');
        }
        console.log('🔤 Using Hebrew font for Hebrew URL (italic disabled for font compatibility)');
      } else if (standardFonts.regular) {
        // Fall back to standard fonts when Hebrew fonts unavailable
        if (isBold && isItalic && standardFonts.boldItalic) {
          selectedFont = standardFonts.boldItalic;
        } else if (isBold && standardFonts.bold) {
          selectedFont = standardFonts.bold;
        } else if (isItalic && standardFonts.italic) {
          selectedFont = standardFonts.italic;
        } else {
          selectedFont = standardFonts.regular;
        }
      } else {
        // If no fonts available at all, skip rendering
        return;
      }
    } else {
      // English/other text: use Helvetica fonts directly (matches frontend exactly)
      if (standardFonts.regular) {
        if (isBold && isItalic && standardFonts.boldItalic) {
          selectedFont = standardFonts.boldItalic;
        } else if (isBold && standardFonts.bold) {
          selectedFont = standardFonts.bold;
        } else if (isItalic && standardFonts.italic) {
          selectedFont = standardFonts.italic;
        } else {
          selectedFont = standardFonts.regular;
        }
      }
    }

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
    console.log('❌ URL render failed for element:', element.type || 'url', 'Error:', error.message);
    console.log('🔍 URL element details:', JSON.stringify(element, null, 2));
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


/**
 * Check if text contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains Hebrew
 */
function containsHebrew(text) {
  if (!text) return false;
  // Hebrew Unicode range: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(text);
}


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

    // Apply rotation if needed
    if (Math.abs(rotation) > 0.1) {
      // For rotated rectangles, use PDF-lib's transform matrix
      const rotationRad = (-rotation * Math.PI) / 180; // Negate for CSS direction match

      page.pushOperators(
        ...page.getRotationDegrees(rotation === 0 ? 0 : -rotation, x, y)
      );
    }

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

export {
  mergePdfTemplate
};