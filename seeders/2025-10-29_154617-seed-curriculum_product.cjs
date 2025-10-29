'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for curriculum_product table
     * Generated: 2025-10-30T08:30:00.000Z
     * Rows: 1 (complete backup data)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('curriculum_product');
    if (!tableExists) {
      console.log('Table curriculum_product does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "curriculum_product"'
    );

    if (results[0].count > 0) {
      console.log('Table curriculum_product already has data, skipping seed');
      return;
    }

    // Insert complete seed data from backup
    await queryInterface.bulkInsert('curriculum_product', [
      {
        curriculum_item_id: '1761717217549wrfsw918s',
        product_id: '1760716453729iku75fgz2',
        created_at: new Date('2025-10-29T14:52:44.749Z'),
        id: '1761749564749njk7uigjx'
      }
    ]);

    console.log('✅ Seeded 1 row into curriculum_product');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from curriculum_product table
     */
    await queryInterface.bulkDelete('curriculum_product', null, {});
  }
};
