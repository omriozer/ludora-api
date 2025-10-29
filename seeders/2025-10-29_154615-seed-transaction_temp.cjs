'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for transaction_temp table
     * Generated: 2025-10-30T15:30:00.000Z
     * Rows: 2 (complete backup data)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('transaction_temp');
    if (!tableExists) {
      console.log('Table transaction_temp does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "transaction_temp"'
    );

    if (results[0].count > 0) {
      console.log('Table transaction_temp already has data, skipping seed');
      return;
    }

    // Insert complete seed data from backup
    await queryInterface.bulkInsert('transaction_temp', [
      {
            "id": "txn_1761339014481_i316cpd4a",
            "user_id": null,
            "amount": 79.00,
            "currency": "ILS",
            "payment_method": "payplus",
            "payment_status": "pending",
            "transaction_id": null,
            "description": null,
            "metadata": null,
            "environment": "production",
            "provider_transaction_id": null,
            "provider_response": null,
            "failure_reason": null,
            "created_at": "2025-10-25 03:50:14.481+07",
            "updated_at": "2025-10-25 03:50:14.481+07"
      },
      {
            "id": "txn_1761396336553_8llo3ws1f",
            "user_id": null,
            "amount": 79.00,
            "currency": "ILS",
            "payment_method": "payplus",
            "payment_status": "pending",
            "transaction_id": null,
            "description": null,
            "metadata": null,
            "environment": "production",
            "provider_transaction_id": null,
            "provider_response": null,
            "failure_reason": null,
            "created_at": "2025-10-25 19:45:36.553+07",
            "updated_at": "2025-10-25 19:45:36.553+07"
      }
]);

    console.log(`✅ Seeded ${2} rows into transaction_temp`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from transaction_temp table
     */
    await queryInterface.bulkDelete('transaction_temp', null, {});
  }
};