'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for game table
     * Generated: 2025-10-29T15:46:15.633Z
     * Rows: 1
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('game');
    if (!tableExists) {
      console.log('Table game does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "game"'
    );

    if (results[0].count > 0) {
      console.log('Table game already has data, skipping seed');
      return;
    }

    // Insert seed data with correct schema mapping
    await queryInterface.bulkInsert('game', [
      {
            "id": "17616228216784hwsvixvk",
            "created_at": "2025-10-28 10:40:21.678+07",
            "updated_at": "2025-10-28 10:40:21.678+07",
            "game_type": null,
            "digital": true,
            "game_settings": "{}",
            "difficulty_level": null,
            "creator_user_id": null
      }
]);

    console.log(`✅ Seeded ${1} rows into game`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from game table
     */
    await queryInterface.bulkDelete('game', null, {});
  }
};
