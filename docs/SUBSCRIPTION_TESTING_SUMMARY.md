# PayPlus Subscription Testing Setup - Summary

## What We Built

A comprehensive testing framework to capture and analyze PayPlus recurring payment webhooks in **2-3 days** instead of waiting **30 days**.

## Problem Being Solved

**Current Issue:**
- ✅ First subscription payment webhooks work perfectly
- ❌ Recurring payment webhooks (charges #2, #3, etc.) fail to process
- ❓ We need to see actual recurring webhook payloads to understand the differences

**Root Cause:**
The webhook handler looks up transactions by `payment_page_request_uid`, which may not be present (or may be different) in recurring charge webhooks from PayPlus.

## Solution Implemented

### 1. Daily Billing Test Mode ✅

**File:** `/services/SubscriptionPaymentService.js`

**What It Does:**
- Overrides subscription billing to daily intervals when `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
- Only works in staging/development (blocked in production)
- Uses PayPlus `recurring_type: 0` (daily) instead of `recurring_type: 2` (monthly)

**Activation:**
```bash
export ENABLE_DAILY_SUBSCRIPTION_TESTING=true
```

### 2. Enhanced Webhook Logging ✅

**File:** `/routes/webhooks.js`

**What It Captures:**
- Complete webhook payload structure
- Presence/absence of critical fields (`payment_page_request_uid`, `subscription_uid`, `custom_fields`)
- Comparison data between first payment and recurring charges
- Full audit trail in WebhookLog database table
- Production logs with `.prod` chaining (visible in all environments)

**Where to Find:**
```bash
# Production logs
grep "SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS" logs/production.log

# Database
SELECT event_data FROM webhooklog WHERE subscription_id = 'YOUR_ID' ORDER BY created_at;
```

### 3. Test Subscription Creation Script ✅

**File:** `/scripts/testDailySubscription.js`

**What It Does:**
- Creates subscriptions with daily billing for rapid testing
- Validates environment (blocks production)
- Validates user and plan exist
- Provides dry-run mode for safe preview
- Returns PayPlus payment URL
- Logs comprehensive metadata for tracking

**Usage:**
```bash
# Preview
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_123 \
  --planId=plan_456 \
  --dryRun

# Create
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_123 \
  --planId=plan_456
```

### 4. Comprehensive Documentation ✅

**Files Created:**
- `/docs/SUBSCRIPTION_WEBHOOK_TESTING_PLAN.md` - Complete testing strategy and timeline
- `/docs/DAILY_SUBSCRIPTION_QUICK_START.md` - Quick reference guide
- `/docs/WEBHOOK_HANDLER_ANALYSIS.md` - Technical analysis of current implementation
- `/scripts/README.md` - Updated with testDailySubscription.js documentation

## Testing Timeline

### Day 1 (Today)
1. **Setup:** Set `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
2. **Create:** Run script to create test subscription
3. **Payment:** Complete payment using PayPlus URL
4. **Verify:** First payment webhook processes successfully (existing logic works)
5. **Capture:** Enhanced logging records first payment webhook structure

### Day 2 (Tomorrow, +24 hours)
1. **Wait:** PayPlus automatically sends first recurring charge webhook
2. **Capture:** Webhook fails at transaction lookup (expected)
3. **Analyze:** Enhanced logging captures complete recurring webhook structure
4. **Compare:** Identify differences between first payment and recurring charge webhooks

### Day 3+ (Analysis & Implementation)
1. **Document:** Record exact webhook structure differences
2. **Implement:** Enhanced transaction lookup logic
3. **Test:** Validate fix with Day 3 recurring charge (if needed)
4. **Cleanup:** Disable daily testing, revert to monthly billing

## Key Questions Day 2 Will Answer

1. **Is `payment_page_request_uid` present in recurring webhooks?**
   - If YES: Is it the same or different from first payment?
   - If NO: What alternative identifier should we use?

2. **Is `subscription_uid` present and consistent?**
   - Can we use this to link recurring charges to subscriptions?

3. **Are `custom_fields` preserved in recurring webhooks?**
   - Do we still have access to our `subscription_id`?

4. **What indicates this is a recurring charge?**
   - `charge_number` field?
   - `recurring_info` object?
   - Different structure?

5. **Should we create new Transaction records for recurring charges?**
   - Or reuse the original transaction?
   - What's best for audit trail?

## Files Modified

### Service Layer
- ✅ `/services/SubscriptionPaymentService.js` (lines 302-348)
  - Added daily billing test mode
  - Feature-flagged with `ENABLE_DAILY_SUBSCRIPTION_TESTING`
  - Logged production warning when test mode active

### Webhook Handler
- ✅ `/routes/webhooks.js` (lines 305-330)
  - Added enhanced subscription webhook logging
  - Captures full payload analysis before transaction lookup
  - Uses `.prod` chaining for production visibility

### Scripts
- ✅ `/scripts/testDailySubscription.js` (new file, 497 lines)
  - Complete test subscription creation utility
  - Environment validation and safety checks
  - Dry-run preview mode
  - Comprehensive help and error messages

### Documentation
- ✅ `/docs/SUBSCRIPTION_WEBHOOK_TESTING_PLAN.md` (new file, 1000+ lines)
- ✅ `/docs/DAILY_SUBSCRIPTION_QUICK_START.md` (new file, 400+ lines)
- ✅ `/docs/WEBHOOK_HANDLER_ANALYSIS.md` (new file, 800+ lines)
- ✅ `/scripts/README.md` (updated with new script documentation)

## Safety Features

### Production Protection
- ❌ Script blocks execution if `NODE_ENV=production`
- ❌ Feature flag required: `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
- ✅ Daily billing only enabled in staging/development
- ✅ All test subscriptions tagged with `test_mode` metadata

### Data Integrity
- ✅ Enhanced logging happens BEFORE transaction lookup fails
- ✅ All webhooks logged to WebhookLog table (even failures)
- ✅ No existing functionality modified (additive changes only)
- ✅ Feature-flagged, can be disabled instantly

### Rollback Plan
```bash
# Disable feature flag
export ENABLE_DAILY_SUBSCRIPTION_TESTING=false

# Cancel test subscriptions
UPDATE subscription SET status = 'cancelled'
WHERE metadata->>'test_mode' = 'daily_subscription_testing';
```

## Expected Outcomes

### Immediate Success Criteria
- ✅ Test subscription created with daily billing
- ✅ First payment webhook processes successfully
- ✅ Enhanced logging captures first payment structure
- ✅ Subscription activated correctly

### Day 2 Success Criteria
- ✅ Recurring webhook received (~24 hours after first payment)
- ⚠️ Transaction lookup fails (expected, current issue)
- ✅ Enhanced logging captures recurring webhook structure
- ✅ Full webhook payload saved to database

### Final Success Criteria (Post-Fix)
- ✅ Analyzed webhook differences and documented findings
- ✅ Implemented enhanced transaction lookup logic
- ✅ Recurring webhooks process successfully
- ✅ Transaction records created for recurring charges
- ✅ No regression in first payment handling

## Current Status

**Phase:** ✅ **READY FOR DAY 1 TESTING**

**Completed:**
- [x] Daily billing test mode implemented
- [x] Enhanced webhook logging in place
- [x] Test script created and validated
- [x] Comprehensive documentation written
- [x] Safety checks implemented
- [x] Production protection verified

**Next Steps:**
1. Set environment variable: `ENABLE_DAILY_SUBSCRIPTION_TESTING=true`
2. Find test user ID and subscription plan ID from database
3. Run test script to create subscription
4. Complete payment using PayPlus URL
5. Monitor first payment webhook (should succeed)
6. Wait 24 hours for Day 2 recurring webhook
7. Analyze captured webhook payload
8. Implement fix based on findings

## Monitoring Commands

### Check Webhook Logs
```sql
-- View all webhooks for your subscription
SELECT
  id,
  created_at,
  event_type,
  status,
  security_check,
  event_data->>'subscription_uid' as subscription_uid,
  event_data->'transaction'->>'payment_page_request_uid' as page_request_uid
FROM webhooklog
WHERE subscription_id = 'YOUR_SUBSCRIPTION_ID'
ORDER BY created_at DESC;
```

### Check Production Logs
```bash
# Enhanced webhook analysis
grep "SUBSCRIPTION WEBHOOK PAYLOAD ANALYSIS" logs/production.log | tail -20

# Test mode activation
grep "DAILY SUBSCRIPTION TEST MODE ACTIVE" logs/production.log | tail -10
```

### Check Subscription Status
```sql
-- Verify subscription created and activated
SELECT
  id,
  status,
  payplus_subscription_uid,
  created_at,
  metadata
FROM subscription
WHERE id = 'YOUR_SUBSCRIPTION_ID';
```

## Reference Documentation

### Quick Start
For immediate usage, see: `/docs/DAILY_SUBSCRIPTION_QUICK_START.md`

### Full Testing Plan
For complete strategy, see: `/docs/SUBSCRIPTION_WEBHOOK_TESTING_PLAN.md`

### Technical Analysis
For implementation details, see: `/docs/WEBHOOK_HANDLER_ANALYSIS.md`

### Script Documentation
For script usage, see: `/scripts/README.md`

## Implementation Estimate

**Time Required:** ~10 minutes to start Day 1 testing

**Day 1 Activities:**
- 2 min: Set environment variable
- 2 min: Find test user and plan IDs
- 1 min: Run test script (dry run)
- 1 min: Create actual subscription
- 2 min: Complete payment via PayPlus
- 2 min: Verify first webhook processed

**Day 2 Activities:**
- 0 min: Wait for automatic recurring webhook (PayPlus sends it)
- 5 min: Extract and analyze webhook payload from logs/database
- 10 min: Document differences and plan implementation

**Day 3+ Activities:**
- 30-60 min: Implement enhanced lookup logic
- 15 min: Test with next recurring charge
- 5 min: Cleanup and disable daily testing

**Total Active Time:** ~1-2 hours spread across 3 days
**Total Calendar Time:** 2-3 days (instead of 30+ days waiting for monthly charges)

## Support and Troubleshooting

### Common Issues

**"ERROR: Cannot run daily subscription testing in production environment!"**
- Solution: Ensure `NODE_ENV` is 'staging' or 'development'

**"ERROR: ENABLE_DAILY_SUBSCRIPTION_TESTING must be set to true"**
- Solution: `export ENABLE_DAILY_SUBSCRIPTION_TESTING=true`

**"ERROR: User not found"**
- Solution: Use valid user ID from database: `SELECT id FROM "user" LIMIT 1;`

**"ERROR: Subscription plan not found"**
- Solution: Use valid plan ID: `SELECT id FROM subscriptionplan WHERE is_active = true LIMIT 1;`

### Debug Checklist
- [ ] Environment variable set correctly
- [ ] Not running in production
- [ ] Valid user ID and plan ID
- [ ] PayPlus staging credentials configured
- [ ] Webhook URL accessible from internet
- [ ] Database connection working

### Help Resources
- Test script help: `node scripts/testDailySubscription.js --help`
- Quick start guide: `/docs/DAILY_SUBSCRIPTION_QUICK_START.md`
- Technical details: `/docs/WEBHOOK_HANDLER_ANALYSIS.md`

## Summary

We've built a comprehensive testing framework that:
- ✅ Reduces testing time from 30+ days to 2-3 days
- ✅ Captures actual PayPlus recurring webhook payloads
- ✅ Provides detailed analysis and monitoring tools
- ✅ Includes comprehensive safety checks
- ✅ Documents the entire testing and implementation strategy

**Ready to start?** Run the dry-run command and follow the prompts:

```bash
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=YOUR_USER_ID \
  --planId=YOUR_PLAN_ID \
  --dryRun
```

**Questions?** See `/docs/DAILY_SUBSCRIPTION_QUICK_START.md` for step-by-step instructions.
