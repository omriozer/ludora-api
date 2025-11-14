'use strict';

const { DataTypes } = require('sequelize');

/**
 * Comprehensive Template System Migration
 *
 * This migration creates a complete template system from scratch:
 * 1. Creates system_templates table with all necessary fields and constraints
 * 2. Adds template reference fields to file table
 * 3. Creates professional Hebrew branding templates for each format
 * 4. Creates protective watermark templates with multiple security elements
 * 5. Includes new user-info template functionality
 *
 * Template Types: branding, watermark
 * Target Formats: pdf-a4-portrait, pdf-a4-landscape, svg-lessonplan
 */

// Generate unique IDs for templates
function generateId() {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🏗️ Starting comprehensive template system creation...');

      // Step 1: Create system_templates table
      console.log('📝 Creating system_templates table...');

      await queryInterface.createTable('system_templates', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          comment: 'Human-readable template name in Hebrew'
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Optional description of template purpose and usage'
        },
        template_type: {
          type: DataTypes.STRING(100),
          allowNull: false,
          comment: 'Type of template: branding or watermark'
        },
        target_format: {
          type: DataTypes.STRING(50),
          allowNull: false,
          comment: 'Target format: pdf-a4-portrait, pdf-a4-landscape, or svg-lessonplan'
        },
        is_default: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether this template is the default for its type+format combination'
        },
        template_data: {
          type: DataTypes.JSONB,
          allowNull: false,
          comment: 'Complete template configuration including all elements and styling'
        },
        target_file_types: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
          defaultValue: null,
          comment: 'Array of file types for watermark templates: [pdf, svg] or null for branding'
        },
        created_by: {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: 'Email of user who created this template'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // Step 2: Create constraints and indexes
      console.log('📝 Creating table constraints and indexes...');

      // Add check constraints
      await queryInterface.sequelize.query(`
        ALTER TABLE system_templates
        ADD CONSTRAINT chk_template_type
        CHECK (template_type IN ('branding', 'watermark'))
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE system_templates
        ADD CONSTRAINT chk_target_format
        CHECK (target_format IN ('pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan'))
      `, { transaction });

      // Create indexes
      await queryInterface.addIndex('system_templates', ['template_type'], {
        name: 'idx_system_templates_type',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['target_format'], {
        name: 'idx_system_templates_format',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['is_default'], {
        name: 'idx_system_templates_default',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['template_type', 'is_default'], {
        name: 'idx_system_templates_type_default',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['template_type', 'target_format'], {
        name: 'idx_system_templates_type_format',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['target_file_types'], {
        name: 'idx_system_templates_file_types',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['created_by'], {
        name: 'idx_system_templates_created_by',
        transaction
      });

      // Create unique constraint for default templates
      await queryInterface.addIndex('system_templates', ['template_type', 'target_format', 'is_default'], {
        unique: true,
        name: 'unique_default_per_type_format',
        where: {
          is_default: true
        },
        transaction
      });

      // Step 3: Add template reference fields to file table
      console.log('📄 Adding template reference fields to file table...');

      // Check if columns exist to avoid conflicts
      const tableDescription = await queryInterface.describeTable('file');

      if (!tableDescription.branding_template_id) {
        await queryInterface.addColumn('file', 'branding_template_id', {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Reference to system_templates for branding configuration'
        }, { transaction });
      }

      if (!tableDescription.branding_settings) {
        await queryInterface.addColumn('file', 'branding_settings', {
          type: DataTypes.JSONB,
          allowNull: true,
          comment: 'File-specific branding settings (positioning, styling). Content comes from SystemTemplate.'
        }, { transaction });
      }

      if (!tableDescription.watermark_template_id) {
        await queryInterface.addColumn('file', 'watermark_template_id', {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Reference to system_templates for watermark configuration'
        }, { transaction });
      }

      if (!tableDescription.watermark_settings) {
        await queryInterface.addColumn('file', 'watermark_settings', {
          type: DataTypes.JSONB,
          allowNull: true,
          comment: 'Custom watermark settings in JSONB format, overrides watermark template when present'
        }, { transaction });
      }

      if (!tableDescription.accessible_pages) {
        await queryInterface.addColumn('file', 'accessible_pages', {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: null,
          comment: 'Array of page numbers accessible in preview mode: [1,3,5,7] or null for all pages'
        }, { transaction });
      }

      if (!tableDescription.target_format) {
        await queryInterface.addColumn('file', 'target_format', {
          type: DataTypes.STRING(50),
          allowNull: true,
          comment: 'File format orientation matching system_templates.target_format for template filtering'
        }, { transaction });
      }

      // Add indexes for file table columns (check if they exist first)
      const createIndexIfNotExists = async (table, column, indexName) => {
        try {
          // Check if index already exists
          const [existingIndex] = await queryInterface.sequelize.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = '${table}' AND indexname = '${indexName}'
          `, { transaction });

          if (existingIndex.length === 0) {
            await queryInterface.addIndex(table, [column], {
              name: indexName,
              transaction
            });
            console.log(`✅ Created index ${indexName}`);
          } else {
            console.log(`⏭️ Index ${indexName} already exists, skipping`);
          }
        } catch (error) {
          console.log(`⚠️ Error creating index ${indexName}:`, error.message);
          // Don't throw error for index creation issues
        }
      };

      await createIndexIfNotExists('file', 'branding_template_id', 'idx_file_branding_template_id');
      await createIndexIfNotExists('file', 'branding_settings', 'idx_file_branding_settings');
      await createIndexIfNotExists('file', 'watermark_template_id', 'idx_file_watermark_template_id');
      await createIndexIfNotExists('file', 'accessible_pages', 'idx_file_accessible_pages');
      await createIndexIfNotExists('file', 'target_format', 'idx_file_target_format');

      // Step 4: Create Hebrew branding templates
      console.log('🎨 Creating Hebrew branding templates...');

      // Get system settings for copyright text
      let copyrightText = '© כל הזכויות שמורות לתוכן זה. שימוש מחייב רכישה.';
      try {
        const [settings] = await queryInterface.sequelize.query(
          'SELECT copyright_footer_text FROM settings LIMIT 1',
          { transaction }
        );
        if (settings[0] && settings[0].copyright_footer_text) {
          copyrightText = settings[0].copyright_footer_text;
        }
      } catch (error) {
        console.log('Using default copyright text - settings table not available');
      }

      // Define branding templates for each format
      const brandingTemplates = [
        // PDF A4 Portrait
        {
          id: generateId(),
          name: 'מיתוג ברירת מחדל - PDF A4 לאורך',
          description: 'תבנית מיתוג מקצועית עבור קבצי PDF A4 לאורך עם לוגו, זכויות יוצרים וקישור',
          template_type: 'branding',
          target_format: 'pdf-a4-portrait',
          is_default: true,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png', // Will use standard logo path
              position: { x: 50, y: 96 }, // Bottom center
              style: {
                size: 70,
                opacity: 100
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: copyrightText,
              position: { x: 50, y: 92 }, // Above logo
              style: {
                fontSize: 10,
                color: '#333333',
                bold: false,
                italic: false,
                opacity: 85,
                width: 400,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: '${FRONTEND_URL}', // Will be replaced with env variable
              position: { x: 50, y: 88 }, // Above text
              style: {
                fontSize: 9,
                color: '#0066cc',
                bold: false,
                italic: false,
                opacity: 90,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },

        // PDF A4 Landscape
        {
          id: generateId(),
          name: 'מיתוג ברירת מחדל - PDF A4 לרוחב',
          description: 'תבנית מיתוג מותאמת עבור קבצי PDF A4 לרוחב עם פריסה אופקית',
          template_type: 'branding',
          target_format: 'pdf-a4-landscape',
          is_default: true,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png',
              position: { x: 5, y: 94 }, // Bottom left
              style: {
                size: 60,
                opacity: 100
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: copyrightText,
              position: { x: 50, y: 94 }, // Bottom center
              style: {
                fontSize: 9,
                color: '#333333',
                bold: false,
                italic: false,
                opacity: 85,
                width: 500,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: '${FRONTEND_URL}',
              position: { x: 95, y: 94 }, // Bottom right
              style: {
                fontSize: 8,
                color: '#0066cc',
                bold: false,
                italic: false,
                opacity: 90,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },

        // SVG Lesson Plan
        {
          id: generateId(),
          name: 'מיתוג ברירת מחדל - מצגת SVG',
          description: 'תבנית מיתוג מותאמת עבור מצגות SVG עם עיצוב דיגיטלי',
          template_type: 'branding',
          target_format: 'svg-lessonplan',
          is_default: true,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png',
              position: { x: 5, y: 5 }, // Top left
              style: {
                size: 50,
                opacity: 90
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: copyrightText,
              position: { x: 50, y: 95 }, // Bottom center
              style: {
                fontSize: 12,
                color: '#2c3e50',
                bold: false,
                italic: true,
                opacity: 80,
                width: 350,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: '${FRONTEND_URL}',
              position: { x: 95, y: 5 }, // Top right
              style: {
                fontSize: 10,
                color: '#3498db',
                bold: true,
                italic: false,
                opacity: 85,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('system_templates', brandingTemplates, { transaction });
      console.log(`✅ Created ${brandingTemplates.length} Hebrew branding templates`);

      // Step 5: Create protective watermark templates
      console.log('🔒 Creating protective watermark templates...');

      const watermarkTemplates = [
        // PDF A4 Portrait Watermark
        {
          id: generateId(),
          name: 'סימן מים מגן - PDF A4 לאורך',
          description: 'סימן מים מגן מתקדם עם מספר אלמנטים להגנה מקסימלית',
          template_type: 'watermark',
          target_format: 'pdf-a4-portrait',
          is_default: true,
          target_file_types: ['pdf'],
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png',
              position: { x: 25, y: 25 }, // Top left
              style: {
                size: 80,
                opacity: 20
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 45,
              content: 'לתצוגה בלבד',
              position: { x: 50, y: 50 }, // Center
              style: {
                fontSize: 28,
                color: '#e74c3c',
                bold: true,
                italic: false,
                opacity: 25,
                width: 200,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: -15,
              href: '${FRONTEND_URL}',
              position: { x: 75, y: 75 }, // Bottom right
              style: {
                fontSize: 16,
                color: '#3498db',
                bold: true,
                italic: false,
                opacity: 30,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {
              'watermark-logo-2': {
                type: 'logo',
                name: 'לוגו נוסף',
                visible: true,
                hidden: false,
                rotation: 0,
                url: 'logo.png',
                position: { x: 75, y: 25 }, // Top right
                style: {
                  size: 60,
                  opacity: 15
                }
              },
              'watermark-text-2': {
                type: 'free-text',
                name: 'טקסט הגנה נוסף',
                visible: true,
                hidden: false,
                rotation: -45,
                content: 'לתצוגה בלבד',
                position: { x: 25, y: 75 }, // Bottom left
                style: {
                  fontSize: 20,
                  color: '#e67e22',
                  bold: true,
                  italic: false,
                  opacity: 20,
                  width: 150,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'watermark-url-2': {
                type: 'url',
                name: 'קישור נוסף',
                visible: true,
                hidden: false,
                rotation: 15,
                href: '${FRONTEND_URL}',
                position: { x: 25, y: 50 }, // Center left
                style: {
                  fontSize: 14,
                  color: '#9b59b6',
                  bold: false,
                  italic: true,
                  opacity: 25,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'user-info-bottom': {
                type: 'user-info',
                name: 'פרטי משתמש',
                visible: true,
                hidden: false,
                rotation: 0,
                content: 'קובץ זה נוצר עבור {{user.email}}',
                editable: false,
                position: { x: 50, y: 90 }, // Bottom center
                style: {
                  fontSize: 11,
                  color: '#7f8c8d',
                  bold: false,
                  italic: true,
                  opacity: 70,
                  width: 250,
                  fontFamily: 'Arial, sans-serif'
                }
              }
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },

        // PDF A4 Landscape Watermark
        {
          id: generateId(),
          name: 'סימן מים מגן - PDF A4 לרוחב',
          description: 'סימן מים מגן מותאם לפורמט לרוחב עם פריסה אופקית',
          template_type: 'watermark',
          target_format: 'pdf-a4-landscape',
          is_default: true,
          target_file_types: ['pdf'],
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png',
              position: { x: 15, y: 15 }, // Top left
              style: {
                size: 70,
                opacity: 18
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 30,
              content: 'לתצוגה בלבד',
              position: { x: 50, y: 45 }, // Center
              style: {
                fontSize: 32,
                color: '#e74c3c',
                bold: true,
                italic: false,
                opacity: 22,
                width: 250,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: -10,
              href: '${FRONTEND_URL}',
              position: { x: 85, y: 85 }, // Bottom right
              style: {
                fontSize: 18,
                color: '#3498db',
                bold: true,
                italic: false,
                opacity: 28,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {
              'watermark-logo-2': {
                type: 'logo',
                name: 'לוגו נוסף',
                visible: true,
                hidden: false,
                rotation: 0,
                url: 'logo.png',
                position: { x: 85, y: 15 }, // Top right
                style: {
                  size: 55,
                  opacity: 15
                }
              },
              'watermark-text-2': {
                type: 'free-text',
                name: 'טקסט הגנה נוסף',
                visible: true,
                hidden: false,
                rotation: -30,
                content: 'לתצוגה בלבד',
                position: { x: 15, y: 75 }, // Bottom left
                style: {
                  fontSize: 24,
                  color: '#e67e22',
                  bold: true,
                  italic: false,
                  opacity: 18,
                  width: 180,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'watermark-url-2': {
                type: 'url',
                name: 'קישור נוסף',
                visible: true,
                hidden: false,
                rotation: 10,
                href: '${FRONTEND_URL}',
                position: { x: 75, y: 25 }, // Top right area
                style: {
                  fontSize: 16,
                  color: '#9b59b6',
                  bold: false,
                  italic: true,
                  opacity: 22,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'user-info-bottom': {
                type: 'user-info',
                name: 'פרטי משתמש',
                visible: true,
                hidden: false,
                rotation: 0,
                content: 'קובץ זה נוצר עבור {{user.email}}',
                editable: false,
                position: { x: 50, y: 88 }, // Bottom center
                style: {
                  fontSize: 12,
                  color: '#7f8c8d',
                  bold: false,
                  italic: true,
                  opacity: 65,
                  width: 300,
                  fontFamily: 'Arial, sans-serif'
                }
              }
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },

        // SVG Lesson Plan Watermark
        {
          id: generateId(),
          name: 'סימן מים מגן - מצגת SVG',
          description: 'סימן מים מגן מותאם למצגות SVG עם עיצוב דיגיטלי',
          template_type: 'watermark',
          target_format: 'svg-lessonplan',
          is_default: true,
          target_file_types: ['svg'],
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: 'logo.png',
              position: { x: 20, y: 20 }, // Top left
              style: {
                size: 60,
                opacity: 25
              }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 35,
              content: 'לתצוגה בלבד',
              position: { x: 50, y: 50 }, // Center
              style: {
                fontSize: 26,
                color: '#e74c3c',
                bold: true,
                italic: false,
                opacity: 30,
                width: 200,
                fontFamily: 'Arial, sans-serif'
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: '${FRONTEND_URL}',
              position: { x: 80, y: 80 }, // Bottom right
              style: {
                fontSize: 14,
                color: '#3498db',
                bold: true,
                italic: false,
                opacity: 35,
                fontFamily: 'Arial, sans-serif'
              }
            },
            customElements: {
              'watermark-logo-2': {
                type: 'logo',
                name: 'לוגו נוסף',
                visible: true,
                hidden: false,
                rotation: 0,
                url: 'logo.png',
                position: { x: 80, y: 20 }, // Top right
                style: {
                  size: 45,
                  opacity: 20
                }
              },
              'watermark-text-2': {
                type: 'free-text',
                name: 'טקסט הגנה נוסף',
                visible: true,
                hidden: false,
                rotation: -35,
                content: 'לתצוגה בלבד',
                position: { x: 20, y: 80 }, // Bottom left
                style: {
                  fontSize: 18,
                  color: '#e67e22',
                  bold: true,
                  italic: false,
                  opacity: 25,
                  width: 140,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'watermark-url-2': {
                type: 'url',
                name: 'קישור נוסף',
                visible: true,
                hidden: false,
                rotation: 0,
                href: '${FRONTEND_URL}',
                position: { x: 20, y: 50 }, // Center left
                style: {
                  fontSize: 12,
                  color: '#9b59b6',
                  bold: false,
                  italic: true,
                  opacity: 28,
                  fontFamily: 'Arial, sans-serif'
                }
              },
              'user-info-bottom': {
                type: 'user-info',
                name: 'פרטי משתמש',
                visible: true,
                hidden: false,
                rotation: 0,
                content: 'קובץ זה נוצר עבור {{user.email}}',
                editable: false,
                position: { x: 50, y: 92 }, // Bottom center
                style: {
                  fontSize: 10,
                  color: '#7f8c8d',
                  bold: false,
                  italic: true,
                  opacity: 75,
                  width: 220,
                  fontFamily: 'Arial, sans-serif'
                }
              }
            }
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('system_templates', watermarkTemplates, { transaction });
      console.log(`✅ Created ${watermarkTemplates.length} protective watermark templates`);

      // Step 6: Verify migration results
      console.log('🔍 Verifying comprehensive template system...');

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

      console.log('📊 Template system verification results:');
      verificationResults.forEach(row => {
        console.log(`   ${row.template_type} (${row.target_format}): ${row.count} templates, ${row.default_count} default`);
      });

      const [totalCount] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as total FROM system_templates
      `, { transaction });

      console.log(`📈 Total templates created: ${totalCount[0].total}`);

      await transaction.commit();
      console.log('✅ Comprehensive template system created successfully!');
      console.log('🎉 Hebrew branding and protective watermark templates are ready!');
      console.log('🔐 User-info template functionality included for enhanced security!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting comprehensive template system...');

      // Remove indexes from file table
      const fileIndexes = [
        'idx_file_branding_template_id',
        'idx_file_branding_settings',
        'idx_file_watermark_template_id',
        'idx_file_accessible_pages',
        'idx_file_target_format'
      ];

      for (const indexName of fileIndexes) {
        try {
          await queryInterface.removeIndex('file', indexName, { transaction });
        } catch (e) {
          console.log(`Index ${indexName} not found, skipping...`);
        }
      }

      // Remove columns from file table
      const fileColumns = [
        'target_format',
        'accessible_pages',
        'watermark_settings',
        'watermark_template_id',
        'branding_settings',
        'branding_template_id'
      ];

      for (const column of fileColumns) {
        try {
          await queryInterface.removeColumn('file', column, { transaction });
        } catch (e) {
          console.log(`Column ${column} not found, skipping...`);
        }
      }

      // Remove indexes from system_templates table
      const templateIndexes = [
        'unique_default_per_type_format',
        'idx_system_templates_created_by',
        'idx_system_templates_file_types',
        'idx_system_templates_type_format',
        'idx_system_templates_type_default',
        'idx_system_templates_default',
        'idx_system_templates_format',
        'idx_system_templates_type'
      ];

      for (const indexName of templateIndexes) {
        try {
          await queryInterface.removeIndex('system_templates', indexName, { transaction });
        } catch (e) {
          console.log(`Index ${indexName} not found, skipping...`);
        }
      }

      // Drop constraints
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

      // Drop system_templates table
      await queryInterface.dropTable('system_templates', { transaction });

      await transaction.commit();
      console.log('✅ Comprehensive template system reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};