'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_game_content_rule_instance_rule_type" AS ENUM (
        'attribute_based',
        'content_list',
        'complex_attribute',
        'relation_based'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_game_content_rule_rule_type" AS ENUM (
        'attribute_based',
        'content_list',
        'complex_attribute',
        'relation_based'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_memory_pairing_rules_rule_type" AS ENUM (
        'manual_pairs',
        'attribute_match',
        'content_type_match',
        'semantic_match'
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop ENUM types
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_memory_pairing_rules_rule_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_game_content_rule_rule_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_game_content_rule_instance_rule_type";');
  }
};