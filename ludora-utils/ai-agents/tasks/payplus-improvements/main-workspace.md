# PayPlus Improvements Project - Master Workspace

## Project Overview

**Project Lead:** ludora-team-leader
**Created:** 2025-11-25
**Updated:** 2025-11-26
**Status:** Planning Phase → Ready for Implementation
**Priority:** Critical (Security issues) → High (Reliability) → Medium (Features)

### Executive Summary

Complete overhaul of PayPlus payment integration to address security vulnerabilities discovered during investigation, improve reliability through polling mechanisms, and enable saved payment methods for returning customers. This project addresses critical production issues that were uncovered during payment failure investigations on 2025-11-25.

### Current Investigation Findings (From investigation-report.md)

1. **CRITICAL Security Vulnerability:** Webhook signature verification is commented out in production (Line 42 in webhooks.js)
2. **Reliability Issue:** Webhooks occasionally fail with no retry mechanism, leaving payments in pending state
3. **Missing Feature:** PayPlus sends payment tokens in webhook responses but we don't capture them
4. **Database Gap:** No schema exists for storing customer payment methods
5. **API Gap:** No endpoints for managing saved payment methods
6. **UX Gap:** No UI components for selecting saved payment methods

### Key Architectural Decisions

- **Dual Verification Approach:** Webhooks remain primary notification, polling serves as reliability fallback
- **Token Storage Strategy:** Encrypted storage in new payment_methods table with PCI compliance
- **Security First Principle:** Fix signature verification before any feature additions
- **Backward Compatibility:** All changes must maintain existing payment flow functionality
- **Phased Rollout:** Security fix first, then reliability, then new features

## Task Status Board

| Task ID | Title | Priority | Status | Assigned To | Dependencies | Est. Time | Progress |
|---------|-------|----------|---------|-------------|--------------|-----------|----------|
| 01 | Webhook Signature Verification Security Fix | CRITICAL | Not Started | - | None | 2-3 hours | 0% |
| 02 | Payment Status Polling Implementation | HIGH | Not Started | - | None | 4-5 hours | 0% |
| 03 | Token Capture System | HIGH | Not Started | - | Task 01 | 3-4 hours | 0% |
| 04 | Payment Method Database Schema | MEDIUM | Not Started | - | Task 03 | 2-3 hours | 0% |
| 05 | Payment Method Management APIs | MEDIUM | Not Started | - | Task 04 | 3-4 hours | 0% |
| 06 | Frontend Payment Method Management | LOW | Not Started | - | Task 05 | 4-5 hours | 0% |

**Total Estimated Time:** 18-24 hours of AI work time

## Task Dependencies Graph

```
Task 01 (Webhook Security) ──┐
                              ├──> Task 03 (Token Capture) ──> Task 04 (Database) ──> Task 05 (APIs) ──> Task 06 (Frontend)
Task 02 (Polling) ────────────┘
```

## Critical Code Locations

### Backend Files
- `/ludora-api/routes/payments.js` - Main payment routes (478 lines)
- `/ludora-api/routes/webhooks.js` - Webhook handlers (Line 42 has commented signature verification)
- `/ludora-api/services/PayPlusService.js` - PayPlus integration service (if exists)
- `/ludora-api/models/Purchase.js` - Purchase model (needs token fields)
- `/ludora-api/constants/payplus.js` - PayPlus configuration
- `/ludora-api/models/webhook_log.js` - Webhook logging model

### Frontend Files
- `/ludora-front/src/pages/payment/PaymentResult.jsx` - Payment result page
- `/ludora-front/src/pages/PaymentPage.jsx` - Checkout page
- `/ludora-front/src/components/Checkout/` - Checkout components
- `/ludora-front/src/services/paymentService.js` - Payment API client

### Database Tables
- `Purchases` - Existing purchase records
- `webhook_logs` - Webhook event logging
- `payment_methods` - TO BE CREATED in Task 04
- `payment_tokens` - TO BE CREATED in Task 04

## External Documentation References

- **PayPlus API Documentation:** https://www.payplus.co.il/api-documentation
- **PayPlus Webhook Signatures:** Section 4.3 - HMAC-SHA256 verification
- **PayPlus Token Documentation:** Section 7 - Recurring payments and saved cards
- **PayPlus Status Polling:** Section 3.2 - Transaction status endpoint
- **PCI DSS Requirements:** https://www.pcisecuritystandards.org/ (for token storage)

## Session Recovery Information

### Investigation Timeline
1. **2025-11-25 Early:** Started with user report of 404 error on payment completion
2. **2025-11-25 Morning:** Fixed redirect URL configuration in PayPlus constants
3. **2025-11-25 Afternoon:** Discovered webhook signature verification was commented out
4. **2025-11-25 Evening:** Identified lack of polling fallback mechanism
5. **2025-11-26 Night:** Found payment tokens in webhook responses not being captured
6. **2025-11-26 00:21:** Confirmed no database schema exists for payment methods

### Key Technical Insights
- PayPlus sends `token` field in webhook responses for successful card payments
- Signature verification uses HMAC-SHA256 with secret_key
- PayPlus has `/api/v1/transaction/status/{uid}` endpoint for polling
- Webhook retry logic is not implemented on PayPlus side
- Current implementation has single point of failure (webhook only)

### Business Context
- **Teacher Pain Point:** Repeat customers must re-enter payment info every time
- **Support Burden:** Team manually checks 3-5 failed payments weekly
- **Security Risk:** Commented signature verification is audit failure
- **Competition Gap:** Competitors offer one-click repeat purchases
- **Revenue Impact:** Cart abandonment due to payment re-entry friction

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|--------|------------|---------------------|
| Webhook signature breaks payments | CRITICAL | LOW | Extensive testing in sandbox, gradual rollout |
| Webhook forgery/replay attacks | HIGH | MEDIUM | Implement signature verification (Task 01) |
| Payment stuck in pending | MEDIUM | LOW | Polling fallback (Task 02) |
| Token data breach | HIGH | LOW | Encryption at rest, access controls (Task 04) |
| Race condition webhook/polling | MEDIUM | MEDIUM | Idempotency keys, transaction locking |
| Breaking existing payment flow | HIGH | LOW | Comprehensive testing, feature flags |

## Implementation Order Rationale

1. **Task 01 - Security First:** Critical vulnerability must be fixed immediately before audit
2. **Task 02 - Reliability Second:** Prevent revenue loss from stuck payments
3. **Task 03 - Token Foundation:** Capture tokens while fixing webhooks
4. **Task 04 - Storage Layer:** Required for token persistence
5. **Task 05 - API Layer:** Expose payment methods to frontend
6. **Task 06 - User Experience:** Complete the feature with UI

## Success Metrics

- [ ] **Security:** Zero webhook signature verification bypasses in production
- [ ] **Reliability:** 100% payment status resolution within 5 minutes
- [ ] **Token Capture:** >95% capture rate for successful card payments
- [ ] **Adoption:** >30% of repeat customers use saved payment methods within 30 days
- [ ] **Support:** 50% reduction in payment-related support tickets
- [ ] **Performance:** <100ms added latency for payment verification

## Cross-Agent Communication

### For ludora-architecture Agent
- Review database schema design in Task 04 for consistency
- Validate API design patterns in Task 05 match system architecture
- Ensure caching strategy follows data-driven patterns

### For ludora-security Agent
- Audit webhook signature implementation for vulnerabilities
- Review token encryption approach for PCI compliance
- Validate access controls on payment method APIs

### For ludora-testing Agent
- Create comprehensive test suite for webhook signatures
- Test polling edge cases and race conditions
- Validate token capture across payment types
- Load test polling service for scale

### For ludora-frontend Agent
- Implement UI components in Task 06
- Ensure consistent UX with existing payment flow
- Add payment method selection to checkout

### For ludora-backend Agent
- Implement core webhook and polling logic
- Create PayPlus service abstractions
- Handle error scenarios gracefully

## Lessons Learned

- **Always investigate commented security code** - Often indicates unresolved issues
- **Webhook-only systems need fallbacks** - Single point of failure is unacceptable
- **Token capture should be day-one feature** - Retrofit is more complex
- **Payment logs are critical** - webhook_logs table helped investigation
- **Documentation prevents confusion** - PayPlus docs clarified capabilities

## Critical Warnings & Notes

⚠️ **CRITICAL:** Do not deploy Task 01 without extensive PayPlus sandbox testing - signature verification failure will break ALL payments

⚠️ **IMPORTANT:** Task 02 polling must implement idempotency - prevent double charges from race conditions

⚠️ **SECURITY:** All payment tokens must be encrypted using AES-256 before database storage

⚠️ **TESTING:** PayPlus provides sandbox environment - use for ALL development: https://sandbox.payplus.co.il/

⚠️ **COORDINATION:** Notify support team before production deployment - they need updated troubleshooting guides

⚠️ **MONITORING:** Add alerting for signature verification failures and polling service health

## Environment Variables Required

```bash
# Existing (verify these exist)
PAYPLUS_API_KEY=<production_key>
PAYPLUS_SECRET_KEY=<production_secret>
PAYPLUS_STAGING_API_KEY=<sandbox_key>
PAYPLUS_STAGING_SECRET_KEY=<sandbox_secret>

# New (to be added)
PAYPLUS_POLLING_ENABLED=true
PAYPLUS_POLLING_INTERVAL_MS=30000
PAYPLUS_POLLING_MAX_ATTEMPTS=10
PAYMENT_TOKEN_ENCRYPTION_KEY=<32-byte-key>
```

## Next Steps

1. **Immediate:** Review and approve all task documentation
2. **Day 1:** Begin Task 01 (webhook security) with sandbox testing
3. **Day 1-2:** Deploy Task 01 to staging after validation
4. **Day 2:** Start Task 02 (polling) in parallel with Task 01 staging tests
5. **Day 3+:** Sequential implementation of Tasks 03-06
6. **Week 2:** Production deployment with monitoring

## Project Files

- [Task 01: Webhook Security](./task-01-webhook-security.md)
- [Task 02: Payment Polling](./task-02-payment-polling.md)
- [Task 03: Token Capture](./task-03-token-capture.md)
- [Task 04: Database Schema](./task-04-database-schema.md)
- [Task 05: API Endpoints](./task-05-api-endpoints.md)
- [Task 06: Frontend UI](./task-06-frontend-ui.md)
- [Investigation Report](./investigation-report.md)