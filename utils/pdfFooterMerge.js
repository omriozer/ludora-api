import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import fontkit from './fontkit.js';

/**
 * Check if text contains Hebrew characters
 * @param {string} text - Input text to check
 * @returns {boolean} True if text contains Hebrew characters
 */
function containsHebrew(text) {
  if (!text) return false;
  // Hebrew Unicode range: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Wrap text into lines based on container width
 * @param {string} text - The text to wrap
 * @param {Object} font - The PDF font object
 * @param {number} fontSize - Font size
 * @param {number} containerWidth - Maximum width for each line
 * @returns {string[]} Array of text lines
 */
function wrapTextToLines(text, font, fontSize, containerWidth) {
  if (!text || !text.trim()) return [''];

  // Check if text contains Hebrew characters - use same font width calculation as non-Hebrew
  if (containsHebrew(text)) {
    console.log('🔤 Hebrew text detected in wrapping - using accurate font width calculation');
  }

  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  console.log('📏 Text Wrapping Analysis:', {
    text: text,
    hasHebrew: containsHebrew(text),
    containerWidth: containerWidth,
    fontSize: fontSize,
    fontName: font.name || font.constructor.name || 'Unknown',
    wordCount: words.length
  });

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    let testWidth;

    try {
      testWidth = font.widthOfTextAtSize(testLine, fontSize);
    } catch (error) {
      // Fallback width calculation
      testWidth = testLine.length * fontSize * 0.6;
      console.log('⚠️ Font width calculation failed, using fallback:', error.message);
    }

    if (testWidth <= containerWidth) {
      currentLine = testLine;
    } else {
      // Current line is full, start new line
      if (currentLine) {
        lines.push(currentLine);
        console.log(`  📝 Line ${lines.length}: "${currentLine}" (width: ${font.widthOfTextAtSize ? font.widthOfTextAtSize(currentLine, fontSize) : 'unknown'})`);
        currentLine = word;
      } else {
        // Single word is too long, force it on its own line
        lines.push(word);
        console.log(`  📝 Line ${lines.length}: "${word}" (forced, too long)`);
        currentLine = '';
      }
    }
  }

  // Add the last line if it has content
  if (currentLine) {
    lines.push(currentLine);
  }

  // If no lines were created, return array with original text
  return lines.length > 0 ? lines : [text];
}

/**
 * Returns default footer settings for PDF rendering
 * Used when footer_settings is null
 * NOTE: This is for PDF rendering - system settings should populate content and URL
 *
 * @returns {Object} Default footer configuration
 */
function getDefaultFooterSettings() {
  return {
    logo: {
      visible: true,
      url: path.join(process.cwd(), 'assets', 'images', 'logo.png'), // Always use standard logo path
      position: { x: 50, y: 95 },
      style: { size: 80, opacity: 100 }
    },
    text: {
      visible: true,
      content: '', // Will be populated from system settings
      position: { x: 50, y: 90 },
      style: { fontSize: 12, color: '#000000', bold: false, italic: false, opacity: 80, width: 300 }
    },
    url: {
      visible: true,
      href: 'https://ludora.app',
      position: { x: 50, y: 85 },
      style: { fontSize: 12, color: '#0066cc', bold: false, italic: false, opacity: 100 }
    },
    customElements: {}
  };
}

/**
 * Merges footer elements (logo, text, URL) onto PDF pages
 *
 * @param {Buffer} pdfBuffer - Original PDF as buffer
 * @param {Object} footerSettings - Complete footer configuration with all settings
 *                                  (positioning, styling, content, logo URL, etc.)
 * @returns {Promise<Buffer>} Modified PDF as buffer
 */
async function mergePdfFooter(pdfBuffer, footerSettings) {
  // Use default settings if footerSettings is null
  const settings = footerSettings || getDefaultFooterSettings();

  try {
    // DEBUG: Log the complete footer settings received
    console.log('🔍 PDF Footer: Complete settings received:', {
      hasFooterSettings: !!footerSettings,
      settingsType: footerSettings ? 'provided' : 'using defaults',
      settingsKeys: Object.keys(settings || {})
    });

    // DEBUG: Log each element configuration in detail
    console.log('🔍 PDF Footer: Element-by-element analysis:');

    if (settings?.logo) {
      console.log('  📍 LOGO:', {
        visible: settings.logo.visible,
        url: settings.logo.url,
        position: settings.logo.position,
        style: settings.logo.style
      });
    }

    if (settings?.text) {
      console.log('  📍 TEXT:', {
        visible: settings.text.visible,
        content: settings.text.content?.substring(0, 50) + '...',
        position: settings.text.position,
        style: settings.text.style,
        hasWidth: !!settings.text.style?.width,
        width: settings.text.style?.width
      });
    }

    if (settings?.url) {
      console.log('  📍 URL:', {
        visible: settings.url.visible,
        href: settings.url.href,
        position: settings.url.position,
        style: settings.url.style
      });
    }

    if (settings?.customElements) {
      console.log('  📍 CUSTOM ELEMENTS:', {
        hasCustomElements: !!settings.customElements,
        count: Object.keys(settings.customElements).length,
        elements: Object.keys(settings.customElements)
      });

      // Log each custom element
      for (const [id, element] of Object.entries(settings.customElements)) {
        console.log(`    📍 Custom Element [${id}]:`, {
          type: element.type,
          visible: element.visible,
          position: element.position,
          style: element.style
        });
      }
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Register fontkit for custom font support
    console.log('🔍 Fontkit debug:', { fontkit: typeof fontkit, hasRegisterMethod: typeof pdfDoc.registerFontkit });
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();

    // Get default fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    // Load Hebrew fonts for Hebrew text support (after fontkit registration)
    let hebrewFont = null;
    let hebrewBoldFont = null;

    try {
      const hebrewFontPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Regular.ttf');
      const hebrewBoldFontPath = path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Bold.ttf');

      if (fs.existsSync(hebrewFontPath)) {
        const hebrewFontBytes = fs.readFileSync(hebrewFontPath);
        hebrewFont = await pdfDoc.embedFont(hebrewFontBytes);
        console.log('✅ Hebrew regular font embedded successfully');
      }

      if (fs.existsSync(hebrewBoldFontPath)) {
        const hebrewBoldFontBytes = fs.readFileSync(hebrewBoldFontPath);
        hebrewBoldFont = await pdfDoc.embedFont(hebrewBoldFontBytes);
        console.log('✅ Hebrew bold font embedded successfully');
      }
    } catch (error) {
      console.error('❌ Failed to load Hebrew fonts:', error);
      // Continue with standard fonts only
    }

    // Load logo if visible and URL is provided
    let logoImage = null;
    if (settings?.logo?.visible && settings?.logo?.url) {
      try {
        let logoBytes;
        let logoPath = settings.logo.url;

        // Resolve relative paths to absolute paths
        if (!logoPath.startsWith('http://') && !logoPath.startsWith('https://') && !path.isAbsolute(logoPath)) {
          logoPath = path.join(process.cwd(), logoPath);
        }

        console.log('🖼️ PDF Footer: Loading logo from:', logoPath);

        // Check if logoPath is a HTTP URL or local file path
        if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
          // Fetch from URL
          const logoResponse = await fetch(logoPath);
          logoBytes = await logoResponse.arrayBuffer();
        } else {
          // Read from local file
          logoBytes = fs.readFileSync(logoPath);
        }

        // Determine image type and embed
        if (logoPath.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoBytes);
          console.log('✅ PDF Footer: PNG logo embedded successfully');
        } else if (logoPath.toLowerCase().endsWith('.jpg') || logoPath.toLowerCase().endsWith('.jpeg')) {
          logoImage = await pdfDoc.embedJpg(logoBytes);
          console.log('✅ PDF Footer: JPG logo embedded successfully');
        } else {
          console.log('⚠️ PDF Footer: Unsupported logo format:', logoPath);
        }
      } catch (error) {
        console.error('Failed to load logo:', error);
        // Continue without logo
      }
    }

    // Process each page
    for (const page of pages) {
      const { width, height } = page.getSize();

      // DEBUG: Log page dimensions and coordinate system info
      console.log('📄 PDF Page Debug:', {
        pageWidth: width,
        pageHeight: height,
        settingsProvided: !!footerSettings,
        coordinateSystem: 'PDF: (0,0)=bottom-left, Y-up | Frontend: (0,0)=top-left, Y-down',
        transformNote: 'Frontend uses: left:X%, top:Y%, transform:translate(-50%,-50%)'
      });

      // Draw logo if available
      if (logoImage && settings?.logo?.visible) {
        const logoSettings = settings.logo;

        // Convert percentage positions to actual coordinates
        // IMPORTANT: Frontend positioning logic:
        // - CSS: left: X%, top: Y%, transform: translate(-50%, -50%)
        // - Frontend Y% is distance from TOP, not bottom
        // - Frontend coordinate system: (0,0) = top-left, Y increases downward
        // - PDF coordinate system: (0,0) = bottom-left, Y increases upward

        const logoXPercent = logoSettings.position?.x || 50;
        const logoYPercent = logoSettings.position?.y || 95;

        // Calculate center position coordinates matching frontend exactly
        // Frontend: element center is at X% from left, Y% from top
        // PDF: convert Y% from top to Y coordinate from bottom
        const logoX = (width * logoXPercent / 100);
        const logoY = height - (height * logoYPercent / 100);

        // DEBUG: Enhanced logo positioning with coordinate transformation details
        console.log('🎯 DETAILED Backend Logo Positioning:', {
          input: {
            percentageX: logoXPercent,
            percentageY: logoYPercent,
            pageWidth: width,
            pageHeight: height
          },
          calculation: {
            'X = width * (X% / 100)': `${width} * (${logoXPercent} / 100) = ${logoX}`,
            'Y = height - (height * (Y% / 100))': `${height} - (${height} * (${logoYPercent} / 100)) = ${logoY}`,
            note: 'Y inverted because PDF (0,0) is bottom-left vs CSS (0,0) top-left'
          },
          result: {
            centerX: logoX,
            centerY: logoY,
            equivalentFromTop: height - logoY,
            percentageFromTop: ((height - logoY) / height) * 100
          },
          coordinateSystem: 'PDF (bottom-left origin, Y increases upward)',
          frontendEquivalent: {
            cssLeft: `${logoXPercent}%`,
            cssTop: `${logoYPercent}%`,
            cssTransform: 'translate(-50%, -50%)',
            note: 'Frontend should show logo at this exact position'
          }
        });

        // Get logo dimensions
        const logoWidth = logoSettings.style?.size || 80;
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

        // Opacity
        const opacity = (logoSettings.style?.opacity || 100) / 100;

        page.drawImage(logoImage, {
          x: logoX - (logoWidth / 2), // Center logo horizontally
          y: logoY - (logoHeight / 2), // Center logo vertically
          width: logoWidth,
          height: logoHeight,
          opacity: opacity
        });
      }

      // Draw copyright text if visible
      if (settings?.text?.visible && settings?.text?.content) {
        const textSettings = settings.text;
        const originalText = textSettings.content.trim();

        // Only proceed if we have text to display
        if (originalText) {
          // Check if text contains Hebrew characters
          const hasHebrewText = containsHebrew(originalText);

          // Use Hebrew font if available and text contains Hebrew, otherwise use standard font
          let useHebrewFont = hasHebrewText && !!hebrewFont;

          console.log('🔍 Footer text debug:', {
            originalText: originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''),
            hasHebrew: hasHebrewText,
            hebrewFontAvailable: !!hebrewFont,
            useHebrewFont: useHebrewFont
          });

          // If Hebrew text is detected but Hebrew font is not available, skip text rendering entirely
          if (hasHebrewText && !useHebrewFont) {
            console.log('⚠️ Skipping Hebrew text rendering - no Hebrew font available');
            continue; // Skip to next page
          }

          // Convert percentage positions to actual coordinates
          // Apply same coordinate transformation logic as logo
          // Frontend: text center is at X% from left, Y% from top
          const textXPercent = textSettings.position?.x || 50;
          const textYPercent = textSettings.position?.y || 90;

          const textX = (width * textXPercent / 100);
          const textY = height - (height * textYPercent / 100);

          // Get text style and container width first
          const containerWidth = textSettings.style?.width || 300;

          // DEBUG: Enhanced text positioning calculation
          console.log('🎯 DETAILED Backend Text Positioning:', {
            input: {
              percentageX: textXPercent,
              percentageY: textYPercent,
              containerWidth: containerWidth,
              pageWidth: width,
              pageHeight: height
            },
            calculation: {
              'X = width * (X% / 100)': `${width} * (${textXPercent} / 100) = ${textX}`,
              'Y = height - (height * (Y% / 100))': `${height} - (${height} * (${textYPercent} / 100)) = ${textY}`,
              note: 'Center position calculated, individual lines will be centered around this point'
            },
            result: {
              centerX: textX,
              centerY: textY,
              equivalentFromTop: height - textY,
              percentageFromTop: ((height - textY) / height) * 100
            },
            coordinateSystem: 'PDF (bottom-left origin, Y increases upward)',
            frontendEquivalent: {
              cssLeft: `${textXPercent}%`,
              cssTop: `${textYPercent}%`,
              cssTransform: 'translate(-50%, -50%)',
              note: 'Frontend should show text at this exact position'
            }
          });

          // Get text style
          const fontSize = textSettings.style?.fontSize || 12;
          const colorHex = textSettings.style?.color || '#000000';
          const isBold = textSettings.style?.bold || false;
          const isItalic = textSettings.style?.italic || false;
          const opacity = (textSettings.style?.opacity || 80) / 100;

          // Will log detailed text style analysis after font selection

          // Parse color
          const r = parseInt(colorHex.slice(1, 3), 16) / 255;
          const g = parseInt(colorHex.slice(3, 5), 16) / 255;
          const b = parseInt(colorHex.slice(5, 7), 16) / 255;

          // Determine final text and font BEFORE width calculation
          let finalText = originalText;
          let finalFont;

          // Handle Hebrew text and font selection with proper fallback
          if (hasHebrewText) {
            if (useHebrewFont) {
              // Use Hebrew font for Hebrew text
              finalFont = isBold && hebrewBoldFont ? hebrewBoldFont : hebrewFont;
              finalText = originalText; // Keep original Hebrew text
            } else {
              // Hebrew text but no Hebrew font available - use English fallback
              console.log('⚠️ Hebrew text detected but Hebrew font not available, using English fallback');
              finalText = 'Copyright notice (Hebrew text requires Hebrew font support)';
              // Use English font
              if (isBold && isItalic) {
                finalFont = boldItalicFont;
              } else if (isBold) {
                finalFont = boldFont;
              } else if (isItalic) {
                finalFont = italicFont;
              } else {
                finalFont = font;
              }
            }
          } else {
            // English text - use appropriate English font
            finalText = originalText;
            if (isBold && isItalic) {
              finalFont = boldItalicFont;
            } else if (isBold) {
              finalFont = boldFont;
            } else if (isItalic) {
              finalFont = italicFont;
            } else {
              finalFont = font;
            }
          }

          try {
            // Log detailed text style analysis now that font is selected
            console.log('📝 BACKEND Text Style Analysis:', {
              fontSize: fontSize,
              containerWidth: containerWidth,
              fontType: useHebrewFont ? 'Hebrew font' : 'Standard Helvetica',
              fontName: finalFont.name || finalFont.constructor.name || 'Unknown',
              textStyleSettings: {
                bold: isBold,
                italic: isItalic,
                opacity: opacity,
                color: colorHex
              },
              note: 'Compare these exact values with frontend rendering'
            });

            // Implement proper text width handling and wrapping
            console.log('📝 Text container debug:', {
              originalText: finalText.substring(0, 50) + '...',
              containerWidth,
              fontSize,
              position: { x: textSettings.position?.x || 50, y: textSettings.position?.y || 90 }
            });

            // Split text into lines based on container width
            const lines = wrapTextToLines(finalText, finalFont, fontSize, containerWidth);
            console.log('📝 DETAILED Text Wrapping Analysis:', {
              originalText: finalText,
              containerWidth: containerWidth,
              fontSize: fontSize,
              font: useHebrewFont ? 'Hebrew' : 'Standard',
              numLines: lines.length,
              lines: lines.map((line, i) => ({
                lineIndex: i,
                text: line,
                length: line.length,
                estimatedWidth: line.length * fontSize * (hasHebrewText ? 0.7 : 0.6)
              })),
              wrappingMethod: hasHebrewText ? 'Hebrew fallback estimation' : 'Font.widthOfTextAtSize()',
              note: 'Compare this with frontend text wrapping to identify discrepancies'
            });

            // Calculate total text block height
            const lineHeight = fontSize * 1.2; // Standard line height
            const totalTextHeight = lines.length * lineHeight;

            // FIXED: Calculate positioning to match CSS transform: translate(-50%, -50%)
            // CSS centers the text block around the coordinate - we need to do the same
            // Center the text block vertically around textY
            const halfTextHeight = totalTextHeight / 2;

            console.log('📐 Text positioning calculation:', {
              textY: textY,
              totalTextHeight: totalTextHeight,
              halfTextHeight: halfTextHeight,
              lineHeight: lineHeight,
              numLines: lines.length,
              note: 'Centering text block around textY coordinate'
            });

            // Draw each line
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              let lineWidth;

              try {
                lineWidth = finalFont.widthOfTextAtSize(line, fontSize);
              } catch (widthError) {
                console.error('❌ Error calculating line width:', widthError.message);
                lineWidth = line.length * fontSize * 0.6;
              }

              // Position each line: start from top of centered text block
              const lineY = textY + halfTextHeight - (i * lineHeight) - (lineHeight / 2);

              page.drawText(line, {
                x: textX - (lineWidth / 2), // Center each line horizontally
                y: lineY,
                size: fontSize,
                font: finalFont,
                color: rgb(r, g, b),
                opacity: opacity
              });

              console.log(`📝 Line ${i + 1} rendered:`, {
                text: line.substring(0, 30) + '...',
                width: lineWidth,
                x: textX - (lineWidth / 2),
                y: lineY
              });
            }

            console.log('✅ Multi-line text rendered successfully:', {
              lines: lines.length,
              font: useHebrewFont ? 'Hebrew' : 'Standard',
              totalHeight: totalTextHeight,
              containerWidth
            });
          } catch (fontError) {
            console.error('❌ Font rendering error:', fontError.message);
            // Text won't be rendered if font fails
          }
        }
      }

      // Draw URL link if visible
      if (settings?.url?.visible && settings?.url?.href) {
        const urlSettings = settings.url;

        // Convert percentage positions to actual coordinates
        // Apply same coordinate transformation logic as logo and text
        const urlXPercent = urlSettings.position?.x || 50;
        const urlYPercent = urlSettings.position?.y || 85;

        const urlX = (width * urlXPercent / 100);
        const urlY = height - (height * urlYPercent / 100);

        // DEBUG: Enhanced URL positioning calculation
        console.log('🔗 URL positioning calculation:', {
          input: {
            percentageX: urlXPercent,
            percentageY: urlYPercent,
            href: urlSettings.href,
            pageWidth: width,
            pageHeight: height
          },
          calculation: {
            'X = width * (X% / 100)': `${width} * (${urlXPercent} / 100) = ${urlX}`,
            'Y = height - (height * (Y% / 100))': `${height} - (${height} * (${urlYPercent} / 100)) = ${urlY}`,
            note: 'URL will be centered at this position'
          },
          result: {
            centerX: urlX,
            centerY: urlY,
            equivalentFromTop: height - urlY
          }
        });

        // Get URL style
        const fontSize = urlSettings.style?.fontSize || 12;
        const colorHex = urlSettings.style?.color || '#0066cc';
        const isBold = urlSettings.style?.bold || false;
        const isItalic = urlSettings.style?.italic || false;
        const opacity = (urlSettings.style?.opacity || 100) / 100;

        // Parse color
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        // Use appropriate font based on style
        let selectedFont;
        if (isBold && isItalic) {
          selectedFont = boldItalicFont;
        } else if (isBold) {
          selectedFont = boldFont;
        } else if (isItalic) {
          selectedFont = italicFont;
        } else {
          selectedFont = font;
        }

        // Draw URL text (centered)
        const urlText = urlSettings.href;
        let urlWidth;

        try {
          urlWidth = selectedFont.widthOfTextAtSize(urlText, fontSize);
        } catch (widthError) {
          console.error('❌ Error calculating URL width:', widthError.message);
          // Use approximate width calculation as fallback
          urlWidth = urlText.length * fontSize * 0.6;
        }

        try {
          page.drawText(urlText, {
            x: urlX - (urlWidth / 2),
            y: urlY - (fontSize / 2), // Center URL text vertically by adjusting for font size
            size: fontSize,
            font: selectedFont,
            color: rgb(r, g, b),
            opacity: opacity
          });

          console.log('✅ URL rendered successfully');
        } catch (urlError) {
          console.error('❌ URL rendering error:', urlError.message);
          // URL won't be rendered if font fails
        }

        // Note: pdf-lib doesn't support clickable links directly
        // The URL will be displayed as text only
      }

      // Draw custom elements (box, line, dotted-line)
      if (settings?.customElements) {
        for (const [elementId, element] of Object.entries(settings.customElements)) {
          if (!element?.visible || !element?.type) continue;

          console.log(`🎨 Processing custom element: ${elementId} (${element.type})`);

          // Convert percentage positions to actual coordinates
          const elementX = (width * (element.position?.x || 50) / 100);
          const elementY = height - (height * (element.position?.y || 50) / 100);

          const opacity = (element.style?.opacity || 100) / 100;

          switch (element.type) {
            case 'box':
              {
                const boxWidth = element.style?.width || 100;
                const boxHeight = element.style?.height || 50;
                const borderWidth = element.style?.borderWidth || 2;
                const borderColorHex = element.style?.borderColor || '#000000';
                const backgroundColorHex = element.style?.backgroundColor;

                // Parse border color
                const borderR = parseInt(borderColorHex.slice(1, 3), 16) / 255;
                const borderG = parseInt(borderColorHex.slice(3, 5), 16) / 255;
                const borderB = parseInt(borderColorHex.slice(5, 7), 16) / 255;

                // Draw background if specified and not transparent
                if (backgroundColorHex && backgroundColorHex !== 'transparent') {
                  const bgR = parseInt(backgroundColorHex.slice(1, 3), 16) / 255;
                  const bgG = parseInt(backgroundColorHex.slice(3, 5), 16) / 255;
                  const bgB = parseInt(backgroundColorHex.slice(5, 7), 16) / 255;

                  page.drawRectangle({
                    x: elementX - (boxWidth / 2),
                    y: elementY - (boxHeight / 2),
                    width: boxWidth,
                    height: boxHeight,
                    color: rgb(bgR, bgG, bgB),
                    opacity: opacity
                  });
                }

                // Draw border
                page.drawRectangle({
                  x: elementX - (boxWidth / 2),
                  y: elementY - (boxHeight / 2),
                  width: boxWidth,
                  height: boxHeight,
                  borderColor: rgb(borderR, borderG, borderB),
                  borderWidth: borderWidth,
                  opacity: opacity
                });

                console.log(`✅ Box element rendered: ${boxWidth}x${boxHeight} at (${elementX}, ${elementY})`);
              }
              break;

            case 'line':
              {
                const lineWidth = element.style?.width || 100;
                const lineHeight = element.style?.height || 2;
                const colorHex = element.style?.color || '#000000';

                // Parse color
                const r = parseInt(colorHex.slice(1, 3), 16) / 255;
                const g = parseInt(colorHex.slice(3, 5), 16) / 255;
                const b = parseInt(colorHex.slice(5, 7), 16) / 255;

                // Draw line as a filled rectangle
                page.drawRectangle({
                  x: elementX - (lineWidth / 2),
                  y: elementY - (lineHeight / 2),
                  width: lineWidth,
                  height: lineHeight,
                  color: rgb(r, g, b),
                  opacity: opacity
                });

                console.log(`✅ Line element rendered: ${lineWidth}x${lineHeight} at (${elementX}, ${elementY})`);
              }
              break;

            case 'dotted-line':
              {
                const lineWidth = element.style?.width || 100;
                const lineHeight = element.style?.height || 2;
                const colorHex = element.style?.color || '#000000';
                const dashArray = element.style?.dashArray || '5,5';

                // Parse color
                const r = parseInt(colorHex.slice(1, 3), 16) / 255;
                const g = parseInt(colorHex.slice(3, 5), 16) / 255;
                const b = parseInt(colorHex.slice(5, 7), 16) / 255;

                // Parse dash pattern (e.g., "5,5" -> [5, 5])
                const dashes = dashArray.split(',').map(d => parseInt(d.trim()) || 5);
                const dashLength = dashes[0] || 5;
                const gapLength = dashes[1] || 5;

                // Calculate how many dashes fit in the line width
                const totalDashUnit = dashLength + gapLength;
                const numDashes = Math.floor(lineWidth / totalDashUnit);

                // Draw individual dashes
                const startX = elementX - (lineWidth / 2);
                for (let i = 0; i < numDashes; i++) {
                  const dashX = startX + (i * totalDashUnit);
                  page.drawRectangle({
                    x: dashX,
                    y: elementY - (lineHeight / 2),
                    width: dashLength,
                    height: lineHeight,
                    color: rgb(r, g, b),
                    opacity: opacity
                  });
                }

                console.log(`✅ Dotted line element rendered: ${numDashes} dashes at (${elementX}, ${elementY})`);
              }
              break;

            default:
              console.warn(`⚠️ Unknown custom element type: ${element.type}`);
          }
        }
      }
    }

    // Save and return modified PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);

  } catch (error) {
    console.error('Error merging PDF footer:', error);
    throw error;
  }
}

export { mergePdfFooter, getDefaultFooterSettings };
