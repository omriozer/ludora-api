'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for subscriptionplan table
     * Generated: 2025-10-29T15:46:15.635Z
     * Rows: 2
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('subscriptionplan');
    if (!tableExists) {
      console.log('Table subscriptionplan does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "subscriptionplan"'
    );

    if (results[0].count > 0) {
      console.log('Table subscriptionplan already has data, skipping seed');
      return;
    }

    // Insert seed data with correct schema mapping
    await queryInterface.bulkInsert('subscriptionplan', [
      {
            "id": "176052690030242pcwbzih",
            "name": "בסיסי",
            "description": "מנוי חינם למי שעוד לא הבין כמה הוא צריך את המנוי בתשלום",
            "price": 0,
            "billing_period": "monthly",
            "has_discount": false,
            "discount_type": "percentage",
            "discount_value": 0,
            "discount_valid_until": "",
            "is_active": true,
            "is_default": true,
            "plan_type": "free",
            "benefits": "{\"games_access\": {\"enabled\": false, \"unlimited\": false, \"monthly_limit\": 10}, \"reports_access\": false, \"classroom_management\": {\"enabled\": true, \"max_classrooms\": 3, \"max_total_students\": 100, \"unlimited_classrooms\": false, \"unlimited_total_students\": false, \"max_students_per_classroom\": 30, \"unlimited_students_per_classroom\": false}}",
            "sort_order": 0,
            "created_at": "2025-10-15 18:15:00.302+07",
            "updated_at": "2025-10-19 21:02:11.359+07"
      },
      {
            "id": "1760952077795emrg9u75s",
            "name": "מנוי פרימיום",
            "description": "מנוי חודשי למערכת לודורה",
            "price": 79,
            "billing_period": "monthly",
            "has_discount": false,
            "discount_type": "percentage",
            "discount_value": 0,
            "discount_valid_until": "",
            "is_active": true,
            "is_default": false,
            "plan_type": "pro",
            "benefits": "{\"games_access\": {\"enabled\": true, \"unlimited\": false, \"monthly_limit\": 10}, \"reports_access\": false, \"classroom_management\": {\"enabled\": true, \"max_classrooms\": 3, \"max_total_students\": 100, \"unlimited_classrooms\": false, \"unlimited_total_students\": false, \"max_students_per_classroom\": 30, \"unlimited_students_per_classroom\": true}}",
            "sort_order": 0,
            "created_at": "2025-10-20 16:21:17.795+07",
            "updated_at": "2025-10-20 16:21:17.795+07"
      }
]);

    console.log(`✅ Seeded ${2} rows into subscriptionplan`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from subscriptionplan table
     */
    await queryInterface.bulkDelete('subscriptionplan', null, {});
  }
};
