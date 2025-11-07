const { DataTypes } = require('sequelize');

/**
 * Migration: Create System Templates and Migrate Footer Settings
 *
 * Creates a flexible system template architecture and migrates existing footer settings:
 * 1. Creates system_templates table for reusable template management
 * 2. Adds footer_template_id reference to File table
 * 3. Migrates existing Settings.footer_settings to default footer template
 * 4. Creates built-in footer templates (landscape, portrait, minimal, etc.)
 * 5. Removes legacy footer_settings field from Settings table
 *
 * This implements the enhanced PDF footer template system with rotation and hiding capabilities.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting system templates creation and footer migration...');

      // Step 1: Create system_templates table
      console.log('📝 Creating system_templates table...');

      await queryInterface.createTable('system_templates', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          comment: 'Human-readable template name (e.g., "Landscape Footer", "Portrait Minimal")'
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Optional description of template purpose and usage'
        },
        template_type: {
          type: DataTypes.STRING(100),
          allowNull: false,
          comment: 'Type of template (footer, header, watermark, etc.)'
        },
        category: {
          type: DataTypes.STRING(100),
          allowNull: true,
          comment: 'Template category (landscape, portrait, minimal, logo-only, corporate, etc.)'
        },
        is_default: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether this template is the default for its template_type'
        },
        template_data: {
          type: DataTypes.JSONB,
          allowNull: false,
          comment: 'Flexible template configuration data structure, varies by template_type'
        },
        created_by: {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: 'Email of user who created this template (admin user)'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      }, { transaction });

      // Step 2: Create indexes for system_templates
      console.log('📝 Creating indexes for system_templates...');

      await queryInterface.addIndex('system_templates', ['template_type'], {
        name: 'idx_system_templates_type',
        transaction
      });

      await queryInterface.addIndex('system_templates', ['category'], {
        name: 'idx_system_templates_category',
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

      await queryInterface.addIndex('system_templates', ['created_by'], {
        name: 'idx_system_templates_created_by',
        transaction
      });

      // Step 3: Add footer_template_id to File table
      console.log('📝 Adding footer_template_id to File table...');

      await queryInterface.addColumn('file', 'footer_template_id', {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference to system_templates for footer configuration'
      }, { transaction });

      await queryInterface.addIndex('file', ['footer_template_id'], {
        name: 'idx_file_footer_template_id',
        transaction
      });

      // Step 4: Migrate existing Settings.footer_settings to default template
      console.log('🔄 Migrating existing footer settings to default template...');

      // Get existing footer settings from Settings table
      const [systemSettings] = await queryInterface.sequelize.query(
        'SELECT footer_settings, copyright_footer_text FROM settings LIMIT 1',
        { transaction }
      );

      let defaultFooterTemplate = {
        logo: {
          visible: true,
          hidden: false,
          rotation: 0,
          url: '/api/assets/image/settings/logo.png',
          position: { x: 50, y: 95 },
          style: { size: 80, opacity: 100 }
        },
        text: {
          visible: true,
          hidden: false,
          rotation: 0,
          content: 'Copyright © 2024 Ludora. All rights reserved.',
          position: { x: 50, y: 90 },
          style: {
            fontSize: 12,
            color: "#000000",
            bold: false,
            italic: false,
            opacity: 80,
            width: 300
          }
        },
        url: {
          visible: true,
          hidden: false,
          rotation: 0,
          href: 'https://ludora.app',
          position: { x: 50, y: 85 },
          style: {
            fontSize: 12,
            color: "#0066cc",
            bold: false,
            italic: false,
            opacity: 100
          }
        },
        customElements: {}
      };

      // Use existing settings if they exist
      if (systemSettings[0] && systemSettings[0].footer_settings) {
        const existingSettings = systemSettings[0].footer_settings;

        // Enhance existing settings with new rotation and hidden properties
        if (existingSettings.logo) {
          defaultFooterTemplate.logo = {
            ...defaultFooterTemplate.logo,
            ...existingSettings.logo,
            hidden: false,
            rotation: 0
          };
        }

        if (existingSettings.text) {
          defaultFooterTemplate.text = {
            ...defaultFooterTemplate.text,
            ...existingSettings.text,
            hidden: false,
            rotation: 0
          };
        }

        if (existingSettings.url) {
          defaultFooterTemplate.url = {
            ...defaultFooterTemplate.url,
            ...existingSettings.url,
            hidden: false,
            rotation: 0
          };
        }
      }

      // Use existing copyright text if available
      if (systemSettings[0] && systemSettings[0].copyright_footer_text) {
        defaultFooterTemplate.text.content = systemSettings[0].copyright_footer_text;
      }

      // Generate IDs for templates (using the nanoid pattern from baseModel)
      const generateId = () => {
        const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return result;
      };

      // Step 5: Create default footer template
      const defaultTemplateId = generateId();
      await queryInterface.bulkInsert('system_templates', [
        {
          id: defaultTemplateId,
          name: 'Default Footer',
          description: 'Default footer template migrated from system settings',
          template_type: 'footer',
          category: 'standard',
          is_default: true,
          template_data: JSON.stringify(defaultFooterTemplate),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ], { transaction });

      console.log(`✅ Created default footer template with ID: ${defaultTemplateId}`);

      // Step 6: Create built-in footer templates
      console.log('📝 Creating built-in footer templates...');

      const builtInTemplates = [
        {
          id: generateId(),
          name: 'Landscape Footer',
          description: 'Optimized footer layout for landscape orientation documents',
          template_type: 'footer',
          category: 'landscape',
          is_default: false,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 10, y: 95 },
              style: { size: 60, opacity: 100 }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: 'Copyright © 2024 Ludora. All rights reserved.',
              position: { x: 50, y: 95 },
              style: {
                fontSize: 10,
                color: "#000000",
                bold: false,
                italic: false,
                opacity: 80,
                width: 400
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: 'https://ludora.app',
              position: { x: 90, y: 95 },
              style: {
                fontSize: 10,
                color: "#0066cc",
                bold: false,
                italic: false,
                opacity: 100
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Portrait Footer',
          description: 'Optimized footer layout for portrait orientation documents',
          template_type: 'footer',
          category: 'portrait',
          is_default: false,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 50, y: 98 },
              style: { size: 80, opacity: 100 }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: 'Copyright © 2024 Ludora. All rights reserved.',
              position: { x: 50, y: 93 },
              style: {
                fontSize: 12,
                color: "#000000",
                bold: false,
                italic: false,
                opacity: 80,
                width: 350
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: 'https://ludora.app',
              position: { x: 50, y: 88 },
              style: {
                fontSize: 11,
                color: "#0066cc",
                bold: false,
                italic: false,
                opacity: 100
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Minimal Footer',
          description: 'Minimal footer with just copyright text, small and unobtrusive',
          template_type: 'footer',
          category: 'minimal',
          is_default: false,
          template_data: JSON.stringify({
            logo: {
              visible: false,
              hidden: false,
              rotation: 0,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 50, y: 95 },
              style: { size: 60, opacity: 100 }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: 'Copyright © 2024 Ludora. All rights reserved.',
              position: { x: 50, y: 97 },
              style: {
                fontSize: 8,
                color: "#666666",
                bold: false,
                italic: false,
                opacity: 60,
                width: 200
              }
            },
            url: {
              visible: false,
              hidden: false,
              rotation: 0,
              href: 'https://ludora.app',
              position: { x: 50, y: 85 },
              style: {
                fontSize: 8,
                color: "#0066cc",
                bold: false,
                italic: false,
                opacity: 100
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Logo Only Footer',
          description: 'Simple footer with just the logo, positioned bottom-right',
          template_type: 'footer',
          category: 'logo-only',
          is_default: false,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 85, y: 95 },
              style: { size: 100, opacity: 80 }
            },
            text: {
              visible: false,
              hidden: false,
              rotation: 0,
              content: 'Copyright © 2024 Ludora. All rights reserved.',
              position: { x: 50, y: 90 },
              style: {
                fontSize: 12,
                color: "#000000",
                bold: false,
                italic: false,
                opacity: 80,
                width: 300
              }
            },
            url: {
              visible: false,
              hidden: false,
              rotation: 0,
              href: 'https://ludora.app',
              position: { x: 50, y: 85 },
              style: {
                fontSize: 12,
                color: "#0066cc",
                bold: false,
                italic: false,
                opacity: 100
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          name: 'Corporate Footer',
          description: 'Professional corporate footer with full branding elements',
          template_type: 'footer',
          category: 'corporate',
          is_default: false,
          template_data: JSON.stringify({
            logo: {
              visible: true,
              hidden: false,
              rotation: 0,
              url: '/api/assets/image/settings/logo.png',
              position: { x: 15, y: 92 },
              style: { size: 120, opacity: 100 }
            },
            text: {
              visible: true,
              hidden: false,
              rotation: 0,
              content: 'Copyright © 2024 Ludora. All rights reserved.',
              position: { x: 50, y: 94 },
              style: {
                fontSize: 11,
                color: "#333333",
                bold: true,
                italic: false,
                opacity: 90,
                width: 350
              }
            },
            url: {
              visible: true,
              hidden: false,
              rotation: 0,
              href: 'https://ludora.app',
              position: { x: 50, y: 90 },
              style: {
                fontSize: 10,
                color: "#0066cc",
                bold: false,
                italic: false,
                opacity: 100
              }
            },
            customElements: {}
          }),
          created_by: 'system_migration',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      await queryInterface.bulkInsert('system_templates', builtInTemplates, { transaction });

      console.log(`✅ Created ${builtInTemplates.length} built-in footer templates`);

      // Step 7: Remove legacy footer_settings from Settings table
      console.log('🗑️ Removing legacy footer_settings from Settings table...');

      await queryInterface.removeColumn('settings', 'footer_settings', { transaction });

      // Step 8: Verify migration results
      console.log('🔍 Verifying migration results...');

      const [templateCount] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total_templates,
           COUNT(CASE WHEN template_type = 'footer' THEN 1 END) as footer_templates,
           COUNT(CASE WHEN is_default = true THEN 1 END) as default_templates
         FROM system_templates`,
        { transaction }
      );

      const [fileColumns] = await queryInterface.sequelize.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'file'
         AND table_schema = 'public'
         AND column_name IN ('footer_template_id', 'footer_overrides', 'add_copyrights_footer')`,
        { transaction }
      );

      const stats = templateCount[0];
      const hasRequiredColumns = fileColumns.length === 3;

      console.log('📊 Template migration verification:');
      console.log(`   Total templates created: ${stats.total_templates}`);
      console.log(`   Footer templates: ${stats.footer_templates}`);
      console.log(`   Default templates: ${stats.default_templates}`);
      console.log(`   File table properly updated: ${hasRequiredColumns ? 'Yes' : 'No'}`);

      await transaction.commit();
      console.log('✅ System templates creation and footer migration completed successfully!');
      console.log('🎉 Enhanced PDF footer template system is now ready!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting system templates and footer migration...');

      // Step 1: Get default template data for restoration
      const [defaultTemplate] = await queryInterface.sequelize.query(
        `SELECT template_data FROM system_templates
         WHERE template_type = 'footer' AND is_default = true LIMIT 1`,
        { transaction }
      );

      // Step 2: Restore footer_settings to Settings table
      console.log('🔄 Restoring footer_settings to Settings table...');

      await queryInterface.addColumn('settings', 'footer_settings', {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Complete footer configuration (logo, text, url). File-specific overrides stored in file.footer_overrides.'
      }, { transaction });

      if (defaultTemplate[0] && defaultTemplate[0].template_data) {
        await queryInterface.sequelize.query(
          `UPDATE settings SET footer_settings = :footerSettings`,
          {
            replacements: {
              footerSettings: JSON.stringify(defaultTemplate[0].template_data)
            },
            transaction
          }
        );
      }

      // Step 3: Remove indexes from File table
      console.log('🗑️ Removing File table indexes...');

      try {
        await queryInterface.removeIndex('file', 'idx_file_footer_template_id', { transaction });
      } catch (e) {
        console.log('Index idx_file_footer_template_id not found, skipping...');
      }

      // Step 4: Remove footer_template_id from File table
      console.log('🗑️ Removing footer_template_id from File table...');

      await queryInterface.removeColumn('file', 'footer_template_id', { transaction });

      // Step 5: Remove system_templates indexes
      console.log('🗑️ Removing system_templates indexes...');

      const indexes = [
        'idx_system_templates_type',
        'idx_system_templates_category',
        'idx_system_templates_default',
        'idx_system_templates_type_default',
        'idx_system_templates_created_by'
      ];

      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('system_templates', indexName, { transaction });
        } catch (e) {
          console.log(`Index ${indexName} not found, skipping...`);
        }
      }

      // Step 6: Drop system_templates table
      console.log('🗑️ Dropping system_templates table...');

      await queryInterface.dropTable('system_templates', { transaction });

      await transaction.commit();
      console.log('✅ System templates migration reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};