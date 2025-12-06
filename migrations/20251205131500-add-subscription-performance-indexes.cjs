'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
    // Drop indexes in reverse order
    await queryInterface.removeIndex('subscription', 'subscriptions_user_created_idx');
    await queryInterface.removeIndex('subscriptionplan', 'subscription_plans_active_idx');
    await queryInterface.removeIndex('subscription', 'subscriptions_user_plan_status_idx');
    await queryInterface.removeIndex('subscription', 'subscriptions_payplus_uid_idx');
    await queryInterface.removeIndex('subscription', 'subscriptions_plan_idx');
    await queryInterface.removeIndex('subscription', 'subscriptions_user_status_idx');
  }
};