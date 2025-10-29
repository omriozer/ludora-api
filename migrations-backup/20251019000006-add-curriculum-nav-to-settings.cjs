'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add curriculum navigation fields to settings table
      await queryInterface.addColumn('settings', 'nav_curriculum_text', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_curriculum_icon', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_curriculum_visibility', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'logged_in_users'
      }, { transaction });

      await queryInterface.addColumn('settings', 'nav_curriculum_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }, { transaction });

      await transaction.commit();
      console.log('Successfully added curriculum navigation fields to settings table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding curriculum navigation fields to settings table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove curriculum navigation fields from settings table
      await queryInterface.removeColumn('settings', 'nav_curriculum_text', { transaction });
      await queryInterface.removeColumn('settings', 'nav_curriculum_icon', { transaction });
      await queryInterface.removeColumn('settings', 'nav_curriculum_visibility', { transaction });
      await queryInterface.removeColumn('settings', 'nav_curriculum_enabled', { transaction });

      await transaction.commit();
      console.log('Successfully removed curriculum navigation fields from settings table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing curriculum navigation fields from settings table:', error);
      throw error;
    }
  }
};