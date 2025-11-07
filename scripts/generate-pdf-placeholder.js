/**
 * Script to generate PDF placeholder for restricted content
 * This creates a professional "Content Restricted" PDF page that can be used
 * to replace inaccessible pages while maintaining document structure.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generatePdfPlaceholder() {
  try {
    console.log('🔧 Generating PDF placeholder for restricted content...');

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a page with standard letter size
    const page = pdfDoc.addPage([612, 792]); // 8.5" x 11" (letter size)
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

    // Main content box
    const boxWidth = 400;
    const boxHeight = 300;
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
    const lockY = boxY + boxHeight - 80;

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
    page.drawText('Content Restricted', {
      x: width / 2 - 140,
      y: lockY - 50,
      size: 32,
      font: helveticaBold,
      color: darkGray,
    });

    // Secondary text
    page.drawText('This content is available to purchased users only', {
      x: width / 2 - 180,
      y: lockY - 85,
      size: 16,
      font: helveticaFont,
      color: mediumGray,
    });

    // Upgrade message
    page.drawText('Upgrade your plan to access this content', {
      x: width / 2 - 155,
      y: lockY - 115,
      size: 14,
      font: helveticaFont,
      color: blue,
    });

    // Website URL
    page.drawText('ludora.app', {
      x: width / 2 - 35,
      y: lockY - 140,
      size: 12,
      font: helveticaFont,
      color: mediumGray,
    });

    // Ludora branding box
    page.drawRectangle({
      x: width / 2 - 40,
      y: lockY - 180,
      width: 80,
      height: 25,
      color: lightBlue,
    });

    page.drawText('LUDORA', {
      x: width / 2 - 25,
      y: lockY - 173,
      size: 14,
      font: helveticaBold,
      color: blue,
    });

    // Footer note
    page.drawText('This page is part of a preview version. Purchase the full content for complete access.', {
      x: width / 2 - 250,
      y: boxY - 30,
      size: 10,
      font: helveticaFont,
      color: lightGray,
    });

    // Watermark text (very light)
    page.drawText('PREVIEW ONLY', {
      x: width / 2 - 80,
      y: height / 2 - 100,
      size: 40,
      font: helveticaBold,
      color: rgb(0.95, 0.95, 0.95),
      opacity: 0.3,
    });

    // Serialize the PDF document to bytes
    const pdfBytes = await pdfDoc.save();

    // Write to file
    const outputPath = path.join(process.cwd(), 'assets', 'placeholders', 'preview-not-available.pdf');

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pdfBytes);

    console.log('✅ PDF placeholder generated successfully!');
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`📊 File size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

    return outputPath;

  } catch (error) {
    console.error('❌ Error generating PDF placeholder:', error);
    throw error;
  }
}

// Run the function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePdfPlaceholder()
    .then((filePath) => {
      console.log(`🎉 PDF placeholder ready at: ${filePath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate PDF placeholder:', error);
      process.exit(1);
    });
}

export { generatePdfPlaceholder };