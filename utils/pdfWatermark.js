import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fetch from 'node-fetch';
import fs from 'fs';
import fontkit from './fontkit.js';

/**
 * Adds watermarks to a PDF for preview mode
 *
 * @param {Buffer} pdfBuffer - Original PDF as buffer
 * @param {string} logoUrl - Logo URL from settings
 * @returns {Promise<Buffer>} Watermarked PDF as buffer
 */
async function addPdfWatermarks(pdfBuffer, logoUrl) {
  try {
    console.log('🔍 PDF Watermark: Processing with logoUrl:', logoUrl);

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Register fontkit for custom font support
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();

    // Get fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Load logo if available
    let logoImage = null;
    if (logoUrl) {
      console.log('🖼️ PDF Watermark: Attempting to load logo from:', logoUrl);
      try {
        let logoBytes;

        // Check if logoUrl is a HTTP URL or local file path
        if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
          // Fetch from URL
          const logoResponse = await fetch(logoUrl);
          logoBytes = await logoResponse.arrayBuffer();
        } else {
          // Read from local file
          logoBytes = fs.readFileSync(logoUrl);
        }

        // Determine image type and embed
        if (logoUrl.toLowerCase().endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoBytes);
          console.log('✅ PDF Watermark: PNG logo embedded successfully');
        } else if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
          logoImage = await pdfDoc.embedJpg(logoBytes);
          console.log('✅ PDF Watermark: JPG logo embedded successfully');
        } else {
          console.log('⚠️ PDF Watermark: Unsupported logo format:', logoUrl);
        }
      } catch (error) {
        console.error('❌ PDF Watermark: Failed to load logo:', error);
        // Continue without logo
      }
    } else {
      console.log('ℹ️ PDF Watermark: No logo URL provided');
    }

    // Watermark text (using English to avoid Hebrew font encoding issues)
    const watermarkText = 'PREVIEW ONLY';

    // Process each page
    for (const page of pages) {
      const { width, height } = page.getSize();

      // Center watermark (large, rotated, low opacity)
      const centerX = width / 2;
      const centerY = height / 2;

      // Draw logo in center if available
      if (logoImage) {
        const logoSize = Math.min(width, height) * 0.15; // 15% of page size
        const logoWidth = logoSize;
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

        console.log('🖼️ PDF Watermark: Drawing logo on page', {
          logoSize,
          logoWidth,
          logoHeight,
          centerX,
          centerY,
          pageWidth: width,
          pageHeight: height
        });

        page.drawImage(logoImage, {
          x: centerX - (logoWidth / 2),
          y: centerY - (logoHeight / 2) + 40, // Slightly above center
          width: logoWidth,
          height: logoHeight,
          opacity: 0.15,
          rotate: { type: 'degrees', angle: 45 }
        });
      } else {
        console.log('⚠️ PDF Watermark: No logo to draw on this page');
      }

      // Draw center watermark text
      const fontSize = Math.min(width, height) * 0.08; // 8% of page size
      const textWidth = boldFont.widthOfTextAtSize(watermarkText, fontSize);

      page.drawText(watermarkText, {
        x: centerX - (textWidth / 2),
        y: centerY - (logoImage ? 40 : 0), // Below logo if logo exists, otherwise center
        size: fontSize,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3), // Dark gray
        opacity: 0.2,
        rotate: { type: 'degrees', angle: 45 }
      });

      // Corner watermarks (smaller, less prominent)
      const cornerFontSize = fontSize * 0.3;
      const cornerTextWidth = font.widthOfTextAtSize(watermarkText, cornerFontSize);

      // Top-left corner
      page.drawText(watermarkText, {
        x: 50,
        y: height - 50,
        size: cornerFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.1,
        rotate: { type: 'degrees', angle: 45 }
      });

      // Top-right corner
      page.drawText(watermarkText, {
        x: width - cornerTextWidth - 50,
        y: height - 50,
        size: cornerFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.1,
        rotate: { type: 'degrees', angle: 45 }
      });

      // Bottom-left corner
      page.drawText(watermarkText, {
        x: 50,
        y: 50,
        size: cornerFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.1,
        rotate: { type: 'degrees', angle: 45 }
      });

      // Bottom-right corner
      page.drawText(watermarkText, {
        x: width - cornerTextWidth - 50,
        y: 50,
        size: cornerFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.1,
        rotate: { type: 'degrees', angle: 45 }
      });

      // Additional scattered watermarks for better coverage
      const scatterPositions = [
        { x: width * 0.25, y: height * 0.75 },
        { x: width * 0.75, y: height * 0.75 },
        { x: width * 0.25, y: height * 0.25 },
        { x: width * 0.75, y: height * 0.25 }
      ];

      scatterPositions.forEach(pos => {
        page.drawText(watermarkText, {
          x: pos.x - (cornerTextWidth / 2),
          y: pos.y,
          size: cornerFontSize,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.08,
          rotate: { type: 'degrees', angle: 45 }
        });
      });
    }

    // Save and return watermarked PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);

  } catch (error) {
    console.error('Error adding PDF watermarks:', error);
    throw error;
  }
}

export { addPdfWatermarks };