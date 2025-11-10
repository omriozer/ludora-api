const { DataTypes } = require('sequelize');

/**
 * Migration: Convert System Templates from Category to Target Format
 *
 * This migration transforms the system_templates table structure:
 * 1. Adds target_format column with validation for PDF/SVG formats
 * 2. Migrates existing category data to appropriate target_format values
 * 3. Removes the old category column and its index
 * 4. Updates unique constraints and indexes
 * 5. Adds support for watermark and header template types
 *
 * Target formats:
 * - pdf-a4-landscape: For PDF A4 landscape orientation
 * - pdf-a4-portrait: For PDF A4 portrait orientation
 * - svg-lessonplan: For SVG lesson plan slides
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting system templates target format migration...');

      // Step 1: Add target_format column
      console.log('📝 Adding target_format column...');

      await queryInterface.addColumn('system_templates', 'target_format', {
        type: DataTypes.STRING(50),
        allowNull: true, // Temporarily nullable for migration
        comment: 'Target format: pdf-a4-landscape, pdf-a4-portrait, or svg-lessonplan'
      }, { transaction });

      // Step 2: Map existing category values to target_format values
      console.log('🔄 Migrating category data to target_format...');

      // Create mapping for existing categories to target formats
      const categoryToFormatMapping = {
        'standard': 'pdf-a4-portrait',
        'landscape': 'pdf-a4-landscape',
        'portrait': 'pdf-a4-portrait',
        'minimal': 'pdf-a4-portrait',
        'logo-only': 'pdf-a4-portrait',
        'corporate': 'pdf-a4-landscape'
      };

      // Update existing records
      for (const [category, format] of Object.entries(categoryToFormatMapping)) {
        await queryInterface.sequelize.query(
          `UPDATE system_templates SET target_format = :format WHERE category = :category`,
          {
            replacements: { format, category },
            transaction
          }
        );
      }

      // Set any remaining null values to default format
      await queryInterface.sequelize.query(
        `UPDATE system_templates SET target_format = 'pdf-a4-portrait' WHERE target_format IS NULL`,
        { transaction }
      );

      // Step 3: Make target_format NOT NULL now that all values are set
      console.log('📝 Making target_format NOT NULL...');

      await queryInterface.changeColumn('system_templates', 'target_format', {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Target format: pdf-a4-landscape, pdf-a4-portrait, or svg-lessonplan'
      }, { transaction });

      // Step 4: Add check constraint for target_format validation
      console.log('📝 Adding target_format validation constraint...');

      await queryInterface.sequelize.query(`
        ALTER TABLE system_templates
        ADD CONSTRAINT chk_target_format
        CHECK (target_format IN ('pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan'))
      `, { transaction });

      // Step 5: Update template_type validation to include new types
      console.log('📝 Updating template_type validation...');

      // Remove old constraint if exists
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE system_templates DROP CONSTRAINT IF EXISTS chk_template_type
        `, { transaction });
      } catch (e) {
        // Constraint might not exist, continue
      }

      // Add new constraint
      await queryInterface.sequelize.query(`
        ALTER TABLE system_templates
        ADD CONSTRAINT chk_template_type
        CHECK (template_type IN ('footer', 'header', 'watermark'))
      `, { transaction });

      // Step 6: Remove old category index
      console.log('🗑️ Removing old category index...');

      try {
        await queryInterface.removeIndex('system_templates', 'idx_system_templates_category', { transaction });
      } catch (e) {
        console.log('Index idx_system_templates_category not found, skipping...');
      }

      // Step 7: Create new indexes for target_format
      console.log('📝 Creating new target_format indexes...');

      await queryInterface.addIndex('system_templates', ['target_format'], {
        name: 'idx_system_templates_format',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['template_type', 'target_format'], {
        name: 'idx_system_templates_type_format',
        transaction
      });

      // Step 8: Create unique constraint for default templates per type+format
      console.log('📝 Creating unique constraint for default templates...');

      // First, ensure we don't have duplicate defaults (in case of data inconsistencies)
      await queryInterface.sequelize.query(`
        UPDATE system_templates
        SET is_default = false
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT DISTINCT ON (template_type, target_format) id
            FROM system_templates
            WHERE is_default = true
            ORDER BY template_type, target_format, created_at ASC
          ) AS unique_defaults
        )
        AND is_default = true
      `, { transaction });

      // Create the unique constraint
      await queryInterface.addIndex('system_templates', ['template_type', 'target_format', 'is_default'], {
        unique: true,
        name: 'unique_default_per_type_format',
        where: {
          is_default: true
        },
        transaction
      });

      // Step 9: Add watermark template support columns if needed
      console.log('📝 Adding watermark template references...');

      // Add watermark_template_id to File table if it doesn't exist
      const [fileColumns] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'file' AND column_name = 'watermark_template_id'`,
        { transaction }
      );

      if (fileColumns.length === 0) {
        await queryInterface.addColumn('file', 'watermark_template_id', {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Reference to system_templates for watermark configuration'
        }, { transaction });

        await queryInterface.addIndex('file', ['watermark_template_id'], {
          name: 'idx_file_watermark_template_id',
          transaction
        });
      }

      // Add watermark_template_id to LessonPlan table if table and column don't exist
      const lessonPlanTableResult = await queryInterface.sequelize.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name = 'lessonplan' AND table_schema = 'public'`,
        { transaction }
      );

      const lessonPlanTableExists = lessonPlanTableResult && lessonPlanTableResult[0] && lessonPlanTableResult[0].length > 0;

      if (lessonPlanTableExists) {
        const lessonPlanColumnsResult = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'lessonplan' AND column_name = 'watermark_template_id'`,
          { transaction }
        );

        const lessonPlanColumns = lessonPlanColumnsResult[0] || [];

        if (lessonPlanColumns.length === 0) {
          await queryInterface.addColumn('lessonplan', 'watermark_template_id', {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Reference to system_templates for watermark configuration'
          }, { transaction });

          await queryInterface.addIndex('lessonplan', ['watermark_template_id'], {
            name: 'idx_lessonplan_watermark_template_id',
            transaction
          });
        }
      } else {
        console.log('LessonPlan table does not exist, skipping watermark_template_id column addition...');
      }

      // Step 10: Remove category column
      console.log('🗑️ Removing category column...');

      await queryInterface.removeColumn('system_templates', 'category', { transaction });

      // Step 11: Create sample watermark templates
      console.log('📝 Creating default watermark and header templates...');

      // Generate ID function
      const generateId = () => {
        const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return result;
      };

      const defaultTemplates = [
        // Default watermark templates
        {
          id: generateId(),
          name: 'Default PDF Watermark',
          description: 'Default watermark template for PDF documents',
          template_type: 'watermark',
          target_format: 'pdf-a4-portrait',
          is_default: true,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'default-text',
                content: 'LUDORA',
                position: { x: 50, y: 50 },
                style: {
                  fontSize: 48,
                  color: '#cccccc',
                  opacity: 30,
                  fontFamily: 'Arial',
                  rotation: -45
                },
                visible: true,
                pattern: 'grid'
              }
            ],
            logoElements: [],
            globalSettings: {
              opacity: 30,
              enabled: true
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Default SVG Watermark',
          description: 'Default watermark template for SVG lesson plans',
          template_type: 'watermark',
          target_format: 'svg-lessonplan',
          is_default: true,
          template_data: JSON.stringify({
            textElements: [
              {
                id: 'default-text',
                content: 'LUDORA',
                position: { x: 50, y: 50 },
                style: {
                  fontSize: 36,
                  color: '#eeeeee',
                  opacity: 20,
                  fontFamily: 'Arial',
                  rotation: -30
                },
                visible: true,
                pattern: 'single'
              }
            ],
            logoElements: [],
            globalSettings: {
              opacity: 20,
              enabled: true
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        // Default header templates
        {
          id: generateId(),
          name: 'Default PDF Header',
          description: 'Default header template for PDF documents',
          template_type: 'header',
          target_format: 'pdf-a4-portrait',
          is_default: true,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 10, y: 5 },
              style: { size: 60, opacity: 100 }
            },
            text: {
              visible: true,
              content: 'Ludora Educational Platform',
              position: { x: 50, y: 5 },
              style: {
                fontSize: 16,
                color: '#333333',
                bold: true,
                italic: false,
                opacity: 100,
                width: 300
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('system_templates', defaultTemplates, { transaction });

      // Step 12: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [verificationResults] = await queryInterface.sequelize.query(`
        SELECT
          template_type,
          target_format,
          COUNT(*) as count,
          COUNT(CASE WHEN is_default = true THEN 1 END) as default_count
        FROM system_templates
        GROUP BY template_type, target_format
        ORDER BY template_type, target_format
      `, { transaction });

      console.log('📊 Migration verification results:');
      verificationResults.forEach(row => {
        console.log(`   ${row.template_type} (${row.target_format}): ${row.count} templates, ${row.default_count} default`);
      });

      await transaction.commit();
      console.log('✅ System templates target format migration completed successfully!');
      console.log('🎉 Template system now supports PDF A4 and SVG lesson plan formats!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting target format migration...');

      // Step 1: Add category column back
      console.log('📝 Adding category column back...');

      await queryInterface.addColumn('system_templates', 'category', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Template category (landscape, portrait, minimal, logo-only, corporate, etc.)'
      }, { transaction });

      // Step 2: Map target_format back to category
      console.log('🔄 Mapping target_format back to category...');

      const formatToCategoryMapping = {
        'pdf-a4-portrait': 'portrait',
        'pdf-a4-landscape': 'landscape',
        'svg-lessonplan': 'standard'
      };

      for (const [format, category] of Object.entries(formatToCategoryMapping)) {
        await queryInterface.sequelize.query(
          `UPDATE system_templates SET category = :category WHERE target_format = :format`,
          {
            replacements: { format, category },
            transaction
          }
        );
      }

      // Step 3: Remove new constraints and indexes
      console.log('🗑️ Removing new constraints and indexes...');

      try {
        await queryInterface.removeIndex('system_templates', 'unique_default_per_type_format', { transaction });
      } catch (e) {
        console.log('unique_default_per_type_format constraint not found, skipping...');
      }

      try {
        await queryInterface.removeIndex('system_templates', 'idx_system_templates_format', { transaction });
      } catch (e) {
        console.log('idx_system_templates_format index not found, skipping...');
      }

      try {
        await queryInterface.removeIndex('system_templates', 'idx_system_templates_type_format', { transaction });
      } catch (e) {
        console.log('idx_system_templates_type_format index not found, skipping...');
      }

      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE system_templates DROP CONSTRAINT IF EXISTS chk_target_format
        `, { transaction });
      } catch (e) {
        console.log('chk_target_format constraint not found, skipping...');
      }

      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE system_templates DROP CONSTRAINT IF EXISTS chk_template_type
        `, { transaction });
      } catch (e) {
        console.log('chk_template_type constraint not found, skipping...');
      }

      // Step 4: Remove watermark template references
      console.log('🗑️ Removing watermark template references...');

      try {
        await queryInterface.removeIndex('file', 'idx_file_watermark_template_id', { transaction });
        await queryInterface.removeColumn('file', 'watermark_template_id', { transaction });
      } catch (e) {
        console.log('file.watermark_template_id not found, skipping...');
      }

      // Check if lessonplan table exists before trying to remove columns
      const lessonPlanTableExistsResult = await queryInterface.sequelize.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name = 'lessonplan' AND table_schema = 'public'`,
        { transaction }
      );

      const lessonPlanExists = lessonPlanTableExistsResult && lessonPlanTableExistsResult[0] && lessonPlanTableExistsResult[0].length > 0;

      if (lessonPlanExists) {
        try {
          await queryInterface.removeIndex('lessonplan', 'idx_lessonplan_watermark_template_id', { transaction });
          await queryInterface.removeColumn('lessonplan', 'watermark_template_id', { transaction });
        } catch (e) {
          console.log('lessonplan.watermark_template_id not found, skipping...');
        }
      } else {
        console.log('LessonPlan table does not exist, skipping watermark_template_id column removal...');
      }

      // Step 5: Remove target_format column
      console.log('🗑️ Removing target_format column...');

      await queryInterface.removeColumn('system_templates', 'target_format', { transaction });

      // Step 6: Restore category index
      console.log('📝 Restoring category index...');

      await queryInterface.addIndex('system_templates', ['category'], {
        name: 'idx_system_templates_category',
        transaction
      });

      // Step 7: Remove new template types (watermark, header)
      console.log('🗑️ Removing watermark and header templates...');

      await queryInterface.sequelize.query(
        `DELETE FROM system_templates WHERE template_type IN ('watermark', 'header')`,
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Target format migration reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};