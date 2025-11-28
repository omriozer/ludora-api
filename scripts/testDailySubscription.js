#!/usr/bin/env node

/**
 * Daily Subscription Testing Script
 *
 * Purpose: Create test subscriptions with daily billing to rapidly test recurring payment webhooks
 *
 * This script creates subscriptions that will:
 * - Charge today (instant first payment)
 * - Attempt first recurring charge tomorrow (24 hours later)
 * - Continue charging daily until cancelled
 *
 * This allows testing the full subscription lifecycle in 2-3 days instead of waiting a month.
 *
 * Usage:
 *   ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js --userId=<USER_ID> --planId=<PLAN_ID>
 *
 * Options:
 *   --userId=<ID>    User ID to create subscription for (required)
 *   --planId=<ID>    Subscription plan ID (required)
 *   --dryRun         Preview the subscription without creating it
 *   --help           Show this help message
 */

import models from '../models/index.js';
import SubscriptionPaymentService from '../services/SubscriptionPaymentService.js';
import { ludlog, luderror } from '../lib/ludlog.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    userId: null,
    planId: null,
    dryRun: false,
    help: false
  };

  args.forEach(arg => {
    if (arg === '--help') {
      parsed.help = true;
    } else if (arg === '--dryRun') {
      parsed.dryRun = true;
    } else if (arg.startsWith('--userId=')) {
      parsed.userId = arg.split('=')[1];
    } else if (arg.startsWith('--planId=')) {
      parsed.planId = arg.split('=')[1];
    }
  });

  return parsed;
}

function showHelp() {
  console.log(`
Daily Subscription Testing Script
==================================

Creates test subscriptions with daily billing for rapid webhook testing.

IMPORTANT: This requires ENABLE_DAILY_SUBSCRIPTION_TESTING=true in your environment.

Usage:
  ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js --userId=<USER_ID> --planId=<PLAN_ID>

Options:
  --userId=<ID>    User ID to create subscription for (required)
  --planId=<ID>    Subscription plan ID (required)
  --dryRun         Preview the subscription without creating it
  --help           Show this help message

Environment Variables:
  ENABLE_DAILY_SUBSCRIPTION_TESTING    Must be 'true' to enable daily billing
  NODE_ENV                              Should be 'staging' or 'development' (not production)

Example:
  # Create test subscription for user 'user_abc123' with plan 'plan_monthly_basic'
  ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \\
    --userId=user_abc123 \\
    --planId=plan_monthly_basic

  # Preview without creating
  ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \\
    --userId=user_abc123 \\
    --planId=plan_monthly_basic \\
    --dryRun

Timeline:
  - Day 1 (Today): First payment processed immediately
  - Day 2 (Tomorrow): First recurring charge webhook received
  - Day 3+: Continue receiving daily recurring webhooks

This allows capturing recurring webhook payloads for analysis and fixing the webhook handler.
`);
}

async function validateEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dailyTestingEnabled = process.env.ENABLE_DAILY_SUBSCRIPTION_TESTING === 'true';

  console.log('\n🔍 Environment Check:');
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   ENABLE_DAILY_SUBSCRIPTION_TESTING: ${dailyTestingEnabled}`);

  if (nodeEnv === 'production') {
    console.error('\n❌ ERROR: Cannot run daily subscription testing in production environment!');
    console.error('   This script is for staging/development only.');
    process.exit(1);
  }

  if (!dailyTestingEnabled) {
    console.error('\n❌ ERROR: ENABLE_DAILY_SUBSCRIPTION_TESTING must be set to "true"');
    console.error('   Run this script with: ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js');
    process.exit(1);
  }

  console.log('   ✅ Environment valid for daily subscription testing\n');
}

async function validateUser(userId) {
  const user = await models.User.findByPk(userId);
  if (!user) {
    console.error(`\n❌ ERROR: User not found with ID: ${userId}`);
    process.exit(1);
  }

  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.displayName || 'N/A'}`);

  return user;
}

async function validatePlan(planId) {
  const plan = await models.SubscriptionPlan.findByPk(planId);
  if (!plan) {
    console.error(`\n❌ ERROR: Subscription plan not found with ID: ${planId}`);
    process.exit(1);
  }

  console.log('\n✅ Subscription Plan found:');
  console.log(`   ID: ${plan.id}`);
  console.log(`   Name: ${plan.name}`);
  console.log(`   Price: ${plan.price_after_discount || plan.price} ILS`);
  console.log(`   Billing Period: ${plan.billing_period} (will be overridden to DAILY)`);

  return plan;
}

async function checkExistingSubscriptions(userId) {
  const activeSubscriptions = await models.Subscription.findAll({
    where: {
      user_id: userId,
      status: 'active'
    },
    include: [{
      model: models.SubscriptionPlan,
      as: 'subscriptionPlan'
    }]
  });

  if (activeSubscriptions.length > 0) {
    console.log('\n⚠️  WARNING: User has existing active subscriptions:');
    activeSubscriptions.forEach((sub, idx) => {
      console.log(`   ${idx + 1}. ${sub.subscriptionPlan?.name} (${sub.id})`);
    });
    console.log('   Creating a new subscription may conflict with existing ones.');
  } else {
    console.log('\n✅ No existing active subscriptions found');
  }

  return activeSubscriptions;
}

async function createTestSubscription(userId, planId, dryRun = false) {
  console.log('\n' + '='.repeat(80));
  console.log('CREATING DAILY TEST SUBSCRIPTION');
  console.log('='.repeat(80));

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No subscription will be created\n');
  }

  try {
    // Validate environment
    await validateEnvironment();

    // Validate user
    const user = await validateUser(userId);

    // Validate plan
    const plan = await validatePlan(planId);

    // Check existing subscriptions
    await checkExistingSubscriptions(userId);

    if (dryRun) {
      console.log('\n✅ Dry run completed successfully!');
      console.log('\n📋 Summary:');
      console.log(`   User: ${user.email} (${user.id})`);
      console.log(`   Plan: ${plan.name} (${plan.id})`);
      console.log(`   Price: ${plan.price_after_discount || plan.price} ILS`);
      console.log(`   Billing: DAILY (testing mode)`);
      console.log('\nRun without --dryRun to create the subscription.');
      return null;
    }

    console.log('\n🚀 Creating subscription payment...\n');

    // Create subscription payment
    const result = await SubscriptionPaymentService.createSubscriptionPayment({
      userId: user.id,
      subscriptionPlanId: plan.id,
      metadata: {
        test_mode: 'daily_subscription_testing',
        created_by_script: true,
        test_start_date: new Date().toISOString()
      }
    });

    console.log('\n✅ Subscription payment created successfully!\n');
    console.log('📋 Payment Details:');
    console.log(`   Subscription ID: ${result.subscriptionId}`);
    console.log(`   Transaction ID: ${result.transactionId}`);
    console.log(`   Page Request UID: ${result.pageRequestUid}`);
    console.log(`   Environment: ${result.environment}`);
    console.log(`\n🔗 Payment URL:\n   ${result.paymentUrl}\n`);

    console.log('📅 Testing Timeline:');
    console.log('   ⏰ Today: Complete payment using the URL above');
    console.log('   ⏰ Tomorrow (24h): First recurring charge webhook will be sent by PayPlus');
    console.log('   ⏰ Day 3+: Daily recurring charges continue\n');

    console.log('🔍 Monitoring Instructions:');
    console.log('   1. Complete the payment using the URL above');
    console.log('   2. Check logs for first payment webhook (should arrive within minutes)');
    console.log('   3. Wait 24 hours for first recurring charge webhook');
    console.log('   4. Check WebhookLog table for detailed webhook payloads:');
    console.log(`      SELECT * FROM webhooklog WHERE subscription_id = '${result.subscriptionId}' ORDER BY created_at DESC;`);
    console.log('   5. Review production logs for SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS entries\n');

    ludlog.payments.prod('🧪 DAILY TEST SUBSCRIPTION CREATED:', {
      subscriptionId: result.subscriptionId,
      transactionId: result.transactionId,
      userId: user.id,
      planId: plan.id,
      paymentUrl: result.paymentUrl,
      testMode: 'daily_subscription_testing'
    });

    return result;

  } catch (error) {
    console.error('\n❌ ERROR creating subscription:', error.message);
    luderror.payments('Daily subscription test failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.userId || !args.planId) {
    console.error('\n❌ ERROR: Missing required arguments\n');
    showHelp();
    process.exit(1);
  }

  try {
    await createTestSubscription(args.userId, args.planId, args.dryRun);
    console.log('\n✅ Script completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createTestSubscription };
