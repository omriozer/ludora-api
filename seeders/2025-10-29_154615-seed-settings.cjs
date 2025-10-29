'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for settings table
     * Generated: 2025-10-29T15:46:15.635Z
     * Rows: 2
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('settings');
    if (!tableExists) {
      console.log('Table settings does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "settings"'
    );

    if (results[0].count > 0) {
      console.log('Table settings already has data, skipping seed');
      return;
    }

    // Insert seed data
    await queryInterface.bulkInsert('settings', [
      {
            "id": "acf573ca-0396-4e54-842f-d06eecda0299",
            "name": false,
            "value": 30,
            "description": true,
            "is_active": 365,
            "created_at": true,
            "updated_at": 365,
            "field_7": true,
            "field_8": "contact@ludora.com",
            "field_9": "",
            "field_10": "פלטפורמת למידה מתקדמת",
            "field_11": "assets/images/logo.png",
            "field_12": "לודורה",
            "field_13": false,
            "field_14": 7,
            "field_15": false,
            "field_16": "[\"curriculum\", \"lesson_plans\", \"files\", \"games\", \"tools\", \"workshops\", \"courses\", \"classrooms\", \"account\", \"content_creators\"]",
            "field_17": "כלים",
            "field_18": "FileText",
            "field_19": "public",
            "field_20": true,
            "field_21": "משחקים",
            "field_22": "Gamepad2",
            "field_23": "public",
            "field_24": true,
            "field_25": "הדרכות",
            "field_26": "Play",
            "field_27": "admin_only",
            "field_28": true,
            "field_29": "קורסים",
            "field_30": "BookOpen",
            "field_31": "admin_only",
            "field_32": true,
            "field_33": "הכיתות שלי",
            "field_34": "Users",
            "field_35": "hidden",
            "field_36": true,
            "field_37": "החשבון שלי",
            "field_38": "UserIcon",
            "field_39": "logged_in_users",
            "field_40": true,
            "field_41": "יוצרי תוכן",
            "field_42": "Award",
            "field_43": "hidden",
            "field_44": true,
            "field_45": false,
            "field_46": "2025-09-28 01:37:56.767+07",
            "field_47": "2025-10-20 02:57:25.179631+07",
            "field_48": true,
            "field_49": false,
            "field_50": true,
            "field_51": false,
            "field_52": true,
            "field_53": "כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.",
            "field_54": "{\"url\": {\"href\": \"https://ludora.app\", \"style\": {\"bold\": false, \"color\": \"#0066cc\", \"italic\": false, \"opacity\": 100, \"fontSize\": 12}, \"visible\": true, \"position\": {\"x\": 50, \"y\": 94}}, \"logo\": {\"url\": \"/src/assets/images/logo.png\", \"style\": {\"size\": 80, \"opacity\": 100}, \"visible\": true, \"position\": {\"x\": 50, \"y\": 87}}, \"text\": {\"style\": {\"bold\": false, \"color\": \"#000000\", \"italic\": false, \"opacity\": 80, \"fontSize\": 12}, \"content\": \"כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.\", \"visible\": true, \"position\": {\"x\": 50, \"y\": 91}}, \"customElements\": {}}",
            "field_55": null,
            "field_56": null,
            "field_57": "admin_only",
            "field_58": true,
            "field_59": null,
            "field_60": "תכניות לימודים",
            "field_61": "BookOpen",
            "field_62": "public",
            "field_63": true,
            "field_64": "[{\"key\": \"civics\", \"name\": \"אזרחות\", \"emoji\": \"🏛️\", \"enabled\": true}, {\"key\": \"art\", \"name\": \"אמנות\", \"emoji\": \"🎨\", \"enabled\": true}, {\"key\": \"english\", \"name\": \"אנגלית\", \"emoji\": \"🇺🇸\", \"enabled\": true}, {\"key\": \"biology\", \"name\": \"ביולוגיה\", \"emoji\": \"🧬\", \"enabled\": true}, {\"key\": \"geography\", \"name\": \"גיאוגרפיה\", \"emoji\": \"🌍\", \"enabled\": true}, {\"key\": \"history\", \"name\": \"היסטוריה\", \"emoji\": \"📚\", \"enabled\": true}, {\"key\": \"physical_education\", \"name\": \"חינוך גופני\", \"emoji\": \"⚽\", \"enabled\": true}, {\"key\": \"calculation\", \"name\": \"חשבון\", \"emoji\": \"🔢\", \"enabled\": true}, {\"key\": \"chemistry\", \"name\": \"כימיה\", \"emoji\": \"⚗️\", \"enabled\": true}, {\"key\": \"hebrew_language\", \"name\": \"לשון והבעה\", \"emoji\": \"📖\", \"enabled\": true}, {\"key\": \"legacy\", \"name\": \"מורשת\", \"emoji\": \"🏛️\", \"enabled\": true}, {\"key\": \"religion\", \"name\": \"מחשבת ישראל\", \"emoji\": \"📜\", \"enabled\": true}, {\"key\": \"computers\", \"name\": \"מחשבים\", \"emoji\": \"💻\", \"enabled\": true}, {\"key\": \"music\", \"name\": \"מוזיקה\", \"emoji\": \"🎵\", \"enabled\": true}, {\"key\": \"math\", \"name\": \"מתמטיקה\", \"emoji\": \"🔢\", \"enabled\": true}, {\"key\": \"spanish\", \"name\": \"ספרדית\", \"emoji\": \"🇪🇸\", \"enabled\": true}, {\"key\": \"literature\", \"name\": \"ספרות\", \"emoji\": \"📖\", \"enabled\": true}, {\"key\": \"arabic\", \"name\": \"ערבית\", \"emoji\": \"🇸🇦\", \"enabled\": true}, {\"key\": \"physics\", \"name\": \"פיזיקה\", \"emoji\": \"⚛️\", \"enabled\": true}, {\"key\": \"french\", \"name\": \"צרפתית\", \"emoji\": \"🇫🇷\", \"enabled\": true}, {\"key\": \"bible_studies\", \"name\": \"תנ\\\"ך\", \"emoji\": \"📜\", \"enabled\": true}]",
            "field_65": "[{\"label\": \"🧸 גן חובה\", \"value\": \"kindergarten\", \"enabled\": true}, {\"label\": \"1️⃣ כיתה א''\", \"value\": \"grade_1\", \"enabled\": true}, {\"label\": \"2️⃣ כיתה ב''\", \"value\": \"grade_2\", \"enabled\": true}, {\"label\": \"3️⃣ כיתה ג''\", \"value\": \"grade_3\", \"enabled\": true}, {\"label\": \"4️⃣ כיתה ד''\", \"value\": \"grade_4\", \"enabled\": true}, {\"label\": \"5️⃣ כיתה ה''\", \"value\": \"grade_5\", \"enabled\": true}, {\"label\": \"6️⃣ כיתה ו''\", \"value\": \"grade_6\", \"enabled\": true}, {\"label\": \"7️⃣ כיתה ז''\", \"value\": \"grade_7\", \"enabled\": true}, {\"label\": \"8️⃣ כיתה ח''\", \"value\": \"grade_8\", \"enabled\": true}, {\"label\": \"9️⃣ כיתה ט''\", \"value\": \"grade_9\", \"enabled\": true}, {\"label\": \"🔟 כיתה י''\", \"value\": \"grade_10\", \"enabled\": true}, {\"label\": \"🎯 כיתה יא''\", \"value\": \"grade_11\", \"enabled\": true}, {\"label\": \"🎓 כיתה יב''\", \"value\": \"grade_12\", \"enabled\": true}]",
            "field_66": 365,
            "field_67": true,
            "field_68": "מערכי שיעור",
            "field_69": "BookOpen",
            "field_70": "public",
            "field_71": true,
            "field_72": false
      },
      {
            "id": 1,
            "name": true,
            "value": 30,
            "description": true,
            "is_active": 365,
            "created_at": true,
            "updated_at": 365,
            "field_7": true,
            "field_8": null,
            "field_9": null,
            "field_10": null,
            "field_11": null,
            "field_12": null,
            "field_13": false,
            "field_14": null,
            "field_15": null,
            "field_16": "[\"curriculum\", \"lesson_plans\", \"files\", \"games\", \"account\", \"tools\", \"workshops\", \"courses\", \"classrooms\", \"content_creators\"]",
            "field_17": null,
            "field_18": "FileText",
            "field_19": "public",
            "field_20": true,
            "field_21": null,
            "field_22": "Gamepad",
            "field_23": "public",
            "field_24": true,
            "field_25": null,
            "field_26": "Calendar",
            "field_27": "hidden",
            "field_28": false,
            "field_29": null,
            "field_30": "Video",
            "field_31": "hidden",
            "field_32": false,
            "field_33": null,
            "field_34": "GraduationCap",
            "field_35": "hidden",
            "field_36": false,
            "field_37": null,
            "field_38": "UserCircle",
            "field_39": "logged_in_users",
            "field_40": true,
            "field_41": null,
            "field_42": "Crown",
            "field_43": "hidden",
            "field_44": false,
            "field_45": null,
            "field_46": "2025-10-14 11:52:20.465734+07",
            "field_47": "2025-10-29 13:07:59.872+07",
            "field_48": false,
            "field_49": false,
            "field_50": false,
            "field_51": false,
            "field_52": false,
            "field_53": "כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.",
            "field_54": "{\"url\": {\"href\": \"https://ludora.app\", \"style\": {\"bold\": false, \"color\": \"#0066cc\", \"italic\": false, \"opacity\": 100, \"fontSize\": 12}, \"visible\": true, \"position\": {\"x\": 50, \"y\": 85}}, \"logo\": {\"url\": \"https://ludora.app/logo.png\", \"style\": {\"size\": 80, \"opacity\": 100}, \"visible\": true, \"position\": {\"x\": 50, \"y\": 95}}, \"text\": {\"style\": {\"bold\": false, \"color\": \"#000000\", \"width\": 300, \"italic\": false, \"opacity\": 80, \"fontSize\": 12}, \"content\": \"כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.\", \"visible\": true, \"position\": {\"x\": 50, \"y\": 90}}, \"customElements\": {}}",
            "field_55": null,
            "field_56": "Wrench",
            "field_57": "hidden",
            "field_58": false,
            "field_59": "{\"purchase-history\": {\"id\": \"purchase-history\", \"icon\": \"ShoppingBag\", \"name\": \"היסטוריית רכישות\", \"enabled\": true, \"category\": \"purchases\", \"defaultSize\": {\"h\": 6, \"w\": 12, \"minH\": 4, \"minW\": 6}, \"description\": \"הצג את כל הרכישות שלך עם אפשרויות סינון וחיפוש\", \"configSchema\": {\"title\": {\"type\": \"string\", \"label\": \"כותרת הווידג''ט\", \"default\": \"היסטוריית רכישות\", \"description\": \"שם הווידג''ט שיוצג בכותרת\"}}}}",
            "field_60": "תכניות לימודים",
            "field_61": "BookOpen",
            "field_62": "public",
            "field_63": true,
            "field_64": "[{\"key\": \"civics\", \"name\": \"אזרחות\", \"emoji\": \"🏛️\", \"enabled\": true}, {\"key\": \"art\", \"name\": \"אמנות\", \"emoji\": \"🎨\", \"enabled\": true}, {\"key\": \"english\", \"name\": \"אנגלית\", \"emoji\": \"🇺🇸\", \"enabled\": true}, {\"key\": \"biology\", \"name\": \"ביולוגיה\", \"emoji\": \"🧬\", \"enabled\": true}, {\"key\": \"geography\", \"name\": \"גיאוגרפיה\", \"emoji\": \"🌍\", \"enabled\": true}, {\"key\": \"history\", \"name\": \"היסטוריה\", \"emoji\": \"📚\", \"enabled\": true}, {\"key\": \"physical_education\", \"name\": \"חינוך גופני\", \"emoji\": \"⚽\", \"enabled\": true}, {\"key\": \"calculation\", \"name\": \"חשבון\", \"emoji\": \"🔢\", \"enabled\": true}, {\"key\": \"chemistry\", \"name\": \"כימיה\", \"emoji\": \"⚗️\", \"enabled\": true}, {\"key\": \"hebrew_language\", \"name\": \"לשון והבעה\", \"emoji\": \"📖\", \"enabled\": true}, {\"key\": \"legacy\", \"name\": \"מורשת\", \"emoji\": \"🏛️\", \"enabled\": true}, {\"key\": \"religion\", \"name\": \"מחשבת ישראל\", \"emoji\": \"📜\", \"enabled\": true}, {\"key\": \"computers\", \"name\": \"מחשבים\", \"emoji\": \"💻\", \"enabled\": true}, {\"key\": \"music\", \"name\": \"מוזיקה\", \"emoji\": \"🎵\", \"enabled\": true}, {\"key\": \"math\", \"name\": \"מתמטיקה\", \"emoji\": \"🔢\", \"enabled\": true}, {\"key\": \"spanish\", \"name\": \"ספרדית\", \"emoji\": \"🇪🇸\", \"enabled\": true}, {\"key\": \"literature\", \"name\": \"ספרות\", \"emoji\": \"📖\", \"enabled\": true}, {\"key\": \"arabic\", \"name\": \"ערבית\", \"emoji\": \"🇸🇦\", \"enabled\": true}, {\"key\": \"physics\", \"name\": \"פיזיקה\", \"emoji\": \"⚛️\", \"enabled\": true}, {\"key\": \"french\", \"name\": \"צרפתית\", \"emoji\": \"🇫🇷\", \"enabled\": true}, {\"key\": \"bible_studies\", \"name\": \"תנ\\\"ך\", \"emoji\": \"📜\", \"enabled\": true}]",
            "field_65": "[{\"label\": \"🧸 גן חובה\", \"value\": \"kindergarten\", \"enabled\": true}, {\"label\": \"1️⃣ כיתה א''\", \"value\": \"grade_1\", \"enabled\": true}, {\"label\": \"2️⃣ כיתה ב''\", \"value\": \"grade_2\", \"enabled\": true}, {\"label\": \"3️⃣ כיתה ג''\", \"value\": \"grade_3\", \"enabled\": true}, {\"label\": \"4️⃣ כיתה ד''\", \"value\": \"grade_4\", \"enabled\": true}, {\"label\": \"5️⃣ כיתה ה''\", \"value\": \"grade_5\", \"enabled\": true}, {\"label\": \"6️⃣ כיתה ו''\", \"value\": \"grade_6\", \"enabled\": true}, {\"label\": \"7️⃣ כיתה ז''\", \"value\": \"grade_7\", \"enabled\": true}, {\"label\": \"8️⃣ כיתה ח''\", \"value\": \"grade_8\", \"enabled\": true}, {\"label\": \"9️⃣ כיתה ט''\", \"value\": \"grade_9\", \"enabled\": true}, {\"label\": \"🔟 כיתה י''\", \"value\": \"grade_10\", \"enabled\": true}, {\"label\": \"🎯 כיתה יא''\", \"value\": \"grade_11\", \"enabled\": true}, {\"label\": \"🎓 כיתה יב''\", \"value\": \"grade_12\", \"enabled\": true}]",
            "field_66": 365,
            "field_67": true,
            "field_68": "מערכי שיעור",
            "field_69": "Bookmark",
            "field_70": "public",
            "field_71": true,
            "field_72": false
      }
]);

    console.log(`✅ Seeded ${2} rows into settings`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from settings table
     */
    await queryInterface.bulkDelete('settings', null, {});
  }
};
