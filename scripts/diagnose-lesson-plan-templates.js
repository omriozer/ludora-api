#!/usr/bin/env node

/**
 * Diagnostic Script for Lesson Plan Template Issues
 *
 * This script helps diagnose watermark and branding template issues in production
 * by checking lesson plan data, system templates, and template merging process.
 *
 * Usage:
 *   node scripts/diagnose-lesson-plan-templates.js [lessonPlanId]
 */

import dotenv from 'dotenv';
import models from '../models/index.js';
import { mergeSvgTemplate } from '../utils/svgTemplateMerge.js';

// Load environment
const env = process.env.ENVIRONMENT || 'production';
if (env !== 'production') {
  dotenv.config({ path: `.env.${env}` });
}
dotenv.config({ path: '.env' });

const { ludlog, luderror } = await import('../lib/ludlog.js');

class TemplateDiagnostics {
  async diagnoseAll() {
    ludlog.generic('🔍 Starting comprehensive template diagnostics...');

    try {
      // Step 1: Check all lesson plans
      const lessonPlans = await models.LessonPlan.findAll({
        order: [['created_at', 'DESC']],
        limit: 10
      });

      ludlog.generic(`📊 Found ${lessonPlans.length} lesson plans in database`);

      for (const lessonPlan of lessonPlans) {
        ludlog.generic(`\n📋 Analyzing Lesson Plan: ${lessonPlan.title} (ID: ${lessonPlan.id})`);
        await this.diagnoseLessonPlan(lessonPlan.id);
      }

      // Step 2: Check system templates
      await this.diagnoseSystemTemplates();

    } catch (error) {
      luderror.generic('❌ Diagnostics failed:', error);
      throw error;
    }
  }

  async diagnoseLessonPlan(lessonPlanId) {
    try {
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId);

      if (!lessonPlan) {
        luderror.generic(`❌ Lesson plan not found: ${lessonPlanId}`);
        return;
      }

      ludlog.generic(`\n🔍 Lesson Plan Diagnostics for: ${lessonPlan.title}`);
      ludlog.generic(`   ID: ${lessonPlan.id}`);
      ludlog.generic(`   Product Type: ${lessonPlan.product_type || 'not set'}`);

      // Check branding configuration
      ludlog.generic('\n📝 Branding Configuration:');
      ludlog.generic(`   add_branding: ${lessonPlan.add_branding}`);
      ludlog.generic(`   branding_template_id: ${lessonPlan.branding_template_id || 'not set'}`);
      ludlog.generic(`   has branding_settings: ${lessonPlan.branding_settings ? 'yes' : 'no'}`);

      if (lessonPlan.branding_settings) {
        ludlog.generic(`   branding_settings keys: ${Object.keys(lessonPlan.branding_settings)}`);
      }

      // Check watermark configuration
      ludlog.generic('\n💧 Watermark Configuration:');
      ludlog.generic(`   watermark_template_id: ${lessonPlan.watermark_template_id || 'not set'}`);

      // Check slide configuration
      ludlog.generic('\n📱 Slide Configuration:');
      ludlog.generic(`   allow_slide_preview: ${lessonPlan.allow_slide_preview}`);
      ludlog.generic(`   accessible_slides: ${JSON.stringify(lessonPlan.accessible_slides)}`);

      const presentationSlides = lessonPlan.file_configs?.presentation || [];
      ludlog.generic(`   total slides: ${presentationSlides.length}`);

      // Check templates exist and are valid
      await this.checkTemplateValidity(lessonPlan);

      // Test template merging if slides exist
      if (presentationSlides.length > 0) {
        await this.testTemplateMerging(lessonPlan);
      } else {
        ludlog.generic('⚠️  No slides found - cannot test template merging');
      }

    } catch (error) {
      luderror.generic(`❌ Error diagnosing lesson plan ${lessonPlanId}:`, error);
    }
  }

  async checkTemplateValidity(lessonPlan) {
    ludlog.generic('\n🧪 Template Validity Check:');

    // Check branding template
    if (lessonPlan.add_branding && lessonPlan.branding_template_id) {
      try {
        const brandingTemplate = await models.SystemTemplate.findByPk(lessonPlan.branding_template_id);

        if (brandingTemplate) {
          ludlog.generic(`   ✅ Branding template found: ${brandingTemplate.template_name}`);
          ludlog.generic(`      Type: ${brandingTemplate.template_type}`);
          ludlog.generic(`      Is default: ${brandingTemplate.is_default}`);

          const elementCount = this.countTemplateElements(brandingTemplate.template_data);
          ludlog.generic(`      Total elements: ${elementCount}`);

          if (elementCount === 0) {
            luderror.generic('      ❌ CRITICAL: Branding template has 0 elements!');
          }
        } else {
          luderror.generic(`   ❌ Branding template NOT FOUND: ${lessonPlan.branding_template_id}`);
        }
      } catch (error) {
        luderror.generic('   ❌ Error loading branding template:', error);
      }
    } else {
      ludlog.generic('   ⚠️  Branding disabled or no branding template ID set');
    }

    // Check watermark template
    if (lessonPlan.watermark_template_id) {
      try {
        const watermarkTemplate = await models.SystemTemplate.findByPk(lessonPlan.watermark_template_id);

        if (watermarkTemplate) {
          ludlog.generic(`   ✅ Watermark template found: ${watermarkTemplate.template_name}`);
          ludlog.generic(`      Type: ${watermarkTemplate.template_type}`);
          ludlog.generic(`      Is default: ${watermarkTemplate.is_default}`);

          const elementCount = this.countTemplateElements(watermarkTemplate.template_data);
          ludlog.generic(`      Total elements: ${elementCount}`);

          if (elementCount === 0) {
            luderror.generic('      ❌ CRITICAL: Watermark template has 0 elements!');
          }
        } else {
          luderror.generic(`   ❌ Watermark template NOT FOUND: ${lessonPlan.watermark_template_id}`);
        }
      } catch (error) {
        luderror.generic('   ❌ Error loading watermark template:', error);
      }
    } else {
      ludlog.generic('   ⚠️  No watermark template ID set');
    }
  }

  countTemplateElements(templateData) {
    if (!templateData) return 0;

    let count = 0;

    // Unified structure
    if (templateData.elements) {
      for (const elementType in templateData.elements) {
        const elements = templateData.elements[elementType];
        if (Array.isArray(elements)) {
          count += elements.length;
        }
      }
    }

    // Legacy structure
    const legacyKeys = ['textElements', 'logoElements', 'boxElements', 'lineElements'];
    for (const key of legacyKeys) {
      if (Array.isArray(templateData[key])) {
        count += templateData[key].length;
      }
    }

    return count;
  }

  async testTemplateMerging(lessonPlan) {
    ludlog.generic('\n🔧 Template Merging Test:');

    try {
      // Create a simple test SVG
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f8f9fa"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#333">
    Test Slide Content
  </text>
</svg>`;

      const templateVariables = {
        lessonPlanTitle: lessonPlan.title || 'Test Lesson Plan',
        userId: 'diagnostic-test',
        accessType: 'Test Mode'
      };

      let processedContent = testSvg;

      // Test branding template
      if (lessonPlan.add_branding && lessonPlan.branding_template_id) {
        try {
          const brandingTemplate = await models.SystemTemplate.findByPk(lessonPlan.branding_template_id);
          if (brandingTemplate) {
            ludlog.generic('   🎨 Testing branding template merging...');

            const brandingResult = await mergeSvgTemplate(
              processedContent,
              brandingTemplate.template_data,
              templateVariables
            );

            if (brandingResult && brandingResult !== processedContent) {
              ludlog.generic('   ✅ Branding template merged successfully');
              ludlog.generic(`      Original length: ${processedContent.length} chars`);
              ludlog.generic(`      Processed length: ${brandingResult.length} chars`);
              processedContent = brandingResult;
            } else {
              luderror.generic('   ❌ Branding template merge returned unchanged content');
            }
          }
        } catch (error) {
          luderror.generic('   ❌ Branding template merge failed:', error);
          luderror.generic('      Error message:', error.message);
          luderror.generic('      Error stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
        }
      }

      // Test watermark template
      if (lessonPlan.watermark_template_id) {
        try {
          const watermarkTemplate = await models.SystemTemplate.findByPk(lessonPlan.watermark_template_id);
          if (watermarkTemplate) {
            ludlog.generic('   💧 Testing watermark template merging...');

            const watermarkResult = await mergeSvgTemplate(
              processedContent,
              watermarkTemplate.template_data,
              templateVariables
            );

            if (watermarkResult && watermarkResult !== processedContent) {
              ludlog.generic('   ✅ Watermark template merged successfully');
              ludlog.generic(`      Previous length: ${processedContent.length} chars`);
              ludlog.generic(`      Final length: ${watermarkResult.length} chars`);
              processedContent = watermarkResult;
            } else {
              luderror.generic('   ❌ Watermark template merge returned unchanged content');
            }
          }
        } catch (error) {
          luderror.generic('   ❌ Watermark template merge failed:', error);
          luderror.generic('      Error message:', error.message);
          luderror.generic('      Error stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
        }
      }

      // Check if any templates were applied
      if (processedContent === testSvg) {
        luderror.generic('   ❌ CRITICAL: No templates were applied to test content!');
      } else {
        ludlog.generic('   ✅ Template processing completed successfully');

        // Save diagnostic output for inspection
        if (process.env.SAVE_DIAGNOSTIC_OUTPUT === 'true') {
          const fs = await import('fs');
          const outputPath = `/tmp/diagnostic-${lessonPlan.id}-output.svg`;
          await fs.promises.writeFile(outputPath, processedContent);
          ludlog.generic(`   📁 Diagnostic output saved to: ${outputPath}`);
        }
      }

    } catch (error) {
      luderror.generic('   ❌ Template merging test failed completely:', error);
    }
  }

  async diagnoseSystemTemplates() {
    ludlog.generic('\n🏗️  System Templates Analysis:');

    try {
      const brandingTemplates = await models.SystemTemplate.findAll({
        where: { template_type: 'branding' },
        order: [['is_default', 'DESC'], ['created_at', 'DESC']]
      });

      const watermarkTemplates = await models.SystemTemplate.findAll({
        where: { template_type: 'watermark' },
        order: [['is_default', 'DESC'], ['created_at', 'DESC']]
      });

      ludlog.generic(`\n📋 Branding Templates (${brandingTemplates.length} found):`);
      for (const template of brandingTemplates) {
        const elementCount = this.countTemplateElements(template.template_data);
        ludlog.generic(`   ${template.is_default ? '🌟' : '📄'} ${template.template_name} (ID: ${template.id})`);
        ludlog.generic(`      Elements: ${elementCount}, Default: ${template.is_default}`);

        if (elementCount === 0) {
          luderror.generic(`      ❌ CRITICAL: Template has 0 elements!`);
        }
      }

      ludlog.generic(`\n💧 Watermark Templates (${watermarkTemplates.length} found):`);
      for (const template of watermarkTemplates) {
        const elementCount = this.countTemplateElements(template.template_data);
        ludlog.generic(`   ${template.is_default ? '🌟' : '📄'} ${template.template_name} (ID: ${template.id})`);
        ludlog.generic(`      Elements: ${elementCount}, Default: ${template.is_default}`);

        if (elementCount === 0) {
          luderror.generic(`      ❌ CRITICAL: Template has 0 elements!`);
        }
      }

      // Check for default templates
      const defaultBranding = brandingTemplates.find(t => t.is_default);
      const defaultWatermark = watermarkTemplates.find(t => t.is_default);

      if (!defaultBranding) {
        luderror.generic('❌ CRITICAL: No default branding template found!');
      }

      if (!defaultWatermark) {
        luderror.generic('❌ CRITICAL: No default watermark template found!');
      }

    } catch (error) {
      luderror.generic('❌ Failed to analyze system templates:', error);
    }
  }
}

// Main execution
async function main() {
  const lessonPlanId = process.argv[2];

  ludlog.generic('🚀 Starting Lesson Plan Template Diagnostics');
  ludlog.generic(`   Environment: ${env}`);
  ludlog.generic(`   Target: ${lessonPlanId ? `Lesson Plan ${lessonPlanId}` : 'All lesson plans'}`);

  try {
    const diagnostics = new TemplateDiagnostics();

    if (lessonPlanId) {
      await diagnostics.diagnoseLessonPlan(lessonPlanId);
    } else {
      await diagnostics.diagnoseAll();
    }

    ludlog.generic('\n✅ Diagnostics completed successfully');
  } catch (error) {
    luderror.generic('❌ Diagnostics failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  luderror.generic('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run diagnostics
main();