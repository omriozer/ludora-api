'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add default_workshop_access_days field to settings table
    await queryInterface.addColumn('settings', 'default_workshop_access_days', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Default access days for workshop products'
    });

    // Add workshop_lifetime_access field for consistency
    await queryInterface.addColumn('settings', 'workshop_lifetime_access', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      comment: 'Default workshop lifetime access setting'
    });

    console.log('✅ Added default_workshop_access_days and workshop_lifetime_access to settings table');
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn('settings', 'default_workshop_access_days');
    await queryInterface.removeColumn('settings', 'workshop_lifetime_access');

    console.log('❌ Removed default_workshop_access_days and workshop_lifetime_access from settings table');
  }
};