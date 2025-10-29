'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for tool table
     * Generated: 2025-10-29T15:46:15.636Z
     * Rows: 2
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('tool');
    if (!tableExists) {
      console.log('Table tool does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "tool"'
    );

    if (results[0].count > 0) {
      console.log('Table tool already has data, skipping seed');
      return;
    }

    // Insert seed data with correct schema mapping
    await queryInterface.bulkInsert('tool', [
      {
            "id": "8f8a1d32-52c7-4fd1-b281-951ce9ce14c2",
            "tool_key": "CONTACT_PAGE_GENERATOR",
            "category": "generators",
            "default_access_days": 365,
            "created_at": "2025-10-17 23:16:33.155+07",
            "updated_at": "2025-10-17 23:16:33.155+07"
      },
      {
            "id": "f0c6991e-0d0f-4d26-b714-5fa6e2db3db4",
            "tool_key": "SCHEDULE_GENERATOR",
            "category": "generators",
            "default_access_days": 365,
            "created_at": "2025-10-17 23:16:33.155+07",
            "updated_at": "2025-10-17 23:16:33.155+07"
      }
]);

    console.log(`✅ Seeded ${2} rows into tool`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from tool table
     */
    await queryInterface.bulkDelete('tool', null, {});
  }
};
