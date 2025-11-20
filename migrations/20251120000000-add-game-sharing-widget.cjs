'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add game-sharing widget to available_dashboard_widgets in settings table
    await queryInterface.sequelize.query(`
      UPDATE settings
      SET available_dashboard_widgets = COALESCE(available_dashboard_widgets, '{}'::jsonb) ||
      '{
        "game-sharing": {
          "id": "game-sharing",
          "name": "שיתוף המשחקים",
          "description": "שתף את קטלוג המשחקים שלך עם תלמידים - צור קוד הזמנה וקר מקוד",
          "category": "classroom",
          "icon": "Share2",
          "enabled": true,
          "defaultSize": { "w": 4, "h": 4, "minW": 3, "minH": 3 },
          "configSchema": {
            "title": {
              "type": "string",
              "label": "כותרת הווידג''ט",
              "default": "שיתוף המשחקים",
              "description": "שם הווידג''ט שיוצג בכותרת"
            }
          }
        }
      }'::jsonb
      WHERE id IS NOT NULL;
    `);

    console.log('✅ Added game-sharing widget to available dashboard widgets');
  },

  async down(queryInterface, Sequelize) {
    // Remove game-sharing widget from available_dashboard_widgets
    await queryInterface.sequelize.query(`
      UPDATE settings
      SET available_dashboard_widgets = available_dashboard_widgets - 'game-sharing'
      WHERE available_dashboard_widgets IS NOT NULL
      AND available_dashboard_widgets ? 'game-sharing';
    `);

    console.log('🔄 Removed game-sharing widget from available dashboard widgets');
  }
};