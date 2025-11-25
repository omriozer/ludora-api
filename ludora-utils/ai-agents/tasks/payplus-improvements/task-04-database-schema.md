# Task 04: Payment Method Database Schema

## Task Header

**Task ID:** 04
**Title:** Payment Method Database Schema
**Priority Level:** MEDIUM (Required for user features)
**Estimated Time:** 2-3 hours AI work time
**Dependencies:** Task 03 (Token Capture) must be complete
**Status:** Not Started

## Context Section

### Why This Task Is Needed

Currently, payment tokens are only stored temporarily in Purchase.payment_metadata. For a production-ready saved payment method system, we need:
- Dedicated tables for payment methods
- Encrypted token storage for PCI compliance
- User management of saved cards
- Support for multiple payment methods per user
- Audit trail for payment method usage

### Current State Analysis

```javascript
// Current: Tokens buried in Purchase metadata
Purchase {
  payment_metadata: {
    payment_token: "tok_abc123", // Not encrypted, not manageable
    token_data: { ... }
  }
}

// Needed: Dedicated, secure, manageable storage
PaymentMethod {
  id: "pm_uuid",
  user_id: "user_123",
  token_encrypted: "encrypted_token",
  card_last_4: "4242",
  is_default: true,
  // ... full schema
}
```

### Expected Outcomes

1. Complete database schema for payment methods
2. Secure encrypted storage for tokens
3. User-payment method relationship
4. Usage tracking and audit trail
5. Support for multiple payment methods per user

### Success Criteria

- [ ] Schema supports all payment method requirements
- [ ] Tokens encrypted at rest using AES-256
- [ ] Migration runs without errors
- [ ] Indexes optimized for common queries
- [ ] Backward compatible with existing purchases

## Implementation Details

### Step-by-Step Implementation Plan

**CONFIRMED: Single PaymentMethod table approach is correct**
- Single table stores all payment methods
- Transaction table references payment_method_id for payment tracking
- No changes needed from original design

#### Step 1: Design Core Payment Methods Table

```sql
-- /ludora-api/migrations/create-payment-methods-table.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PaymentMethods', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },

      // User relationship
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      // Token storage (encrypted)
      token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'AES-256 encrypted PayPlus token'
      },

      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 hash for duplicate detection'
      },

      // Card information (not encrypted, non-sensitive)
      card_last_4: {
        type: Sequelize.STRING(4),
        allowNull: false
      },

      card_brand: {
        type: Sequelize.ENUM('visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'other'),
        allowNull: false
      },

      card_exp_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 12
        }
      },

      card_exp_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: new Date().getFullYear()
        }
      },

      card_holder_name: {
        type: Sequelize.STRING,
        allowNull: true
      },

      // Payment provider info
      provider: {
        type: Sequelize.ENUM('payplus', 'stripe', 'paypal'),
        defaultValue: 'payplus',
        allowNull: false
      },

      provider_customer_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Customer ID at payment provider'
      },

      // User preferences
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },

      nickname: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'User-defined name for this card'
      },

      // Billing address (optional)
      billing_address: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Structured billing address data'
      },

      // Status and lifecycle
      status: {
        type: Sequelize.ENUM('active', 'expired', 'deleted', 'failed'),
        defaultValue: 'active',
        allowNull: false
      },

      // Usage tracking
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },

      use_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },

      // Metadata
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: 'Additional provider-specific data'
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },

      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp'
      }
    });

    // Indexes for performance
    await queryInterface.addIndex('PaymentMethods', ['user_id', 'status'], {
      name: 'idx_payment_methods_user_status'
    });

    await queryInterface.addIndex('PaymentMethods', ['token_hash'], {
      name: 'idx_payment_methods_token_hash',
      unique: true
    });

    await queryInterface.addIndex('PaymentMethods', ['user_id', 'is_default'], {
      name: 'idx_payment_methods_user_default',
      where: {
        is_default: true,
        status: 'active'
      }
    });

    await queryInterface.addIndex('PaymentMethods', ['card_exp_year', 'card_exp_month'], {
      name: 'idx_payment_methods_expiry'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PaymentMethods');
  }
};
```

#### Step 2: Create Payment Method Usage Tracking Table

```sql
-- /ludora-api/migrations/create-payment-method-usage-table.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PaymentMethodUsage', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },

      payment_method_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'PaymentMethods',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      purchase_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Purchases',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Amount in cents'
      },

      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'ILS',
        allowNull: false
      },

      status: {
        type: Sequelize.ENUM('success', 'failed', 'pending'),
        allowNull: false
      },

      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      provider_transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'PayPlus transaction UID'
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Indexes
    await queryInterface.addIndex('PaymentMethodUsage', ['payment_method_id'], {
      name: 'idx_payment_usage_method'
    });

    await queryInterface.addIndex('PaymentMethodUsage', ['purchase_id'], {
      name: 'idx_payment_usage_purchase',
      unique: true
    });

    await queryInterface.addIndex('PaymentMethodUsage', ['created_at'], {
      name: 'idx_payment_usage_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PaymentMethodUsage');
  }
};
```

#### Step 3: Create Sequelize Models

```javascript
// /ludora-api/models/PaymentMethod.js
const { Model, DataTypes } = require('sequelize');

class PaymentMethod extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      token_encrypted: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      token_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      card_last_4: {
        type: DataTypes.STRING(4),
        allowNull: false
      },
      card_brand: {
        type: DataTypes.ENUM('visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'other'),
        allowNull: false
      },
      card_exp_month: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      card_exp_year: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      card_holder_name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      provider: {
        type: DataTypes.ENUM('payplus', 'stripe', 'paypal'),
        defaultValue: 'payplus'
      },
      provider_customer_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      nickname: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      billing_address: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('active', 'expired', 'deleted', 'failed'),
        defaultValue: 'active'
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      use_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
      }
    }, {
      sequelize,
      modelName: 'PaymentMethod',
      tableName: 'PaymentMethods',
      underscored: true,
      timestamps: true,
      paranoid: true, // Soft deletes
      hooks: {
        beforeValidate: async (paymentMethod) => {
          // Check for expired cards
          const now = new Date();
          const expiry = new Date(paymentMethod.card_exp_year, paymentMethod.card_exp_month - 1);
          if (expiry < now && paymentMethod.status === 'active') {
            paymentMethod.status = 'expired';
          }
        }
      }
    });
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    this.hasMany(models.PaymentMethodUsage, {
      foreignKey: 'payment_method_id',
      as: 'usage'
    });
  }

  // Instance methods
  isExpired() {
    const now = new Date();
    const expiry = new Date(this.card_exp_year, this.card_exp_month - 1);
    return expiry < now;
  }

  async markAsUsed(purchaseId, transactionId) {
    this.last_used_at = new Date();
    this.use_count += 1;
    await this.save();

    // Log usage
    await PaymentMethodUsage.create({
      payment_method_id: this.id,
      purchase_id: purchaseId,
      provider_transaction_id: transactionId,
      status: 'success'
    });
  }

  // Mask sensitive data for API responses
  toSafeJSON() {
    return {
      id: this.id,
      card_last_4: this.card_last_4,
      card_brand: this.card_brand,
      card_exp_month: this.card_exp_month,
      card_exp_year: this.card_exp_year,
      card_holder_name: this.card_holder_name,
      is_default: this.is_default,
      nickname: this.nickname,
      status: this.status,
      created_at: this.created_at
      // Explicitly exclude token_encrypted
    };
  }
}

module.exports = PaymentMethod;
```

#### Step 4: Create Encryption Service

```javascript
// /ludora-api/services/EncryptionService.js
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // Use 32-byte key from environment
    this.encryptionKey = Buffer.from(
      process.env.PAYMENT_TOKEN_ENCRYPTION_KEY ||
      crypto.randomBytes(32).toString('hex'),
      'hex'
    );

    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }

    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Encrypts a payment token
   * @param {string} token - Plain text token
   * @returns {string} - Encrypted token with IV and auth tag
   */
  encryptToken(token) {
    if (!token) return null;

    // Generate random IV
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    // Encrypt token
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypts a payment token
   * @param {string} encryptedToken - Encrypted token
   * @returns {string} - Plain text token
   */
  decryptToken(encryptedToken) {
    if (!encryptedToken) return null;

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedToken, 'base64');

      // Extract components
      const iv = combined.slice(0, 16);
      const authTag = combined.slice(16, 32);
      const encrypted = combined.slice(32);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt token
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      cerror('Token decryption failed:', error);
      throw new Error('Failed to decrypt payment token');
    }
  }

  /**
   * Creates a hash of token for duplicate detection
   * @param {string} token - Plain text token
   * @returns {string} - SHA-256 hash
   */
  hashToken(token) {
    if (!token) return null;

    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}

module.exports = EncryptionService;
```

#### Step 5: Create Migration for Existing Tokens

```javascript
// /ludora-api/migrations/migrate-existing-tokens.js
const EncryptionService = require('../services/EncryptionService');
const encryptionService = new EncryptionService();

module.exports = {
  async up(queryInterface, Sequelize) {
    // Find all purchases with tokens
    const purchases = await queryInterface.sequelize.query(
      `SELECT id, buyer_user_id, payment_metadata
       FROM "Purchases"
       WHERE payment_metadata->>'payment_token' IS NOT NULL
       AND payment_status = 'completed'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${purchases.length} purchases with tokens to migrate`);

    // Migrate each token to PaymentMethods table
    for (const purchase of purchases) {
      try {
        const metadata = purchase.payment_metadata;
        const token = metadata.payment_token;
        const tokenData = metadata.token_data || {};

        // Check if already migrated
        const tokenHash = encryptionService.hashToken(token);
        const existing = await queryInterface.sequelize.query(
          `SELECT id FROM "PaymentMethods" WHERE token_hash = :hash`,
          {
            replacements: { hash: tokenHash },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        if (existing.length > 0) {
          continue; // Already migrated
        }

        // Create payment method
        await queryInterface.insert(null, 'PaymentMethods', {
          id: Sequelize.fn('gen_random_uuid'),
          user_id: purchase.buyer_user_id,
          token_encrypted: encryptionService.encryptToken(token),
          token_hash: tokenHash,
          card_last_4: tokenData.last_4 || '0000',
          card_brand: tokenData.brand || 'other',
          card_exp_month: tokenData.exp_month || 12,
          card_exp_year: tokenData.exp_year || new Date().getFullYear() + 1,
          card_holder_name: tokenData.holder_name,
          provider: 'payplus',
          status: 'active',
          use_count: 1,
          last_used_at: purchase.created_at,
          metadata: metadata,
          created_at: new Date(),
          updated_at: new Date()
        });

      } catch (error) {
        console.error(`Failed to migrate token for purchase ${purchase.id}:`, error);
      }
    }

    console.log('Token migration completed');
  },

  async down(queryInterface, Sequelize) {
    // Remove migrated payment methods
    await queryInterface.sequelize.query(
      `DELETE FROM "PaymentMethods"
       WHERE metadata->>'migrated_from_purchase' = 'true'`
    );
  }
};
```

#### Step 6: Update Purchase Model Relationship

```javascript
// /ludora-api/models/Purchase.js (update associations)
class Purchase extends Model {
  static associate(models) {
    // Existing associations...

    // Add payment method relationship
    this.hasOne(models.PaymentMethodUsage, {
      foreignKey: 'purchase_id',
      as: 'payment_method_usage'
    });
  }
}
```

### Database Changes Required

```sql
-- Summary of new tables and changes

-- 1. PaymentMethods table
CREATE TABLE "PaymentMethods" (
  -- See Step 1 for full schema
);

-- 2. PaymentMethodUsage table
CREATE TABLE "PaymentMethodUsage" (
  -- See Step 2 for full schema
);

-- 3. Indexes for performance
CREATE INDEX idx_payment_methods_user_status ON "PaymentMethods"(user_id, status);
CREATE INDEX idx_payment_methods_token_hash ON "PaymentMethods"(token_hash);
CREATE INDEX idx_payment_methods_expiry ON "PaymentMethods"(card_exp_year, card_exp_month);
CREATE INDEX idx_payment_usage_method ON "PaymentMethodUsage"(payment_method_id);
CREATE INDEX idx_payment_usage_purchase ON "PaymentMethodUsage"(purchase_id);

-- 4. Foreign key constraints
ALTER TABLE "PaymentMethods"
  ADD CONSTRAINT fk_payment_methods_user
  FOREIGN KEY (user_id) REFERENCES "Users"(id) ON DELETE CASCADE;

ALTER TABLE "PaymentMethodUsage"
  ADD CONSTRAINT fk_payment_usage_method
  FOREIGN KEY (payment_method_id) REFERENCES "PaymentMethods"(id) ON DELETE CASCADE;
```

### Configuration Changes Needed

```bash
# Required environment variables
PAYMENT_TOKEN_ENCRYPTION_KEY=<32-byte-hex-key>  # Generate with: openssl rand -hex 32

# Optional configuration
PAYMENT_METHOD_MAX_PER_USER=10           # Maximum saved cards per user
PAYMENT_METHOD_AUTO_DELETE_EXPIRED=true  # Auto-delete expired cards
PAYMENT_METHOD_EXPIRY_WARNING_DAYS=30    # Warn before expiry
```

## Technical Specifications

### Database Schema Diagram

```
┌─────────────────────┐
│       Users         │
├─────────────────────┤
│ id (PK)            │
│ email              │
│ ...                │
└──────┬──────────────┘
       │ 1:N
       │
┌──────▼──────────────┐         ┌─────────────────────┐
│   PaymentMethods    │         │     Purchases       │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)            │         │ id (PK)            │
│ user_id (FK)       │         │ buyer_user_id (FK)  │
│ token_encrypted    │         │ ...                │
│ card_last_4        │         └──────▲──────────────┘
│ card_brand         │                │
│ ...                │                │ 1:1
└──────┬──────────────┘                │
       │ 1:N                           │
       │                               │
┌──────▼────────────────────────────────┐
│        PaymentMethodUsage            │
├───────────────────────────────────────┤
│ id (PK)                              │
│ payment_method_id (FK)               │
│ purchase_id (FK)                     │
│ amount                               │
│ status                               │
│ ...                                  │
└───────────────────────────────────────┘
```

### Security Requirements

1. **Encryption at Rest:**
   - AES-256-GCM for token encryption
   - Unique IV per token
   - Auth tag for integrity verification
   - Key rotation capability

2. **Access Control:**
   - Users can only access their own payment methods
   - Admins have read-only access with audit logging
   - Tokens never exposed in API responses

3. **PCI DSS Compliance:**
   - Tokens encrypted before storage
   - No sensitive authentication data stored
   - Audit trail for all access
   - Automatic purging of expired cards

### Testing Requirements

```javascript
// Unit tests
describe('PaymentMethod Model', () => {
  test('encrypts token on save', async () => {
    const method = await PaymentMethod.create({
      user_id: userId,
      token_encrypted: encryptionService.encryptToken('tok_test'),
      // ... other fields
    });

    expect(method.token_encrypted).not.toBe('tok_test');
  });

  test('enforces unique token constraint', async () => {
    // Test duplicate token rejection
  });

  test('auto-expires old cards', async () => {
    // Test expiry detection
  });
});
```

### Performance Considerations

- Indexes on all foreign keys and commonly queried fields
- JSONB for flexible metadata storage
- Soft deletes to maintain audit trail
- Batch processing for migration

## Completion Checklist

### Implementation
- [ ] Created PaymentMethods migration
- [ ] Created PaymentMethodUsage migration
- [ ] Created Sequelize models
- [ ] Created EncryptionService
- [ ] Created data migration script

### Testing
- [ ] Migration runs successfully
- [ ] Encryption/decryption working
- [ ] Foreign keys enforced
- [ ] Indexes created properly
- [ ] Model validations working

### Security
- [ ] Tokens encrypted at rest
- [ ] Encryption key secure
- [ ] No token leaks in logs
- [ ] Access control verified
- [ ] PCI compliance checked

### Documentation
- [ ] Schema documented
- [ ] Encryption process documented
- [ ] Migration guide written
- [ ] Model methods documented

### Deployment
- [ ] Backup database before migration
- [ ] Encryption key in environment
- [ ] Migration tested in staging
- [ ] Rollback plan ready
- [ ] Monitoring configured

## Notes for Next Session

If implementing this task:
1. Generate encryption key securely: `openssl rand -hex 32`
2. Test migration on copy of production data
3. Ensure encryption key is backed up securely
4. Consider key rotation strategy for future
5. Task 05 will build APIs on top of this schema