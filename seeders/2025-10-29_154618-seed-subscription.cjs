'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for subscription table
     * Generated: 2025-10-30T08:30:00.000Z
     * Rows: 1 (complete backup data)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('subscription');
    if (!tableExists) {
      console.log('Table subscription does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "subscription"'
    );

    if (results[0].count > 0) {
      console.log('Table subscription already has data, skipping seed');
      return;
    }

    // Insert complete seed data from backup
    await queryInterface.bulkInsert('subscription', [
      {
        id: 'sub_1761339018649_p9wasim0v',
        user_id: '685afa14113ac3f4419275b1',
        subscription_plan_id: '176052690030242pcwbzih',
        transaction_id: null,
        status: 'active',
        start_date: new Date('2025-10-24T20:50:18.649Z'),
        end_date: null,
        next_billing_date: null,
        cancelled_at: null,
        payplus_subscription_uid: null,
        payplus_status: null,
        monthly_price: 0.00,
        billing_period: 'monthly',
        metadata: {
          ip: '::1',
          source: 'change_plan_api',
          createdAt: '2025-10-24T20:50:18.649Z',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          actionType: 'new_subscription',
          createdVia: 'change_plan_api',
          fromPlanId: null,
          requestedAt: '2025-10-24T20:50:18.645Z',
          planSnapshot: {
            name: 'בסיסי',
            benefits: {
              games_access: {
                enabled: false,
                unlimited: false,
                monthly_limit: 10
              },
              reports_access: false,
              classroom_management: {
                enabled: true,
                max_classrooms: 3,
                max_total_students: 100,
                unlimited_classrooms: false,
                unlimited_total_students: false,
                max_students_per_classroom: 30,
                unlimited_students_per_classroom: false
              }
            },
            description: 'מנוי חינם למי שעוד לא הבין כמה הוא צריך את המנוי בתשלום',
            discountInfo: null,
            originalPrice: 0
          },
          pricingSnapshot: {
            finalPrice: 0,
            isDiscounted: false,
            originalPrice: 0,
            discountAmount: 0
          },
          planChangeReason: 'direct_plan_change'
        },
        created_at: new Date('2025-10-24T20:50:18.649Z'),
        updated_at: new Date('2025-10-24T20:50:18.649Z'),
        original_price: 0.00,
        discount_amount: 0.00
      }
    ]);

    console.log('✅ Seeded 1 row into subscription');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from subscription table
     */
    await queryInterface.bulkDelete('subscription', null, {});
  }
};
