'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add default_lesson_plan_access_days field to settings table
    await queryInterface.addColumn('settings', 'default_lesson_plan_access_days', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Default access days for lesson plan products'
    });

    // Add lesson_plan_lifetime_access field for consistency
    await queryInterface.addColumn('settings', 'lesson_plan_lifetime_access', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      comment: 'Default lesson plan lifetime access setting'
    });

    console.log('✅ Added default_lesson_plan_access_days and lesson_plan_lifetime_access to settings table');
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn('settings', 'default_lesson_plan_access_days');
    await queryInterface.removeColumn('settings', 'lesson_plan_lifetime_access');

    console.log('❌ Removed default_lesson_plan_access_days and lesson_plan_lifetime_access from settings table');
  }
};