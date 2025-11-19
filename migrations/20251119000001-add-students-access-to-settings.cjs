'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add students_access field to settings table
    await queryInterface.addColumn('settings', 'students_access', {
      type: Sequelize.ENUM('invite_only', 'authed_only', 'all'),
      allowNull: true,
      defaultValue: 'invite_only'
    });

    console.log('✅ Added students_access field to settings table with default value "invite_only"');
  },

  async down(queryInterface, Sequelize) {
    // Remove the added column (this will also clean up the enum type automatically)
    await queryInterface.removeColumn('settings', 'students_access');

    console.log('❌ Removed students_access field from settings table');
  }
};