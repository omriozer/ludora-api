'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add onboarding_completed column to user table
    await queryInterface.addColumn('user', 'onboarding_completed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flag indicating whether user has completed the onboarding process'
    });

    // Update existing users who already have user_type set to mark onboarding as completed
    await queryInterface.sequelize.query(`
      UPDATE "user"
      SET "onboarding_completed" = true
      WHERE "user_type" IS NOT NULL
    `);

    // Add index for faster queries on onboarding status
    await queryInterface.addIndex('user', ['onboarding_completed'], {
      name: 'user_onboarding_completed_index'
    });

    console.log('✅ Added onboarding_completed column to user table');
    console.log('✅ Updated existing users with user_type to mark onboarding as completed');
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('user', 'user_onboarding_completed_index');

    // Remove column
    await queryInterface.removeColumn('user', 'onboarding_completed');

    console.log('✅ Removed onboarding_completed column from user table');
  }
};