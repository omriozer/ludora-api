'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add user_settings JSONB field
      await queryInterface.addColumn('user', 'user_settings', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'User settings including privacy_code and achievements for player users'
      }, { transaction });

      // Add is_online BOOLEAN field
      await queryInterface.addColumn('user', 'is_online', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether user is currently connected (mainly for player users)'
      }, { transaction });

      // Skip unique constraint - already exists as 'user_email_unique'
      // Skip some indexes that might already exist, only add the essential ones

      // Add index for user_settings field (GIN index for JSONB)
      try {
        await queryInterface.addIndex('user', ['user_settings'], {
          name: 'idx_user_settings_gin',
          using: 'gin',
          transaction
        });
      } catch (error) {
        if (!error.message.includes('already exists')) throw error;
      }

      // Add index for is_online field
      try {
        await queryInterface.addIndex('user', ['is_online'], {
          name: 'idx_user_online',
          transaction
        });
      } catch (error) {
        if (!error.message.includes('already exists')) throw error;
      }

      // Add combined index for user_type and is_online
      try {
        await queryInterface.addIndex('user', ['user_type', 'is_online'], {
          name: 'idx_user_type_online',
          transaction
        });
      } catch (error) {
        if (!error.message.includes('already exists')) throw error;
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes first (only the ones we added)
      try {
        await queryInterface.removeIndex('user', 'idx_user_type_online', { transaction });
      } catch (error) {
        if (!error.message.includes('does not exist')) throw error;
      }

      try {
        await queryInterface.removeIndex('user', 'idx_user_online', { transaction });
      } catch (error) {
        if (!error.message.includes('does not exist')) throw error;
      }

      try {
        await queryInterface.removeIndex('user', 'idx_user_settings_gin', { transaction });
      } catch (error) {
        if (!error.message.includes('does not exist')) throw error;
      }

      // Don't remove unique constraint on email - it was already there

      // Remove columns we added
      await queryInterface.removeColumn('user', 'is_online', { transaction });
      await queryInterface.removeColumn('user', 'user_settings', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};