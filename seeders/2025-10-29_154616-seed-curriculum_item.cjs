'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for curriculum_item table
     * Generated: 2025-10-30T08:30:00.000Z
     * Rows: 19 (complete backup data)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('curriculum_item');
    if (!tableExists) {
      console.log('Table curriculum_item does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "curriculum_item"'
    );

    if (results[0].count > 0) {
      console.log('Table curriculum_item already has data, skipping seed');
      return;
    }

    // Insert complete seed data from backup
    await queryInterface.bulkInsert('curriculum_item', [
      {
        id: '1760879172751fvikt13ta',
        curriculum_id: '1760879155800a5mabyttr',
        study_topic: 'חיבור וחיסור עד 10',
        content_topic: 'ראש השנה',
        is_mandatory: true,
        mandatory_order: 1,
        custom_order: null,
        description: null,
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-19T13:06:12.819Z'),
        updated_at: new Date('2025-10-19T13:07:18.830Z')
      },
      {
        id: '1761717217549wrfsw918s',
        curriculum_id: '1761717217545geil79soh',
        study_topic: 'זיהוי אותיות',
        content_topic: 'הכרת האותיות בעברית - אותיות הדפוס',
        is_mandatory: true,
        mandatory_order: 1,
        custom_order: 1,
        description: 'זיהוי וקריאת אותיות הדפוס העבריות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549stj94bb81',
        curriculum_id: '1761717217545geil79soh',
        study_topic: 'קריאה',
        content_topic: 'קריאת מילים פשוטות',
        is_mandatory: true,
        mandatory_order: 2,
        custom_order: 2,
        description: 'קריאת מילים בסיסיות ופשוטות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549zoiedju2m',
        curriculum_id: '1761717217545geil79soh',
        study_topic: 'כתיבה',
        content_topic: 'כתיבת אותיות דפוס',
        is_mandatory: true,
        mandatory_order: 3,
        custom_order: 3,
        description: 'כתיבת אותיות דפוס עבריות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549b5fkvtua0',
        curriculum_id: '1761717217545geil79soh',
        study_topic: 'הבנת הנקרא',
        content_topic: 'הבנת משפטים קצרים',
        is_mandatory: true,
        mandatory_order: 4,
        custom_order: 4,
        description: 'הבנת משפטים קצרים ופשוטים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549qkqj3mbnj',
        curriculum_id: '1761717217545geil79soh',
        study_topic: 'הבעה בעל פה',
        content_topic: 'תיאור פשוט של תמונות וחפצים',
        is_mandatory: true,
        mandatory_order: 5,
        custom_order: 5,
        description: 'תיאור פשוט ובסיסי של סביבה קרובה',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549c3l0u23jp',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'קריאה שוטפת',
        content_topic: 'קריאת טקסטים קצרים',
        is_mandatory: true,
        mandatory_order: 1,
        custom_order: 1,
        description: 'קריאה שוטפת של טקסטים קצרים ומובנים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549vqak4qbpg',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'כתיבה',
        content_topic: 'כתיבת משפטים ופסקאות קצרות',
        is_mandatory: true,
        mandatory_order: 2,
        custom_order: 2,
        description: 'כתיבת משפטים שלמים ופסקאות קצרות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549ze8fn6i1w',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'אוצר מילים',
        content_topic: 'הרחבת אוצר המילים',
        is_mandatory: true,
        mandatory_order: 3,
        custom_order: 3,
        description: 'הכרת מילים חדשות והבנת משמעותן',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549dqga1uq5r',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'הבנת הנקרא',
        content_topic: 'הבנת סיפורים ומידע עיקרי',
        is_mandatory: true,
        mandatory_order: 4,
        custom_order: 4,
        description: 'הבנת עלילה ומידע מרכזי בטקסטים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549h0kizlc0c',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'הבעה בעל פה',
        content_topic: 'סיפור ותיאור מפורט',
        is_mandatory: true,
        mandatory_order: 5,
        custom_order: 5,
        description: 'סיפור חויות ותיאור מפורט של אירועים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '17617172175496rzu34gnu',
        curriculum_id: '17617172175451y0us1c7k',
        study_topic: 'דקדוק',
        content_topic: 'כללי דקדוק בסיסיים',
        is_mandatory: true,
        mandatory_order: 6,
        custom_order: 6,
        description: 'הכרת כללי דקדוק בסיסיים - זכר ונקבה, יחיד ורבים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '17617172175495g2vavxhy',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'קריאה מתקדמת',
        content_topic: 'קריאת טקסטים מורכבים וספרותיים',
        is_mandatory: true,
        mandatory_order: 1,
        custom_order: 1,
        description: 'קריאה והבנה של טקסטים ספרותיים ומידעיים מורכבים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549i43kb4i7r',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'כתיבה יצירתית',
        content_topic: 'כתיבת חיבורים וסיפורים',
        is_mandatory: true,
        mandatory_order: 2,
        custom_order: 2,
        description: 'כתיבת חיבורים, סיפורים וטקסטים יצירתיים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '176171721754917rpwzonh',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'ביקורת ספרות',
        content_topic: 'ניתוח טקסטים ספרותיים',
        is_mandatory: true,
        mandatory_order: 3,
        custom_order: 3,
        description: 'ניתוח ופרשנות של טקסטים ספרותיים',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549gllb462lr',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'דקדוק מתקדם',
        content_topic: 'כללי דקדוק מורכבים',
        is_mandatory: true,
        mandatory_order: 4,
        custom_order: 4,
        description: 'זמנים, גזרות, תחביר משפטי מורכב',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549l68qdfh48',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'הבעה ודיבור',
        content_topic: 'הצגה ודיון מובנה',
        is_mandatory: true,
        mandatory_order: 5,
        custom_order: 5,
        description: 'הצגת עמדות, ניהול דיון והבעת דעות מנומקות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '1761717217549ilrui7hmo',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'חקר לשון',
        content_topic: 'מקורות השפה והתפתחותה',
        is_mandatory: true,
        mandatory_order: 6,
        custom_order: 6,
        description: 'הכרת מקורות השפה העברית והתפתחותה',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      },
      {
        id: '176171721754935uf7plbd',
        curriculum_id: '1761717217545ip7afqq5g',
        study_topic: 'כתיבה אקדמית',
        content_topic: 'מחקר וכתיבה מובנית',
        is_mandatory: true,
        mandatory_order: 7,
        custom_order: 7,
        description: 'כתיבת מחקרים קצרים ועבודות מובנות',
        is_completed: false,
        completed_at: null,
        created_at: new Date('2025-10-29T05:53:37.549Z'),
        updated_at: new Date('2025-10-29T05:53:37.549Z')
      }
    ]);

    console.log('✅ Seeded 19 rows into curriculum_item');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from curriculum_item table
     */
    await queryInterface.bulkDelete('curriculum_item', null, {});
  }
};
