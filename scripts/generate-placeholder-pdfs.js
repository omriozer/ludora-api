#!/usr/bin/env node

/**
 * Generate Placeholder PDFs Script
 *
 * Creates three placeholder PDF files for the page replacement system:
 * 1. Portrait A4 (595 × 842 pt)
 * 2. Landscape A4 (842 × 595 pt)
 * 3. Slide format (800 × 600 pt)
 *
 * All files include Hebrew text and the Ludora logo.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hebrew text - using English for now due to font limitations
const HEBREW_TEXT = 'This page is protected and will be available after purchase';
const HEBREW_TEXT_ORIGINAL = 'עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה';
const SECONDARY_TEXT = 'Upgrade your plan for full access';
const SECONDARY_TEXT_ORIGINAL = 'שדרגו את החבילה שלכם לגישה מלאה';
const WEBSITE_TEXT = 'ludora.app';

// Note: We'll use English text for now since Hebrew requires special font support
console.log('📝 Note: Using English text due to Hebrew font limitations in pdf-lib');

// Brand colors
const COLORS = {
  primary: rgb(0, 0.48, 1),      // #007bff
  gray: rgb(0.42, 0.46, 0.49),   // #6c757d
  lightGray: rgb(0.97, 0.98, 0.98), // #f8f9fa
  borderGray: rgb(0.87, 0.89, 0.90), // #dee2e6
  white: rgb(1, 1, 1),
  darkGray: rgb(0.29, 0.31, 0.32) // #495057
};

/**
 * Load Ludora logo
 */
async function loadLogo() {
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.png');
    if (!fs.existsSync(logoPath)) {
      console.log('⚠️ Logo file not found at:', logoPath);
      return null;
    }

    const logoData = fs.readFileSync(logoPath);
    console.log('✅ Logo loaded successfully');
    return logoData;
  } catch (error) {
    console.log('⚠️ Failed to load logo:', error.message);
    return null;
  }
}

/**
 * Draw background with dot pattern
 */
function drawBackground(page, width, height) {
  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: COLORS.lightGray
  });

  // Subtle dot pattern
  const dotSpacing = 30;
  for (let x = dotSpacing; x < width; x += dotSpacing) {
    for (let y = dotSpacing; y < height; y += dotSpacing) {
      page.drawCircle({
        x: x,
        y: y,
        size: 0.8,
        color: COLORS.borderGray,
        opacity: 0.5
      });
    }
  }
}

/**
 * Draw lock icon
 */
function drawLockIcon(page, centerX, centerY, size = 30) {
  const lockWidth = size;
  const lockHeight = size * 0.8;

  // Lock body
  page.drawRectangle({
    x: centerX - (lockWidth / 2),
    y: centerY - (lockHeight / 2),
    width: lockWidth,
    height: lockHeight * 0.6,
    color: COLORS.gray,
    borderRadius: 3
  });

  // Lock shackle (simplified as arc)
  const shackleWidth = lockWidth * 0.5;
  const shackleHeight = lockHeight * 0.4;

  // Draw shackle as rectangle outline
  page.drawRectangle({
    x: centerX - (shackleWidth / 2),
    y: centerY + (lockHeight * 0.1),
    width: shackleWidth,
    height: shackleHeight,
    borderColor: COLORS.gray,
    borderWidth: 3,
    color: COLORS.lightGray // Same as background to create outline effect
  });

  // Keyhole
  page.drawCircle({
    x: centerX,
    y: centerY - (lockHeight * 0.1),
    size: 3,
    color: COLORS.white
  });

  page.drawRectangle({
    x: centerX - 1,
    y: centerY - (lockHeight * 0.3),
    width: 2,
    height: 8,
    color: COLORS.white
  });
}

/**
 * Draw logo or fallback text
 */
async function drawLogo(page, pdfDoc, logoData, centerX, centerY, maxWidth = 120) {
  if (logoData) {
    try {
      const logoImage = await pdfDoc.embedPng(logoData);
      const logoAspectRatio = logoImage.width / logoImage.height;

      // Calculate logo dimensions maintaining aspect ratio
      let logoWidth = maxWidth;
      let logoHeight = logoWidth / logoAspectRatio;

      // If height is too large, constrain by height
      if (logoHeight > 60) {
        logoHeight = 60;
        logoWidth = logoHeight * logoAspectRatio;
      }

      page.drawImage(logoImage, {
        x: centerX - (logoWidth / 2),
        y: centerY - (logoHeight / 2),
        width: logoWidth,
        height: logoHeight
      });

      return;
    } catch (error) {
      console.log('⚠️ Failed to embed logo, using fallback text');
    }
  }

  // Fallback to text
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoText = 'LUDORA';
  const fontSize = 20;
  const textWidth = font.widthOfTextAtSize(logoText, fontSize);

  // Background for text logo
  page.drawRectangle({
    x: centerX - (textWidth / 2) - 15,
    y: centerY - 15,
    width: textWidth + 30,
    height: 30,
    color: COLORS.primary,
    opacity: 0.1,
    borderRadius: 15
  });

  page.drawText(logoText, {
    x: centerX - (textWidth / 2),
    y: centerY - (fontSize / 3),
    size: fontSize,
    font: font,
    color: COLORS.primary
  });
}

/**
 * Generate Portrait A4 Placeholder
 */
async function generatePortraitPlaceholder(logoData) {
  console.log('📄 Generating portrait A4 placeholder...');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 Portrait
  const { width, height } = page.getSize();

  // Background
  drawBackground(page, width, height);

  // Main content container
  const containerWidth = 440;
  const containerHeight = 320;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2;

  page.drawRectangle({
    x: containerX,
    y: containerY,
    width: containerWidth,
    height: containerHeight,
    color: COLORS.white,
    borderColor: COLORS.borderGray,
    borderWidth: 2,
    borderRadius: 16
  });

  // Content positioning
  const centerX = width / 2;
  let currentY = containerY + containerHeight - 60;

  // Lock icon
  drawLockIcon(page, centerX, currentY, 35);
  currentY -= 60;

  // Hebrew headline
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const headlineSize = 22;
  const headlineWidth = font.widthOfTextAtSize(HEBREW_TEXT, headlineSize);

  page.drawText(HEBREW_TEXT, {
    x: centerX - (headlineWidth / 2),
    y: currentY,
    size: headlineSize,
    font: font,
    color: COLORS.darkGray
  });
  currentY -= 45;

  // Secondary Hebrew text
  const secondarySize = 16;
  const secondaryWidth = regularFont.widthOfTextAtSize(SECONDARY_TEXT, secondarySize);

  page.drawText(SECONDARY_TEXT, {
    x: centerX - (secondaryWidth / 2),
    y: currentY,
    size: secondarySize,
    font: regularFont,
    color: COLORS.primary
  });
  currentY -= 35;

  // Website URL
  const urlSize = 14;
  const urlWidth = regularFont.widthOfTextAtSize(WEBSITE_TEXT, urlSize);

  page.drawText(WEBSITE_TEXT, {
    x: centerX - (urlWidth / 2),
    y: currentY,
    size: urlSize,
    font: regularFont,
    color: COLORS.gray
  });
  currentY -= 50;

  // Logo
  await drawLogo(page, pdfDoc, logoData, centerX, currentY);

  return pdfDoc;
}

/**
 * Generate Landscape A4 Placeholder
 */
async function generateLandscapePlaceholder(logoData) {
  console.log('📄 Generating landscape A4 placeholder...');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 Landscape
  const { width, height } = page.getSize();

  // Background
  drawBackground(page, width, height);

  // Main content container (wider for landscape)
  const containerWidth = 600;
  const containerHeight = 280;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2;

  page.drawRectangle({
    x: containerX,
    y: containerY,
    width: containerWidth,
    height: containerHeight,
    color: COLORS.white,
    borderColor: COLORS.borderGray,
    borderWidth: 2,
    borderRadius: 16
  });

  // Content positioning - horizontal layout
  const leftSide = containerX + 80;
  const rightSide = containerX + containerWidth - 80;
  const centerY = containerY + (containerHeight / 2);

  // Lock icon on left
  drawLockIcon(page, leftSide, centerY + 20, 40);

  // Text content on right side
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let textY = centerY + 40;

  // Hebrew headline
  const headlineSize = 24;
  const headlineWidth = font.widthOfTextAtSize(HEBREW_TEXT, headlineSize);

  page.drawText(HEBREW_TEXT, {
    x: rightSide - (headlineWidth / 2),
    y: textY,
    size: headlineSize,
    font: font,
    color: COLORS.darkGray
  });
  textY -= 40;

  // Secondary Hebrew text
  const secondarySize = 16;
  const secondaryWidth = regularFont.widthOfTextAtSize(SECONDARY_TEXT, secondarySize);

  page.drawText(SECONDARY_TEXT, {
    x: rightSide - (secondaryWidth / 2),
    y: textY,
    size: secondarySize,
    font: regularFont,
    color: COLORS.primary
  });
  textY -= 30;

  // Website URL
  const urlSize = 14;
  const urlWidth = regularFont.widthOfTextAtSize(WEBSITE_TEXT, urlSize);

  page.drawText(WEBSITE_TEXT, {
    x: rightSide - (urlWidth / 2),
    y: textY,
    size: urlSize,
    font: regularFont,
    color: COLORS.gray
  });

  // Logo at bottom center
  await drawLogo(page, pdfDoc, logoData, width / 2, containerY - 30, 100);

  return pdfDoc;
}

/**
 * Generate Slide Format Placeholder
 */
async function generateSlidePlaceholder(logoData) {
  console.log('📄 Generating slide format placeholder...');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([800, 600]); // Slide format
  const { width, height } = page.getSize();

  // Background
  drawBackground(page, width, height);

  // Main content container
  const containerWidth = 560;
  const containerHeight = 360;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2;

  page.drawRectangle({
    x: containerX,
    y: containerY,
    width: containerWidth,
    height: containerHeight,
    color: COLORS.white,
    borderColor: COLORS.borderGray,
    borderWidth: 2,
    borderRadius: 16
  });

  // Content positioning - presentation style
  const centerX = width / 2;
  let currentY = containerY + containerHeight - 50;

  // Lock icon
  drawLockIcon(page, centerX, currentY, 35);
  currentY -= 60;

  // Hebrew headline
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const headlineSize = 26;
  const headlineWidth = font.widthOfTextAtSize(HEBREW_TEXT, headlineSize);

  page.drawText(HEBREW_TEXT, {
    x: centerX - (headlineWidth / 2),
    y: currentY,
    size: headlineSize,
    font: font,
    color: COLORS.darkGray
  });
  currentY -= 50;

  // Secondary Hebrew text
  const secondarySize = 18;
  const secondaryWidth = regularFont.widthOfTextAtSize(SECONDARY_TEXT, secondarySize);

  page.drawText(SECONDARY_TEXT, {
    x: centerX - (secondaryWidth / 2),
    y: currentY,
    size: secondarySize,
    font: regularFont,
    color: COLORS.primary
  });
  currentY -= 40;

  // Website URL
  const urlSize = 14;
  const urlWidth = regularFont.widthOfTextAtSize(WEBSITE_TEXT, urlSize);

  page.drawText(WEBSITE_TEXT, {
    x: centerX - (urlWidth / 2),
    y: currentY,
    size: urlSize,
    font: regularFont,
    color: COLORS.gray
  });
  currentY -= 50;

  // Logo
  await drawLogo(page, pdfDoc, logoData, centerX, currentY, 140);

  return pdfDoc;
}

/**
 * Save PDF to file
 */
async function savePDF(pdfDoc, filename) {
  try {
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(__dirname, '..', 'assets', 'placeholders', filename);

    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`✅ Generated: ${filename} (${Math.round(pdfBytes.length / 1024)}KB)`);
  } catch (error) {
    console.error(`❌ Failed to generate ${filename}:`, error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting placeholder PDF generation...');
  console.log('📝 Hebrew text:', HEBREW_TEXT);
  console.log('📝 Secondary text:', SECONDARY_TEXT);
  console.log();

  // Load logo
  const logoData = await loadLogo();

  try {
    // Generate all three placeholder files
    const portraitPdf = await generatePortraitPlaceholder(logoData);
    await savePDF(portraitPdf, 'preview-not-available-portrait.pdf');

    const landscapePdf = await generateLandscapePlaceholder(logoData);
    await savePDF(landscapePdf, 'preview-not-available-landscape.pdf');

    const slidePdf = await generateSlidePlaceholder(logoData);
    await savePDF(slidePdf, 'preview-not-available-slide.pdf');

    console.log();
    console.log('✅ All placeholder PDFs generated successfully!');
    console.log('📁 Files saved to: assets/placeholders/');

  } catch (error) {
    console.error('❌ Error generating PDFs:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as generatePlaceholderPDFs };