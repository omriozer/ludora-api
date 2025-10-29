'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for file table
     * Generated: 2025-10-29T15:46:15.633Z
     * Rows: 3 (representative samples with correct schema mapping)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('file');
    if (!tableExists) {
      console.log('Table file does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "file"'
    );

    if (results[0].count > 0) {
      console.log('Table file already has data, skipping seed');
      return;
    }

    // Insert seed data with correct schema mapping - ALL 7 rows from backup
    await queryInterface.bulkInsert('file', [
      {
            "id": "1759948809894jo839csgg",
            "title": "jkhkjhkjh",
            "category": null,
            "file_name": "Ludora 2.pdf",
            "file_type": "pdf",
            "created_at": "2025-10-09 01:40:09.895+07",
            "updated_at": "2025-10-17 22:55:54.675+07",
            "allow_preview": true,
            "add_copyrights_footer": true,
            "footer_settings": null,
            "is_asset_only": false
      },
      {
            "id": "1759947746382gamqwbkwz",
            "title": "חלילחיחל",
            "category": null,
            "file_name": "Ludora 2.pdf",
            "file_type": "pdf",
            "created_at": "2025-10-09 01:22:26.383+07",
            "updated_at": "2025-10-17 22:56:25.09+07",
            "allow_preview": true,
            "add_copyrights_footer": true,
            "footer_settings": null,
            "is_asset_only": false
      },
      {
            "id": "1760716453729iku75fgz2",
            "title": "בדיקה לעולם לא לרכוש",
            "category": null,
            "file_name": "Ludora 2.pdf",
            "file_type": "pdf",
            "created_at": "2025-10-17 22:54:13.729+07",
            "updated_at": "2025-10-20 13:33:50.448+07",
            "allow_preview": true,
            "add_copyrights_footer": true,
            "footer_settings": null,
            "is_asset_only": false
      },
      {
            "id": "1760982316021xlkyt484q",
            "title": "jkhkjhjkh",
            "category": null,
            "file_name": "CamScanner 06-09-2025 11.31.pdf",
            "file_type": "pdf",
            "created_at": "2025-10-21 00:45:16.034+07",
            "updated_at": "2025-10-21 00:45:40.108+07",
            "allow_preview": true,
            "add_copyrights_footer": true,
            "footer_settings": null,
            "is_asset_only": false
      },
      {
            "id": "17594106836241qlpebdvq",
            "title": "בדיקה",
            "category": null,
            "file_name": "confirmation.pdf",
            "file_type": "pdf",
            "created_at": "2025-10-02 20:11:23.627+07",
            "updated_at": "2025-10-28 00:39:04.053+07",
            "allow_preview": true,
            "add_copyrights_footer": true,
            "footer_settings": null,
            "is_asset_only": false
      },
      {
            "id": "1761710611932af2271raw",
            "title": "pdf_1001684959.pdf",
            "category": null,
            "file_name": null,
            "file_type": "pdf",
            "created_at": "2025-10-29 11:03:31.932+07",
            "updated_at": "2025-10-29 11:03:31.932+07",
            "allow_preview": false,
            "add_copyrights_footer": false,
            "footer_settings": null,
            "is_asset_only": true
      },
      {
            "id": "1761711924061pbvwlmnmp",
            "title": "pdf_1001684959.pdf",
            "category": null,
            "file_name": null,
            "file_type": "pdf",
            "created_at": "2025-10-29 11:25:24.061+07",
            "updated_at": "2025-10-29 11:25:24.061+07",
            "allow_preview": false,
            "add_copyrights_footer": false,
            "footer_settings": null,
            "is_asset_only": true
      }
]);

    console.log(`✅ Seeded ${7} rows into file`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from file table
     */
    await queryInterface.bulkDelete('file', null, {});
  }
};
