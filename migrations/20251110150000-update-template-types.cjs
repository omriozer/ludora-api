'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Updating template types: removing header, renaming footer to branding...');

    try {
      // Delete all header templates first
      await queryInterface.bulkDelete('system_templates', {
        template_type: 'header'
      });
      console.log('✅ Deleted all header templates');

      // Drop the existing check constraint to allow branding
      await queryInterface.sequelize.query(
        'ALTER TABLE system_templates DROP CONSTRAINT IF EXISTS chk_template_type;'
      );
      console.log('✅ Dropped old template type constraint');

      // Add new constraint with only 'branding' and 'watermark'
      await queryInterface.sequelize.query(
        "ALTER TABLE system_templates ADD CONSTRAINT chk_template_type CHECK (template_type IN ('branding', 'watermark'));"
      );
      console.log('✅ Added new template type constraint (branding, watermark)');

      // Now update footer templates to branding
      await queryInterface.bulkUpdate('system_templates',
        { template_type: 'branding' },
        { template_type: 'footer' }
      );
      console.log('✅ Renamed footer templates to branding');

      // Update template names for clarity
      await queryInterface.bulkUpdate('system_templates',
        { name: 'מיתוג ברירת מחדל - PDF A4 לאורך' },
        {
          template_type: 'branding',
          target_format: 'pdf-a4-portrait'
        }
      );

      await queryInterface.bulkUpdate('system_templates',
        { name: 'מיתוג ברירת מחדל - PDF A4 לרוחב' },
        {
          template_type: 'branding',
          target_format: 'pdf-a4-landscape'
        }
      );

      await queryInterface.bulkUpdate('system_templates',
        { name: 'מיתוג ברירת מחדל - מצגת SVG' },
        {
          template_type: 'branding',
          target_format: 'svg-lessonplan'
        }
      );

      console.log('✅ Updated template names for branding templates');
      console.log('📊 Final template types: watermark, branding');

    } catch (error) {
      console.error('❌ Error updating template types:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Reverting template type changes...');

    try {
      // Revert branding back to footer
      await queryInterface.bulkUpdate('system_templates',
        { template_type: 'footer' },
        { template_type: 'branding' }
      );

      // Revert template names
      await queryInterface.bulkUpdate('system_templates',
        { name: 'תחתית ברירת מחדל - PDF A4 לאורך' },
        {
          template_type: 'footer',
          target_format: 'pdf-a4-portrait'
        }
      );

      await queryInterface.bulkUpdate('system_templates',
        { name: 'תחתית ברירת מחדל - PDF A4 לרוחב' },
        {
          template_type: 'footer',
          target_format: 'pdf-a4-landscape'
        }
      );

      await queryInterface.bulkUpdate('system_templates',
        { name: 'תחתית ברירת מחדל - מצגת SVG' },
        {
          template_type: 'footer',
          target_format: 'svg-lessonplan'
        }
      );

      console.log('✅ Reverted template changes');

    } catch (error) {
      console.error('❌ Error reverting template changes:', error);
      throw error;
    }
  }
};