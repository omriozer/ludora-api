# Task 03: Token Capture System - Simplified Single Table Approach

## Task Header

**Task ID:** 03
**Title:** Token Capture System with Single PaymentMethod Table
**Priority Level:** HIGH (Foundation for saved payment methods)
**Estimated Time:** 2-3 hours AI work time (simplified from 3-4)
**Dependencies:** Task 01 (Webhook Security) should be complete
**Status:** Not Started

## Context Section

### Why This Task Is Needed

Investigation revealed PayPlus sends payment tokens in webhook responses for successful card payments, but we're not capturing them. These tokens enable:
- One-click repeat purchases WITHOUT opening PayPlus page
- Subscription billing via direct token charging
- Saved payment methods with popup confirmation
- Reduced checkout friction for teachers
- Higher conversion rates for returning customers

Without token capture, teachers must re-enter payment details for every purchase, causing cart abandonment.

### Current State Analysis

```javascript
// Current webhook handler (tokens ignored):
async function handlePayPlusWebhook(payload) {
  const purchase = await findPurchase(payload.transaction_uid);
  purchase.payment_status = 'completed';
  await purchase.save();
  // Token in payload.token is completely ignored!
}

// PayPlus sends this in webhook:
{
  "transaction": {
    "uid": "trans_123",
    "status": "approved",
    "token": "tok_abc123def456", // <-- We're not capturing this!
    "card_last_4": "4242",
    "card_brand": "visa"
  }
}
```

### Expected Outcomes

1. All payment tokens automatically captured and saved WITHOUT user permission
2. Simple single PaymentMethod table (NO PaymentMethodUsage table)
3. Transaction table updated with payment_method_id field
4. Direct token charging via PayPlus API (no payment page needed)
5. Popup confirmation for existing payment methods

### Success Criteria

- [ ] >95% token capture rate for card payments
- [ ] Tokens automatically saved to PaymentMethod table without user permission
- [ ] Transaction table includes payment_method_id field
- [ ] PayPlus direct token charging API integrated
- [ ] Popup confirmation system for existing payment methods
- [ ] TODO comment added for user notification (implementation skipped)

## Implementation Details

### CRITICAL REQUIREMENTS:

**1. SINGLE TABLE APPROACH:**
- Only ONE table: PaymentMethod
- NO PaymentMethodUsage table
- Just add payment_method_id to Transaction table

**2. PAYMENT FLOW - Users WITHOUT saved payment method:**
- Checkout → PayPlus page opens
- User completes payment
- Backend extracts token from webhook automatically
- Token saved WITHOUT asking permission
- Add TODO comment: "implement notifying user about new payment method"

**3. PAYMENT FLOW - Users WITH saved payment method:**
- Checkout → Popup INSTEAD of PayPlus page:
  ```
  כרטיסך המסתיים בספרות XXXX יחוייב בסך X ש״ח. האם לחייב?

  [כן, אני מאשר]  [לא, השתמש בכרטיס אחר]
  ```
- "כן, אני מאשר" → Direct charge via PayPlus token API (no payment page)
- "לא, השתמש בכרטיס אחר" → Opens PayPlus page, saves new token (keeps ALL old tokens)

**4. TOKEN MANAGEMENT:**
- Keep ALL tokens when new ones are saved (no deletion)
- Default selection: Most recent token OR user-selected default (is_default field)
- Account page reference: Use `nav_account_text` setting (defaults to 'החשבון שלי')

### Step-by-Step Implementation Plan

#### Step 1: Research PayPlus Token Charging API

**PRIORITY RESEARCH:**
1. PayPlus Direct Token Charging API endpoint
2. Token charge request format
3. Token validation endpoint
4. Token metadata available in webhook responses

```javascript
// Research needed: PayPlus Token Charging API
// Expected endpoint: POST /api/v1/charge_with_token
{
  "token": "tok_abc123",           // Saved payment token
  "amount": 10000,                 // Amount in cents
  "currency": "ILS",
  "transaction_type": "charge",
  "customer": {
    "email": "teacher@school.edu"
  }
}

// Research needed: Token in webhook response
{
  "transaction": {
    "uid": "trans_123",
    "status": "approved",
    "token": "tok_abc123def456",    // Payment token for reuse
    "card": {
      "last_4": "4242",
      "brand": "visa",
      "exp_month": 12,
      "exp_year": 2025
    }
  }
}
```

#### Step 2: Create Single PaymentMethod Table

```sql
-- Create PaymentMethod table (SINGLE TABLE ONLY)
CREATE TABLE "PaymentMethods" (
  id VARCHAR(255) PRIMARY KEY DEFAULT ('pm_' || generate_ulid()),
  user_id VARCHAR(255) NOT NULL REFERENCES "Users"(id),
  payplus_token VARCHAR(500) NOT NULL,
  card_last4 VARCHAR(4) NOT NULL,
  card_brand VARCHAR(50) NOT NULL,
  card_expiry_month INTEGER,
  card_expiry_year INTEGER,
  card_holder_name VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,  -- For default selection
  is_active BOOLEAN DEFAULT TRUE,     -- For soft deletion
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for user queries
CREATE INDEX idx_payment_methods_user ON "PaymentMethods"(user_id, is_active);

-- Add payment_method_id to Transaction table
ALTER TABLE "Transactions"
ADD COLUMN payment_method_id VARCHAR(255)
REFERENCES "PaymentMethods"(id);
```

#### Step 3: Create PaymentMethod Model

```javascript
// /ludora-api/models/PaymentMethod.js
module.exports = (sequelize, DataTypes) => {
  const PaymentMethod = sequelize.define('PaymentMethod', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => 'pm_' + generateULID()
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    payplus_token: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    card_last4: {
      type: DataTypes.STRING(4),
      allowNull: false
    },
    card_brand: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    card_expiry_month: {
      type: DataTypes.INTEGER
    },
    card_expiry_year: {
      type: DataTypes.INTEGER
    },
    card_holder_name: {
      type: DataTypes.STRING
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  PaymentMethod.associate = (models) => {
    PaymentMethod.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    PaymentMethod.hasMany(models.Transaction, {
      foreignKey: 'payment_method_id',
      as: 'transactions'
    });
  };

  return PaymentMethod;
};
```

#### Step 4: Create Token Extraction and Storage Service

```javascript
// /ludora-api/services/PaymentTokenService.js
const clog = require('../utils/clog');
const models = require('../models');

class PaymentTokenService {
  /**
   * Extracts and automatically saves payment token WITHOUT user permission
   * @param {Object} payplusPayload - Raw PayPlus response
   * @param {String} userId - User ID to save token for
   * @param {Object} transaction - Database transaction
   * @returns {Object|null} Created PaymentMethod or null
   */
  async extractAndSaveToken(payplusPayload, userId, transaction) {
    try {
      // TODO remove debug - token capture system
      clog('Extracting payment token from PayPlus response');

      // Multiple possible token locations based on PayPlus format
      const token =
        payplusPayload?.payment_method?.token ||
        payplusPayload?.token ||
        payplusPayload?.transaction?.token ||
        payplusPayload?.card_token;

      if (!token) {
        // TODO remove debug - token capture system
        clog('No payment token found in response');
        return null;
      }

      // Extract card metadata
      const cardInfo = this.extractCardInfo(payplusPayload);

      // Check if token already exists for this user
      const existingMethod = await models.PaymentMethod.findOne({
        where: {
          user_id: userId,
          payplus_token: token,
          is_active: true
        },
        transaction
      });

      if (existingMethod) {
        // TODO remove debug - token capture system
        clog('Token already exists for user');
        return existingMethod;
      }

      // Automatically save WITHOUT asking permission
      const paymentMethod = await models.PaymentMethod.create({
        user_id: userId,
        payplus_token: token,
        card_last4: cardInfo.last4,
        card_brand: cardInfo.brand,
        card_expiry_month: cardInfo.expMonth,
        card_expiry_year: cardInfo.expYear,
        card_holder_name: cardInfo.holderName,
        is_default: false // Will be set to default if it's the first method
      }, { transaction });

      // If this is the user's first payment method, make it default
      const methodCount = await models.PaymentMethod.count({
        where: { user_id: userId, is_active: true },
        transaction
      });

      if (methodCount === 1) {
        await paymentMethod.update({ is_default: true }, { transaction });
      }

      // TODO: implement notifying user about new payment method
      // This should send an email/notification that a payment method was saved
      // for their convenience on future purchases

      // TODO remove debug - token capture system
      clog('Token saved successfully', {
        last4: paymentMethod.card_last4,
        brand: paymentMethod.card_brand
      });

      return paymentMethod;

    } catch (error) {
      cerror('Error extracting payment token:', error);
      return null;
    }
  }

  /**
   * Extracts card information from various payload formats
   */
  extractCardInfo(payload) {
    const card =
      payload?.payment_method?.card ||
      payload?.card ||
      payload?.transaction?.card ||
      {};

    return {
      last4: card.last_4 || card.last4 || card.last_four,
      brand: this.normalizeBrand(card.brand || card.type),
      expMonth: card.exp_month || card.expiry_month,
      expYear: card.exp_year || card.expiry_year,
      holderName: card.holder_name || card.name || payload?.customer?.name
    };
  }

  /**
   * Normalizes card brand names
   */
  normalizeBrand(brand) {
    if (!brand) return 'unknown';
    const brandMap = {
      'visa': 'visa',
      'mastercard': 'mastercard',
      'master': 'mastercard',
      'amex': 'amex',
      'american_express': 'amex'
    };
    return brandMap[brand.toLowerCase()] || brand.toLowerCase();
  }

  /**
   * Gets user's default payment method
   */
  async getUserDefaultPaymentMethod(userId, transaction) {
    // First try to find explicitly marked default
    let defaultMethod = await models.PaymentMethod.findOne({
      where: { user_id: userId, is_default: true, is_active: true },
      transaction
    });

    // If no default, use most recent
    if (!defaultMethod) {
      defaultMethod = await models.PaymentMethod.findOne({
        where: { user_id: userId, is_active: true },
        order: [['created_at', 'DESC']],
        transaction
      });
    }

    return defaultMethod;
  }
}

module.exports = PaymentTokenService;
```

#### Step 5: Create PayPlus Token Charging Service

```javascript
// /ludora-api/services/PayPlusTokenChargeService.js
const axios = require('axios');
const clog = require('../utils/clog');

class PayPlusTokenChargeService {
  constructor() {
    this.apiKey = process.env.NODE_ENV === 'production'
      ? process.env.PAYPLUS_API_KEY
      : process.env.PAYPLUS_STAGING_API_KEY;

    this.secretKey = process.env.NODE_ENV === 'production'
      ? process.env.PAYPLUS_SECRET_KEY
      : process.env.PAYPLUS_STAGING_SECRET_KEY;

    this.baseURL = process.env.NODE_ENV === 'production'
      ? 'https://api.payplus.co.il'
      : 'https://sandbox.payplus.co.il';
  }

  /**
   * Charges a saved payment token directly WITHOUT opening payment page
   * @param {Object} params - Charge parameters
   * @returns {Object} Charge result
   */
  async chargeToken(params) {
    try {
      const {
        token,
        amount,
        currency = 'ILS',
        customerEmail,
        customerName,
        description
      } = params;

      // TODO: Research exact PayPlus API endpoint and format
      const chargeRequest = {
        api_key: this.apiKey,
        secret_key: this.secretKey,
        payment_token: token,
        amount: amount,
        currency: currency,
        customer: {
          email: customerEmail,
          name: customerName
        },
        description: description || 'Ludora Purchase'
      };

      // TODO remove debug - token capture system
      clog('Charging saved payment token', {
        amount,
        currency,
        tokenMasked: token.substring(0, 4) + '****'
      });

      // TODO: Verify actual PayPlus endpoint for token charges
      const response = await axios.post(
        `${this.baseURL}/api/v1/payments/charge_token`,
        chargeRequest
      );

      if (response.data.status === 'approved') {
        return {
          success: true,
          transactionId: response.data.transaction_uid,
          amount: response.data.amount,
          status: response.data.status
        };
      }

      return {
        success: false,
        error: response.data.error || 'Charge failed'
      };

    } catch (error) {
      cerror('Token charge failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PayPlusTokenChargeService;
```

#### Step 6: Update Webhook Handler for Automatic Token Capture

```javascript
// /ludora-api/routes/webhooks.js (update existing)
const PaymentTokenService = require('../services/PaymentTokenService');
const tokenService = new PaymentTokenService();

router.post('/payplus', async (req, res) => {
  const transaction = await models.sequelize.transaction();

  try {
    // ... existing signature verification ...

    const webhookData = req.body;
    const transactionUid = webhookData.transaction?.uid;

    // Find associated purchase
    const purchase = await models.Purchase.findOne({
      where: { payplus_transaction_uid: transactionUid },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // AUTOMATICALLY extract and save token WITHOUT permission
    const paymentMethod = await tokenService.extractAndSaveToken(
      webhookData,
      purchase.buyer_user_id,
      transaction
    );

    // Update purchase with payment completion
    const updateData = {
      payment_status: 'completed',
      resolution_method: 'webhook',
      last_updated: new Date()
    };

    await purchase.update(updateData, { transaction });

    // Link transaction to payment method if token was saved
    if (paymentMethod) {
      await models.Transaction.update(
        { payment_method_id: paymentMethod.id },
        {
          where: { purchase_id: purchase.id },
          transaction
        }
      );

      // TODO remove debug - token capture system
      clog(`Token automatically saved for user ${purchase.buyer_user_id}`, {
        last4: paymentMethod.card_last4,
        brand: paymentMethod.card_brand
      });
    }

    await transaction.commit();
    res.json({ success: true });

  } catch (error) {
    await transaction.rollback();
    cerror('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

#### Step 7: Create Frontend Popup for Existing Payment Methods

```javascript
// /ludora-front/components/PaymentConfirmationPopup.jsx
import React from 'react';
import { useSettings } from '../hooks/useSettings';

const PaymentConfirmationPopup = ({
  paymentMethod,
  amount,
  onConfirm,
  onUseNewCard
}) => {
  const settings = useSettings();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 text-right">
        <h3 className="text-xl font-semibold mb-4">אישור תשלום</h3>

        <div className="mb-6 p-4 bg-gray-50 rounded">
          <p className="text-lg">
            כרטיסך המסתיים בספרות {paymentMethod.card_last4} יחוייב בסך {amount} ש״ח.
            האם לחייב?
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {paymentMethod.card_brand.toUpperCase()} •••• {paymentMethod.card_last4}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            כן, אני מאשר
          </button>

          <button
            onClick={onUseNewCard}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            לא, השתמש בכרטיס אחר
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          ניתן לנהל את אמצעי התשלום שלך בעמוד {settings.nav_account_text || 'החשבון שלי'}
        </p>
      </div>
    </div>
  );
};

export default PaymentConfirmationPopup;
```

#### Step 8: Update Checkout Flow to Check for Saved Payment Methods

```javascript
// /ludora-front/services/CheckoutService.js
class CheckoutService {
  async initiateCheckout(cartItems, userId) {
    try {
      // Check if user has saved payment methods
      const paymentMethods = await api.get('/api/payment-methods');

      if (paymentMethods.length > 0) {
        // User HAS saved payment method - show popup INSTEAD of PayPlus page
        const defaultMethod = paymentMethods.find(m => m.is_default) || paymentMethods[0];
        const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);

        return {
          hasSavedMethod: true,
          paymentMethod: defaultMethod,
          amount: totalAmount,
          requiresPopup: true
        };
      } else {
        // User has NO saved payment method - proceed to PayPlus page
        const paymentPage = await api.post('/api/payments/createPayplusPaymentPage', {
          items: cartItems
        });

        return {
          hasSavedMethod: false,
          paymentPageUrl: paymentPage.payment_page_link,
          requiresPopup: false
        };
      }
    } catch (error) {
      console.error('Checkout error:', error);
      throw error;
    }
  }

  async chargeWithToken(paymentMethodId, cartItems) {
    try {
      const response = await api.post('/api/payments/charge-token', {
        payment_method_id: paymentMethodId,
        items: cartItems
      });

      return response;
    } catch (error) {
      console.error('Token charge error:', error);
      throw error;
    }
  }
}
```

#### Step 9: Create API Endpoints for Payment Methods

```javascript
// /ludora-api/routes/payment-methods.js (new file)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const PaymentTokenService = require('../services/PaymentTokenService');
const PayPlusTokenChargeService = require('../services/PayPlusTokenChargeService');

const tokenService = new PaymentTokenService();
const chargeService = new PayPlusTokenChargeService();

// Get user's saved payment methods
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const methods = await models.PaymentMethod.findAll({
      where: {
        user_id: req.user.id,
        is_active: true
      },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    res.json(methods);
  } catch (error) {
    cerror('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Set default payment method
router.put('/payment-methods/:id/set-default', authenticateToken, async (req, res) => {
  const transaction = await models.sequelize.transaction();

  try {
    // Remove default from all user's methods
    await models.PaymentMethod.update(
      { is_default: false },
      {
        where: { user_id: req.user.id },
        transaction
      }
    );

    // Set new default
    await models.PaymentMethod.update(
      { is_default: true },
      {
        where: {
          id: req.params.id,
          user_id: req.user.id,
          is_active: true
        },
        transaction
      }
    );

    await transaction.commit();
    res.json({ success: true });

  } catch (error) {
    await transaction.rollback();
    cerror('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to update default payment method' });
  }
});

// Charge using saved payment token
router.post('/payments/charge-token', authenticateToken, async (req, res) => {
  const transaction = await models.sequelize.transaction();

  try {
    const { payment_method_id, items } = req.body;

    // Verify payment method belongs to user
    const paymentMethod = await models.PaymentMethod.findOne({
      where: {
        id: payment_method_id,
        user_id: req.user.id,
        is_active: true
      },
      transaction
    });

    if (!paymentMethod) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Calculate total
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Charge the token directly (no payment page)
    const chargeResult = await chargeService.chargeToken({
      token: paymentMethod.payplus_token,
      amount: total * 100, // Convert to cents
      customerEmail: req.user.email,
      customerName: req.user.name,
      description: `Ludora purchase - ${items.length} items`
    });

    if (chargeResult.success) {
      // Create purchase record
      const purchase = await models.Purchase.create({
        buyer_user_id: req.user.id,
        payment_status: 'completed',
        payment_method: 'saved_card',
        payplus_transaction_uid: chargeResult.transactionId,
        total_amount: total,
        items: items
      }, { transaction });

      // Link transaction to payment method
      await models.Transaction.create({
        purchase_id: purchase.id,
        payment_method_id: paymentMethod.id,
        amount: total,
        status: 'completed'
      }, { transaction });

      await transaction.commit();

      res.json({
        success: true,
        purchase_id: purchase.id,
        transaction_id: chargeResult.transactionId
      });

    } else {
      await transaction.rollback();
      res.status(400).json({
        error: 'Payment failed',
        details: chargeResult.error
      });
    }

  } catch (error) {
    await transaction.rollback();
    cerror('Token charge error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

module.exports = router;
```

### Specific File Locations to Modify

1. **New Files:**
   - `/ludora-api/models/PaymentMethod.js` - PaymentMethod model
   - `/ludora-api/services/PaymentTokenService.js` - Token extraction and storage
   - `/ludora-api/services/PayPlusTokenChargeService.js` - Direct token charging
   - `/ludora-api/routes/payment-methods.js` - Payment method API endpoints
   - `/ludora-front/components/PaymentConfirmationPopup.jsx` - Checkout popup

2. **Modified Files:**
   - `/ludora-api/routes/webhooks.js` - Add automatic token capture
   - `/ludora-api/models/Transaction.js` - Add payment_method_id field
   - `/ludora-front/services/CheckoutService.js` - Check for saved methods

### Database Migration Required

```javascript
// /ludora-api/migrations/YYYYMMDD-create-payment-methods-table.js
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create SINGLE PaymentMethod table
    await queryInterface.createTable('PaymentMethods', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        defaultValue: Sequelize.literal("'pm_' || generate_ulid()")
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      payplus_token: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      card_last4: {
        type: Sequelize.STRING(4),
        allowNull: false
      },
      card_brand: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      card_expiry_month: Sequelize.INTEGER,
      card_expiry_year: Sequelize.INTEGER,
      card_holder_name: Sequelize.STRING,
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add index for user queries
    await queryInterface.addIndex('PaymentMethods', ['user_id', 'is_active']);

    // Add payment_method_id to Transaction table
    await queryInterface.addColumn('Transactions', 'payment_method_id', {
      type: Sequelize.STRING,
      references: { model: 'PaymentMethods', key: 'id' }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Transactions', 'payment_method_id');
    await queryInterface.dropTable('PaymentMethods');
  }
};
```

## Technical Specifications

### Simplified Payment Flow Diagrams

```
USER WITHOUT SAVED PAYMENT METHOD:
User Checkout → PayPlus Page → Payment Complete → Webhook
                                                      ↓
                                    Auto-Save Token (NO permission)
                                                      ↓
                                    PaymentMethod Created
                                                      ↓
                              TODO: Notify user (implementation skipped)

USER WITH SAVED PAYMENT METHOD:
User Checkout → Check PaymentMethods → Show Popup
                                           ↓
                     ┌────────────────────────────────────┐
                     │  "כרטיסך XXXX יחוייב בסך X ש״ח"  │
                     │  [כן, אני מאשר] [כרטיס אחר]      │
                     └────────────────────────────────────┘
                                ↓                    ↓
                        Direct Token Charge    PayPlus Page
                        (No payment page)      (New token saved)
```

### Database Schema (SINGLE TABLE ONLY)

```javascript
// PaymentMethod table - THE ONLY TABLE
{
  id: 'pm_123',
  user_id: 'user_456',
  payplus_token: 'tok_abc123',
  card_last4: '4242',
  card_brand: 'visa',
  card_expiry_month: 12,
  card_expiry_year: 2025,
  card_holder_name: 'John Doe',
  is_default: true,   // User-selected or first method
  is_active: true,     // Soft deletion
  created_at: Date,
  updated_at: Date
}

// Transaction table - just add this field:
{
  // ... existing fields ...
  payment_method_id: 'pm_123'  // References PaymentMethod.id
}
```

### Security Requirements

1. **Token Protection:**
   - Never log full tokens (mask as tok_****f456)
   - Store tokens only in PaymentMethod table
   - No token exposure in API responses

2. **Access Control:**
   - Payment methods only accessible to owner
   - Admin access requires audit logging
   - Token charging requires ownership verification

3. **Automatic Saving:**
   - Tokens saved WITHOUT user permission
   - TODO comment for future notification implementation

## Dependencies and Integration

### Prerequisites

- Task 01 complete (webhook security)
- PayPlus API documentation for:
  - Token structure in webhook responses
  - Direct token charging endpoint
  - Token validation methods

### PayPlus API Research Required

1. **Token Charging API:**
   - Endpoint URL for direct token charges
   - Required parameters and authentication
   - Response format for successful/failed charges

2. **Token Metadata:**
   - Exact fields available in webhook response
   - Token expiration handling
   - Token validation endpoints

### Integration Points

- PayPlus webhook payload (automatic token extraction)
- New PaymentMethod table
- Transaction table (add payment_method_id)
- Frontend popup component
- Checkout flow modification

### NO Breaking Changes

- All changes are additive
- Tokens saved automatically (no user action required)
- Existing payment flows continue working

## Testing and Validation

### Manual Testing Steps

1. **First-time User Flow:**
   - [ ] Complete purchase via PayPlus page
   - [ ] Verify token automatically saved to PaymentMethod table
   - [ ] Check is_default set to true for first method
   - [ ] Confirm TODO comment present for notification

2. **Returning User Flow:**
   - [ ] Initiate checkout with saved payment method
   - [ ] Verify popup appears INSTEAD of PayPlus page
   - [ ] Test "כן, אני מאשר" - direct charge works
   - [ ] Test "לא, השתמש בכרטיס אחר" - PayPlus page opens
   - [ ] Verify ALL tokens kept (no deletion)

3. **Token Management:**
   - [ ] Verify default payment method selection logic
   - [ ] Test setting different default method
   - [ ] Check `nav_account_text` setting used in popup

### Security Validation

1. [ ] Tokens never logged in plain text
2. [ ] Token ownership verified before charging
3. [ ] No token exposure in API responses
4. [ ] Automatic saving without user permission

## Completion Checklist

### Research Required
- [ ] PayPlus token charging API documentation obtained
- [ ] Token structure in webhook responses verified
- [ ] Direct charging endpoint confirmed
- [ ] Token validation methods understood

### Implementation - Backend
- [ ] Created PaymentMethod model (SINGLE TABLE)
- [ ] Added payment_method_id to Transaction table
- [ ] Created PaymentTokenService with auto-save
- [ ] Created PayPlusTokenChargeService for direct charging
- [ ] Updated webhook handler for automatic token capture
- [ ] Created payment-methods API endpoints
- [ ] Added TODO comment for user notification

### Implementation - Frontend
- [ ] Created PaymentConfirmationPopup component
- [ ] Updated CheckoutService to check for saved methods
- [ ] Integrated popup with Hebrew text
- [ ] Used nav_account_text setting in popup
- [ ] Handled both confirmation paths (approve/new card)

### Testing
- [ ] First-time user flow tested
- [ ] Returning user popup tested
- [ ] Direct token charging tested
- [ ] All tokens kept (no deletion) verified
- [ ] Default selection logic tested

### Security & Quality
- [ ] Tokens masked in all logs
- [ ] No user permission required for saving
- [ ] Ownership verification before charging
- [ ] Proper error handling implemented
- [ ] Transaction safety ensured

### Deployment
- [ ] Database migration run
- [ ] PayPlus credentials configured
- [ ] Staging environment tested
- [ ] Production monitoring ready

## Key Reminders for Implementation

1. **SINGLE TABLE ONLY** - Just PaymentMethod table, NO PaymentMethodUsage
2. **AUTOMATIC SAVING** - Tokens saved WITHOUT asking permission
3. **POPUP INSTEAD OF PAGE** - Show confirmation popup for existing users
4. **KEEP ALL TOKENS** - Never delete old tokens when adding new ones
5. **TODO FOR NOTIFICATION** - Add comment but skip implementation
6. **RESEARCH FIRST** - Get PayPlus API docs before implementing

## Expected Time: 2-3 hours AI work time (simplified from original 3-4 hours)