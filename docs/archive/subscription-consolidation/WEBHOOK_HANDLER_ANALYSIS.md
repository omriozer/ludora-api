# PayPlus Webhook Handler - Current Implementation Analysis

## Executive Summary

This document analyzes the current webhook handler implementation in `/routes/webhooks.js`, identifies the exact failure point for recurring subscription webhooks, and proposes the implementation strategy once we capture actual recurring webhook payloads.

## Current Implementation Flow

### 1. Webhook Reception (Lines 96-203)

**File:** `/routes/webhooks.js`

```javascript
router.post('/payplus', asyncHandler(async (req, res) => {
  const webhookData = req.body;
  const rawBody = JSON.stringify(req.body);

  // Capture comprehensive sender information
  const senderInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    // ... 50+ fields captured
  };
```

**Status:** ✅ Working for all webhooks (first payment and recurring)

**What We Capture:**
- Complete webhook payload (`webhookData`)
- Raw request body for signature verification
- All HTTP headers
- Sender IP, user agent, timestamp
- Complete request metadata

### 2. Webhook Logging (Lines 204-217)

```javascript
webhookLog = await models.WebhookLog.create({
  id: generateId(),
  provider: 'payplus',
  event_type: webhookData.transaction_type || webhookData.status || 'unknown',
  event_data: webhookData,  // ✅ Complete payload stored
  sender_info: senderInfo,
  status: 'received',
  payment_page_request_uid: webhookData.transaction?.payment_page_request_uid,
  payplus_transaction_uid: webhookData.transaction_uid,
  created_at: new Date()
});
```

**Status:** ✅ Working - all webhooks logged to database

**Important:** Even failed webhooks get logged with full payload in `event_data` field.

### 3. Signature Verification (Lines 224-259)

```javascript
const signatureValid = validateWebhookSignature(req, [
  'hash',                        // PayPlus actual signature header
  'x-payplus-signature',
  'payplus-signature',
  'x-signature',
  'signature'
]);

if (!signatureValid) {
  await webhookLog.updateStatus('failed', 'Invalid webhook signature');
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Status:** ✅ Working for first payment webhooks

**Question for Day 2:** Does signature validation work for recurring webhooks?
- If recurring webhooks fail here, they won't reach transaction lookup
- Monitor `security_check` field in WebhookLog

### 4. Transaction Lookup (Lines 267-292) ⚠️ **THIS IS WHERE IT FAILS**

```javascript
// Validate required webhook data
if (!webhookData.transaction?.payment_page_request_uid) {
  throw new Error('Missing required payment_page_request_uid in webhook data');
}

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

**Status:** ⚠️ **FAILS for recurring charges**

**Why It Fails:**

**Scenario 1: `payment_page_request_uid` is missing in recurring webhooks**
```javascript
// First payment webhook
{
  transaction: {
    payment_page_request_uid: "page_req_abc123"  // ✅ Present
  }
}

// Recurring charge webhook (hypothesis)
{
  transaction: {
    payment_page_request_uid: null  // ❌ Missing
  }
}
```
**Result:** Line 267 throws error "Missing required payment_page_request_uid"

**Scenario 2: `payment_page_request_uid` is present but doesn't match any transaction**
```javascript
// Recurring charge webhook (hypothesis)
{
  transaction: {
    payment_page_request_uid: "different_uid_for_recurring"  // Present but different
  }
}
```
**Result:** Line 286 throws error "No transaction found for payment_page_request_uid"

**Scenario 3: Structure is completely different**
```javascript
// Recurring charge webhook (hypothesis)
{
  // No nested 'transaction' object?
  payment_page_request_uid: "...",
  subscription_uid: "sub_123",
  charge_number: 2
}
```
**Result:** Line 267 fails because `webhookData.transaction` is undefined

### 5. Enhanced Logging for Subscriptions (Lines 305-330) ✅ **NEW**

```javascript
// ENHANCED LOGGING: Capture PayPlus subscription webhook structure for analysis
if (isSubscriptionTransaction) {
  ludlog.payments.prod('📊 SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS:', {
    webhookId: webhookLog.id,
    subscriptionId,
    analysis: {
      hasSubscriptionUid: !!webhookData.subscription_uid,
      subscriptionUid: webhookData.subscription_uid,
      hasCustomFields: !!webhookData.custom_fields,
      customFields: webhookData.custom_fields,
      hasTransactionUid: !!webhookData.transaction_uid,
      transactionUid: webhookData.transaction_uid,
      hasPaymentPageRequestUid: !!webhookData.transaction?.payment_page_request_uid,
      paymentPageRequestUid: webhookData.transaction?.payment_page_request_uid,
      statusCode: webhookData.transaction?.status_code,
      status: webhookData.status,
      webhookType: webhookData.type || 'unknown',
      recurringInfo: webhookData.recurring_info || null,
      chargeNumber: webhookData.charge_number || null
    },
    fullWebhookData: webhookData,
    timestamp: new Date().toISOString()
  });
}
```

**Status:** ✅ Implemented, ready to capture data on Day 2

**Note:** This logging happens BEFORE the transaction lookup fails, so we'll still get the data even if the webhook processing fails.

### 6. Payment Processing (Lines 309-478)

This section handles successful/failed payments after transaction is found.

**Status:** ⏸️ Never reached for recurring charges (fails at step 4)

**What It Does:**
- Updates transaction status to 'completed' or 'failed'
- Activates subscriptions (for subscription payments)
- Completes purchases (for product purchases)
- Captures payment tokens automatically
- Creates success/failure records

## Proposed Fix Strategy

### Phase 1: Data Collection (Day 1-2)

**Goal:** Capture actual recurring webhook payload

**Actions:**
1. ✅ Enhanced logging implemented (lines 305-330)
2. ⏰ Wait for Day 2 recurring charge
3. 📊 Extract webhook payload from logs/database
4. 🔍 Compare first payment vs recurring payment

**Data Sources:**
```sql
-- Extract all webhooks for analysis
SELECT
  id,
  created_at,
  event_type,
  status,
  security_check,
  event_data,
  process_log
FROM webhooklog
WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
ORDER BY created_at ASC;
```

### Phase 2: Implementation (Day 3+)

**Goal:** Handle both first payment and recurring charges

**Strategy A: Enhanced Lookup with Fallbacks** (Recommended)

```javascript
async function findTransactionForWebhook(webhookData) {
  let transaction = null;

  // ATTEMPT 1: Standard lookup by payment_page_request_uid (works for first payment)
  if (webhookData.transaction?.payment_page_request_uid) {
    transaction = await models.Transaction.findOne({
      where: {
        payment_page_request_uid: webhookData.transaction.payment_page_request_uid
      }
    });

    if (transaction) {
      return { transaction, lookupMethod: 'payment_page_request_uid' };
    }
  }

  // ATTEMPT 2: Lookup by subscription_uid + custom_fields (for recurring charges)
  if (webhookData.subscription_uid && webhookData.custom_fields?.subscription_id) {
    const subscription = await models.Subscription.findOne({
      where: {
        id: webhookData.custom_fields.subscription_id,
        payplus_subscription_uid: webhookData.subscription_uid
      }
    });

    if (subscription?.transaction_id) {
      transaction = await models.Transaction.findByPk(subscription.transaction_id);

      if (transaction) {
        return { transaction, lookupMethod: 'subscription_link' };
      }
    }
  }

  // ATTEMPT 3: Lookup by transaction_uid (if PayPlus sends it)
  if (webhookData.transaction_uid) {
    transaction = await models.Transaction.findOne({
      where: {
        'metadata.payplus_transaction_uid': webhookData.transaction_uid
      }
    });

    if (transaction) {
      return { transaction, lookupMethod: 'transaction_uid' };
    }
  }

  return { transaction: null, lookupMethod: null };
}
```

**Strategy B: Create New Transaction for Recurring Charges**

```javascript
async function handleRecurringCharge(webhookData, subscription) {
  // Create new transaction for this recurring charge
  const transaction = await models.Transaction.create({
    id: generateId(),
    user_id: subscription.user_id,
    amount: webhookData.amount || subscription.amount,
    payment_status: 'pending',
    metadata: {
      subscription_id: subscription.id,
      transaction_type: 'subscription_recurring_charge',
      charge_number: webhookData.charge_number || null,
      original_transaction_id: subscription.transaction_id,
      payplus_transaction_uid: webhookData.transaction_uid,
      payplus_subscription_uid: webhookData.subscription_uid,
      payplusWebhookData: webhookData
    }
  });

  return transaction;
}
```

**Strategy C: Hybrid Approach** (Recommended)

```javascript
async function getOrCreateTransaction(webhookData) {
  // Try to find existing transaction first
  const { transaction, lookupMethod } = await findTransactionForWebhook(webhookData);

  if (transaction) {
    ludlog.payments('Found transaction using:', lookupMethod);
    return transaction;
  }

  // For recurring charges, create new transaction
  if (webhookData.subscription_uid && webhookData.custom_fields?.subscription_id) {
    const subscription = await models.Subscription.findOne({
      where: {
        id: webhookData.custom_fields.subscription_id,
        payplus_subscription_uid: webhookData.subscription_uid
      }
    });

    if (subscription) {
      ludlog.payments('Creating new transaction for recurring charge');
      return await handleRecurringCharge(webhookData, subscription);
    }
  }

  // If we get here, something is wrong
  throw new Error('Unable to find or create transaction for webhook');
}
```

### Phase 3: Integration Points

**Update Webhook Handler (Line 267-292):**

```javascript
// OLD CODE (remove):
if (!webhookData.transaction?.payment_page_request_uid) {
  throw new Error('Missing required payment_page_request_uid in webhook data');
}

const transaction = await models.Transaction.findOne({
  where: {
    payment_page_request_uid: webhookData.transaction.payment_page_request_uid
  }
});

if (!transaction) {
  throw new Error(`No transaction found for payment_page_request_uid`);
}

// NEW CODE (implement):
const transaction = await getOrCreateTransaction(webhookData);

webhookLog.addProcessLog(`Transaction ${transaction.id} found/created using ${transaction.lookupMethod || 'creation'}`);
```

## Implementation Checklist

### Pre-Implementation (Data Collection)

- [x] Enhanced logging implemented
- [x] Daily subscription testing setup
- [ ] Test subscription created
- [ ] First payment completed
- [ ] Day 2 recurring webhook received
- [ ] Webhook payload analyzed and documented

### Implementation Phase

- [ ] Extract exact webhook structure from Day 2 logs
- [ ] Document differences between first and recurring webhooks
- [ ] Implement `findTransactionForWebhook()` function
- [ ] Implement `handleRecurringCharge()` function (if needed)
- [ ] Implement `getOrCreateTransaction()` wrapper
- [ ] Update webhook handler to use new lookup logic
- [ ] Add comprehensive logging for each lookup attempt
- [ ] Add unit tests for transaction lookup scenarios

### Testing Phase

- [ ] Test with Day 3 recurring charge (if daily testing still active)
- [ ] Verify transaction found/created correctly
- [ ] Verify subscription status updated appropriately
- [ ] Verify WebhookLog records show successful processing
- [ ] Test signature validation for recurring webhooks
- [ ] Test idempotency (same webhook received twice)
- [ ] Test error handling for malformed recurring webhooks

### Production Readiness

- [ ] Disable daily testing mode
- [ ] Deploy to staging environment
- [ ] Monitor first monthly recurring charge in staging
- [ ] Verify no regression in first payment handling
- [ ] Deploy to production
- [ ] Monitor production recurring charges

## Key Questions to Answer on Day 2

### Webhook Structure

1. **Is `payment_page_request_uid` present in recurring webhooks?**
   - If YES: Is it the same as first payment or different?
   - If NO: What alternative identifier is provided?

2. **Is `subscription_uid` present in recurring webhooks?**
   - Should always be present according to PayPlus docs
   - Verify it matches the `payplus_subscription_uid` in our Subscription record

3. **Are `custom_fields` present in recurring webhooks?**
   - Should contain our `subscription_id` and `subscription_plan_id`
   - These are critical for linking webhook to our subscription

4. **What indicates this is a recurring charge vs first payment?**
   - `charge_number` field?
   - `recurring_info` object?
   - Different `transaction_type`?
   - Different event structure?

5. **Is there a unique `transaction_uid` for each recurring charge?**
   - Can we use this to prevent duplicate processing?
   - Can we use this to track individual charges?

### Signature Validation

6. **Does signature validation work for recurring webhooks?**
   - Check `security_check` field in WebhookLog
   - If failed, investigate why signature differs

### Transaction Model

7. **Should we create new Transaction for each recurring charge?**
   - Pro: Full audit trail
   - Con: Need to link transactions together

8. **What metadata should be stored for recurring charges?**
   - Original transaction ID?
   - Charge number?
   - Subscription UID?

## Error Handling Improvements

### Current Error Handling

```javascript
catch (error) {
  luderror.payment('PayPlus webhook processing failed:', error.message);

  // Still respond with success to prevent PayPlus retries
  res.status(200).json({
    message: 'PayPlus webhook received but processing failed',
    error: error.message
  });
}
```

**Status:** ✅ Good - prevents infinite PayPlus retries

### Proposed Enhancements

```javascript
catch (error) {
  // Categorize errors for better monitoring
  const errorCategory = categorizeWebhookError(error);

  luderror.payment('PayPlus webhook processing failed:', {
    error: error.message,
    category: errorCategory,
    webhookData: {
      subscription_uid: webhookData.subscription_uid,
      transaction_uid: webhookData.transaction_uid,
      has_payment_page_request_uid: !!webhookData.transaction?.payment_page_request_uid
    }
  });

  // Log to webhook log with error details
  await webhookLog.failProcessing(startTime, error, errorCategory);

  // For recurring charge failures, attempt recovery
  if (errorCategory === 'recurring_transaction_not_found') {
    await attemptRecurringChargeRecovery(webhookData, webhookLog);
  }

  // Still return 200 to prevent retries
  res.status(200).json({
    message: 'PayPlus webhook received but processing failed',
    error: error.message,
    category: errorCategory,
    webhookId: webhookLog?.id
  });
}
```

## Monitoring and Alerting

### Metrics to Track

1. **Webhook Processing Success Rate**
   ```sql
   SELECT
     status,
     COUNT(*) as count,
     COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
   FROM webhooklog
   WHERE provider = 'payplus'
     AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY status;
   ```

2. **Recurring vs First Payment Webhooks**
   ```sql
   SELECT
     CASE
       WHEN event_data->>'charge_number' IS NULL THEN 'First Payment'
       ELSE 'Recurring Charge ' || (event_data->>'charge_number')
     END as payment_type,
     COUNT(*) as count,
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_seconds
   FROM webhooklog
   WHERE provider = 'payplus'
     AND subscription_id IS NOT NULL
   GROUP BY payment_type
   ORDER BY payment_type;
   ```

3. **Transaction Lookup Methods**
   ```sql
   SELECT
     process_log->-1->>'message' as last_step,
     COUNT(*) as count
   FROM webhooklog
   WHERE provider = 'payplus'
     AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY last_step
   ORDER BY count DESC;
   ```

### Alerts to Configure

1. **Recurring Webhook Failures**
   - Trigger: 3+ failed recurring webhooks in 1 hour
   - Action: Page on-call engineer

2. **Signature Validation Failures**
   - Trigger: Any signature validation failure
   - Action: Security review

3. **Transaction Creation for Recurring Charges**
   - Trigger: First time creating transaction for recurring charge
   - Action: Notify team for verification

## Code Locations Reference

### Files to Modify

1. **`/routes/webhooks.js`**
   - Lines 267-292: Transaction lookup logic
   - Lines 305-330: Enhanced logging (already implemented)

2. **`/services/SubscriptionPaymentService.js`**
   - Lines 302-348: Recurring settings (already modified for daily testing)

3. **`/utils/transactionLookup.js`** (NEW FILE)
   - Implement `findTransactionForWebhook()`
   - Implement `getOrCreateTransaction()`
   - Implement `handleRecurringCharge()`

4. **`/models/Transaction.js`**
   - Potentially add methods:
     - `Transaction.createForRecurringCharge()`
     - `Transaction.findByWebhookData()`

### Testing Files to Create

1. **`/tests/webhooks/recurring-charges.test.js`**
   - Test transaction lookup scenarios
   - Test new transaction creation
   - Test idempotency

2. **`/tests/services/subscription-payment.test.js`**
   - Test daily billing mode
   - Test recurring settings

## Success Metrics

### Immediate Success (Day 3)

- ✅ Recurring webhook processed successfully
- ✅ Transaction found or created
- ✅ No error thrown at line 267 or 286
- ✅ WebhookLog shows status = 'completed'

### Long-term Success (Production)

- ✅ 100% webhook processing success rate
- ✅ All recurring charges tracked in Transaction table
- ✅ Subscription status updated correctly for all charges
- ✅ No manual intervention required for recurring charges
- ✅ Clear audit trail for billing disputes

## Next Steps

1. **Complete Day 1 testing**
   - Create subscription
   - Complete payment
   - Verify first webhook processes correctly

2. **Monitor Day 2 results**
   - Wait for recurring webhook
   - Extract payload from logs/database
   - Analyze structure

3. **Document findings**
   - Update this document with actual webhook structure
   - Confirm or reject hypotheses

4. **Implement solution**
   - Write enhanced lookup logic
   - Add comprehensive tests
   - Deploy to staging

5. **Validate in production**
   - Monitor first production recurring charge
   - Verify success metrics
   - Document any issues

---

**Current Status:** Ready for Day 1 testing. Enhanced logging in place to capture Day 2 recurring webhook payload.
