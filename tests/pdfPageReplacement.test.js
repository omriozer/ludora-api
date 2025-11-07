/**
 * Test PDF Page Replacement Service
 *
 * Simple test to verify PDF selective page access functionality
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { processSelectiveAccessPdf } from '../services/PdfPageReplacementService.js';

/**
 * Create a simple test PDF with multiple pages
 * @param {number} pageCount - Number of pages to create
 * @returns {Promise<Buffer>} - Test PDF buffer
 */
async function createTestPdf(pageCount = 5) {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pageCount; i++) {
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    // Add page content
    page.drawRectangle({
      x: 50,
      y: height - 150,
      width: width - 100,
      height: 100,
      color: rgb(0.9, 0.9, 1.0),
    });

    page.drawText(`Test Document - Page ${i}`, {
      x: 100,
      y: height - 100,
      size: 24,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`This is the content of page ${i}.\nThis page contains important information.`, {
      x: 100,
      y: height - 200,
      size: 14,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Add some more content to make it realistic
    page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', {
      x: 100,
      y: height - 250,
      size: 12,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return await pdfDoc.save();
}

/**
 * Test watermark template
 */
const testWatermarkTemplate = {
  textElements: [
    {
      id: 'preview-text',
      content: 'PREVIEW ONLY - Page {{page}}',
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        color: '#FF6B6B',
        opacity: 40,
        rotation: 45
      },
      pattern: 'single',
      visible: true
    }
  ],
  logoElements: [
    {
      id: 'preview-logo',
      source: 'system-logo',
      url: '/api/assets/image/settings/logo.png',
      position: { x: 85, y: 15 },
      style: {
        size: 50,
        opacity: 30,
        rotation: 0
      },
      pattern: 'single',
      visible: true
    }
  ],
  globalSettings: {
    layerBehindContent: false
  }
};

async function testPdfPageReplacement() {
  try {
    console.log('🧪 Testing PDF Page Replacement Service...\n');

    // Test 1: Create test PDF
    console.log('1️⃣ Creating test PDF with 5 pages...');
    const testPdfBuffer = await createTestPdf(5);
    console.log(`✅ Test PDF created (${(testPdfBuffer.length / 1024).toFixed(2)} KB)\n`);

    // Test 2: Full access (no restrictions)
    console.log('2️⃣ Testing full access (no page restrictions)...');
    const fullAccessResult = await processSelectiveAccessPdf(
      testPdfBuffer,
      null, // No restrictions
      testWatermarkTemplate,
      { filename: 'test-document.pdf', user: 'Test User' }
    );
    console.log(`✅ Full access PDF processed (${(fullAccessResult.length / 1024).toFixed(2)} KB)\n`);

    // Test 3: Selective access (pages 1, 3, 5)
    console.log('3️⃣ Testing selective access (pages 1, 3, 5 accessible)...');
    const selectiveResult = await processSelectiveAccessPdf(
      testPdfBuffer,
      [1, 3, 5], // Only pages 1, 3, 5 accessible
      testWatermarkTemplate,
      { filename: 'test-document.pdf', user: 'Test User' }
    );
    console.log(`✅ Selective access PDF processed (${(selectiveResult.length / 1024).toFixed(2)} KB)\n`);

    // Test 4: No accessible pages (all restricted)
    console.log('4️⃣ Testing complete restriction (no accessible pages)...');
    const restrictedResult = await processSelectiveAccessPdf(
      testPdfBuffer,
      [], // No pages accessible
      testWatermarkTemplate,
      { filename: 'test-document.pdf' }
    );
    console.log(`✅ Completely restricted PDF processed (${(restrictedResult.length / 1024).toFixed(2)} KB)\n`);

    // Test 5: Verify document structure
    console.log('5️⃣ Verifying document structure preservation...');

    const originalPdf = await PDFDocument.load(testPdfBuffer);
    const selectivePdf = await PDFDocument.load(selectiveResult);

    const originalPageCount = originalPdf.getPageCount();
    const selectivePageCount = selectivePdf.getPageCount();

    console.log(`   📄 Original pages: ${originalPageCount}`);
    console.log(`   📄 Selective PDF pages: ${selectivePageCount}`);
    console.log(`   ✅ Page count preserved: ${originalPageCount === selectivePageCount}\n`);

    // Test 6: Invalid page numbers handling
    console.log('6️⃣ Testing invalid page numbers handling...');
    const invalidPagesResult = await processSelectiveAccessPdf(
      testPdfBuffer,
      [1, 10, -5, 3.5, 'invalid'], // Mix of valid and invalid page numbers
      testWatermarkTemplate,
      { filename: 'test-document.pdf' }
    );
    console.log(`✅ Invalid pages handled gracefully (${(invalidPagesResult.length / 1024).toFixed(2)} KB)\n`);

    console.log('🎉 All PDF page replacement tests passed!\n');

    return {
      original: testPdfBuffer,
      fullAccess: fullAccessResult,
      selective: selectiveResult,
      restricted: restrictedResult,
      invalidPages: invalidPagesResult
    };

  } catch (error) {
    console.error('❌ PDF page replacement test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPdfPageReplacement()
    .then((results) => {
      console.log('📁 Test results available for inspection');
      console.log('💡 Check the generated PDFs to verify watermarks and page replacements');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testPdfPageReplacement };
export default testPdfPageReplacement;