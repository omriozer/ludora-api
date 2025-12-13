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

      // Make email field unique
      await queryInterface.addConstraint('user', {
        fields: ['email'],
        type: 'unique',
        name: 'user_email_unique'
      }, { transaction });

      // Add indexes for new fields
      await queryInterface.addIndex('user', ['user_settings'], {
        name: 'idx_user_settings_gin',
        using: 'gin',
        transaction
      });

      await queryInterface.addIndex('user', ['is_online'], {
        name: 'idx_user_online',
        transaction
      });

      await queryInterface.addIndex('user', ['user_type', 'is_online'], {
        name: 'idx_user_type_online',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes first
      await queryInterface.removeIndex('user', 'idx_user_type_online', { transaction });
      await queryInterface.removeIndex('user', 'idx_user_online', { transaction });
      await queryInterface.removeIndex('user', 'idx_user_settings_gin', { transaction });

      // Remove unique constraint on email
      await queryInterface.removeConstraint('user', 'user_email_unique', { transaction });

      // Remove columns
      await queryInterface.removeColumn('user', 'is_online', { transaction });
      await queryInterface.removeColumn('user', 'user_settings', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};