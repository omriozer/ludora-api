# Task 05: Payment Method Management APIs

## Task Header

**Task ID:** 05
**Title:** Payment Method Management APIs
**Priority Level:** MEDIUM (User-facing features)
**Estimated Time:** 3-4 hours AI work time
**Dependencies:** Task 04 (Database Schema) must be complete
**Status:** Not Started

## Context Section

### Why This Task Is Needed

With the database schema in place, we need secure, well-designed APIs that allow users to:
- View ALL their payment methods (both active and inactive/deleted)
- Add new payment methods
- Soft delete payment methods (mark as inactive, never hard delete)
- Set a default payment method (with automatic unsetting of other defaults)
- Use saved payment methods for checkout
- Manage payment method preferences

### Current State Analysis

```javascript
// Current: No payment method APIs exist
// Users must enter payment details every time

// Needed: Complete CRUD API for payment methods
GET /api/payment-methods              // List user's methods
POST /api/payment-methods             // Save new method
DELETE /api/payment-methods/:id       // Remove method
PATCH /api/payment-methods/:id        // Update method
POST /api/payments/create-with-saved  // Use saved method for payment
```

### Expected Outcomes

1. Complete RESTful API for payment method management
2. Secure endpoints with proper authentication and authorization
3. Integration with PayPlus for tokenization
4. Comprehensive validation and error handling
5. Audit logging for all payment method operations

### Success Criteria

- [ ] All CRUD operations functional
- [ ] Authorization prevents cross-user access
- [ ] Tokens never exposed in responses
- [ ] Rate limiting protects against abuse
- [ ] API documentation complete

## Implementation Details

### Step-by-Step Implementation Plan

#### Step 1: Create Payment Methods Router

```javascript
// /ludora-api/routes/paymentMethods.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const PaymentMethodController = require('../controllers/PaymentMethodController');
const { paymentMethodSchemas } = require('../validation/paymentMethodSchemas');

// All routes require authentication
router.use(authenticateToken);

// List ALL user's payment methods (active AND inactive/deleted)
router.get('/',
  PaymentMethodController.listMethods  // Returns all with status field
);

// Get specific payment method
router.get('/:id',
  PaymentMethodController.getMethod
);

// Add new payment method from token
router.post('/',
  validateBody(paymentMethodSchemas.create),
  PaymentMethodController.createMethod
);

// Add payment method from recent purchase
router.post('/from-purchase/:purchaseId',
  PaymentMethodController.createFromPurchase
);

// Update payment method (nickname, billing address only - NOT default)
router.patch('/:id',
  validateBody(paymentMethodSchemas.update),
  PaymentMethodController.updateMethod
);

// SOFT DELETE payment method (set is_active: false, never hard delete)
router.delete('/:id',
  PaymentMethodController.deleteMethod  // Soft delete only
);

// Set default payment method - DEDICATED ENDPOINT
// Automatically unsets all other user payment methods as default
router.put('/:id/set-default',
  PaymentMethodController.setDefault
);

// Validate payment method is still active
router.post('/:id/validate',
  PaymentMethodController.validateMethod
);

module.exports = router;
```

#### Step 2: Create Payment Method Controller

```javascript
// /ludora-api/controllers/PaymentMethodController.js
const models = require('../models');
const EncryptionService = require('../services/EncryptionService');
const PayPlusService = require('../services/PayPlusService');
const clog = require('../utils/clog');

const encryptionService = new EncryptionService();

class PaymentMethodController {
  /**
   * List ALL payment methods for authenticated user
   * Returns both active AND inactive/deleted methods with status field
   */
  async listMethods(req, res, next) {
    try {
      const userId = req.user.id;

      // Get ALL payment methods (no status filter)
      const methods = await models.PaymentMethod.findAll({
        where: {
          user_id: userId
          // NO status filter - return ALL records
        },
        order: [
          ['is_default', 'DESC'],
          ['status', 'ASC'],  // Active first, then deleted
          ['created_at', 'DESC']
        ]
      });

      // Return safe representation with status field
      const safeMethods = methods.map(m => ({
        ...m.toSafeJSON(),
        status: m.status  // Include status for UI display
      }));

      res.json({
        payment_methods: safeMethods,
        count: safeMethods.length,
        active_count: safeMethods.filter(m => m.status === 'active').length,
        deleted_count: safeMethods.filter(m => m.status === 'deleted').length
      });

      // TODO remove debug - payment method APIs
      clog(`Listed ${safeMethods.length} payment methods for user ${userId}`);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific payment method
   */
  async getMethod(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const method = await models.PaymentMethod.findOne({
        where: {
          id: id,
          user_id: userId,
          status: 'active'
        }
      });

      if (!method) {
        return res.status(404).json({
          error: 'Payment method not found'
        });
      }

      res.json({
        payment_method: method.toSafeJSON()
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create payment method from token
   */
  async createMethod(req, res, next) {
    const transaction = await models.sequelize.transaction();

    try {
      const userId = req.user.id;
      const {
        token,
        card_last_4,
        card_brand,
        card_exp_month,
        card_exp_year,
        card_holder_name,
        nickname,
        billing_address,
        set_as_default
      } = req.body;

      // Check user hasn't exceeded limit
      const existingCount = await models.PaymentMethod.count({
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      const maxMethods = process.env.PAYMENT_METHOD_MAX_PER_USER || 10;
      if (existingCount >= maxMethods) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Maximum ${maxMethods} payment methods allowed`
        });
      }

      // Check for duplicate token
      const tokenHash = encryptionService.hashToken(token);
      const duplicate = await models.PaymentMethod.findOne({
        where: {
          token_hash: tokenHash,
          user_id: userId,
          status: 'active'
        },
        transaction
      });

      if (duplicate) {
        await transaction.rollback();
        return res.status(409).json({
          error: 'This payment method already exists',
          payment_method: duplicate.toSafeJSON()
        });
      }

      // Validate token with PayPlus (optional but recommended)
      // const isValid = await PayPlusService.validateToken(token);
      // if (!isValid) {
      //   await transaction.rollback();
      //   return res.status(400).json({ error: 'Invalid payment token' });
      // }

      // If setting as default, unset current default
      if (set_as_default) {
        await models.PaymentMethod.update(
          { is_default: false },
          {
            where: {
              user_id: userId,
              is_default: true
            },
            transaction
          }
        );
      }

      // Create payment method
      const paymentMethod = await models.PaymentMethod.create({
        user_id: userId,
        token_encrypted: encryptionService.encryptToken(token),
        token_hash: tokenHash,
        card_last_4,
        card_brand,
        card_exp_month,
        card_exp_year,
        card_holder_name,
        nickname,
        billing_address,
        is_default: set_as_default || existingCount === 0, // First card is default
        provider: 'payplus',
        status: 'active'
      }, { transaction });

      await transaction.commit();

      // Log creation
      await models.Logs.create({
        user_id: userId,
        action: 'payment_method_created',
        entity_type: 'PaymentMethod',
        entity_id: paymentMethod.id,
        metadata: {
          card_last_4,
          card_brand
        }
      });

      res.status(201).json({
        payment_method: paymentMethod.toSafeJSON(),
        message: 'Payment method saved successfully'
      });

      // TODO remove debug - payment method APIs
      clog(`Payment method created for user ${userId}`, {
        id: paymentMethod.id,
        last4: card_last_4
      });

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Create payment method from recent purchase
   */
  async createFromPurchase(req, res, next) {
    const transaction = await models.sequelize.transaction();

    try {
      const { purchaseId } = req.params;
      const userId = req.user.id;

      // Find purchase
      const purchase = await models.Purchase.findOne({
        where: {
          id: purchaseId,
          buyer_user_id: userId,
          payment_status: 'completed'
        }
      });

      if (!purchase) {
        return res.status(404).json({
          error: 'Purchase not found or not completed'
        });
      }

      // Extract token from purchase
      const token = purchase.payment_metadata?.payment_token;
      const tokenData = purchase.payment_metadata?.token_data;

      if (!token || !tokenData) {
        return res.status(400).json({
          error: 'No payment method available for this purchase'
        });
      }

      // Create payment method from purchase token
      req.body = {
        token: token,
        card_last_4: tokenData.last_4,
        card_brand: tokenData.brand,
        card_exp_month: tokenData.exp_month,
        card_exp_year: tokenData.exp_year,
        card_holder_name: tokenData.holder_name,
        nickname: `Card ending in ${tokenData.last_4}`,
        set_as_default: false
      };

      // Reuse create method logic
      await this.createMethod(req, res, next);

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Update payment method (nickname and billing address only)
   * NOTE: Use dedicated set-default endpoint for default changes
   */
  async updateMethod(req, res, next) {
    const transaction = await models.sequelize.transaction();

    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { nickname, billing_address } = req.body;  // NO is_default here

      const method = await models.PaymentMethod.findOne({
        where: {
          id: id,
          user_id: userId,
          status: 'active'
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!method) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Payment method not found'
        });
      }

      // Update only nickname and billing address
      if (nickname !== undefined) {
        method.nickname = nickname;
      }

      if (billing_address !== undefined) {
        method.billing_address = billing_address;
      }

      // NOTE: is_default changes only through dedicated endpoint

      await method.save({ transaction });
      await transaction.commit();

      res.json({
        payment_method: method.toSafeJSON(),
        message: 'Payment method updated successfully'
      });

      // TODO remove debug - payment method APIs
      clog(`Payment method ${id} updated for user ${userId}`);

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Delete payment method - SOFT DELETE ONLY
   * Sets is_active: false, NEVER hard deletes for audit trail
   * User can delete even if it's their only payment method
   */
  async deleteMethod(req, res, next) {
    const transaction = await models.sequelize.transaction();

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const method = await models.PaymentMethod.findOne({
        where: {
          id: id,
          user_id: userId,
          status: 'active'
        },
        transaction
      });

      if (!method) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Payment method not found'
        });
      }

      // SOFT DELETE: Set is_active to false and status to 'deleted'
      method.is_active = false;  // Soft delete flag
      method.status = 'deleted';
      method.deleted_at = new Date();

      // Also unset as default if it was default
      if (method.is_default) {
        method.is_default = false;

        // Try to set another active method as default
        const nextDefault = await models.PaymentMethod.findOne({
          where: {
            user_id: userId,
            status: 'active',
            id: { [models.Sequelize.Op.ne]: id }
          },
          order: [['created_at', 'DESC']],
          transaction
        });

        if (nextDefault) {
          nextDefault.is_default = true;
          await nextDefault.save({ transaction });
        }
      }

      await method.save({ transaction });

      await transaction.commit();

      // Log deletion
      await models.Logs.create({
        user_id: userId,
        action: 'payment_method_deleted',
        entity_type: 'PaymentMethod',
        entity_id: method.id,
        metadata: {
          card_last_4: method.card_last_4
        }
      });

      res.json({
        message: 'Payment method removed successfully'
      });

      // TODO remove debug - payment method APIs
      clog(`Payment method ${id} deleted for user ${userId}`);

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Set payment method as default - DEDICATED ENDPOINT
   * MUST unset ALL other user payment methods as not default
   * Only one default per user at any time
   */
  async setDefault(req, res, next) {
    const transaction = await models.sequelize.transaction();

    try {
      const { id } = req.params;
      const userId = req.user.id;

      // First, unset ALL current defaults for this user
      await models.PaymentMethod.update(
        { is_default: false },
        {
          where: {
            user_id: userId,
            is_default: true
            // No ID exclusion - unset ALL first
          },
          transaction
        }
      );

      // Now set the specified method as the ONLY default
      const [updated] = await models.PaymentMethod.update(
        { is_default: true },
        {
          where: {
            id: id,
            user_id: userId,
            status: 'active'  // Can only set active methods as default
          },
          transaction
        }
      );

      if (!updated) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Payment method not found or not active'
        });
      }

      await transaction.commit();

      // Log the change
      await models.Logs.create({
        user_id: userId,
        action: 'payment_method_set_default',
        entity_type: 'PaymentMethod',
        entity_id: id,
        metadata: { previous_default: null }
      });

      res.json({
        success: true,
        message: 'Default payment method updated',
        payment_method_id: id
      });

      // TODO remove debug - payment method APIs
      clog(`Payment method ${id} set as default for user ${userId}`);

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Validate payment method is still active with provider
   */
  async validateMethod(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const method = await models.PaymentMethod.findOne({
        where: {
          id: id,
          user_id: userId,
          status: 'active'
        }
      });

      if (!method) {
        return res.status(404).json({
          error: 'Payment method not found'
        });
      }

      // Check if expired
      if (method.isExpired()) {
        method.status = 'expired';
        await method.save();

        return res.json({
          valid: false,
          reason: 'Card has expired',
          payment_method: method.toSafeJSON()
        });
      }

      // Optional: Validate with PayPlus
      // const token = encryptionService.decryptToken(method.token_encrypted);
      // const isValid = await PayPlusService.validateToken(token);

      res.json({
        valid: true,
        payment_method: method.toSafeJSON()
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentMethodController();
```

#### Step 3: Create Validation Schemas

```javascript
// /ludora-api/validation/paymentMethodSchemas.js
const Joi = require('joi');

const paymentMethodSchemas = {
  create: Joi.object({
    token: Joi.string().required(),
    card_last_4: Joi.string().length(4).regex(/^\d{4}$/).required(),
    card_brand: Joi.string().valid(
      'visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'other'
    ).required(),
    card_exp_month: Joi.number().integer().min(1).max(12).required(),
    card_exp_year: Joi.number().integer().min(new Date().getFullYear()).required(),
    card_holder_name: Joi.string().max(100).optional(),
    nickname: Joi.string().max(50).optional(),
    billing_address: Joi.object({
      line1: Joi.string().max(200),
      line2: Joi.string().max(200).optional(),
      city: Joi.string().max(100),
      state: Joi.string().max(100).optional(),
      postal_code: Joi.string().max(20),
      country: Joi.string().length(2) // ISO country code
    }).optional(),
    set_as_default: Joi.boolean().optional()
  }),

  update: Joi.object({
    nickname: Joi.string().max(50).allow(null).optional(),
    billing_address: Joi.object({
      line1: Joi.string().max(200),
      line2: Joi.string().max(200).optional(),
      city: Joi.string().max(100),
      state: Joi.string().max(100).optional(),
      postal_code: Joi.string().max(20),
      country: Joi.string().length(2)
    }).allow(null).optional()
    // NOTE: is_default removed - use dedicated set-default endpoint
  })
};

module.exports = { paymentMethodSchemas };
```

#### Step 4: Create Payment with Saved Method Endpoint

```javascript
// /ludora-api/routes/payments.js (add to existing)
const PaymentMethodService = require('../services/PaymentMethodService');

/**
 * Create payment using saved payment method
 */
router.post('/create-with-saved',
  authenticateToken,
  validateBody(paymentWithSavedSchema),
  async (req, res, next) => {
    const transaction = await models.sequelize.transaction();

    try {
      const userId = req.user.id;
      const {
        payment_method_id,
        items,
        coupon_code,
        success_url,
        failure_url
      } = req.body;

      // Verify payment method ownership
      const paymentMethod = await models.PaymentMethod.findOne({
        where: {
          id: payment_method_id,
          user_id: userId,
          status: 'active'
        },
        transaction
      });

      if (!paymentMethod) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Payment method not found or not active'
        });
      }

      // Check if expired
      if (paymentMethod.isExpired()) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Payment method has expired'
        });
      }

      // Calculate total
      const total = await calculateOrderTotal(items, coupon_code);

      // Create purchase record
      const purchase = await models.Purchase.create({
        buyer_user_id: userId,
        items: items,
        total_amount: total.amount,
        currency: 'ILS',
        payment_status: 'pending',
        payment_method: 'saved_card',
        coupon_code: coupon_code,
        metadata: {
          payment_method_id: payment_method_id,
          card_last_4: paymentMethod.card_last_4,
          card_brand: paymentMethod.card_brand
        }
      }, { transaction });

      // Decrypt token for PayPlus
      const token = encryptionService.decryptToken(paymentMethod.token_encrypted);

      // Create PayPlus payment with token
      const payplusResponse = await PayPlusService.createTokenPayment({
        token: token,
        amount: total.amount,
        currency: 'ILS',
        transaction_uid: purchase.id,
        success_url: success_url || `${process.env.FRONTEND_URL}/payment/success`,
        failure_url: failure_url || `${process.env.FRONTEND_URL}/payment/failed`,
        webhook_url: `${process.env.API_URL}/api/webhooks/payplus`
      });

      if (!payplusResponse.success) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Payment failed',
          message: payplusResponse.error
        });
      }

      // Update purchase with PayPlus transaction ID
      purchase.payplus_transaction_uid = payplusResponse.transaction_uid;
      purchase.payment_status = payplusResponse.status || 'processing';
      await purchase.save({ transaction });

      // Update payment method usage
      await paymentMethod.markAsUsed(purchase.id, payplusResponse.transaction_uid);

      // Log payment method usage
      await models.PaymentMethodUsage.create({
        payment_method_id: payment_method_id,
        purchase_id: purchase.id,
        amount: total.amount,
        currency: 'ILS',
        status: 'pending',
        provider_transaction_id: payplusResponse.transaction_uid
      }, { transaction });

      await transaction.commit();

      res.json({
        success: true,
        purchase_id: purchase.id,
        transaction_id: payplusResponse.transaction_uid,
        message: 'Payment initiated successfully'
      });

      // TODO remove debug - payment method APIs
      clog(`Payment created with saved method ${payment_method_id} for user ${userId}`);

    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
);
```

#### Step 5: Add Rate Limiting

```javascript
// /ludora-api/middleware/rateLimiting.js
const rateLimit = require('express-rate-limit');

const paymentMethodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    error: 'Too many payment method requests, please try again later'
  }
});

const paymentCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 payments per minute
  message: {
    error: 'Too many payment attempts, please wait before trying again'
  }
});

module.exports = {
  paymentMethodLimiter,
  paymentCreationLimiter
};
```

#### Step 6: Register Routes

```javascript
// /ludora-api/app.js (add to existing)
const paymentMethodsRouter = require('./routes/paymentMethods');
const { paymentMethodLimiter } = require('./middleware/rateLimiting');

// Register payment methods routes
app.use('/api/payment-methods', paymentMethodLimiter, paymentMethodsRouter);
```

### Specific File Locations to Modify

1. `/ludora-api/routes/paymentMethods.js` - New routes file
2. `/ludora-api/controllers/PaymentMethodController.js` - New controller
3. `/ludora-api/validation/paymentMethodSchemas.js` - New validation schemas
4. `/ludora-api/routes/payments.js` - Add saved payment endpoint
5. `/ludora-api/middleware/rateLimiting.js` - Add rate limiters
6. `/ludora-api/app.js` - Register new routes

### API Endpoint Specifications

| Method | Endpoint | Description | Auth Required | Notes |
|--------|----------|-------------|---------------|--------|
| GET | `/api/payment-methods` | List ALL user's payment methods | Yes | Returns active AND deleted with status field |
| GET | `/api/payment-methods/:id` | Get specific payment method | Yes | |
| POST | `/api/payment-methods` | Add new payment method | Yes | |
| POST | `/api/payment-methods/from-purchase/:id` | Create from purchase | Yes | |
| PATCH | `/api/payment-methods/:id` | Update nickname/address only | Yes | No default changes here |
| DELETE | `/api/payment-methods/:id` | SOFT delete payment method | Yes | Sets is_active: false, never hard delete |
| PUT | `/api/payment-methods/:id/set-default` | Set as default | Yes | Dedicated endpoint, unsets all others |
| POST | `/api/payment-methods/:id/validate` | Validate method | Yes | |
| POST | `/api/payments/create-with-saved` | Pay with saved method | Yes | |

### Request/Response Examples

```javascript
// GET /api/payment-methods (returns ALL with status)
Response: {
  "payment_methods": [
    {
      "id": "pm_123",
      "card_last_4": "4242",
      "card_brand": "visa",
      "card_exp_month": 12,
      "card_exp_year": 2025,
      "nickname": "Personal Card",
      "is_default": true,
      "status": "active",  // Shows current status
      "created_at": "2025-11-26T10:00:00Z"
    },
    {
      "id": "pm_456",
      "card_last_4": "1234",
      "card_brand": "mastercard",
      "card_exp_month": 6,
      "card_exp_year": 2024,
      "nickname": "Old Card",
      "is_default": false,
      "status": "deleted",  // Soft deleted card still shown
      "created_at": "2024-11-26T10:00:00Z"
    }
  ],
  "count": 2,
  "active_count": 1,
  "deleted_count": 1
}

// POST /api/payment-methods
Request: {
  "token": "tok_abc123",
  "card_last_4": "4242",
  "card_brand": "visa",
  "card_exp_month": 12,
  "card_exp_year": 2025,
  "nickname": "Work Card",
  "set_as_default": true
}

Response: {
  "payment_method": { ... },
  "message": "Payment method saved successfully"
}
```

## Technical Specifications

### Security Requirements

1. **Authentication:** All endpoints require valid JWT
2. **Authorization:** Users can only access their own payment methods
3. **Token Protection:** Tokens never included in API responses
4. **Rate Limiting:** Prevent abuse and brute force attempts
5. **Audit Logging:** All payment method operations logged

### Testing Requirements

```javascript
// Integration tests
describe('Payment Methods API', () => {
  test('POST /api/payment-methods creates method', async () => {
    const response = await request(app)
      .post('/api/payment-methods')
      .set('Authorization', `Bearer ${token}`)
      .send(validPaymentMethod)
      .expect(201);

    expect(response.body.payment_method).toHaveProperty('id');
  });

  test('prevents cross-user access', async () => {
    await request(app)
      .get(`/api/payment-methods/${otherUserMethodId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
```

### Performance Considerations

- Database queries optimized with proper indexes
- Eager loading to prevent N+1 queries
- Response caching where appropriate
- Rate limiting to prevent abuse

## Completion Checklist

### Implementation
- [ ] Created payment methods router
- [ ] Created controller with all methods
- [ ] Created validation schemas
- [ ] Added saved payment endpoint
- [ ] Implemented rate limiting

### Testing
- [ ] Unit tests for controller
- [ ] Integration tests for endpoints
- [ ] Authorization tests
- [ ] Rate limiting tests
- [ ] Error handling tests

### Security
- [ ] Authentication enforced
- [ ] Authorization verified
- [ ] Tokens never exposed
- [ ] Rate limiting active
- [ ] Audit logging working

### Documentation
- [ ] API documentation written
- [ ] Request/response examples
- [ ] Error codes documented
- [ ] Integration guide created

### Deployment
- [ ] Routes registered
- [ ] Middleware configured
- [ ] Environment variables set
- [ ] Staging tested
- [ ] Monitoring configured

## Notes for Next Session

If implementing this task:
1. Test all endpoints with Postman/Insomnia first
2. Ensure proper error messages for user feedback
3. Consider implementing webhook for card expiry updates
4. Add metrics for payment method usage
5. Task 06 will build the frontend UI for these APIs