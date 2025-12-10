# Daily Subscription Testing - Quick Start Guide

## TL;DR - Get Started in 5 Minutes

This guide helps you set up daily subscription testing to capture recurring payment webhooks in 24 hours instead of waiting a month.

## Prerequisites

- Staging/Development environment (NOT production)
- Valid user ID from your database
- Valid subscription plan ID from your database
- PayPlus staging credentials configured

## Quick Setup (5 steps)

### 1. Enable Daily Testing Mode

```bash
# Add to your environment or .env.staging file
export ENABLE_DAILY_SUBSCRIPTION_TESTING=true
```

### 2. Find a Test User and Plan

```sql
-- Find a test user
SELECT id, email, displayName FROM "user" LIMIT 5;

-- Find an active subscription plan
SELECT id, name, price, billing_period FROM subscriptionplan WHERE is_active = true LIMIT 5;
```

### 3. Run Test Script (Dry Run First)

```bash
# Preview without creating
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic \
  --dryRun
```

### 4. Create Test Subscription

```bash
# Create actual subscription
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic
```

**Output will include:**
- Payment URL to complete the transaction
- Subscription ID for monitoring
- Transaction ID for tracking

### 5. Complete Payment and Monitor

1. **Open the payment URL** in a browser
2. **Complete the payment** using PayPlus test card
3. **Monitor first webhook** (arrives within minutes)
4. **Wait 24 hours** for first recurring charge webhook

## Monitoring Your Test

### Check Webhook Logs

```sql
-- View all webhooks for your subscription
SELECT
  id,
  created_at,
  event_type,
  status,
  event_data->>'subscription_uid' as subscription_uid,
  event_data->'transaction'->>'payment_page_request_uid' as page_request_uid
FROM webhooklog
WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
ORDER BY created_at DESC;
```

### Check Production Logs

```bash
# Look for enhanced webhook logging
grep "SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS" logs/production.log | tail -20

# Look for daily test mode activation
grep "DAILY SUBSCRIPTION TEST MODE ACTIVE" logs/production.log | tail -10
```

### Check Subscription Status

```sql
-- Verify subscription was created and activated
SELECT
  id,
  status,
  payplus_subscription_uid,
  created_at,
  metadata
FROM subscription
WHERE id = 'YOUR_SUBSCRIPTION_ID';
```

## Timeline Expectations

| Time | Event | What to Check |
|------|-------|---------------|
| **Day 1, Now** | Create subscription | Script completes, payment URL generated |
| **Day 1, +5 min** | Complete payment | PayPlus payment page, use test card |
| **Day 1, +10 min** | First payment webhook | Check webhooklog table, status = 'completed' |
| **Day 1, +15 min** | Subscription activated | subscription.status = 'active' |
| **Day 2, +24h** | First recurring charge | Second webhook arrives, THIS IS THE KEY TEST |
| **Day 2, +24h +10 min** | Analyze webhook payload | Compare first vs recurring webhook structure |
| **Day 3+** | Continue daily charges | Optional: monitor additional charges |

## What You'll Capture

### Day 1 - First Payment Webhook ✅ (Works Already)

```json
{
  "transaction": {
    "payment_page_request_uid": "page_req_abc123",
    "status_code": "000"
  },
  "transaction_uid": "txn_first",
  "subscription_uid": "sub_payplus_123",
  "custom_fields": {
    "subscription_id": "sub_ludora_456",
    "subscription_plan_id": "plan_789"
  }
}
```

### Day 2 - Recurring Payment Webhook ⚠️ (Currently Fails)

This is what we need to capture and analyze:

```json
{
  "transaction": {
    "payment_page_request_uid": "???",  // This is the question!
    "status_code": "000"
  },
  "transaction_uid": "txn_recurring_2",
  "subscription_uid": "sub_payplus_123",
  "custom_fields": {
    "subscription_id": "sub_ludora_456",
    "subscription_plan_id": "plan_789"
  },
  "charge_number": 2,  // Maybe?
  "recurring_info": { ... }  // Maybe?
}
```

## PayPlus Test Cards (Staging)

Use these test cards in PayPlus staging environment:

| Card Number | Expiry | CVV | Result |
|-------------|--------|-----|--------|
| 4580458045804580 | 12/25 | 123 | Success |
| 4111111111111111 | 12/25 | 123 | Success |
| 5555555555554444 | 12/25 | 123 | Success |

## Common Issues

### "ERROR: Cannot run daily subscription testing in production environment!"

**Solution:** Make sure `NODE_ENV` is NOT set to `production`:
```bash
echo $NODE_ENV  # Should be 'staging' or 'development'
export NODE_ENV=staging
```

### "ERROR: ENABLE_DAILY_SUBSCRIPTION_TESTING must be set to true"

**Solution:** Set the environment variable:
```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=true
```

### "ERROR: User not found with ID: user_abc123"

**Solution:** Use a real user ID from your database:
```sql
SELECT id FROM "user" LIMIT 1;
```

### "ERROR: Subscription plan not found with ID: plan_abc123"

**Solution:** Use a real plan ID from your database:
```sql
SELECT id FROM subscriptionplan WHERE is_active = true LIMIT 1;
```

### Webhook didn't arrive after payment

**Checks:**
1. Verify webhook URL is configured in PayPlus dashboard
2. Check server is accessible from PayPlus servers
3. Review WebhookLog table for any received webhooks
4. Check firewall/security settings

## What to Do With Results

### After Day 2 Webhook Arrives

1. **Extract webhook payload from logs:**
   ```sql
   SELECT event_data
   FROM webhooklog
   WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
     AND created_at > NOW() - INTERVAL '2 hours'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **Compare with Day 1 webhook:**
   - What fields are different?
   - Is `payment_page_request_uid` present?
   - Are `subscription_uid` and `custom_fields` present?

3. **Document findings:**
   - Update `/docs/SUBSCRIPTION_WEBHOOK_TESTING_PLAN.md`
   - Share webhook payload structure

4. **Implement fix:**
   - Enhanced lookup logic in `/routes/webhooks.js`
   - Handle both first payment and recurring charges

## Cleanup After Testing

### 1. Disable Daily Testing

```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=false
```

Or remove from `.env.staging`:
```bash
# ENABLE_DAILY_SUBSCRIPTION_TESTING=true  # Comment out or remove
```

### 2. Cancel Test Subscriptions

```sql
-- Find all test subscriptions
SELECT id, user_id, status
FROM subscription
WHERE metadata->>'test_mode' = 'daily_subscription_testing';

-- Cancel them
UPDATE subscription
SET status = 'cancelled'
WHERE metadata->>'test_mode' = 'daily_subscription_testing';
```

### 3. Cancel in PayPlus Dashboard

1. Log in to PayPlus staging dashboard
2. Navigate to Subscriptions
3. Find subscriptions created during testing
4. Cancel them manually to stop recurring charges

## Advanced Usage

### Test Multiple Plans

```bash
# Test different subscription plans
for PLAN_ID in plan_basic plan_premium plan_enterprise; do
  ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
    --userId=user_test_123 \
    --planId=$PLAN_ID
done
```

### Monitor Webhooks in Real-Time

```bash
# Tail webhook logs
tail -f logs/production.log | grep "SUBSCRIPTION WEBHOOK"
```

```sql
-- Poll webhook table every 5 seconds
SELECT id, created_at, event_type, status
FROM webhooklog
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

### Export Webhook Payload for Analysis

```sql
-- Export as JSON
COPY (
  SELECT
    id,
    created_at,
    event_data,
    sender_info
  FROM webhooklog
  WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
  ORDER BY created_at ASC
) TO '/tmp/webhook_payloads.json';
```

## Help & Support

### Debug Checklist

- [ ] Environment variable set: `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
- [ ] Not in production: `NODE_ENV != 'production'`
- [ ] Valid user ID and plan ID
- [ ] PayPlus staging credentials configured
- [ ] Webhook URL accessible from internet
- [ ] Database accessible

### Log Files to Check

1. **Production logs:** `logs/production.log`
   - Search for: `DAILY SUBSCRIPTION TEST MODE ACTIVE`
   - Search for: `SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS`

2. **Webhook logs:** WebhookLog database table
   - Check: `event_data` field for full payload
   - Check: `process_log` field for processing steps

3. **PayPlus dashboard:** staging.payplus.co.il
   - Check: Subscription creation
   - Check: Transaction history
   - Check: Webhook delivery logs

### Questions?

- Review full testing plan: `/docs/SUBSCRIPTION_WEBHOOK_TESTING_PLAN.md`
- Check webhook handler code: `/routes/webhooks.js` (lines 293-330)
- Check service implementation: `/services/SubscriptionPaymentService.js` (lines 302-348)

## Quick Reference

**Enable:**
```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=true
```

**Create:**
```bash
node scripts/testDailySubscription.js --userId=USER_ID --planId=PLAN_ID
```

**Monitor:**
```sql
SELECT * FROM webhooklog WHERE subscription_id = 'SUB_ID' ORDER BY created_at DESC;
```

**Disable:**
```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=false
```

---

**Ready to start testing?** Run the dry-run command above and follow the prompts!
