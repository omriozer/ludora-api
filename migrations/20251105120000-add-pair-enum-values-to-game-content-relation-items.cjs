'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pair_a' and 'pair_b' to the existing role enum
    // This extends the enum for memory game functionality
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_game_content_relation_items_role
      ADD VALUE IF NOT EXISTS 'pair_a';
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_game_content_relation_items_role
      ADD VALUE IF NOT EXISTS 'pair_b';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // If rollback is needed, you would need to recreate the enum type
    // For now, we'll leave the enum values in place as they don't break anything
    console.log('Warning: PostgreSQL does not support removing enum values. The pair_a and pair_b values will remain in the enum.');
  }
};