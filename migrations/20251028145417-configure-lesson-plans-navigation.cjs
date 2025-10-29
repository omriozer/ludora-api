'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if settings table exists
      const settingsTableExists = await queryInterface.tableExists('settings');
      if (!settingsTableExists) {
        console.log('Settings table does not exist, skipping lesson_plans navigation configuration');
        await transaction.commit();
        return;
      }

      // Update lesson_plans navigation settings
      await queryInterface.sequelize.query(`
        UPDATE settings SET
          nav_lesson_plans_enabled = true,
          nav_lesson_plans_text = 'מערכי שיעור',
          nav_lesson_plans_icon = 'BookOpen',
          nav_lesson_plans_visibility = 'logged_in_users',
          nav_order = '["curriculum", "lesson_plans", "files", "games", "tools", "workshops", "courses", "classrooms", "account", "content_creators"]'
        WHERE id IS NOT NULL;
      `, { transaction });

      await transaction.commit();
      console.log('Successfully configured lesson_plans navigation settings');
    } catch (error) {
      await transaction.rollback();
      console.error('Error configuring lesson_plans navigation settings:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if settings table exists
      const settingsTableExists = await queryInterface.tableExists('settings');
      if (!settingsTableExists) {
        console.log('Settings table does not exist, skipping lesson_plans navigation rollback');
        await transaction.commit();
        return;
      }

      // Rollback lesson_plans navigation settings
      await queryInterface.sequelize.query(`
        UPDATE settings SET
          nav_lesson_plans_enabled = false,
          nav_lesson_plans_text = NULL,
          nav_lesson_plans_icon = NULL,
          nav_lesson_plans_visibility = 'logged_in_users',
          nav_order = '["curriculum", "files", "games", "tools", "workshops", "courses", "classrooms", "account", "content_creators"]'
        WHERE id IS NOT NULL;
      `, { transaction });

      await transaction.commit();
      console.log('Successfully rolled back lesson_plans navigation settings');
    } catch (error) {
      await transaction.rollback();
      console.error('Error rolling back lesson_plans navigation settings:', error);
      throw error;
    }
  }
};
