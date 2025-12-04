#!/usr/bin/env node

/**
 * Verify Placeholder System
 *
 * Checks that all placeholder files exist and are properly configured
 * for the preview system to work correctly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLACEHOLDER_DIR = path.join(__dirname, '..', 'assets', 'placeholders');

// Expected placeholder files
const REQUIRED_FILES = {
  pdf: [
    'preview-not-available-portrait.pdf',
    'preview-not-available-landscape.pdf',
    'preview-not-available-slide.pdf'
  ],
  svg: [
    'preview-not-available.svg'
  ]
};

// Expected dimensions for PDF placeholders
const EXPECTED_DIMENSIONS = {
  'preview-not-available-portrait.pdf': { width: 595, height: 842 },
  'preview-not-available-landscape.pdf': { width: 842, height: 595 },
  'preview-not-available-slide.pdf': { width: 800, height: 600 }
};

/**
 * Check if a file exists and get its size
 */
function checkFile(filename) {
  const filePath = path.join(PLACEHOLDER_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      path: filePath
    };
  }

  const stats = fs.statSync(filePath);
  return {
    exists: true,
    path: filePath,
    size: stats.size,
    sizeKB: Math.round(stats.size / 1024)
  };
}

/**
 * Verify PDF dimensions
 */
async function verifyPdfDimensions(filename, expectedWidth, expectedHeight) {
  try {
    const filePath = path.join(PLACEHOLDER_DIR, filename);
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    const widthMatch = Math.abs(width - expectedWidth) < 1;
    const heightMatch = Math.abs(height - expectedHeight) < 1;

    return {
      valid: widthMatch && heightMatch,
      actual: { width: Math.round(width), height: Math.round(height) },
      expected: { width: expectedWidth, height: expectedHeight }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Verify SVG content
 */
function verifySvgContent(filename) {
  try {
    const filePath = path.join(PLACEHOLDER_DIR, filename);
    const svgContent = fs.readFileSync(filePath, 'utf8');

    // Basic SVG validation
    const hasSvgTag = svgContent.includes('<svg');
    const hasViewBox = svgContent.includes('viewBox');
    const hasContent = svgContent.length > 100;

    return {
      valid: hasSvgTag && hasViewBox && hasContent,
      hasSvgTag,
      hasViewBox,
      contentLength: svgContent.length
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Main verification
 */
async function main() {
  console.log('🔍 Verifying Placeholder System...\n');

  let allValid = true;

  // Check PDF placeholders
  console.log('📄 PDF Placeholders:');
  for (const filename of REQUIRED_FILES.pdf) {
    const fileCheck = checkFile(filename);

    if (!fileCheck.exists) {
      console.log(`  ❌ ${filename}: NOT FOUND`);
      console.log(`     Expected at: ${fileCheck.path}`);
      allValid = false;
      continue;
    }

    console.log(`  ✅ ${filename}: ${fileCheck.sizeKB}KB`);

    // Verify dimensions
    const expected = EXPECTED_DIMENSIONS[filename];
    if (expected) {
      const dimensionCheck = await verifyPdfDimensions(filename, expected.width, expected.height);

      if (!dimensionCheck.valid) {
        console.log(`     ⚠️  Dimension mismatch:`);
        console.log(`        Expected: ${dimensionCheck.expected.width} × ${dimensionCheck.expected.height}`);
        console.log(`        Actual: ${dimensionCheck.actual.width} × ${dimensionCheck.actual.height}`);
        allValid = false;
      } else {
        console.log(`     ✓ Dimensions: ${dimensionCheck.actual.width} × ${dimensionCheck.actual.height}`);
      }
    }
  }

  console.log('\n📐 SVG Placeholders:');
  for (const filename of REQUIRED_FILES.svg) {
    const fileCheck = checkFile(filename);

    if (!fileCheck.exists) {
      console.log(`  ❌ ${filename}: NOT FOUND`);
      console.log(`     Expected at: ${fileCheck.path}`);
      allValid = false;
      continue;
    }

    console.log(`  ✅ ${filename}: ${fileCheck.sizeKB}KB`);

    // Verify SVG content
    const svgCheck = verifySvgContent(filename);

    if (!svgCheck.valid) {
      console.log(`     ⚠️  Invalid SVG content`);
      if (svgCheck.error) {
        console.log(`        Error: ${svgCheck.error}`);
      }
      allValid = false;
    } else {
      console.log(`     ✓ Valid SVG (${svgCheck.contentLength} bytes)`);
    }
  }

  console.log('\n📋 Integration Points:');

  // Check if pdfTemplateMerge.js references the correct files
  const pdfTemplateMergePath = path.join(__dirname, '..', 'utils', 'pdfTemplateMerge.js');
  if (fs.existsSync(pdfTemplateMergePath)) {
    const content = fs.readFileSync(pdfTemplateMergePath, 'utf8');

    const checks = [
      { name: 'Portrait PDF reference', pattern: 'preview-not-available-portrait.pdf' },
      { name: 'Landscape PDF reference', pattern: 'preview-not-available-landscape.pdf' },
      { name: 'Slide PDF reference', pattern: 'preview-not-available-slide.pdf' }
    ];

    for (const check of checks) {
      if (content.includes(check.pattern)) {
        console.log(`  ✅ ${check.name}: Found`);
      } else {
        console.log(`  ❌ ${check.name}: NOT FOUND`);
        allValid = false;
      }
    }
  } else {
    console.log('  ⚠️  pdfTemplateMerge.js not found');
  }

  // Check if svgSlides.js references the SVG file
  const svgSlidesPath = path.join(__dirname, '..', 'routes', 'svgSlides.js');
  if (fs.existsSync(svgSlidesPath)) {
    const content = fs.readFileSync(svgSlidesPath, 'utf8');

    if (content.includes('preview-not-available.svg')) {
      console.log('  ✅ SVG placeholder reference: Found in svgSlides.js');
    } else {
      console.log('  ❌ SVG placeholder reference: NOT FOUND in svgSlides.js');
      allValid = false;
    }
  } else {
    console.log('  ⚠️  svgSlides.js not found');
  }

  console.log('\n' + '='.repeat(60));

  if (allValid) {
    console.log('✅ All placeholder system checks passed!');
    console.log('   The preview system is properly configured.');
    process.exit(0);
  } else {
    console.log('❌ Some placeholder system checks failed!');
    console.log('   Please review the issues above.');
    process.exit(1);
  }
}

// Run verification
main().catch((error) => {
  console.error('❌ Verification failed with error:', error);
  process.exit(1);
});
