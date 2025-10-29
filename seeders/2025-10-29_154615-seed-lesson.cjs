'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for lesson table
     * Generated: 2025-10-29T15:46:15.634Z
     * Rows: 2
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('lesson');
    if (!tableExists) {
      console.log('Table lesson does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "lesson"'
    );

    if (results[0].count > 0) {
      console.log('Table lesson already has data, skipping seed');
      return;
    }

    // Insert seed data
    await queryInterface.bulkInsert('lesson', [
      {
            "field_0": "17616705170501owl8pdse",
            "field_1": null,
            "field_2": "{}",
            "field_3": true,
            "field_4": "2025-10-28 23:55:17.05+07",
            "field_5": "2025-10-28 23:55:17.053+07",
            "field_6": null,
            "field_7": null,
            "field_8": null
      },
      {
            "field_0": "176167854500406ugxpl18",
            "field_1": null,
            "field_2": "{\"files\": []}",
            "field_3": true,
            "field_4": "2025-10-29 02:09:05.004+07",
            "field_5": "2025-10-29 02:09:05.005+07",
            "field_6": null,
            "field_7": null,
            "field_8": null
      }
]);

    console.log(`✅ Seeded ${2} rows into lesson`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from lesson table
     */
    await queryInterface.bulkDelete('lesson', null, {});
  }
};
