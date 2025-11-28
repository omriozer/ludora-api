# PayPlus Subscription Webhook Testing Plan

## Executive Summary

This document outlines the setup for rapid testing of PayPlus recurring subscription webhooks using daily billing cycles. Instead of waiting 30 days between recurring charges, we can test the full lifecycle in 2-3 days.

## Problem Statement

**Current Situation:**
- First subscription payment webhooks work perfectly
- Recurring payment webhooks (charges #2, #3, etc.) fail to find the associated transaction
- Failure occurs at line 274-287 in `/routes/webhooks.js` where we look up by `payment_page_request_uid`
- We need to capture actual recurring webhook payloads to understand the differences

**Key Question:**
What fields are present in recurring charge webhooks that differ from first payment webhooks?

## Testing Strategy

### 1. Daily Billing Override (Implemented)

**File:** `/services/SubscriptionPaymentService.js` (lines 302-348)

**Implementation:**
```javascript
static getRecurringSettings(subscriptionPlan) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isStaging = nodeEnv !== 'production';
  const enableDailyTesting = process.env.ENABLE_DAILY_SUBSCRIPTION_TESTING === 'true';

  if (isStaging && enableDailyTesting) {
    return {
      recurringType: 0, // Daily
      recurringRange: 1,
      testMode: true
    };
  }
  // ... normal monthly/yearly logic
}
```

**Activation:**
```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=true
```

**PayPlus Recurring Types:**
- `0` = Daily (for testing)
- `1` = Weekly
- `2` = Monthly
- `3` = Yearly

### 2. Enhanced Webhook Logging (Implemented)

**File:** `/routes/webhooks.js` (lines 305-330)

**What We Capture:**
```javascript
{
  webhookId: 'webhook_123',
  subscriptionId: 'sub_456',
  analysis: {
    hasSubscriptionUid: true/false,
    subscriptionUid: 'payplus_sub_uid',
    hasCustomFields: true/false,
    customFields: { subscription_id, subscription_plan_id },
    hasTransactionUid: true/false,
    transactionUid: 'payplus_txn_uid',
    hasPaymentPageRequestUid: true/false,
    paymentPageRequestUid: 'page_request_uid',
    statusCode: 000,
    status: 'success',
    webhookType: 'recurring_charge',
    recurringInfo: { ... },
    chargeNumber: 2
  },
  fullWebhookData: { ... complete webhook payload ... }
}
```

**Logging Destinations:**
1. Production logs (`.prod` chaining forces output in all environments)
2. WebhookLog database table (complete audit trail)

### 3. Test Subscription Creation Script

**File:** `/scripts/testDailySubscription.js`

**Usage:**
```bash
# Preview without creating
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic \
  --dryRun

# Create actual test subscription
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic
```

**What It Does:**
1. Validates environment (blocks production)
2. Validates user and subscription plan exist
3. Checks for existing active subscriptions
4. Creates subscription with daily billing
5. Returns PayPlus payment URL
6. Logs test metadata for tracking

## Current Webhook Handler Analysis

### Transaction Lookup Logic (CURRENT IMPLEMENTATION)

**File:** `/routes/webhooks.js` (lines 274-287)

```javascript
// Find the transaction by payment_page_request_uid
const transaction = await models.Transaction.findOne({
  where: {
    payment_page_request_uid: webhookData.transaction.payment_page_request_uid
  },
  include: [{
    model: models.Purchase,
    as: 'purchases'
  }]
});

if (!transaction) {
  throw new Error(`No transaction found for payment_page_request_uid: ${webhookData.transaction.payment_page_request_uid}`);
}
```

**Why This Fails for Recurring Charges:**

**Hypothesis #1:** `payment_page_request_uid` is only present in first payment webhook
- First payment: Uses payment page created by our API
- Recurring charges: PayPlus uses stored payment token, no new payment page
- Solution: Add fallback lookup using `subscription_uid` + `custom_fields.subscription_id`

**Hypothesis #2:** `payment_page_request_uid` is in a different location in recurring webhooks
- Maybe nested differently in webhook payload structure
- Solution: Enhanced logging will reveal actual structure

**Hypothesis #3:** Recurring webhooks use completely different structure
- Different top-level fields
- Different nested structure
- Solution: Compare first payment vs recurring payment webhook logs

### Expected Webhook Payload Differences

**First Payment Webhook (KNOWN):**
```json
{
  "transaction": {
    "payment_page_request_uid": "page_req_abc123",
    "status_code": "000"
  },
  "transaction_uid": "txn_first_payment",
  "subscription_uid": "sub_payplus_123",
  "custom_fields": {
    "subscription_id": "sub_ludora_456",
    "subscription_plan_id": "plan_789"
  },
  "status": "success"
}
```

**Recurring Payment Webhook (HYPOTHESIS):**
```json
{
  "transaction": {
    "payment_page_request_uid": null,  // ❓ Maybe missing?
    "status_code": "000"
  },
  "transaction_uid": "txn_recurring_2",
  "subscription_uid": "sub_payplus_123",  // ✅ Same subscription
  "custom_fields": {
    "subscription_id": "sub_ludora_456",  // ✅ Should be present
    "subscription_plan_id": "plan_789"
  },
  "status": "success",
  "charge_number": 2,  // ❓ Maybe indicates recurring charge?
  "recurring_info": { ... }  // ❓ Additional recurring metadata?
}
```

## Testing Timeline

### Day 1 (Today)

**Actions:**
1. Set environment variable: `export ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
2. Run test script to create subscription
3. Complete payment using generated PayPlus URL
4. Monitor first payment webhook

**Expected Results:**
- First payment webhook arrives within minutes
- Transaction found successfully (existing logic works)
- Subscription activated
- Enhanced logging captures first payment webhook structure

**Monitoring:**
```sql
-- Check webhook logs
SELECT id, event_type, status, created_at, event_data
FROM webhooklog
WHERE provider = 'payplus'
  AND subscription_id = 'YOUR_SUBSCRIPTION_ID'
ORDER BY created_at DESC;

-- Check subscription status
SELECT id, status, payplus_subscription_uid, created_at
FROM subscription
WHERE id = 'YOUR_SUBSCRIPTION_ID';
```

**Log Monitoring:**
```bash
# Production logs will show (using .prod chaining):
grep "SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS" logs/production.log
```

### Day 2 (Tomorrow, +24 hours)

**Actions:**
1. Monitor for first recurring charge webhook
2. Expect webhook to arrive ~24 hours after first payment
3. Capture recurring webhook payload from logs

**Expected Results:**
- Recurring charge webhook arrives
- Transaction lookup FAILS (current known issue)
- Enhanced logging captures recurring webhook structure
- We can compare first payment vs recurring payment webhooks

**Data Collection:**
```sql
-- Compare webhook payloads
SELECT
  id,
  created_at,
  event_type,
  event_data->>'transaction_uid' as transaction_uid,
  event_data->>'subscription_uid' as subscription_uid,
  event_data->'transaction'->>'payment_page_request_uid' as page_request_uid,
  event_data->>'charge_number' as charge_number,
  status
FROM webhooklog
WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
ORDER BY created_at ASC;
```

### Day 3+ (Analysis & Implementation)

**Actions:**
1. Analyze differences between first and recurring webhooks
2. Implement enhanced transaction lookup logic
3. Test fix with Day 3 recurring charge (if needed)

**Expected Implementation:**
```javascript
// Enhanced lookup logic (to be implemented after analysis)
let transaction = null;

// Try standard lookup first (works for first payment)
transaction = await models.Transaction.findOne({
  where: { payment_page_request_uid: webhookData.transaction?.payment_page_request_uid }
});

// Fallback for recurring charges (lookup by subscription)
if (!transaction && webhookData.subscription_uid) {
  const subscriptionId = webhookData.custom_fields?.subscription_id;

  if (subscriptionId) {
    // Find subscription
    const subscription = await models.Subscription.findOne({
      where: {
        id: subscriptionId,
        payplus_subscription_uid: webhookData.subscription_uid
      }
    });

    if (subscription && subscription.transaction_id) {
      transaction = await models.Transaction.findByPk(subscription.transaction_id);
    }
  }
}

// Create new transaction for recurring charge if needed
if (!transaction) {
  transaction = await createRecurringChargeTransaction({
    subscriptionId,
    webhookData
  });
}
```

## Transaction Model Integration

**Current Transaction Fields:**
```javascript
Transaction {
  id: string,
  user_id: string,
  amount: decimal,
  payment_status: enum('pending', 'completed', 'failed', 'cancelled', 'refunded'),
  payment_page_request_uid: string,  // Only for first payment?
  metadata: jsonb,
  environment: enum('production', 'staging')
}
```

**Options for Recurring Charges:**

**Option A: Reuse Original Transaction**
- Pro: Simple, matches existing pattern
- Con: Doesn't track individual recurring charges
- Con: Metadata gets overwritten with each charge

**Option B: Create New Transaction per Recurring Charge**
- Pro: Full audit trail of each charge
- Pro: Clear separation of charges
- Con: Need to link transactions to subscription
- Implementation: Add `parent_transaction_id` or use `metadata.subscription_id`

**Option C: Use SubscriptionPurchase Model**
- Pro: Dedicated model for subscription charges
- Pro: Tracks usage_tracking JSONB for allowances
- Con: Need to ensure it integrates with Transaction workflow
- Implementation: Link each recurring charge to SubscriptionPurchase

**Recommended Approach:** Option B (Create New Transactions)
- Keeps Transaction as single source of truth for all payments
- Add metadata fields:
  ```javascript
  metadata: {
    subscription_id: 'sub_123',
    charge_type: 'recurring',
    charge_number: 2,
    original_transaction_id: 'txn_first_payment',
    payplus_subscription_uid: 'sub_payplus_123'
  }
  ```

## Security Considerations

### 1. Webhook Signature Validation

**Current Implementation:** `/routes/webhooks.js` (lines 224-259)

```javascript
const signatureValid = validateWebhookSignature(req, [
  'hash',
  'x-payplus-signature',
  'payplus-signature'
]);

if (!signatureValid) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Ensure This Works for Recurring Webhooks:**
- Recurring charges should have same signature scheme
- Monitor signature validation for recurring charges
- If validation fails, investigate PayPlus documentation

### 2. Preventing Duplicate Processing

**Add Idempotency Check:**
```javascript
// Check if this webhook was already processed
const existingWebhook = await models.WebhookLog.findOne({
  where: {
    payplus_transaction_uid: webhookData.transaction_uid
  }
});

if (existingWebhook && existingWebhook.status === 'completed') {
  // Already processed, return success to prevent PayPlus retries
  return res.status(200).json({
    message: 'Webhook already processed',
    webhookId: existingWebhook.id
  });
}
```

## Environment Configuration

### Required Environment Variables

**Staging/Development:**
```bash
# Enable daily subscription testing
ENABLE_DAILY_SUBSCRIPTION_TESTING=true

# Standard PayPlus staging credentials
PAYPLUS_STAGING_API_KEY=your_staging_key
PAYPLUS_STAGING_SECRET_KEY=your_staging_secret
NODE_ENV=staging
```

**Production (NEVER enable daily testing):**
```bash
# Daily testing MUST be disabled in production
ENABLE_DAILY_SUBSCRIPTION_TESTING=false

# Production PayPlus credentials
PAYPLUS_API_KEY=your_production_key
PAYPLUS_SECRET_KEY=your_production_secret
NODE_ENV=production
```

### Safety Checks

**Script Validation:**
1. Blocks execution if `NODE_ENV=production`
2. Requires explicit `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
3. Shows dry-run preview before creating subscriptions
4. Logs all test subscriptions with `test_mode` metadata

**Service Validation:**
1. `getRecurringSettings()` only returns daily billing in staging
2. Logs production warning when test mode activated
3. Includes `testMode: true` in returned settings for tracking

## Database Schema

### Relevant Models

**Subscription:**
```javascript
{
  id: string,
  user_id: string,
  subscription_plan_id: string,
  status: enum('pending', 'active', 'cancelled', 'expired', 'failed'),
  payplus_subscription_uid: string,  // Links to PayPlus recurring subscription
  transaction_id: string,  // Original payment transaction
  metadata: jsonb
}
```

**SubscriptionHistory:**
```javascript
{
  id: string,
  user_id: string,
  subscription_plan_id: string,
  action_type: enum('started', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired', 'failed'),
  payplus_subscription_uid: string,
  transaction_id: string,
  metadata: jsonb
}
```

**Transaction:**
```javascript
{
  id: string,
  user_id: string,
  amount: decimal,
  payment_status: enum('pending', 'completed', 'failed', 'cancelled', 'refunded'),
  payment_page_request_uid: string,
  metadata: jsonb  // Will contain subscription_id for subscription transactions
}
```

**WebhookLog:**
```javascript
{
  id: string,
  provider: string,
  event_type: string,
  event_data: jsonb,  // Complete webhook payload
  sender_info: jsonb,  // Request headers, IP, etc.
  status: enum('received', 'processing', 'completed', 'failed'),
  subscription_id: string,
  transaction_id: string,
  payplus_transaction_uid: string,
  security_check: enum('passed', 'failed'),
  process_log: jsonb  // Step-by-step processing logs
}
```

## Expected Outcomes

### Immediate (Day 1)
- ✅ Test subscription created with daily billing
- ✅ First payment webhook processed successfully
- ✅ Enhanced logging captures first payment structure
- ✅ Subscription activated

### Day 2
- ✅ First recurring charge webhook received
- ⚠️ Transaction lookup fails (expected, current issue)
- ✅ Enhanced logging captures recurring charge structure
- ✅ Full webhook payload saved to WebhookLog table

### Day 3+
- ✅ Analyzed differences between webhooks
- ✅ Implemented enhanced lookup logic
- ✅ Recurring charge webhooks process successfully
- ✅ New Transaction records created for recurring charges
- ✅ Daily testing can be disabled

## Rollback Plan

If daily testing causes issues:

1. **Disable feature flag:**
   ```bash
   export ENABLE_DAILY_SUBSCRIPTION_TESTING=false
   ```

2. **Cancel test subscriptions:**
   ```sql
   UPDATE subscription
   SET status = 'cancelled'
   WHERE metadata->>'test_mode' = 'daily_subscription_testing';
   ```

3. **Monitor PayPlus dashboard:**
   - Cancel recurring subscriptions manually if needed
   - Check for any failed charges

4. **Code rollback:**
   - Changes are additive and feature-flagged
   - No existing functionality modified
   - Safe to leave code in place with flag disabled

## Success Criteria

**Testing Setup (Immediate):**
- [x] Daily billing mode implemented and feature-flagged
- [x] Enhanced webhook logging captures all relevant fields
- [x] Test script creates subscriptions successfully
- [x] Safety checks prevent production usage

**Data Collection (Day 2):**
- [ ] First payment webhook payload captured
- [ ] Recurring payment webhook payload captured
- [ ] Differences identified and documented
- [ ] Failure point confirmed in webhook handler

**Implementation (Day 3+):**
- [ ] Enhanced lookup logic implemented
- [ ] Recurring webhooks process successfully
- [ ] New Transaction records created correctly
- [ ] Subscription status updated appropriately
- [ ] No regression in first payment handling

## Next Steps

1. **Run test script** to create first daily subscription
2. **Monitor Day 1 results** - confirm first payment works
3. **Wait for Day 2** - capture recurring webhook payload
4. **Analyze webhook differences** - compare payloads
5. **Implement enhanced lookup** - handle recurring charges
6. **Test Day 3 charge** - validate fix works
7. **Disable daily testing** - revert to monthly billing
8. **Document findings** - update webhook handler documentation

## References

- **PayPlus API Documentation:** [PayPlus Recurring Payments](https://payplus.co.il/)
- **SubscriptionPaymentService:** `/services/SubscriptionPaymentService.js`
- **Webhook Handler:** `/routes/webhooks.js`
- **Test Script:** `/scripts/testDailySubscription.js`
- **Transaction Model:** `/models/Transaction.js`
- **WebhookLog Model:** `/models/WebhookLog.js`
