# Task 02: Payment Status Polling Implementation

## Task Header

**Task ID:** 02
**Title:** Payment Status Polling Implementation
**Priority Level:** HIGH (Reliability Enhancement)
**Estimated Time:** 4-5 hours AI work time
**Dependencies:** None (can run parallel with Task 01)
**Status:** Not Started

## Context Section

### Why This Task Is Needed

Current payment system relies 100% on webhooks with no fallback mechanism. Investigation revealed:
- PayPlus webhooks occasionally fail without retry
- Network issues can prevent webhook delivery
- No way to recover stuck "pending" payments
- Support manually checks 3-5 failed payments weekly
- Single point of failure causes revenue loss

### Current State Analysis

```javascript
// Current flow (webhook only):
Payment Created → Webhook Expected → If webhook fails → Payment stuck "pending" forever

// Desired flow (dual verification):
Payment Created → Webhook (primary) + PayPlus iframe events
                ↓ If webhook fails
                → Polling (fallback) → Payment resolved
                → After 10 failed polls → Mark abandoned + Email support
```

Currently no polling mechanism exists. PayPlus provides status endpoint but requires API documentation research.

### Expected Outcomes

1. **Primary:** Webhook-based payment processing (existing)
2. **Secondary:** Polling as fallback for missed webhooks
3. **Abandonment handling:** Email support after 10 failed polls
4. **Status tracking:** Proper transitions from cart → pending → completed/abandoned
5. **Complete audit trail** of resolution method

### Success Criteria

- [ ] 100% payment resolution or abandonment within 10 polling attempts
- [ ] Zero duplicate payment processing
- [ ] Support notified of abandoned transactions via email
- [ ] Pending purchases show "ממתין לאישור תשלום" in UI
- [ ] Pending purchases are non-deletable in cart
- [ ] Clear logging of resolution method

## Implementation Details

### Step-by-Step Implementation Plan

#### Step 1: Update PaymentModal to Use Documented PayPlus Events

```javascript
// /ludora-front/src/components/PaymentModal.jsx
// REPLACE custom 'payplus_payment_complete' event with documented events

useEffect(() => {
  const handlePayPlusMessage = async (event) => {
    if (event.origin !== PAYPLUS_IFRAME_ORIGIN) return;

    const { data } = event;

    // Handle documented PayPlus events
    switch (data.event || data.type) {
      case 'pp_submitProcess':
        if (data.value === true) {
          // Payment submission started
          // TODO remove debug - payment status polling
          console.log('Payment submission detected');

          // Update transaction status from 'cart' to 'pending'
          await updateTransactionStatus(transactionId, 'pending');
        }
        break;

      case 'pp_responseFromServer':
        // Transaction completed (success or failure)
        // TODO remove debug - payment status polling
        console.log('PayPlus response:', data);

        // Redirect to result page - let backend handle status via webhook/polling
        window.location.href = `/payment-result?transaction_id=${transactionId}`;
        break;

      case 'pp_paymentPageKilled':
      case 'pp_pageExpired':
        // Payment page closed or expired
        // Keep transaction in cart status
        setShowPaymentModal(false);
        showNotification('Payment cancelled', 'info');
        break;
    }
  };

  window.addEventListener('message', handlePayPlusMessage);
  return () => window.removeEventListener('message', handlePayPlusMessage);
}, [transactionId]);
```

#### Step 2: Create Frontend API Service for Status Updates

```javascript
// /ludora-front/src/services/PaymentService.js

export const updateTransactionStatus = async (transactionId, newStatus) => {
  try {
    const response = await apiCall('/api/payments/update-status', {
      method: 'POST',
      body: JSON.stringify({
        transaction_id: transactionId,
        status: newStatus
      })
    });

    return response.data;
  } catch (error) {
    console.error('Failed to update transaction status:', error);
    throw error;
  }
};

export const pollTransactionStatus = async (transactionId) => {
  try {
    const response = await apiCall(`/api/payments/transaction-status/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to poll transaction status:', error);
    throw error;
  }
};
```

#### Step 3: Update Backend to Handle Status Transitions

```javascript
// /ludora-api/routes/payments.js

// New endpoint to update transaction status (from frontend events)
router.post('/update-status', authenticateToken, async (req, res, next) => {
  const { transaction_id, status } = req.body;

  try {
    const purchase = await models.Purchase.findOne({
      where: {
        id: transaction_id,
        buyer_user_id: req.user.id
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Only allow cart → pending transition from frontend
    if (purchase.payment_status === 'cart' && status === 'pending') {
      await purchase.update({
        payment_status: 'pending',
        payment_metadata: {
          ...purchase.payment_metadata,
          pending_started_at: new Date(),
          pending_source: 'pp_submitProcess_event'
        }
      });

      // TODO remove debug - payment status polling
      clog(`Transaction ${transaction_id} moved to pending via iframe event`);
    }

    res.json({ success: true, status: purchase.payment_status });
  } catch (error) {
    next(error);
  }
});
```

#### Step 4: Create Polling Service with Abandonment Handling

```javascript
// /ludora-api/services/PaymentPollingService.js
const models = require('../models');
const { Op } = require('sequelize');
const EmailService = require('./EmailService');
const SettingsService = require('./SettingsService');
const clog = require('../utils/clog');
const cerror = require('../utils/cerror');

class PaymentPollingService {
  constructor() {
    this.pollingInterval = process.env.PAYPLUS_POLLING_INTERVAL_MS || 20000; // 20 seconds
    this.maxAttempts = 10; // After 10 attempts = abandon
    this.isRunning = false;
    this.pollingTimer = null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.pollPendingPayments();
    this.scheduleNextPoll();
  }

  stop() {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  scheduleNextPoll() {
    if (!this.isRunning) return;

    this.pollingTimer = setTimeout(async () => {
      await this.pollPendingPayments();
      this.scheduleNextPoll();
    }, this.pollingInterval);
  }

  async pollPendingPayments() {
    try {
      // TODO remove debug - payment status polling
      clog('Starting payment polling cycle');

      // Find ALL pending payments from last hour
      const pendingPurchases = await models.Purchase.findAll({
        where: {
          payment_status: 'pending',
          polling_attempts: {
            [Op.lt]: this.maxAttempts
          },
          created_at: {
            [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour only
          },
          payplus_transaction_uid: {
            [Op.not]: null
          }
        },
        order: [['created_at', 'ASC']]
      });

      // TODO remove debug - payment status polling
      clog(`Found ${pendingPurchases.length} pending payments to poll`);

      for (const purchase of pendingPurchases) {
        await this.pollSinglePayment(purchase);
      }

      // Handle abandoned payments (reached max attempts)
      await this.handleAbandonedPayments();

    } catch (error) {
      cerror('Payment polling cycle error:', error);
    }
  }

  async pollSinglePayment(purchase) {
    const transaction = await models.sequelize.transaction();

    try {
      // Check if payment was already processed (race condition prevention)
      const currentPurchase = await models.Purchase.findByPk(purchase.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (currentPurchase.payment_status !== 'pending') {
        // TODO remove debug - payment status polling
        clog(`Payment ${purchase.id} already processed, skipping`);
        await transaction.rollback();
        return;
      }

      // Update polling attempts
      await currentPurchase.update({
        polling_attempts: currentPurchase.polling_attempts + 1,
        last_polled_at: new Date()
      }, { transaction });

      // RESEARCH NEEDED: PayPlus API status check
      // Need to research PayPlus API documentation for:
      // 1. Status endpoint URL format
      // 2. Authentication method (API key headers)
      // 3. Response format and status values
      // 4. Rate limits and best practices

      // Placeholder for PayPlus status check
      const statusResult = await this.checkPayPlusStatus(currentPurchase.payplus_transaction_uid);

      if (statusResult && statusResult.status === 'completed') {
        await this.handleSuccessfulPayment(currentPurchase, statusResult, transaction);
      } else if (statusResult && (statusResult.status === 'failed' || statusResult.status === 'cancelled')) {
        await this.handleFailedPayment(currentPurchase, statusResult, transaction);
      }
      // If still pending or no response, will retry on next cycle

      await transaction.commit();

      // TODO remove debug - payment status polling
      clog(`Polling attempt ${currentPurchase.polling_attempts} for payment ${purchase.id}`);

    } catch (error) {
      await transaction.rollback();
      cerror(`Error polling payment ${purchase.id}:`, error);
    }
  }

  async checkPayPlusStatus(transactionUid) {
    // TODO: Research and implement PayPlus API status check
    // Need PayPlus API documentation for:
    // - Endpoint URL (likely /api/v1/transactions/status/{uid})
    // - Authentication headers
    // - Response format

    // TODO remove debug - payment status polling
    clog(`Would check PayPlus status for transaction: ${transactionUid}`);

    // For now, return null to indicate API not yet implemented
    return null;
  }

  async handleSuccessfulPayment(purchase, statusResult, transaction) {
    await purchase.update({
      payment_status: 'completed',
      resolution_method: 'polling',
      payment_metadata: {
        ...purchase.payment_metadata,
        polling_resolution: {
          resolved_at: new Date(),
          attempts: purchase.polling_attempts,
          payplus_status: statusResult.originalStatus
        }
      }
    }, { transaction });

    // Log resolution
    await models.webhook_log.create({
      source: 'payplus_polling',
      event_type: 'payment_completed_via_polling',
      payload: statusResult.raw || {},
      purchase_id: purchase.id,
      status: 'processed'
    }, { transaction });

    clog(`Payment ${purchase.id} successfully completed via polling after ${purchase.polling_attempts} attempts`);
  }

  async handleFailedPayment(purchase, statusResult, transaction) {
    // Failed/cancelled payments go back to cart status
    await purchase.update({
      payment_status: 'cart',
      resolution_method: 'polling',
      polling_attempts: 0, // Reset for potential retry
      payment_metadata: {
        ...purchase.payment_metadata,
        polling_resolution: {
          resolved_at: new Date(),
          failure_reason: statusResult.originalStatus,
          returned_to_cart: true
        }
      }
    }, { transaction });

    clog(`Payment ${purchase.id} returned to cart after failure via polling`);
  }

  async handleAbandonedPayments() {
    try {
      // Find payments that exceeded max polling attempts
      const abandonedPurchases = await models.Purchase.findAll({
        where: {
          payment_status: 'pending',
          polling_attempts: {
            [Op.gte]: this.maxAttempts
          }
        }
      });

      for (const purchase of abandonedPurchases) {
        await this.markAsAbandoned(purchase);
      }
    } catch (error) {
      cerror('Error handling abandoned payments:', error);
    }
  }

  async markAsAbandoned(purchase) {
    const transaction = await models.sequelize.transaction();

    try {
      // Update status to abandoned
      await purchase.update({
        payment_status: 'abandoned',
        resolution_method: 'abandoned_after_polling',
        payment_metadata: {
          ...purchase.payment_metadata,
          abandonment_details: {
            abandoned_at: new Date(),
            polling_attempts: purchase.polling_attempts,
            last_polled_at: purchase.last_polled_at,
            reason: 'exceeded_max_polling_attempts'
          }
        }
      }, { transaction });

      // Send email to support
      await this.sendAbandonmentEmail(purchase);

      await transaction.commit();

      clog(`Payment ${purchase.id} marked as abandoned after ${purchase.polling_attempts} failed attempts`);
    } catch (error) {
      await transaction.rollback();
      cerror(`Error marking payment ${purchase.id} as abandoned:`, error);
    }
  }

  async sendAbandonmentEmail(purchase) {
    try {
      // Get contact email from settings
      const contactEmailSetting = await SettingsService.get(['contact_email']);
      const contactEmail = contactEmailSetting?.contact_email || process.env.ADMIN_EMAIL;

      if (!contactEmail) {
        cerror('No contact email configured for abandoned payment notifications');
        return;
      }

      // Get buyer details
      const buyer = await models.User.findByPk(purchase.buyer_user_id);

      // Compose email
      const emailSubject = `Abandoned Payment Alert - Transaction ${purchase.id}`;
      const emailBody = `
        <h2>Abandoned Payment Detected</h2>
        <p>A payment transaction has been abandoned after exceeding maximum polling attempts.</p>

        <h3>Transaction Details:</h3>
        <ul>
          <li><strong>Transaction ID:</strong> ${purchase.id}</li>
          <li><strong>PayPlus UID:</strong> ${purchase.payplus_transaction_uid || 'N/A'}</li>
          <li><strong>Amount:</strong> ₪${purchase.total_amount}</li>
          <li><strong>Created:</strong> ${purchase.created_at}</li>
          <li><strong>Polling Attempts:</strong> ${purchase.polling_attempts}</li>
          <li><strong>Last Polled:</strong> ${purchase.last_polled_at || 'Never'}</li>
        </ul>

        <h3>Buyer Information:</h3>
        <ul>
          <li><strong>Name:</strong> ${buyer?.first_name} ${buyer?.last_name}</li>
          <li><strong>Email:</strong> ${buyer?.email}</li>
          <li><strong>User ID:</strong> ${buyer?.id}</li>
        </ul>

        <h3>Action Required:</h3>
        <p>Please investigate this transaction in the PayPlus dashboard and contact the customer if necessary.</p>

        <p><em>This is an automated message from the Ludora payment monitoring system.</em></p>
      `;

      // Send email using EmailService
      await EmailService.sendEmail({
        to: contactEmail,
        subject: emailSubject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });

      // TODO remove debug - payment status polling
      clog(`Abandonment email sent to ${contactEmail} for transaction ${purchase.id}`);
    } catch (error) {
      cerror(`Failed to send abandonment email for payment ${purchase.id}:`, error);
    }
  }
}

module.exports = PaymentPollingService;
```

#### Step 5: Update Purchase Model for Polling Support

```javascript
// /ludora-api/migrations/add-payment-polling-fields.js
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add polling tracking fields to Purchases table
    await queryInterface.addColumn('Purchases', 'polling_attempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('Purchases', 'last_polled_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Purchases', 'resolution_method', {
      type: Sequelize.ENUM('webhook', 'polling', 'manual', 'abandoned_after_polling'),
      allowNull: true
    });

    // Add index for efficient polling queries
    await queryInterface.addIndex('Purchases', ['payment_status', 'polling_attempts', 'created_at'], {
      name: 'idx_purchases_polling',
      where: {
        payment_status: 'pending'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Purchases', 'polling_attempts');
    await queryInterface.removeColumn('Purchases', 'last_polled_at');
    await queryInterface.removeColumn('Purchases', 'resolution_method');
    await queryInterface.removeIndex('Purchases', 'idx_purchases_polling');
  }
};
```

#### Step 6: Frontend UI Updates for Pending Purchases

```javascript
// /ludora-front/src/components/Cart.jsx
// Update to show pending status and prevent deletion

const CartItem = ({ item, onRemove, onQuantityChange }) => {
  const isPending = item.payment_status === 'pending';

  return (
    <div className={`cart-item ${isPending ? 'pending-payment' : ''}`}>
      <div className="item-details">
        <h4>{item.title}</h4>
        {isPending && (
          <div className="pending-badge">
            ממתין לאישור תשלום
          </div>
        )}
      </div>

      {!isPending && (
        <button onClick={() => onRemove(item.id)} className="remove-btn">
          הסר מהעגלה
        </button>
      )}
    </div>
  );
};

// /ludora-front/src/styles/cart.css
.pending-payment {
  opacity: 0.7;
  pointer-events: none;
}

.pending-badge {
  background: #ffa500;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 4px;
  display: inline-block;
}
```

#### Step 7: Add Polling Hooks to Key Pages

```javascript
// /ludora-front/src/pages/MyAccount.jsx
// Add polling for pending transactions

useEffect(() => {
  const checkPendingTransactions = async () => {
    const pendingTransactions = purchases.filter(p => p.payment_status === 'pending');

    for (const transaction of pendingTransactions) {
      try {
        const status = await pollTransactionStatus(transaction.id);
        if (status.payment_status !== 'pending') {
          // Refresh purchases list if status changed
          await fetchPurchases();
        }
      } catch (error) {
        console.error('Failed to poll transaction:', error);
      }
    }
  };

  // Check on mount and every 30 seconds
  checkPendingTransactions();
  const interval = setInterval(checkPendingTransactions, 30000);

  return () => clearInterval(interval);
}, [purchases]);
```

### Specific File Locations to Modify

1. `/ludora-api/services/PaymentPollingService.js` - New polling service with abandonment
2. `/ludora-api/routes/payments.js` - Add status update endpoint
3. `/ludora-api/models/Purchase.js` - Add polling fields
4. `/ludora-api/migrations/` - Add migration for new fields
5. `/ludora-api/app.js` - Initialize polling on startup
6. `/ludora-front/src/components/PaymentModal.jsx` - Use documented PayPlus events
7. `/ludora-front/src/services/PaymentService.js` - Add status update functions
8. `/ludora-front/src/components/Cart.jsx` - Show pending status, prevent deletion
9. `/ludora-front/src/pages/MyAccount.jsx` - Add polling hook

### Database Changes Required

```sql
-- Add to Purchases table
ALTER TABLE "Purchases" ADD COLUMN "polling_attempts" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "Purchases" ADD COLUMN "last_polled_at" TIMESTAMP;
ALTER TABLE "Purchases" ADD COLUMN "resolution_method" VARCHAR(30);

-- Update enum for payment_status to include 'abandoned'
ALTER TABLE "Purchases" ALTER COLUMN "payment_status" TYPE VARCHAR(20);
-- Then update to include: 'cart', 'pending', 'completed', 'failed', 'cancelled', 'abandoned'

-- Create index for efficient polling
CREATE INDEX idx_purchases_polling ON "Purchases"(payment_status, polling_attempts, created_at)
WHERE payment_status = 'pending';
```

### Configuration Changes Needed

```bash
# Add to environment variables
PAYPLUS_POLLING_ENABLED=true
PAYPLUS_POLLING_INTERVAL_MS=20000    # Poll every 20 seconds
```

## Technical Specifications

### Service Architecture

```
┌─────────────────────────────────┐
│   Payment Creation Flow         │
├─────────────────────────────────┤
│ 1. Create Purchase (cart)       │
│ 2. Open PayPlus iframe          │
│ 3. Detect pp_submitProcess      │
│ 4. Update status to pending     │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐    ┌──────────┐
│ Webhook  │    │ Polling  │
│ (Primary)│    │ (Backup) │
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             ▼
    ┌────────────────┐
    │ Update Status  │
    │ Send Emails    │
    │ Log Resolution │
    └────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌──────────┐    ┌───────────┐
│Completed │    │ Abandoned │
│(success) │    │(10 polls) │
└──────────┘    └─────┬─────┘
                      │
                      ▼
             ┌───────────────┐
             │Email Support  │
             │contact_email  │
             └───────────────┘
```

### PayPlus Event Integration

```javascript
// Documented PayPlus iframe events to implement:
{
  'pp_submitProcess': boolean,        // true = payment submission started
  'pp_responseFromServer': object,    // Transaction result (success/failure)
  'pp_paymentPageKilled': boolean,    // User closed payment page
  'pp_pageExpired': boolean           // Payment page expired
}
```

### Status Transition Flow

```
cart (initial)
  ↓ [pp_submitProcess event]
pending (payment in progress)
  ↓ [webhook or polling success]
completed (success)

pending (payment in progress)
  ↓ [webhook or polling failure]
cart (returned for retry)

pending (payment in progress)
  ↓ [10 failed polling attempts]
abandoned (support notified)
```

## Research Requirements

### PayPlus API Documentation Needed

Before full implementation, research needed for:

1. **Status Check Endpoint:**
   - Exact URL format (likely `/api/v1/transactions/status/{uid}`)
   - Authentication method (Bearer token vs API key header)
   - Request/response format

2. **Response Format:**
   - Status field names and possible values
   - How to detect completed vs failed transactions
   - Additional metadata available

3. **API Limits:**
   - Rate limiting constraints
   - Recommended polling frequency
   - Bulk status check availability

4. **Error Handling:**
   - Error response formats
   - Retry recommendations
   - Timeout handling

### Integration Points Research

1. **EmailService verification:**
   - Confirmed: `/services/EmailService.js` exists
   - Method: `EmailService.sendEmail(options)`
   - Required fields: to, subject, html, text

2. **Settings Service:**
   - Confirmed: `contact_email` setting exists
   - Access via: `SettingsService.get(['contact_email'])`

3. **PayPlus iframe events:**
   - Confirmed documented events from PayPlus
   - Need to replace custom events in PaymentModal

## Dependencies and Integration

### Prerequisites

- Research PayPlus API documentation for status endpoint
- Verify EmailService functionality
- Confirm contact_email setting is configured
- Test PayPlus iframe events in sandbox

### Other Systems Affected

1. **Webhook Processing:** Must coordinate to prevent duplicates
2. **Email Service:** Send abandonment notifications
3. **Frontend Cart:** Display pending status correctly
4. **Support Dashboard:** Show abandoned transactions

## Testing and Validation

### Unit Test Requirements

```javascript
// /ludora-api/tests/unit/services/PaymentPollingService.test.js
describe('Payment Polling Service', () => {
  test('polls all pending payments from last hour', async () => {
    // Create multiple pending purchases
    // Run polling cycle
    // Verify all are checked
  });

  test('marks payment as abandoned after 10 attempts', async () => {
    // Create payment with 10 attempts
    // Run abandonment check
    // Verify status = abandoned
    // Verify email sent
  });

  test('returns failed payment to cart status', async () => {
    // Mock failed PayPlus response
    // Verify status returns to cart
    // Verify polling attempts reset
  });

  test('sends abandonment email with correct details', async () => {
    // Mock EmailService
    // Trigger abandonment
    // Verify email content and recipient
  });
});
```

### Manual Testing Steps

1. **PayPlus Event Testing:**
   - [ ] Open payment modal
   - [ ] Monitor browser console for pp_submitProcess event
   - [ ] Verify status changes to pending
   - [ ] Complete/cancel payment
   - [ ] Verify pp_responseFromServer event fires

2. **Polling Cycle Testing:**
   - [ ] Create pending payment
   - [ ] Block webhook (firewall/ngrok)
   - [ ] Wait for polling cycles
   - [ ] Verify status resolution

3. **Abandonment Testing:**
   - [ ] Create stuck pending payment
   - [ ] Let 10 polling cycles pass
   - [ ] Verify abandonment email sent
   - [ ] Check email contains transaction details

## Completion Checklist

### Implementation
- [ ] Replace custom PayPlus events with documented ones
- [ ] Create PaymentPollingService with abandonment handling
- [ ] Add status update endpoint
- [ ] Implement abandonment email system
- [ ] Add database migration for new fields
- [ ] Update frontend to show pending status

### Testing
- [ ] Test PayPlus iframe events
- [ ] Test polling for all pending transactions
- [ ] Test abandonment after 10 attempts
- [ ] Test email notifications
- [ ] Test status transitions
- [ ] Verify no duplicate processing

### Research & Documentation
- [ ] Research PayPlus API status endpoint
- [ ] Document status transition flow
- [ ] Update API documentation
- [ ] Brief support team on abandonment emails

### Deployment
- [ ] Configure environment variables
- [ ] Run database migration
- [ ] Test in staging environment
- [ ] Monitor first 24 hours in production

## Notes for Implementation

1. **Critical:** Replace ALL custom PayPlus events with documented ones
2. **Polling:** Poll ALL pending transactions, not just most recent
3. **UI:** Pending purchases must show "ממתין לאישור תשלום"
4. **Email:** Use existing EmailService and contact_email setting
5. **Research:** PayPlus API documentation needed before full implementation
6. **Testing:** Thoroughly test abandonment email flow