'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add lesson_plans navigation fields to settings table
      await queryInterface.addColumn('settings', 'nav_lesson_plans_text', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_lesson_plans_icon', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_lesson_plans_visibility', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'logged_in_users'
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_lesson_plans_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }, { transaction });

      // Add allow_content_creator_lesson_plans field for creator permissions
      await queryInterface.addColumn('settings', 'allow_content_creator_lesson_plans', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }, { transaction });

      await transaction.commit();
      console.log('Successfully added lesson_plans navigation fields to settings table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding lesson_plans navigation fields to settings table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove lesson_plans navigation fields from settings table
      await queryInterface.removeColumn('settings', 'nav_lesson_plans_text', { transaction });
      await queryInterface.removeColumn('settings', 'nav_lesson_plans_icon', { transaction });
      await queryInterface.removeColumn('settings', 'nav_lesson_plans_visibility', { transaction });
      await queryInterface.removeColumn('settings', 'nav_lesson_plans_enabled', { transaction });
      await queryInterface.removeColumn('settings', 'allow_content_creator_lesson_plans', { transaction });

      await transaction.commit();
      console.log('Successfully removed lesson_plans navigation fields from settings table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing lesson_plans navigation fields from settings table:', error);
      throw error;
    }
  }
};