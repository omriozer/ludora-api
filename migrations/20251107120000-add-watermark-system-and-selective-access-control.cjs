const { DataTypes } = require('sequelize');

/**
 * Migration: Add Watermark System and Selective Access Control
 *
 * Extends the existing system templates with watermark support and adds selective access control:
 * 1. Adds target_file_types field to system_templates for watermark file type targeting
 * 2. Adds accessible_pages and watermark_template_id to File table for selective PDF access
 * 3. Adds accessible_slides, allow_slide_preview, and watermark_template_id to LessonPlan table
 * 4. Creates built-in watermark templates for PDFs and SVG slides
 * 5. Adds indexes for performance optimization
 *
 * This implements the comprehensive selective access control system with template-based watermarks.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting watermark system and selective access control migration...');

      // Step 1: Add target_file_types field to system_templates
      console.log('📝 Adding target_file_types to system_templates table...');

      await queryInterface.addColumn('system_templates', 'target_file_types', {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: null,
        comment: 'Array of file types this template applies to: [pdf, svg, both] - null for footer/header templates'
      }, { transaction });

      await queryInterface.addIndex('system_templates', ['target_file_types'], {
        name: 'idx_system_templates_file_types',
        transaction
      });

      // Step 2: Add selective access fields to File table
      console.log('📝 Adding selective access fields to File table...');

      await queryInterface.addColumn('file', 'accessible_pages', {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Array of page numbers accessible in preview mode: [1,3,5,7] or null for all pages'
      }, { transaction });

      await queryInterface.addColumn('file', 'watermark_template_id', {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference to system_templates for watermark configuration'
      }, { transaction });

      await queryInterface.addIndex('file', ['accessible_pages'], {
        name: 'idx_file_accessible_pages',
        transaction
      });

      await queryInterface.addIndex('file', ['watermark_template_id'], {
        name: 'idx_file_watermark_template_id',
        transaction
      });

      // Step 3: Add selective access fields to LessonPlan table
      console.log('📝 Adding selective access fields to LessonPlan table...');

      await queryInterface.addColumn('lesson_plan', 'accessible_slides', {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: true,
        defaultValue: null,
        comment: 'Array of slide indices (0-based) accessible in preview mode: [0,2,4] or null for all slides'
      }, { transaction });

      await queryInterface.addColumn('lesson_plan', 'allow_slide_preview', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether slides can be previewed without purchase access'
      }, { transaction });

      await queryInterface.addColumn('lesson_plan', 'watermark_template_id', {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference to system_templates for watermark configuration on slides'
      }, { transaction });

      await queryInterface.addIndex('lesson_plan', ['accessible_slides'], {
        name: 'idx_lesson_plan_accessible_slides',
        transaction
      });

      await queryInterface.addIndex('lesson_plan', ['allow_slide_preview'], {
        name: 'idx_lesson_plan_allow_slide_preview',
        transaction
      });

      await queryInterface.addIndex('lesson_plan', ['watermark_template_id'], {
        name: 'idx_lesson_plan_watermark_template_id',
        transaction
      });

      // Step 4: Create built-in watermark templates
      console.log('📝 Creating built-in watermark templates...');

      // Generate IDs for templates (using the nanoid pattern from existing migration)
      const generateId = () => {
        const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return result;
      };

      const watermarkTemplates = [
        {
          id: generateId(),
          name: 'Basic PDF Watermark',
          description: 'Standard watermark for PDF files with text and logo overlay',
          template_type: 'watermark',
          target_file_types: ['pdf'],
          category: 'basic',
          is_default: true,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'preview-text-1',
                content: 'PREVIEW ONLY',
                position: { x: 50, y: 50 },
                style: {
                  fontSize: 48,
                  color: '#FF6B6B',
                  opacity: 30,
                  rotation: 45,
                  fontFamily: 'Helvetica'
                },
                pattern: 'single',
                visible: true
              },
              {
                id: 'preview-text-2',
                content: 'Purchase to access full content',
                position: { x: 50, y: 20 },
                style: {
                  fontSize: 14,
                  color: '#666666',
                  opacity: 80,
                  rotation: 0,
                  fontFamily: 'Helvetica'
                },
                pattern: 'single',
                visible: true
              }
            ],
            logoElements: [
              {
                id: 'watermark-logo-1',
                source: 'system-logo',
                url: '/api/assets/image/settings/logo.png',
                position: { x: 50, y: 65 },
                style: {
                  size: 120,
                  opacity: 25,
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
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Basic SVG Watermark',
          description: 'Standard watermark for SVG slide presentations',
          template_type: 'watermark',
          target_file_types: ['svg'],
          category: 'basic',
          is_default: true,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'svg-preview-text',
                content: 'PREVIEW ONLY',
                position: { x: 50, y: 50 },
                style: {
                  fontSize: 32,
                  color: '#FF6B6B',
                  opacity: 40,
                  rotation: 45,
                  fontFamily: 'Arial'
                },
                pattern: 'single',
                visible: true
              }
            ],
            logoElements: [
              {
                id: 'svg-watermark-logo',
                source: 'system-logo',
                url: '/api/assets/image/settings/logo.png',
                position: { x: 85, y: 15 },
                style: {
                  size: 80,
                  opacity: 30,
                  rotation: 0
                },
                pattern: 'single',
                visible: true
              }
            ],
            globalSettings: {
              layerBehindContent: true,
              preserveReadability: true
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Heavy Protection Watermark',
          description: 'High-density watermark for maximum content protection',
          template_type: 'watermark',
          target_file_types: ['pdf', 'svg'],
          category: 'heavy',
          is_default: false,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'heavy-text-1',
                content: 'PREVIEW ONLY',
                position: { x: 50, y: 50 },
                style: {
                  fontSize: 40,
                  color: '#FF4757',
                  opacity: 25,
                  rotation: 45,
                  fontFamily: 'Helvetica'
                },
                pattern: 'grid',
                visible: true
              },
              {
                id: 'heavy-text-2',
                content: 'LUDORA',
                position: { x: 30, y: 30 },
                style: {
                  fontSize: 24,
                  color: '#5F27CD',
                  opacity: 20,
                  rotation: -45,
                  fontFamily: 'Helvetica'
                },
                pattern: 'scattered',
                visible: true
              }
            ],
            logoElements: [
              {
                id: 'heavy-logo-1',
                source: 'system-logo',
                url: '/api/assets/image/settings/logo.png',
                position: { x: 25, y: 75 },
                style: {
                  size: 60,
                  opacity: 15,
                  rotation: 0
                },
                pattern: 'grid',
                visible: true
              }
            ],
            globalSettings: {
              layerBehindContent: false,
              preserveReadability: false,
              gridSpacing: { x: 200, y: 150 },
              scatterDensity: 0.3
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Light Preview Watermark',
          description: 'Subtle watermark that preserves content readability',
          template_type: 'watermark',
          target_file_types: ['pdf', 'svg'],
          category: 'light',
          is_default: false,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'light-text',
                content: 'Preview Version',
                position: { x: 95, y: 5 },
                style: {
                  fontSize: 12,
                  color: '#95A5A6',
                  opacity: 60,
                  rotation: 0,
                  fontFamily: 'Helvetica'
                },
                pattern: 'single',
                visible: true
              }
            ],
            logoElements: [
              {
                id: 'light-logo',
                source: 'system-logo',
                url: '/api/assets/image/settings/logo.png',
                position: { x: 5, y: 5 },
                style: {
                  size: 40,
                  opacity: 50,
                  rotation: 0
                },
                pattern: 'single',
                visible: true
              }
            ],
            globalSettings: {
              layerBehindContent: true,
              preserveReadability: true
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Educational Watermark',
          description: 'Professional watermark for educational content with upgrade messaging',
          template_type: 'watermark',
          target_file_types: ['pdf', 'svg'],
          category: 'educational',
          is_default: false,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'edu-main-text',
                content: 'EDUCATIONAL PREVIEW',
                position: { x: 50, y: 45 },
                style: {
                  fontSize: 36,
                  color: '#3742FA',
                  opacity: 35,
                  rotation: 0,
                  fontFamily: 'Helvetica'
                },
                pattern: 'single',
                visible: true
              },
              {
                id: 'edu-upgrade-text',
                content: 'Upgrade for full access • ludora.app',
                position: { x: 50, y: 55 },
                style: {
                  fontSize: 16,
                  color: '#2F3542',
                  opacity: 70,
                  rotation: 0,
                  fontFamily: 'Helvetica'
                },
                pattern: 'single',
                visible: true
              }
            ],
            logoElements: [
              {
                id: 'edu-logo',
                source: 'system-logo',
                url: '/api/assets/image/settings/logo.png',
                position: { x: 50, y: 35 },
                style: {
                  size: 100,
                  opacity: 40,
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
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('system_templates', watermarkTemplates, { transaction });

      console.log(`✅ Created ${watermarkTemplates.length} built-in watermark templates`);

      // Step 5: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [templateCount] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total_templates,
           COUNT(CASE WHEN template_type = 'watermark' THEN 1 END) as watermark_templates,
           COUNT(CASE WHEN template_type = 'footer' THEN 1 END) as footer_templates,
           COUNT(CASE WHEN target_file_types IS NOT NULL THEN 1 END) as templates_with_file_types
         FROM system_templates`,
        { transaction }
      );

      const [fileColumns] = await queryInterface.sequelize.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'file'
         AND table_schema = 'public'
         AND column_name IN ('accessible_pages', 'watermark_template_id')`,
        { transaction }
      );

      const [lessonPlanColumns] = await queryInterface.sequelize.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'lesson_plan'
         AND table_schema = 'public'
         AND column_name IN ('accessible_slides', 'allow_slide_preview', 'watermark_template_id')`,
        { transaction }
      );

      const stats = templateCount[0];
      const fileColumnsComplete = fileColumns.length === 2;
      const lessonPlanColumnsComplete = lessonPlanColumns.length === 3;

      console.log('📊 Watermark system migration verification:');
      console.log(`   Total templates: ${stats.total_templates}`);
      console.log(`   Watermark templates: ${stats.watermark_templates}`);
      console.log(`   Footer templates: ${stats.footer_templates}`);
      console.log(`   Templates with file types: ${stats.templates_with_file_types}`);
      console.log(`   File table updated: ${fileColumnsComplete ? 'Yes' : 'No'}`);
      console.log(`   LessonPlan table updated: ${lessonPlanColumnsComplete ? 'Yes' : 'No'}`);

      await transaction.commit();
      console.log('✅ Watermark system and selective access control migration completed successfully!');
      console.log('🎉 Advanced preview control system is now ready!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting watermark system and selective access control migration...');

      // Step 1: Remove indexes from LessonPlan table
      console.log('🗑️ Removing LessonPlan table indexes...');

      const lessonPlanIndexes = [
        'idx_lesson_plan_accessible_slides',
        'idx_lesson_plan_allow_slide_preview',
        'idx_lesson_plan_watermark_template_id'
      ];

      for (const indexName of lessonPlanIndexes) {
        try {
          await queryInterface.removeIndex('lesson_plan', indexName, { transaction });
        } catch (e) {
          console.log(`Index ${indexName} not found, skipping...`);
        }
      }

      // Step 2: Remove fields from LessonPlan table
      console.log('🗑️ Removing selective access fields from LessonPlan table...');

      await queryInterface.removeColumn('lesson_plan', 'watermark_template_id', { transaction });
      await queryInterface.removeColumn('lesson_plan', 'allow_slide_preview', { transaction });
      await queryInterface.removeColumn('lesson_plan', 'accessible_slides', { transaction });

      // Step 3: Remove indexes from File table
      console.log('🗑️ Removing File table indexes...');

      const fileIndexes = [
        'idx_file_accessible_pages',
        'idx_file_watermark_template_id'
      ];

      for (const indexName of fileIndexes) {
        try {
          await queryInterface.removeIndex('file', indexName, { transaction });
        } catch (e) {
          console.log(`Index ${indexName} not found, skipping...`);
        }
      }

      // Step 4: Remove fields from File table
      console.log('🗑️ Removing selective access fields from File table...');

      await queryInterface.removeColumn('file', 'watermark_template_id', { transaction });
      await queryInterface.removeColumn('file', 'accessible_pages', { transaction });

      // Step 5: Remove watermark templates
      console.log('🗑️ Removing watermark templates...');

      await queryInterface.sequelize.query(
        `DELETE FROM system_templates WHERE template_type = 'watermark'`,
        { transaction }
      );

      // Step 6: Remove target_file_types field and index from system_templates
      console.log('🗑️ Removing target_file_types from system_templates...');

      try {
        await queryInterface.removeIndex('system_templates', 'idx_system_templates_file_types', { transaction });
      } catch (e) {
        console.log('Index idx_system_templates_file_types not found, skipping...');
      }

      await queryInterface.removeColumn('system_templates', 'target_file_types', { transaction });

      await transaction.commit();
      console.log('✅ Watermark system migration reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};