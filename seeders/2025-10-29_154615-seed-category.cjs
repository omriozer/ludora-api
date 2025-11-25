'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for category table
     * Generated: 2025-10-29T15:46:15.630Z
     * Rows: 1
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('category');
    if (!tableExists) {
      console.log('Table category does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "category"'
    );

    if (results[0].count > 0) {
      console.log('Table category already has data, skipping seed');
      return;
    }

    // Insert seed data
    await queryInterface.bulkInsert('category', [
      {
            "id": "1759040636246l0i2tv23z",
            "name": "כללי",
            "is_default": true,
            "created_at": "2025-09-28 13:23:56.246+07",
            "updated_at": "2025-09-28 13:23:56.246+07"
      }
]);

    console.log(`✅ Seeded ${1} rows into category`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from category table
     */
    await queryInterface.bulkDelete('category', null, {});
  }
};
