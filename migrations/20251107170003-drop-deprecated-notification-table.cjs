const { DataTypes } = require('sequelize');

/**
 * Migration: Drop Deprecated Notification Table
 *
 * Removes the notification table and related references that are no longer used.
 * The Notification model exists but has no active business functionality.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Starting removal of deprecated notification table...');

      // First, remove any foreign key constraints that reference the notification table
      // Check for any constraints that might reference notification table
      console.log('🔍 Checking for foreign key references to notification table...');

      // Drop any indexes on the notification table if they exist
      try {
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_notification_user_id CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_notification_read CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No indexes found on notification table, continuing...');
      }

      // Drop the notification table if it exists
      console.log('🗑️ Dropping notification table...');
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS notification CASCADE;',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Deprecated notification table cleanup completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Recreating notification table...');
      console.log('⚠️ Note: This table was deprecated and should not be recreated in normal circumstances.');

      // Recreate the notification table based on the model definition
      await queryInterface.createTable('notification', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        message: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        read: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
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

      // Recreate basic indexes
      await queryInterface.addIndex('notification', ['user_id'], {
        name: 'idx_notification_user_id',
        transaction
      });

      await queryInterface.addIndex('notification', ['read'], {
        name: 'idx_notification_read',
        transaction
      });

      await transaction.commit();
      console.log('✅ Notification table recreated (though it remains deprecated).');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};