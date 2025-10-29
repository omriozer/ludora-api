'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add available_dashboard_widgets column to settings table
    await queryInterface.addColumn('settings', 'available_dashboard_widgets', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Available widgets for user dashboards'
    });

    // Add index for faster JSON queries
    await queryInterface.addIndex('settings', ['available_dashboard_widgets'], {
      name: 'settings_available_dashboard_widgets_index',
      using: 'GIN'
    });

    // Initialize with default widgets - currently only purchase history
    const defaultWidgets = {
      'purchase-history': {
        id: 'purchase-history',
        name: 'היסטוריית רכישות',
        description: 'הצג את כל הרכישות שלך עם אפשרויות סינון וחיפוש',
        category: 'purchases',
        icon: 'ShoppingBag',
        enabled: true,
        defaultSize: { w: 12, h: 6, minW: 6, minH: 4 },
        configSchema: {
          title: {
            type: 'string',
            label: 'כותרת הווידג\'ט',
            default: 'היסטוריית רכישות',
            description: 'שם הווידג\'ט שיוצג בכותרת'
          }
        }
      }
    };

    // Update or insert the settings record with default widgets
    await queryInterface.sequelize.query(`
      INSERT INTO settings (id, available_dashboard_widgets, created_at, updated_at)
      VALUES (1, :widgets, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        available_dashboard_widgets = :widgets,
        updated_at = NOW()
    `, {
      replacements: { widgets: JSON.stringify(defaultWidgets) }
    });

    console.log('✅ Added available_dashboard_widgets to settings table with default widgets');
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('settings', 'settings_available_dashboard_widgets_index');

    // Remove column
    await queryInterface.removeColumn('settings', 'available_dashboard_widgets');

    console.log('✅ Removed available_dashboard_widgets column from settings table');
  }
};