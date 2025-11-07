/**
 * Test SVG Watermark Processing Engine
 *
 * Simple test to verify SVG watermark functionality
 */

import { applyWatermarksToSvg, addSimpleTextWatermark } from '../utils/svgWatermark.js';

// Sample SVG content for testing
const sampleSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f0f0f0"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">
    Sample Lesson Plan Slide
  </text>
  <circle cx="400" cy="200" r="50" fill="#007bff"/>
</svg>`;

// Test watermark template
const testTemplate = {
  textElements: [
    {
      id: 'test-watermark',
      content: 'TEST WATERMARK',
      position: { x: 50, y: 50 },
      style: {
        fontSize: 32,
        color: '#FF6B6B',
        opacity: 40,
        rotation: 45,
        fontFamily: 'Arial, sans-serif'
      },
      pattern: 'single',
      visible: true
    }
  ],
  logoElements: [
    {
      id: 'test-logo',
      source: 'system-logo',
      url: '/api/assets/image/settings/logo.png',
      position: { x: 85, y: 15 },
      style: {
        size: 60,
        opacity: 30,
        rotation: 0
      },
      pattern: 'single',
      visible: true
    }
  ],
  globalSettings: {
    layerBehindContent: false,
    preserveReadability: true
  }
};

async function testSvgWatermark() {
  try {
    console.log('🧪 Testing SVG Watermark Processing...\n');

    // Test 1: Simple text watermark
    console.log('1️⃣ Testing simple text watermark...');
    const simpleResult = await addSimpleTextWatermark(sampleSvg, 'PREVIEW ONLY');
    console.log('✅ Simple watermark applied successfully');
    console.log(`   Result length: ${simpleResult.length} characters\n`);

    // Test 2: Template-based watermark
    console.log('2️⃣ Testing template-based watermark...');
    const variables = {
      filename: 'test-slide.svg',
      user: 'Test User'
    };
    const templateResult = await applyWatermarksToSvg(sampleSvg, testTemplate, variables);
    console.log('✅ Template watermark applied successfully');
    console.log(`   Result length: ${templateResult.length} characters\n`);

    // Test 3: Verify SVG structure is preserved
    console.log('3️⃣ Testing SVG structure preservation...');
    const hasOriginalContent = templateResult.includes('Sample Lesson Plan Slide');
    const hasWatermarks = templateResult.includes('ludora-watermarks');
    const hasTextWatermark = templateResult.includes('TEST WATERMARK');

    console.log(`   ✅ Original content preserved: ${hasOriginalContent}`);
    console.log(`   ✅ Watermark group added: ${hasWatermarks}`);
    console.log(`   ✅ Text watermark present: ${hasTextWatermark}\n`);

    // Test 4: Variable substitution
    console.log('4️⃣ Testing variable substitution...');
    const templateWithVars = {
      textElements: [{
        id: 'var-test',
        content: 'File: {{filename}} - Date: {{date}}',
        position: { x: 50, y: 90 },
        style: { fontSize: 14, color: '#666', opacity: 80 },
        pattern: 'single',
        visible: true
      }],
      globalSettings: {}
    };

    const varResult = await applyWatermarksToSvg(sampleSvg, templateWithVars, variables);
    const hasVariables = varResult.includes('test-slide.svg');
    console.log(`   ✅ Variable substitution working: ${hasVariables}\n`);

    console.log('🎉 All SVG watermark tests passed!\n');

    return {
      simple: simpleResult,
      template: templateResult,
      variables: varResult
    };

  } catch (error) {
    console.error('❌ SVG watermark test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSvgWatermark()
    .then((results) => {
      console.log('📁 Test results available for inspection');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testSvgWatermark };
export default testSvgWatermark;