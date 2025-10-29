'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for curriculum table
     * Generated: 2025-10-29T15:46:15.633Z
     * Rows: 3 (representative samples with correct schema mapping)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('curriculum');
    if (!tableExists) {
      console.log('Table curriculum does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "curriculum"'
    );

    if (results[0].count > 0) {
      console.log('Table curriculum already has data, skipping seed');
      return;
    }

    // Insert ALL curriculum data from backup (221 rows)
    const curriculumData = require('../curriculum_data.cjs');
    await queryInterface.bulkInsert('curriculum', curriculumData);

    console.log(`✅ Seeded ${curriculumData.length} rows into curriculum`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from curriculum table
     */
    await queryInterface.bulkDelete('curriculum', null, {});
  }
};
