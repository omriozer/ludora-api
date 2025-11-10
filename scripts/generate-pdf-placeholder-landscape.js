/**
 * Script to generate PDF placeholder for restricted content (Landscape A4)
 * This creates a professional "Content Restricted" PDF page in landscape format
 * that can be used for landscape PDF templates in the visual editor.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generatePdfPlaceholderLandscape() {
  try {
    console.log('🔧 Generating landscape PDF placeholder for template editor...');

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a page with A4 landscape size (297mm x 210mm = 842pt x 595pt)
    const page = pdfDoc.addPage([842, 595]); // A4 landscape
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Define colors
    const darkGray = rgb(0.29, 0.31, 0.34); // #495057
    const mediumGray = rgb(0.42, 0.47, 0.53); // #6c757d
    const lightGray = rgb(0.68, 0.71, 0.74); // #adb5bd
    const blue = rgb(0.00, 0.48, 1.00); // #007bff
    const lightBlue = rgb(0.94, 0.97, 1.00); // #f0f7ff

    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: height,
      color: rgb(0.97, 0.98, 0.98), // #f8f9fa
    });

    // Main content box (adjusted for landscape)
    const boxWidth = 500;
    const boxHeight = 280;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1), // white
      borderColor: rgb(0.87, 0.89, 0.90), // #dee2e6
      borderWidth: 2,
    });

    // Lock icon (simplified as rectangles and circle)
    const lockX = width / 2;
    const lockY = boxY + boxHeight - 60;

    // Lock body
    page.drawRectangle({
      x: lockX - 15,
      y: lockY - 12,
      width: 30,
      height: 25,
      color: mediumGray,
    });

    // Lock shackle (simplified as rectangle)
    page.drawRectangle({
      x: lockX - 8,
      y: lockY + 8,
      width: 16,
      height: 3,
      color: mediumGray,
    });
    page.drawRectangle({
      x: lockX - 8,
      y: lockY + 8,
      width: 3,
      height: 12,
      color: mediumGray,
    });
    page.drawRectangle({
      x: lockX + 5,
      y: lockY + 8,
      width: 3,
      height: 12,
      color: mediumGray,
    });

    // Main heading
    page.drawText('Template Preview - Landscape Format', {
      x: width / 2 - 190,
      y: lockY - 40,
      size: 28,
      font: helveticaBold,
      color: darkGray,
    });

    // Secondary text
    page.drawText('This is a placeholder for PDF A4 landscape template editing', {
      x: width / 2 - 210,
      y: lockY - 75,
      size: 16,
      font: helveticaFont,
      color: mediumGray,
    });

    // Template editing info
    page.drawText('Use the visual editor to design your footer template layout', {
      x: width / 2 - 185,
      y: lockY - 105,
      size: 14,
      font: helveticaFont,
      color: blue,
    });

    // Dimensions info
    page.drawText('Landscape A4 (842 × 595 pt)', {
      x: width / 2 - 80,
      y: lockY - 130,
      size: 12,
      font: helveticaFont,
      color: mediumGray,
    });

    // Ludora branding box
    page.drawRectangle({
      x: width / 2 - 40,
      y: lockY - 165,
      width: 80,
      height: 25,
      color: lightBlue,
    });

    page.drawText('LUDORA', {
      x: width / 2 - 25,
      y: lockY - 158,
      size: 14,
      font: helveticaBold,
      color: blue,
    });

    // Footer note
    page.drawText('Template Editor - PDF A4 Landscape Format Preview', {
      x: width / 2 - 150,
      y: boxY - 25,
      size: 10,
      font: helveticaFont,
      color: lightGray,
    });

    // Watermark text (very light) - adjusted for landscape
    page.drawText('TEMPLATE PREVIEW', {
      x: width / 2 - 120,
      y: height / 2 - 80,
      size: 36,
      font: helveticaBold,
      color: rgb(0.95, 0.95, 0.95),
      opacity: 0.3,
    });

    // Footer area indicator (where footer templates would appear)
    page.drawRectangle({
      x: 50,
      y: 30,
      width: width - 100,
      height: 60,
      color: rgb(0.95, 0.97, 1.00), // very light blue
      borderColor: rgb(0.80, 0.85, 0.95),
      borderWidth: 1,
    });

    page.drawText('Footer Template Area - Design your footer layout in this region', {
      x: width / 2 - 180,
      y: 55,
      size: 11,
      font: helveticaFont,
      color: rgb(0.40, 0.50, 0.80),
    });

    // Header area indicator (where header templates would appear)
    page.drawRectangle({
      x: 50,
      y: height - 90,
      width: width - 100,
      height: 60,
      color: rgb(0.95, 1.00, 0.95), // very light green
      borderColor: rgb(0.80, 0.95, 0.85),
      borderWidth: 1,
    });

    page.drawText('Header Template Area - Design your header layout in this region', {
      x: width / 2 - 185,
      y: height - 65,
      size: 11,
      font: helveticaFont,
      color: rgb(0.40, 0.80, 0.50),
    });

    // Serialize the PDF document to bytes
    const pdfBytes = await pdfDoc.save();

    // Write to file
    const outputPath = path.join(process.cwd(), 'assets', 'placeholders', 'preview-not-available-landscape.pdf');

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pdfBytes);

    console.log('✅ Landscape PDF placeholder generated successfully!');
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`📊 File size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

    return outputPath;

  } catch (error) {
    console.error('❌ Error generating landscape PDF placeholder:', error);
    throw error;
  }
}

// Run the function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePdfPlaceholderLandscape()
    .then((filePath) => {
      console.log(`🎉 Landscape PDF placeholder ready at: ${filePath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate landscape PDF placeholder:', error);
      process.exit(1);
    });
}

export { generatePdfPlaceholderLandscape };