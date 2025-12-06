'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if tables exist before adding indexes
    const subscriptionTableExists = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription';`
    );
    const subscriptionPlanTableExists = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptionplan';`
    );

    // Only proceed if both tables exist
    if (subscriptionTableExists[0].length === 0) {
      console.log('⚠️  Skipping subscription indexes: subscription table does not exist');
      return;
    }

    if (subscriptionPlanTableExists[0].length === 0) {
      console.log('⚠️  Skipping subscription plan indexes: subscriptionplan table does not exist');
      return;
    }

    console.log('✅ Both subscription tables exist, adding performance indexes...');

    // 1. Composite index for user's active/pending subscriptions (most frequent query)
    // Used in: SubscriptionService.validateSubscriptionCreation, getUserActiveSubscription
    await queryInterface.addIndex('subscription', ['user_id', 'status'], {
      name: 'subscriptions_user_status_idx',
      where: {
        status: ['active', 'pending', 'cancelled']
      }
    });

    // 2. Index for subscription plan lookups
    // Used in: SubscriptionService.validateSubscriptionCreation for plan validation
    await queryInterface.addIndex('subscription', ['subscription_plan_id'], {
      name: 'subscriptions_plan_idx'
    });

    // 3. Index for PayPlus UID lookups (used in webhooks)
    // Used in: SubscriptionService.updateSubscriptionFromPayPlus
    await queryInterface.addIndex('subscription', ['payplus_subscription_uid'], {
      name: 'subscriptions_payplus_uid_idx',
      where: {
        payplus_subscription_uid: { [Sequelize.Op.ne]: null }
      }
    });

    // 4. Composite index for retry payment queries
    // Used in: SubscriptionService.getUserPendingSubscription, validateRetryPayment
    await queryInterface.addIndex('subscription', ['user_id', 'subscription_plan_id', 'status'], {
      name: 'subscriptions_user_plan_status_idx'
    });

    // 5. Index for subscription plan active status (frequently filtered)
    // Used in: All subscription plan queries with is_active filter
    await queryInterface.addIndex('subscriptionplan', ['is_active'], {
      name: 'subscription_plans_active_idx'
    });

    // 6. Index for subscription creation date ordering
    // Used in: getUserActiveSubscription, getUserSubscriptionHistory
    await queryInterface.addIndex('subscription', ['user_id', 'created_at'], {
      name: 'subscriptions_user_created_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Check if tables exist before removing indexes
    const subscriptionTableExists = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription';`
    );
    const subscriptionPlanTableExists = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptionplan';`
    );

    // Only proceed if tables exist
    if (subscriptionTableExists[0].length === 0 || subscriptionPlanTableExists[0].length === 0) {
      console.log('⚠️  Skipping index removal: subscription tables do not exist');
      return;
    }

    console.log('✅ Removing subscription performance indexes...');

    // Drop indexes in reverse order (with error handling for non-existent indexes)
    try {
      await queryInterface.removeIndex('subscription', 'subscriptions_user_created_idx');
    } catch (e) {
      console.log('Index subscriptions_user_created_idx does not exist, skipping');
    }

    try {
      await queryInterface.removeIndex('subscriptionplan', 'subscription_plans_active_idx');
    } catch (e) {
      console.log('Index subscription_plans_active_idx does not exist, skipping');
    }

    try {
      await queryInterface.removeIndex('subscription', 'subscriptions_user_plan_status_idx');
    } catch (e) {
      console.log('Index subscriptions_user_plan_status_idx does not exist, skipping');
    }

    try {
      await queryInterface.removeIndex('subscription', 'subscriptions_payplus_uid_idx');
    } catch (e) {
      console.log('Index subscriptions_payplus_uid_idx does not exist, skipping');
    }

    try {
      await queryInterface.removeIndex('subscription', 'subscriptions_plan_idx');
    } catch (e) {
      console.log('Index subscriptions_plan_idx does not exist, skipping');
    }

    try {
      await queryInterface.removeIndex('subscription', 'subscriptions_user_status_idx');
    } catch (e) {
      console.log('Index subscriptions_user_status_idx does not exist, skipping');
    }
  }
};