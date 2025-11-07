const { DataTypes } = require('sequelize');

/**
 * Migration: Create EmailTemplate Table
 *
 * Creates the emailtemplate table for email template management system.
 * This table stores reusable email templates with trigger conditions and targeting options.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('📝 Creating emailtemplate table...');

      // Create emailtemplate table
      await queryInterface.createTable('emailtemplate', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Human-readable template name'
        },
        subject: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Email subject line template'
        },
        html_content: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'HTML email body content with template variables'
        },
        trigger_type: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Event type that triggers this email (registration_confirmation, payment_confirmation, etc.)'
        },
        trigger_hours_before: {
          type: DataTypes.DECIMAL,
          allowNull: true,
          comment: 'Hours before event to trigger email'
        },
        trigger_hours_after: {
          type: DataTypes.DECIMAL,
          allowNull: true,
          comment: 'Hours after event to trigger email'
        },
        target_product_types: {
          type: DataTypes.JSONB,
          allowNull: true,
          comment: 'Array of product types to target for this template'
        },
        target_product_ids: {
          type: DataTypes.JSONB,
          allowNull: true,
          comment: 'Array of specific product IDs to target for this template'
        },
        target_admin_emails: {
          type: DataTypes.JSONB,
          allowNull: true,
          comment: 'Array of admin emails to notify'
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: true,
          comment: 'Whether this template is currently active'
        },
        send_to_admins: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
          comment: 'Whether to send this email to administrators'
        },
        access_expiry_days_before: {
          type: DataTypes.DECIMAL,
          allowNull: true,
          comment: 'Days before access expiry to trigger email'
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
      }, {
        transaction,
        ifNotExists: true
      });

      // Create indexes for emailtemplate
      console.log('📝 Creating indexes for emailtemplate table...');

      await queryInterface.addIndex('emailtemplate', ['trigger_type'], {
        name: 'idx_emailtemplate_trigger_type',
        transaction
      });

      await queryInterface.addIndex('emailtemplate', ['is_active'], {
        name: 'idx_emailtemplate_is_active',
        transaction
      });

      await queryInterface.addIndex('emailtemplate', ['trigger_type', 'is_active'], {
        name: 'idx_emailtemplate_trigger_active',
        transaction
      });

      await queryInterface.addIndex('emailtemplate', ['send_to_admins'], {
        name: 'idx_emailtemplate_send_to_admins',
        transaction
      });

      await transaction.commit();
      console.log('✅ EmailTemplate table created successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Dropping emailtemplate table...');

      // Remove indexes first
      try {
        await queryInterface.removeIndex('emailtemplate', 'idx_emailtemplate_trigger_type', { transaction });
        await queryInterface.removeIndex('emailtemplate', 'idx_emailtemplate_is_active', { transaction });
        await queryInterface.removeIndex('emailtemplate', 'idx_emailtemplate_trigger_active', { transaction });
        await queryInterface.removeIndex('emailtemplate', 'idx_emailtemplate_send_to_admins', { transaction });
      } catch (e) {
        console.log('Some indexes may not exist, continuing...');
      }

      // Drop the table
      await queryInterface.dropTable('emailtemplate', { transaction });

      await transaction.commit();
      console.log('✅ EmailTemplate table dropped successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};