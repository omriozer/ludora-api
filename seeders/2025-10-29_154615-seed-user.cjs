'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for user table
     * Generated: 2025-10-29T15:46:15.636Z
     * Rows: 4
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('user');
    if (!tableExists) {
      console.log('Table user does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "user"'
    );

    if (results[0].count > 0) {
      console.log('Table user already has data, skipping seed');
      return;
    }

    // Insert seed data
    await queryInterface.bulkInsert('user', [
      {
            "id": "685b15c4a037d9433fbd2805",
            "firebase_uid": "galgoldman4@gmail.com",
            "email": "gal goldman",
            "display_name": null,
            "photo_url": true,
            "role": null,
            "is_active": "user",
            "created_at": "2025-06-24 21:16:52.477+07",
            "updated_at": "2025-09-12 10:20:04.974+07",
            "field_9": true,
            "field_10": null,
            "field_11": null,
            "field_12": null,
            "field_13": null,
            "field_14": null,
            "field_15": null,
            "field_16": false,
            "field_17": null,
            "field_18": "[]",
            "field_19": null
      },
      {
            "id": "68a0b172b43132f178b29b83",
            "firebase_uid": "galclinic9@gmail.com",
            "email": "גל - קליניקה לפיתוח תכני הוראה עוזר",
            "display_name": null,
            "photo_url": true,
            "role": null,
            "is_active": "user",
            "created_at": "2025-08-16 16:27:30.49+07",
            "updated_at": "2025-08-16 16:27:30.49+07",
            "field_9": true,
            "field_10": null,
            "field_11": null,
            "field_12": null,
            "field_13": null,
            "field_14": null,
            "field_15": null,
            "field_16": false,
            "field_17": null,
            "field_18": "[]",
            "field_19": null
      },
      {
            "id": "68b5c29a1cdd154f650cb976",
            "firebase_uid": "liorgoldman0@gmail.com",
            "email": "lior goldman",
            "display_name": null,
            "photo_url": true,
            "role": null,
            "is_active": "user",
            "created_at": "2025-09-01 15:58:18.091+07",
            "updated_at": "2025-09-11 23:23:44.911+07",
            "field_9": true,
            "field_10": null,
            "field_11": null,
            "field_12": null,
            "field_13": null,
            "field_14": null,
            "field_15": null,
            "field_16": false,
            "field_17": null,
            "field_18": "[]",
            "field_19": null
      },
      {
            "id": "685afa14113ac3f4419275b1",
            "firebase_uid": "ozeromri@gmail.com",
            "email": "עומרי עוזר",
            "display_name": null,
            "photo_url": true,
            "role": null,
            "is_active": "admin",
            "created_at": "2025-06-24 19:18:44.597+07",
            "updated_at": "2025-10-23 01:16:00.407+07",
            "field_9": true,
            "field_10": null,
            "field_11": 522123222,
            "field_12": "no_education_degree",
            "field_13": null,
            "field_14": "teacher",
            "field_15": "{\"widgets\": [{\"id\": \"purchase-history-1760467818965\", \"type\": \"purchase-history\", \"order\": 0, \"settings\": {}}], \"updatedAt\": \"2025-10-14T18:50:18.965Z\"}",
            "field_16": true,
            "field_17": "1989-03-14",
            "field_18": "[\"אמנות\"]",
            "field_19": null
      }
]);

    console.log(`✅ Seeded ${4} rows into user`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from user table
     */
    await queryInterface.bulkDelete('user', null, {});
  }
};
