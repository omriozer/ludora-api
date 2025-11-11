'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add my-products widget to available_dashboard_widgets in settings table
    await queryInterface.sequelize.query(`
      UPDATE settings
      SET available_dashboard_widgets = COALESCE(available_dashboard_widgets, '{}'::jsonb) ||
      '{
        "my-products": {
          "id": "my-products",
          "name": "המוצרים שלי",
          "description": "גישה מהירה למוצרים שרכשת ללא פרטי רכישה - מושלם למורים בכיתה",
          "category": "purchases",
          "icon": "Package",
          "enabled": true,
          "defaultSize": { "w": 6, "h": 4, "minW": 4, "minH": 3 },
          "configSchema": {
            "title": {
              "type": "string",
              "label": "כותרת הווידג''ט",
              "default": "המוצרים שלי",
              "description": "שם הווידג''ט שיוצג בכותרת"
            },
            "size": {
              "type": "string",
              "label": "גודל הווידג''ט",
              "default": "medium",
              "options": ["small", "medium", "large"],
              "description": "גודל הווידג''ט משפיע על כמות התוכן המוצג"
            }
          }
        }
      }'::jsonb
      WHERE id IS NOT NULL;
    `);

    console.log('✅ Added my-products widget to available dashboard widgets');
  },

  async down(queryInterface, Sequelize) {
    // Remove my-products widget from available_dashboard_widgets
    await queryInterface.sequelize.query(`
      UPDATE settings
      SET available_dashboard_widgets = available_dashboard_widgets - 'my-products'
      WHERE available_dashboard_widgets IS NOT NULL
      AND available_dashboard_widgets ? 'my-products';
    `);

    console.log('🔄 Removed my-products widget from available dashboard widgets');
  }
};