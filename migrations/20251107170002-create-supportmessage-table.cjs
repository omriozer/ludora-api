const { DataTypes } = require('sequelize');

/**
 * Migration: Create SupportMessage Table
 *
 * Creates the supportmessage table for storing customer support requests.
 * This table is used by the Contact form and admin support dashboard.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('📝 Creating supportmessage table...');

      // Create supportmessage table
      await queryInterface.createTable('supportmessage', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Name of the person submitting the support request'
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Email address of the person submitting the request'
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Phone number of the person submitting the request'
        },
        subject: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Subject line of the support request'
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Detailed content of the support request'
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
          comment: 'Whether this message has been read by an administrator'
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

      // Create indexes for supportmessage
      console.log('📝 Creating indexes for supportmessage table...');

      await queryInterface.addIndex('supportmessage', ['email'], {
        name: 'idx_supportmessage_email',
        transaction
      });

      await queryInterface.addIndex('supportmessage', ['is_read'], {
        name: 'idx_supportmessage_is_read',
        transaction
      });

      await queryInterface.addIndex('supportmessage', ['created_at'], {
        name: 'idx_supportmessage_created_at',
        transaction
      });

      await queryInterface.addIndex('supportmessage', ['is_read', 'created_at'], {
        name: 'idx_supportmessage_read_created',
        transaction
      });

      await transaction.commit();
      console.log('✅ SupportMessage table created successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Dropping supportmessage table...');

      // Remove indexes first
      try {
        await queryInterface.removeIndex('supportmessage', 'idx_supportmessage_email', { transaction });
        await queryInterface.removeIndex('supportmessage', 'idx_supportmessage_is_read', { transaction });
        await queryInterface.removeIndex('supportmessage', 'idx_supportmessage_created_at', { transaction });
        await queryInterface.removeIndex('supportmessage', 'idx_supportmessage_read_created', { transaction });
      } catch (e) {
        console.log('Some indexes may not exist, continuing...');
      }

      // Drop the table
      await queryInterface.dropTable('supportmessage', { transaction });

      await transaction.commit();
      console.log('✅ SupportMessage table dropped successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};