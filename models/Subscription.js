import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Subscription = sequelize.define('Subscription', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      }
    },
    subscription_plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'subscriptionplan',
        key: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      }
    },
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'transaction',
        key: 'id',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      }
    },

    // Subscription Status & Lifecycle
    status: {
      type: DataTypes.ENUM('pending', 'active', 'cancelled', 'expired', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },

    // Billing & Dates
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    next_billing_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // PayPlus Integration
    payplus_subscription_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        // UUID-like format validation if provided
        isValidUid(value) {
          if (value && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
            throw new Error('PayPlus subscription UID must be a valid UUID format');
          }
        }
      }
    },
    payplus_status: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: {
          args: [['active', 'cancelled', 'expired', 'failed', 'pending', 'suspended']],
          msg: 'PayPlus status must be a valid status'
        }
      }
    },

    // Pricing (snapshot at subscription time)
    billing_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Price for this subscription billing period after discounts',
      validate: {
        min: {
          args: [0],
          msg: 'Billing price must be zero or positive'
        },
        max: {
          args: [99999.99],
          msg: 'Billing price cannot exceed 99,999.99'
        }
      }
    },
    original_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Original price before discounts',
      validate: {
        min: {
          args: [0],
          msg: 'Original price must be zero or positive'
        },
        max: {
          args: [99999.99],
          msg: 'Original price cannot exceed 99,999.99'
        }
      }
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Discount amount applied to this subscription',
      validate: {
        min: {
          args: [0],
          msg: 'Discount amount must be zero or positive'
        },
        max: {
          args: [99999.99],
          msg: 'Discount amount cannot exceed 99,999.99'
        }
      }
    },
    billing_period: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        // Allow 'daily' in staging/development for testing, only monthly/yearly in production
        isIn: process.env.NODE_ENV === 'production'
          ? [['monthly', 'yearly']]
          : [['monthly', 'yearly', 'daily']]
      }
    },

    // Metadata for additional data
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },

    // Standard timestamps
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'subscription',
    timestamps: false,
    validate: {
      // Model-level validation for field relationships
      validatePricing() {
        // Check that original_price >= billing_price when both are provided
        if (this.original_price && this.billing_price && this.original_price < this.billing_price) {
          throw new Error('Original price cannot be less than billing price');
        }

        // Check that discount_amount doesn't exceed original_price when both are provided
        if (this.original_price && this.discount_amount && this.discount_amount > this.original_price) {
          throw new Error('Discount amount cannot exceed original price');
        }

        // Check that billing_price + discount_amount equals original_price when all are provided
        if (this.original_price && this.billing_price && this.discount_amount) {
          const calculatedOriginal = parseFloat(this.billing_price) + parseFloat(this.discount_amount);
          const actualOriginal = parseFloat(this.original_price);
          // Allow small floating point differences (0.01)
          if (Math.abs(calculatedOriginal - actualOriginal) > 0.01) {
            throw new Error('Pricing calculation mismatch: billing_price + discount_amount must equal original_price');
          }
        }
      },

      // Validate date relationships
      validateDates() {
        // Check that end_date is after start_date when both are provided
        if (this.start_date && this.end_date && new Date(this.end_date) <= new Date(this.start_date)) {
          throw new Error('End date must be after start date');
        }

        // Check that next_billing_date is after start_date when both are provided
        if (this.start_date && this.next_billing_date && new Date(this.next_billing_date) <= new Date(this.start_date)) {
          throw new Error('Next billing date must be after start date');
        }

        // Check that cancelled_at is only set when status is 'cancelled'
        if (this.cancelled_at && this.status !== 'cancelled') {
          throw new Error('Cancelled date can only be set when status is cancelled');
        }
      },

      // Validate PayPlus fields consistency
      validatePayPlusFields() {
        // If subscription has a paid billing_price, it should have a PayPlus UID when active
        if (this.status === 'active' && this.billing_price > 0 && !this.payplus_subscription_uid) {
          throw new Error('Active paid subscriptions must have a PayPlus subscription UID');
        }
      }
    },
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_subscription_user_id'
      },
      {
        fields: ['subscription_plan_id'],
        name: 'idx_subscription_plan_id'
      },
      {
        fields: ['status'],
        name: 'idx_subscription_status'
      },
      {
        fields: ['payplus_subscription_uid'],
        name: 'idx_subscription_payplus_uid'
      },
      {
        fields: ['next_billing_date'],
        name: 'idx_subscription_next_billing'
      },
      {
        fields: ['created_at'],
        name: 'idx_subscription_created_at'
      },
    ],
  });

  Subscription.associate = function(models) {
    // Belongs to User
    Subscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    // Belongs to SubscriptionPlan
    Subscription.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'subscription_plan_id',
      as: 'subscriptionPlan'
    });

    // Belongs to Transaction (optional, for payment tracking)
    Subscription.belongsTo(models.Transaction, {
      foreignKey: 'transaction_id',
      as: 'transaction'
    });
  };

  // Instance methods for subscription lifecycle management
  Subscription.prototype.isActive = function() {
    return this.status === 'active' &&
           (!this.end_date || new Date() < new Date(this.end_date));
  };

  Subscription.prototype.isPending = function() {
    return this.status === 'pending';
  };

  Subscription.prototype.isCancelled = function() {
    return this.status === 'cancelled';
  };

  Subscription.prototype.isExpired = function() {
    return this.status === 'expired' ||
           (this.end_date && new Date() >= new Date(this.end_date));
  };

  Subscription.prototype.canBeCancelled = function() {
    return ['active', 'pending'].includes(this.status);
  };

  Subscription.prototype.canBeReactivated = function() {
    return ['cancelled', 'failed'].includes(this.status) &&
           (!this.end_date || new Date() < new Date(this.end_date));
  };

  // Calculate next billing date based on billing period
  Subscription.prototype.calculateNextBillingDate = function(fromDate = null) {
    const baseDate = fromDate ? new Date(fromDate) : new Date(this.start_date);
    const nextBilling = new Date(baseDate);

    switch (this.billing_period) {
      case 'daily':
        nextBilling.setDate(nextBilling.getDate() + 1);
        break;
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      default:
        // Default to monthly if billing period is invalid
        nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    return nextBilling;
  };

  // Activate subscription
  Subscription.prototype.activate = async function(options = {}) {
    const updateData = {
      status: 'active',
      start_date: options.startDate || new Date(),
      updated_at: new Date()
    };

    // Set PayPlus subscription UID if provided
    if (options.payplusSubscriptionUid) {
      updateData.payplus_subscription_uid = options.payplusSubscriptionUid;
    }

    // Set PayPlus status if provided
    if (options.payplusStatus) {
      updateData.payplus_status = options.payplusStatus;
    }

    // Set next billing date for paid subscriptions with PayPlus UID
    const hasPayplusUid = updateData.payplus_subscription_uid || this.payplus_subscription_uid;
    if (hasPayplusUid && this.billing_price > 0) {
      updateData.next_billing_date = this.calculateNextBillingDate(updateData.start_date);
    }

    // Update metadata
    if (options.metadata) {
      updateData.metadata = {
        ...this.metadata,
        ...options.metadata,
        activatedAt: new Date().toISOString()
      };
    }

    return await this.update(updateData);
  };

  // Cancel subscription
  Subscription.prototype.cancel = async function(options = {}) {
    const updateData = {
      status: 'cancelled',
      cancelled_at: new Date(),
      updated_at: new Date()
    };

    // Clear PayPlus subscription UID to prevent future charges
    if (options.removePayPlusUid !== false) {
      updateData.payplus_subscription_uid = null;
    }

    // Keep subscription active until end date if specified
    if (options.keepActiveUntilEndDate && this.end_date) {
      updateData.status = 'active';
      updateData.metadata = {
        ...this.metadata,
        scheduledCancellation: {
          cancelledAt: new Date().toISOString(),
          willExpireAt: this.end_date,
          reason: options.reason || 'user_cancelled'
        }
      };
    }

    // Update metadata
    if (options.metadata) {
      updateData.metadata = {
        ...updateData.metadata || this.metadata,
        ...options.metadata
      };
    }

    return await this.update(updateData);
  };

  // Update subscription status from PayPlus webhook
  Subscription.prototype.updateFromPayPlus = async function(payplusData) {
    const updateData = {
      payplus_status: payplusData.status,
      updated_at: new Date(),
      metadata: {
        ...this.metadata,
        lastPayPlusUpdate: new Date().toISOString(),
        payplusData
      }
    };

    // Map PayPlus status to our status
    switch (payplusData.status) {
      case 'active':
        updateData.status = 'active';
        if (payplusData.next_payment_date) {
          updateData.next_billing_date = new Date(payplusData.next_payment_date);
        }
        break;
      case 'cancelled':
        updateData.status = 'cancelled';
        updateData.cancelled_at = new Date();
        break;
      case 'expired':
        updateData.status = 'expired';
        break;
      case 'failed':
        updateData.status = 'failed';
        break;
    }

    return await this.update(updateData);
  };

  return Subscription;
}