'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for product table
     * Generated: 2025-10-29T15:46:15.634Z
     * Rows: 12
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('product');
    if (!tableExists) {
      console.log('Table product does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "product"'
    );

    if (results[0].count > 0) {
      console.log('Table product already has data, skipping seed');
      return;
    }

    // Insert seed data with correct schema mapping
    await queryInterface.bulkInsert('product', [
      {
            "id": "1759948809894jo839csgg",
            "title": "jkhkjhkjh",
            "description": "kjhkjhkjhk",
            "category": "",
            "product_type": "file",
            "entity_id": "1759948809894jo839csgg",
            "price": 1,
            "is_published": true,
            "image_url": "HAS_IMAGE",
            "tags": "[]",
            "target_audience": null,
            "access_days": null,
            "created_at": "2025-10-09 01:40:09.9+07",
            "updated_at": "2025-10-17 22:55:54.475+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": "",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1759947746382gamqwbkwz",
            "title": "חלילחיחל",
            "description": "לךחךלחךלח",
            "category": "",
            "product_type": "file",
            "entity_id": "1759947746382gamqwbkwz",
            "price": 1,
            "is_published": true,
            "image_url": "HAS_IMAGE",
            "tags": "[]",
            "target_audience": null,
            "access_days": null,
            "created_at": "2025-10-09 01:22:26.388+07",
            "updated_at": "2025-10-17 22:56:24.934+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": "",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1760716453729iku75fgz2",
            "title": "בדיקה לעולם לא לרכוש",
            "description": "אף פעם לא לרכוש את הקובץ הזה כדי שתמיד יהיה קובץ בתשלום שטרם נרכש",
            "category": "כללי",
            "product_type": "file",
            "entity_id": "1760716453729iku75fgz2",
            "price": 0,
            "is_published": true,
            "image_url": "HAS_IMAGE",
            "tags": "[\"בדיקה\"]",
            "target_audience": "מורים מקצועיים",
            "access_days": null,
            "created_at": "2025-10-17 22:54:13.736+07",
            "updated_at": "2025-10-20 13:33:50.401+07",
            "creator_user_id": null,
            "short_description": "",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "tool_contact_page_gen_fd179f64-452b-4be2-8949-7c4bf764b125",
            "title": "מחולל דף קשר",
            "description": "כלי ליצירת דפי קשר מותאמים אישית למוסדות חינוך וארגונים. יצירת דפי קשר מקצועיים עם כל הפרטים הנדרשים.",
            "category": "generators",
            "product_type": "tool",
            "entity_id": "8f8a1d32-52c7-4fd1-b281-951ce9ce14c2",
            "price": 29,
            "is_published": true,
            "image_url": null,
            "tags": "[]",
            "target_audience": "מורים ומוסדות חינוך",
            "access_days": 365,
            "created_at": "2025-10-17 23:16:33.169+07",
            "updated_at": "2025-10-17 23:16:33.169+07",
            "creator_user_id": null,
            "short_description": "כלי ליצירת דפי קשר מותאמים אישית",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "tool_schedule_gen_b5375009-13bf-4570-9c64-e5f52fe1f27b",
            "title": "מחולל לוח זמנים",
            "description": "כלי ליצירת לוחות זמנים ותכנון מערכת שעות למוסדות חינוך. יצירת מערכות שעות מותאמות אישית עם אפשרויות התאמה מתקדמות.",
            "category": "generators",
            "product_type": "tool",
            "entity_id": "f0c6991e-0d0f-4d26-b714-5fa6e2db3db4",
            "price": 29,
            "is_published": true,
            "image_url": null,
            "tags": "[]",
            "target_audience": "מורים ומוסדות חינוך",
            "access_days": 365,
            "created_at": "2025-10-17 23:16:33.169+07",
            "updated_at": "2025-10-17 23:16:33.169+07",
            "creator_user_id": null,
            "short_description": "כלי ליצירת לוחות זמנים ותכנון מערכת שעות",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1760982316021xlkyt484q",
            "title": "jkhkjhjkh",
            "description": "khjjkhkjhjkhkj",
            "category": "",
            "product_type": "file",
            "entity_id": "1760982316021xlkyt484q",
            "price": 5,
            "is_published": true,
            "image_url": null,
            "tags": "[]",
            "target_audience": null,
            "access_days": 30,
            "created_at": "2025-10-21 00:45:16.074+07",
            "updated_at": "2025-10-21 00:45:40.043+07",
            "creator_user_id": null,
            "short_description": "",
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "17594106836241qlpebdvq",
            "title": "בדיקה",
            "description": "תיאור ארוך מאוד של הקובץ בלה בל הלב חיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחיחיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחיחיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחיחיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחיחיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחיחיעיחעיחעחיעחיעחיעחיעח ילחילחיחלילחילחיחל ייעחיעחיע בלה בל הלב חיעיחעיחעחיעחיעחי",
            "category": "כללי",
            "product_type": "file",
            "entity_id": "17594106836241qlpebdvq",
            "price": 5,
            "is_published": true,
            "image_url": "/assets/image/file/17594106836241qlpebdvq/Background.png",
            "tags": "[\"חינוך\", \"מתחילים\", \"שלום\"]",
            "target_audience": "רכזי מקצוע",
            "access_days": null,
            "created_at": "2025-10-02 20:11:23.633+07",
            "updated_at": "2025-10-28 00:39:04.028+07",
            "creator_user_id": null,
            "short_description": "תיאור קצר של הקובץ",
            "marketing_video_url": null,
            "marketing_video_title": "ננה בננה",
            "marketing_video_duration": 30,
            "marketing_video_type": "uploaded",
            "marketing_video_id": "17594106836241qlpebdvq",
            "type_attributes": "{\"subject\": \"מתמטיקה\", \"grade_max\": 3, \"grade_min\": 2}"
      },
      {
            "id": "17616228216916106kjgm9",
            "title": "לחילחיחליח",
            "description": "חליחליחלי",
            "category": "",
            "product_type": "game",
            "entity_id": "17616228216784hwsvixvk",
            "price": 0,
            "is_published": false,
            "image_url": null,
            "tags": "[]",
            "target_audience": null,
            "access_days": null,
            "created_at": "2025-10-28 10:40:21.691+07",
            "updated_at": "2025-10-28 10:40:21.691+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": null,
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1761670517067ujrv041tb",
            "title": "jkhkjhkjhjkh",
            "description": "lkjlkjlkjlkj",
            "category": "",
            "product_type": "lesson_plan",
            "entity_id": "17616705170501owl8pdse",
            "price": 50,
            "is_published": false,
            "image_url": "",
            "tags": "[]",
            "target_audience": "",
            "access_days": null,
            "created_at": "2025-10-28 23:55:17.067+07",
            "updated_at": "2025-10-28 23:55:17.068+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": null,
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1761710611931vktwarnk1",
            "title": "pdf_1001684959.pdf",
            "description": null,
            "category": null,
            "product_type": "file",
            "entity_id": "1761710611932af2271raw",
            "price": 0,
            "is_published": false,
            "image_url": null,
            "tags": "[]",
            "target_audience": null,
            "access_days": null,
            "created_at": "2025-10-29 11:03:31.946+07",
            "updated_at": "2025-10-29 11:03:31.946+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": null,
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1761711924060a4qwdeb7z",
            "title": "pdf_1001684959.pdf",
            "description": null,
            "category": null,
            "product_type": "file",
            "entity_id": "1761711924061pbvwlmnmp",
            "price": 0,
            "is_published": false,
            "image_url": null,
            "tags": "[]",
            "target_audience": null,
            "access_days": null,
            "created_at": "2025-10-29 11:25:24.069+07",
            "updated_at": "2025-10-29 11:25:24.069+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": null,
            "marketing_video_url": null,
            "marketing_video_title": null,
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": null,
            "type_attributes": "{}"
      },
      {
            "id": "1761678545017wtnr5gci6",
            "title": "ננה בננה",
            "description": "לחילחילחילחי",
            "category": "",
            "product_type": "lesson_plan",
            "entity_id": "176167854500406ugxpl18",
            "price": 49.99,
            "is_published": false,
            "image_url": "",
            "tags": "[]",
            "target_audience": "",
            "access_days": null,
            "created_at": "2025-10-29 02:09:05.017+07",
            "updated_at": "2025-10-29 11:27:41.751+07",
            "creator_user_id": "685afa14113ac3f4419275b1",
            "short_description": "",
            "marketing_video_url": null,
            "marketing_video_title": "",
            "marketing_video_duration": null,
            "marketing_video_type": null,
            "marketing_video_id": "",
            "type_attributes": "{}"
      }
]);

    console.log(`✅ Seeded ${12} rows into product`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from product table
     */
    await queryInterface.bulkDelete('product', null, {});
  }
};
