# Complete Subscription Lifecycle Testing on Staging

## Test Environment Setup

**Staging Database:** `d8heo41r5j4f62` (PostgreSQL Cloud)
**Valid Plan:** `qEX8k8` (בסיסי - 69 ILS, monthly)
**Test User:** `68b5c29a1cdd154f650cb976` (liorgoldman0@gmail.com)
**PayPlus Environment:** Staging credentials with webhook endpoints

---

## Test 1: Webhooks DISABLED (Polling Only)

### Configuration
```bash
NODE_ENV=staging
ENABLE_DAILY_SUBSCRIPTION_TESTING=true
DISABLE_PAYPLUS_WEBHOOKS=true
```

### Test Steps
```bash
# 1. Create subscription (webhooks disabled)
node scripts/testDailySubscription.js \
  --userId=68b5c29a1cdd154f650cb976 \
  --planId=qEX8k8

# Expected: Subscription created with daily billing override
```

### Manual Testing Phase
1. **Payment URL Generated:** `https://paymentsdev.payplus.co.il/[uid]`
2. **Open Payment Page:** Use PayPlus test card
3. **Monitor Polling:** System should poll every 20 seconds
4. **Complete Payment:** Test card: `4580458045804580`, `12/25`, `123`
5. **Check Activation:** Subscription status should change to `active`

### Expected Behavior (Polling Only)
- ❌ **No webhook processing** (disabled)
- ✅ **Polling detects payment completion** (~20 second delay)
- ✅ **Subscription activates via polling**
- ✅ **Daily billing override active** (next charge tomorrow)
- ✅ **Manual intervention required** for status changes

---

## Test 2: Webhooks ENABLED (Normal Flow)

### Configuration
```bash
NODE_ENV=staging
ENABLE_DAILY_SUBSCRIPTION_TESTING=true
# DISABLE_PAYPLUS_WEBHOOKS=false (default)
```

### Test Steps
```bash
# 1. Create subscription (webhooks enabled)
node scripts/testDailySubscription.js \
  --userId=68a0b172b43132f178b29b83 \
  --planId=qEX8k8

# Expected: Subscription created, webhook URL configured
```

### Manual Testing Phase
1. **Payment URL Generated:** `https://paymentsdev.payplus.co.il/[uid]`
2. **PayPlus Webhook URL:** `https://api.ludora.app/api/webhooks/payplus`
3. **Complete Payment:** Same test card
4. **Webhook Received:** Immediate processing (~5 seconds)
5. **Check Activation:** Automatic subscription activation

### Expected Behavior (Webhook Flow)
- ✅ **Webhook processes immediately** (~5 second response)
- ✅ **Automatic subscription activation**
- ✅ **Daily billing override active**
- ✅ **No manual intervention needed**
- ✅ **Faster activation than polling**

---

## Comparison Matrix

| Aspect | Polling Only | Webhook Enabled |
|--------|-------------|-----------------|
| **Activation Speed** | ~20-60 seconds | ~5-10 seconds |
| **Manual Monitoring** | Required | Automatic |
| **PayPlus Integration** | API calls only | API + Webhook |
| **Failure Recovery** | Polling retries | Webhook + Polling fallback |
| **Daily Recurring Test** | Tomorrow (polling) | Tomorrow (webhook) |
| **Production Reliability** | Backup method | Primary method |

---

## Critical Test Questions

### Subscription Lifecycle
1. **Does status change when user opens PayPlus page?**
2. **How does system detect abandonment vs never-accessed?**
3. **What triggers subscription activation in each scenario?**
4. **Does polling work for subscriptions or only purchases?**

### Daily Billing Testing
1. **Does daily override work for recurring charges?**
2. **Are recurring webhooks different from initial payment webhooks?**
3. **Does polling detect recurring charges correctly?**
4. **How is subscription renewal handled in each scenario?**

### Error Handling
1. **What happens if webhook fails but polling succeeds?**
2. **How does abandonment cleanup work in each scenario?**
3. **Are there different error states for polling vs webhooks?**

---

## Expected Test Results

### Scenario 1 Results (Polling)
```json
{
  "subscription_id": "sub_staging_polling_test",
  "activation_method": "polling",
  "activation_delay": "20-60 seconds",
  "daily_billing_override": true,
  "next_charge_date": "tomorrow",
  "webhook_processing": false,
  "manual_intervention": true
}
```

### Scenario 2 Results (Webhooks)
```json
{
  "subscription_id": "sub_staging_webhook_test",
  "activation_method": "webhook",
  "activation_delay": "5-10 seconds",
  "daily_billing_override": true,
  "next_charge_date": "tomorrow",
  "webhook_processing": true,
  "manual_intervention": false
}
```

---

## Daily Recurring Test (Tomorrow)

### Both Scenarios Should Receive
1. **Daily recurring charge** (instead of monthly)
2. **Webhook payload** (different structure than initial payment)
3. **Subscription renewal** (extends next billing date)
4. **Continued active status**

### Key Question to Answer
**"Does the recurring webhook payload have the same structure as initial payment webhooks?"**

This determines if the current webhook processing logic handles both:
- Initial subscription payment webhooks
- Recurring subscription charge webhooks

---

## Running the Tests

### Prerequisites
- Access to staging infrastructure (database IP whitelist)
- PayPlus staging credentials configured
- Webhook endpoint accessible to PayPlus servers

### Test Commands (Run on Staging Server)
```bash
# Test 1: Polling only
DISABLE_PAYPLUS_WEBHOOKS=true \
ENABLE_DAILY_SUBSCRIPTION_TESTING=true \
node scripts/testDailySubscription.js \
  --userId=68b5c29a1cdd154f650cb976 \
  --planId=qEX8k8

# Test 2: Webhooks enabled
ENABLE_DAILY_SUBSCRIPTION_TESTING=true \
node scripts/testDailySubscription.js \
  --userId=68a0b172b43132f178b29b83 \
  --planId=qEX8k8
```

### Monitoring Commands
```bash
# Monitor subscription status
psql $DATABASE_URL -c "
SELECT id, status, payplus_subscription_uid, next_billing_date
FROM subscription
WHERE id IN ('sub_polling_test', 'sub_webhook_test');"

# Monitor webhook logs
psql $DATABASE_URL -c "
SELECT created_at, event_type, status, subscription_id
FROM webhook_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;"
```

---

## Success Criteria

### Test 1 (Polling) Success
- [ ] Subscription created with pending status
- [ ] PayPlus payment page generated
- [ ] Payment completion detected via polling
- [ ] Subscription activated through polling mechanism
- [ ] Daily billing override confirmed (next charge tomorrow)
- [ ] No webhook processing occurred

### Test 2 (Webhook) Success
- [ ] Subscription created with pending status
- [ ] PayPlus payment page generated
- [ ] Webhook received and processed successfully
- [ ] Subscription activated through webhook mechanism
- [ ] Daily billing override confirmed (next charge tomorrow)
- [ ] Faster activation than polling scenario

### Overall Success
- [ ] Both activation methods work correctly
- [ ] Daily billing override functions in both scenarios
- [ ] Performance difference documented (webhook faster)
- [ ] Recurring charge testing setup for tomorrow
- [ ] Complete subscription lifecycle validated