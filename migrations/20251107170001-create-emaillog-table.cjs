const { DataTypes } = require('sequelize');

/**
 * Migration: Create EmailLog Table
 *
 * Creates the emaillog table for tracking sent emails and their delivery status.
 * This table logs all email communications sent through the EmailService.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('📝 Creating emaillog table...');

      // Create emaillog table
      await queryInterface.createTable('emaillog', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        template_id: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Reference to emailtemplate used for this email'
        },
        recipient_email: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Email address of the recipient'
        },
        subject: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Actual email subject that was sent'
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Actual email content that was sent'
        },
        trigger_type: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Event that triggered this email (registration_confirmation, payment_confirmation, etc.)'
        },
        related_product_id: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Product related to this email (if applicable)'
        },
        related_registration_id: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Registration related to this email (if applicable) - DEPRECATED'
        },
        related_purchase_id: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Purchase transaction related to this email'
        },
        status: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Email delivery status (sent, failed, pending)'
        },
        error_message: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Error message if email sending failed'
        },
        scheduled_for: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'When email is scheduled to be sent (for future implementation)'
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

      // Create indexes for emaillog
      console.log('📝 Creating indexes for emaillog table...');

      await queryInterface.addIndex('emaillog', ['recipient_email'], {
        name: 'idx_emaillog_recipient_email',
        transaction
      });

      await queryInterface.addIndex('emaillog', ['template_id'], {
        name: 'idx_emaillog_template_id',
        transaction
      });

      await queryInterface.addIndex('emaillog', ['status'], {
        name: 'idx_emaillog_status',
        transaction
      });

      await queryInterface.addIndex('emaillog', ['trigger_type'], {
        name: 'idx_emaillog_trigger_type',
        transaction
      });

      await queryInterface.addIndex('emaillog', ['related_purchase_id'], {
        name: 'idx_emaillog_related_purchase_id',
        transaction
      });

      await queryInterface.addIndex('emaillog', ['created_at'], {
        name: 'idx_emaillog_created_at',
        transaction
      });

      // Add foreign key constraints
      console.log('📝 Adding foreign key constraints for emaillog table...');

      // Foreign key to emailtemplate table
      await queryInterface.addConstraint('emaillog', {
        fields: ['template_id'],
        type: 'foreign key',
        name: 'fk_emaillog_template',
        references: {
          table: 'emailtemplate',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      // Foreign key to purchase table
      await queryInterface.addConstraint('emaillog', {
        fields: ['related_purchase_id'],
        type: 'foreign key',
        name: 'fk_emaillog_purchase',
        references: {
          table: 'purchase',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await transaction.commit();
      console.log('✅ EmailLog table created successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Dropping emaillog table...');

      // Remove foreign key constraints first
      try {
        await queryInterface.removeConstraint('emaillog', 'fk_emaillog_template', { transaction });
        await queryInterface.removeConstraint('emaillog', 'fk_emaillog_purchase', { transaction });
      } catch (e) {
        console.log('Some constraints may not exist, continuing...');
      }

      // Remove indexes
      try {
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_recipient_email', { transaction });
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_template_id', { transaction });
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_status', { transaction });
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_trigger_type', { transaction });
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_related_purchase_id', { transaction });
        await queryInterface.removeIndex('emaillog', 'idx_emaillog_created_at', { transaction });
      } catch (e) {
        console.log('Some indexes may not exist, continuing...');
      }

      // Drop the table
      await queryInterface.dropTable('emaillog', { transaction });

      await transaction.commit();
      console.log('✅ EmailLog table dropped successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};