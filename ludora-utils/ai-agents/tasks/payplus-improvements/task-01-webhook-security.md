# Task 01: Webhook Signature Verification Security Fix

## Task Header

**Task ID:** 01
**Title:** Webhook Signature Verification Security Fix
**Priority Level:** CRITICAL (Security Vulnerability)
**Estimated Time:** 2-3 hours AI work time
**Dependencies:** None (can start immediately)
**Status:** COMPLETED
**Started:** 2025-11-26 01:00:00 UTC
**Completed:** 2025-11-26 02:22:00 UTC
**Assigned:** Claude Code (ludora-team-leader)

## Context Section

### Why This Task Is Needed

During investigation on 2025-11-25, we discovered that webhook signature verification is **commented out in production** (Line 42 in `/ludora-api/routes/webhooks.js`). This creates a critical security vulnerability where anyone could forge PayPlus webhook requests, potentially:
- Marking unpaid purchases as completed
- Creating fraudulent payment confirmations
- Manipulating payment amounts or customer data
- Performing replay attacks with old webhook payloads

### Current State Analysis (UPDATED - Investigation Complete)

**CRITICAL FINDING:** PayPlus webhook endpoint has NO signature verification implemented.

```javascript
// Current code in webhooks.js (Line 95-430):
// PayPlus webhook route completely lacks signature verification
router.post('/payplus', asyncHandler(async (req, res) => {
  // ... comprehensive logging and processing ...
  // BUT NO SIGNATURE VERIFICATION AT ALL
}));

// Generic webhook middleware exists (lines 34-57) but:
// 1. NOT used for PayPlus
// 2. Has TODO for actual implementation
// 3. Only used for other providers (GitHub, Stripe, PayPal)
```

**Investigation Results:**
- ✅ Security vulnerability confirmed - no cryptographic verification
- ❌ Line 42 is not commented verification (it's development environment check)
- ✅ PayPlus route needs complete signature verification implementation
- ✅ Comprehensive sender logging exists but no signature validation

### Expected Outcomes

1. All incoming PayPlus webhooks are cryptographically verified
2. Forged or tampered webhooks are rejected with 401 status
3. Legitimate webhooks continue to process normally
4. Comprehensive logging of verification failures for monitoring
5. No disruption to existing payment flow

### Success Criteria

- [ ] Signature verification active in production
- [ ] 100% of forged webhooks rejected in testing
- [ ] 100% of legitimate webhooks accepted
- [ ] Zero payment processing disruption
- [ ] Monitoring alerts configured for failures

## Implementation Details

### Step-by-Step Implementation Plan

#### Step 1: Locate and Review Existing Code
```bash
# Files to examine:
/ludora-api/routes/webhooks.js           # Line 42 - commented verification
/ludora-api/utils/payplus.js            # Likely has verifyPayPlusSignature function
/ludora-api/services/PayPlusService.js  # May have signature logic
```

#### Step 2: Understand PayPlus Signature Format

PayPlus webhook signatures use HMAC-SHA256:
```javascript
// Expected signature generation:
const crypto = require('crypto');

function generatePayPlusSignature(payload, secretKey) {
  // PayPlus typically sends JSON body
  const message = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload);

  return crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
}
```

#### Step 3: Implement Robust Verification Function

```javascript
// /ludora-api/utils/payplusSignature.js
const crypto = require('crypto');
const clog = require('../utils/clog');

/**
 * Verifies PayPlus webhook signature
 * @param {Object|string} payload - Request body
 * @param {string} signature - Signature from headers
 * @param {string} secretKey - PayPlus secret key
 * @returns {boolean} - True if valid
 */
function verifyPayPlusSignature(payload, signature, secretKey) {
  try {
    // TODO remove debug - webhook signature verification
    clog('Starting signature verification');

    if (!signature || !secretKey) {
      // TODO remove debug - webhook signature verification
      cerror('Missing signature or secret key');
      return false;
    }

    // Normalize payload to string
    const message = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    // TODO remove debug - webhook signature verification
    if (!valid) {
      cerror('Signature mismatch', {
        received: signature.substring(0, 10) + '...',
        expected: expectedSignature.substring(0, 10) + '...'
      });
    }

    return valid;
  } catch (error) {
    // TODO remove debug - webhook signature verification
    cerror('Signature verification error:', error);
    return false;
  }
}

module.exports = { verifyPayPlusSignature };
```

#### Step 4: Update Webhook Route

```javascript
// /ludora-api/routes/webhooks.js
const { verifyPayPlusSignature } = require('../utils/payplusSignature');
const clog = require('../utils/clog');

router.post('/payplus', async (req, res) => {
  try {
    // Get signature from headers (check PayPlus docs for exact header name)
    const signature = req.headers['x-payplus-signature'] ||
                     req.headers['payplus-signature'] ||
                     req.headers['x-signature'];

    // Get appropriate secret key based on environment
    const secretKey = process.env.NODE_ENV === 'production'
      ? process.env.PAYPLUS_SECRET_KEY
      : process.env.PAYPLUS_STAGING_SECRET_KEY;

    // CRITICAL: Verify signature before processing
    if (!verifyPayPlusSignature(req.body, signature, secretKey)) {
      // Log failure for monitoring
      await models.webhook_log.create({
        source: 'payplus',
        event_type: 'signature_verification_failed',
        payload: req.body,
        headers: req.headers,
        ip_address: req.ip,
        status: 'rejected',
        error_message: 'Invalid signature'
      });

      clog('PayPlus webhook rejected: invalid signature', {
        ip: req.ip,
        transaction_uid: req.body?.transaction?.uid
      });

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }

    // Signature valid, continue processing...
    // TODO remove debug - webhook signature verification
    clog('PayPlus webhook signature verified successfully');

    // Rest of webhook processing...
  } catch (error) {
    cerror('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Step 5: Add Configuration and Environment Variables

```javascript
// /ludora-api/config/payplus.js
module.exports = {
  webhook: {
    signatureHeader: process.env.PAYPLUS_SIGNATURE_HEADER || 'x-payplus-signature',
    enforceSignature: process.env.PAYPLUS_ENFORCE_SIGNATURE !== 'false', // Default true
    logFailures: true,
    maxPayloadSize: '10mb' // Prevent DoS attacks
  }
};
```

#### Step 6: Add Monitoring and Alerting

```javascript
// /ludora-api/monitoring/webhookMonitor.js
const AlertService = require('../services/AlertService');

async function monitorWebhookSecurity() {
  // Check for signature failures in last hour
  const recentFailures = await models.webhook_log.count({
    where: {
      status: 'rejected',
      error_message: 'Invalid signature',
      created_at: {
        [Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  // Alert if threshold exceeded
  if (recentFailures > 5) {
    await AlertService.sendSecurityAlert({
      type: 'webhook_signature_failures',
      count: recentFailures,
      severity: 'high'
    });
  }
}
```

### Specific File Locations to Modify

1. `/ludora-api/routes/webhooks.js` - Main webhook handler (uncomment and fix Line 42)
2. `/ludora-api/utils/payplusSignature.js` - Create new signature verification utility
3. `/ludora-api/config/payplus.js` - Add signature configuration
4. `/ludora-api/models/webhook_log.js` - Ensure has fields for security logging
5. `/ludora-api/monitoring/webhookMonitor.js` - Create monitoring service

### Code Examples and Patterns to Follow

Follow Ludora's existing patterns:
- Use `clog`/`cerror` for logging (not console.log)
- Transaction safety for database operations
- Proper error handling with try/catch
- Environment-specific configuration
- Data-driven caching (no setTimeout)

### Database Changes Required

None for basic implementation. Optional enhancement:
```sql
-- Add index for security monitoring queries
CREATE INDEX idx_webhook_log_security ON webhook_logs(status, error_message, created_at);
```

### Configuration Changes Needed

Environment variables to verify/add:
```bash
# Production
PAYPLUS_SECRET_KEY=<production_secret>
PAYPLUS_SIGNATURE_HEADER=x-payplus-signature
PAYPLUS_ENFORCE_SIGNATURE=true

# Staging/Development
PAYPLUS_STAGING_SECRET_KEY=<staging_secret>
```

## Technical Specifications

### API Endpoints

No new endpoints. Modifying existing:
- `POST /api/webhooks/payplus` - Add signature verification

### Security Requirements

1. **Cryptographic Security:**
   - HMAC-SHA256 signature verification
   - Constant-time comparison to prevent timing attacks
   - Secure key storage in environment variables

2. **Defensive Programming:**
   - Validate all inputs before processing
   - Log all verification failures
   - Rate limit webhook endpoint
   - Max payload size limits

3. **Monitoring:**
   - Alert on verification failure spikes
   - Track success/failure rates
   - Log IP addresses of failures

### Testing Requirements

1. **Unit Tests:**
   ```javascript
   describe('PayPlus Signature Verification', () => {
     test('accepts valid signature', () => {
       const payload = { transaction: { uid: '123' } };
       const secret = 'test_secret';
       const signature = generateSignature(payload, secret);
       expect(verifyPayPlusSignature(payload, signature, secret)).toBe(true);
     });

     test('rejects invalid signature', () => {
       const payload = { transaction: { uid: '123' } };
       expect(verifyPayPlusSignature(payload, 'wrong_sig', 'secret')).toBe(false);
     });

     test('rejects modified payload', () => {
       const payload = { transaction: { uid: '123' } };
       const signature = generateSignature(payload, 'secret');
       payload.transaction.uid = '456'; // Modify after signing
       expect(verifyPayPlusSignature(payload, signature, 'secret')).toBe(false);
     });
   });
   ```

2. **Integration Tests:**
   - Test with actual PayPlus sandbox webhooks
   - Verify error handling and logging
   - Test with malformed requests

### Performance Considerations

- Signature verification adds ~1-2ms latency
- Use crypto.timingSafeEqual() for constant-time comparison
- Consider caching valid signatures briefly (5 minutes) to handle retries
- Implement rate limiting: max 100 webhooks/minute per IP

## Dependencies and Integration

### Prerequisites

- Access to PayPlus documentation for signature format
- PayPlus sandbox account for testing
- Production secret keys in environment

### Other Systems Affected

1. **Purchase Processing:** Must handle potential 401 responses
2. **Monitoring:** New alerts for signature failures
3. **Logging:** Increased webhook_log entries for failures
4. **Support Tools:** Need updates for troubleshooting

### Integration Points

- PayPlus webhook endpoint
- webhook_log database table
- Alert/monitoring services
- Purchase status updates

### Potential Breaking Changes

⚠️ **CRITICAL RISK:** If signature verification is implemented incorrectly, ALL payments will fail. Must test extensively in sandbox first.

## Testing and Validation

### Unit Test Requirements

```javascript
// /ludora-api/tests/unit/payplus/signature.test.js
const { verifyPayPlusSignature } = require('../../../utils/payplusSignature');

describe('PayPlus Signature Verification', () => {
  const secret = 'test_secret_key';

  test('should accept valid HMAC-SHA256 signature', () => {
    // Test implementation
  });

  test('should reject tampered payload', () => {
    // Test implementation
  });

  test('should handle non-JSON payloads', () => {
    // Test implementation
  });

  test('should be timing-attack resistant', () => {
    // Measure execution time for valid vs invalid signatures
  });
});
```

### Integration Test Scenarios

1. **Sandbox Testing:**
   ```bash
   # Use PayPlus sandbox to trigger real webhooks
   curl -X POST https://sandbox.payplus.co.il/api/v1/payments/create \
     -H "Authorization: Bearer $SANDBOX_KEY" \
     -d '{"amount": 100, "webhook_url": "https://staging.ludora.com/api/webhooks/payplus"}'
   ```

2. **Security Testing:**
   ```bash
   # Test with forged signature
   curl -X POST http://localhost:3000/api/webhooks/payplus \
     -H "x-payplus-signature: invalid_signature" \
     -H "Content-Type: application/json" \
     -d '{"transaction": {"uid": "fake_transaction"}}'
   # Should return 401
   ```

### Manual Testing Steps

1. **Development Environment:**
   - [ ] Configure sandbox keys
   - [ ] Trigger test payment in PayPlus sandbox
   - [ ] Verify webhook received and signature validated
   - [ ] Check webhook_log for success entry

2. **Staging Environment:**
   - [ ] Deploy changes to staging
   - [ ] Run full payment flow with test card
   - [ ] Verify signature validation in logs
   - [ ] Test with intentionally bad signature (should fail)

3. **Production Rollout:**
   - [ ] Deploy with feature flag initially
   - [ ] Monitor first 10 webhooks closely
   - [ ] Check no increase in payment failures
   - [ ] Enable for all traffic after validation

### Security Validation Steps

1. [ ] Penetration test with forged signatures
2. [ ] Verify timing attack resistance
3. [ ] Test replay attack prevention
4. [ ] Validate error messages don't leak information
5. [ ] Confirm keys not logged anywhere

### Performance Benchmarks

- Signature verification: < 2ms
- Total webhook processing: < 100ms
- Memory usage: < 10MB additional
- CPU impact: < 1% increase

## Completion Checklist

### Implementation
- [ ] Created payplusSignature.js utility file
- [ ] Implemented verifyPayPlusSignature function
- [ ] Updated webhooks.js route with verification
- [ ] Added proper error handling and logging
- [ ] Configured environment variables

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests with sandbox
- [ ] Security testing completed
- [ ] Performance benchmarks met
- [ ] Manual testing in development

### Code Review
- [ ] Code follows Ludora patterns
- [ ] No console.log statements
- [ ] Proper error handling
- [ ] Security best practices followed
- [ ] Comments and documentation added

### Documentation
- [ ] API documentation updated
- [ ] Environment variables documented
- [ ] Troubleshooting guide created
- [ ] Support team notified of changes
- [ ] Monitoring alerts configured

### Deployment
- [ ] Tested in PayPlus sandbox
- [ ] Staged deployment successful
- [ ] Production feature flag ready
- [ ] Rollback plan documented
- [ ] Monitoring dashboard updated

## Rollback Plan

If signature verification causes issues in production:

1. **Immediate:** Set `PAYPLUS_ENFORCE_SIGNATURE=false` to disable
2. **Quick Fix:** Deploy with verification commented (1 minute)
3. **Investigation:** Review webhook_log for failure patterns
4. **Resolution:** Fix issue and re-enable with careful monitoring

## Notes for Next Session

If picking up this task:
1. Start by checking if `/ludora-api/utils/payplus.js` has existing signature code
2. Verify exact header name with PayPlus documentation
3. Test with PayPlus sandbox before any production deployment
4. Consider implementing gradual rollout with feature flags
5. Coordinate with support team for monitoring during deployment