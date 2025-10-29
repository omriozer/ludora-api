'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add dashboard_settings column to user table
    await queryInterface.addColumn('user', 'dashboard_settings', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'User dashboard configuration with widgets and their settings'
    });

    // Add index for faster JSON queries
    await queryInterface.addIndex('user', ['dashboard_settings'], {
      name: 'user_dashboard_settings_index',
      using: 'GIN'
    });

    console.log('✅ Added dashboard_settings column to user table');
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('user', 'user_dashboard_settings_index');

    // Remove column
    await queryInterface.removeColumn('user', 'dashboard_settings');

    console.log('✅ Removed dashboard_settings column from user table');
  }
};