import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

/**
 * PaymentMethod model - Stores user payment method tokens for one-click purchasing
 * Part of token capture system for PayPlus payment integration
 */
export default function(sequelize) {
  const PaymentMethod = sequelize.define('PaymentMethod', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateId('pm_')
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      comment: 'ID of the user who owns this payment method'
    },
    payplus_token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'PayPlus payment token for direct charging'
    },
    card_last4: {
      type: DataTypes.STRING(4),
      allowNull: false,
      comment: 'Last 4 digits of the card for display purposes'
    },
    card_brand: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Card brand (visa, mastercard, amex, etc.)'
    },
    card_expiry_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Card expiry month (1-12)'
    },
    card_expiry_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 2024,
        max: 2040
      },
      comment: 'Card expiry year (YYYY)'
    },
    card_holder_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Cardholder name if available'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is the user\'s default payment method'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this payment method is active (for soft deletion)'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'PaymentMethods',
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['user_id', 'is_active'],
        name: 'idx_payment_methods_user_active'
      },
      {
        fields: ['user_id', 'is_default', 'is_active'],
        name: 'idx_payment_methods_user_default'
      },
      {
        fields: ['payplus_token'],
        name: 'idx_payment_methods_token'
      }
    ]
  });

  // Define associations
  PaymentMethod.associate = function(models) {
    // Each payment method belongs to a user
    PaymentMethod.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    // Payment methods can be used in multiple transactions
    PaymentMethod.hasMany(models.Transaction, {
      foreignKey: 'payment_method_id',
      as: 'transactions'
    });
  };

  // Instance methods

  /**
   * Check if this payment method is expired
   * @returns {boolean} True if expired
   */
  PaymentMethod.prototype.isExpired = function() {
    if (!this.card_expiry_month || !this.card_expiry_year) {
      return false; // Can't determine if no expiry data
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    if (this.card_expiry_year < currentYear) {
      return true;
    }

    if (this.card_expiry_year === currentYear && this.card_expiry_month < currentMonth) {
      return true;
    }

    return false;
  };

  /**
   * Get a display name for this payment method
   * @returns {string} Display name like "Visa •••• 4242"
   */
  PaymentMethod.prototype.getDisplayName = function() {
    const brand = this.card_brand.toUpperCase();
    return `${brand} •••• ${this.card_last4}`;
  };

  /**
   * Get masked token for logging (security)
   * @returns {string} Masked token like "tok_****f456"
   */
  PaymentMethod.prototype.getMaskedToken = function() {
    if (!this.payplus_token) return 'unknown';
    if (this.payplus_token.length <= 8) return 'tok_****';

    const start = this.payplus_token.substring(0, 4);
    const end = this.payplus_token.substring(this.payplus_token.length - 4);
    return `${start}****${end}`;
  };

  /**
   * Soft delete this payment method
   * @param {Object} options - Sequelize transaction options
   */
  PaymentMethod.prototype.softDelete = async function(options = {}) {
    return await this.update({
      is_active: false,
      is_default: false, // Remove default status when deleting
      updated_at: new Date()
    }, options);
  };

  // Static methods

  /**
   * Find user's active payment methods
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of active payment methods
   */
  PaymentMethod.findActiveForUser = async function(userId, options = {}) {
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true
      },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ],
      ...options
    });
  };

  /**
   * Find user's default payment method
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Default payment method or null
   */
  PaymentMethod.findDefaultForUser = async function(userId, options = {}) {
    // First try to find explicitly marked default
    let defaultMethod = await this.findOne({
      where: {
        user_id: userId,
        is_default: true,
        is_active: true
      },
      ...options
    });

    // If no default, use most recent
    if (!defaultMethod) {
      defaultMethod = await this.findOne({
        where: {
          user_id: userId,
          is_active: true
        },
        order: [['created_at', 'DESC']],
        ...options
      });
    }

    return defaultMethod;
  };

  /**
   * Set a payment method as default for a user
   * @param {string} paymentMethodId - Payment method ID to set as default
   * @param {string} userId - User ID for verification
   * @param {Object} options - Transaction options
   */
  PaymentMethod.setAsDefault = async function(paymentMethodId, userId, options = {}) {
    const transaction = options.transaction;

    // Remove default from all user's methods
    await this.update(
      { is_default: false },
      {
        where: { user_id: userId },
        transaction
      }
    );

    // Set new default
    const [updatedCount] = await this.update(
      {
        is_default: true,
        updated_at: new Date()
      },
      {
        where: {
          id: paymentMethodId,
          user_id: userId,
          is_active: true
        },
        transaction
      }
    );

    if (updatedCount === 0) {
      throw new Error('Payment method not found or not owned by user');
    }

    return true;
  };

  // Override toJSON to remove sensitive data
  PaymentMethod.prototype.toJSON = function() {
    const values = { ...this.dataValues };

    // Remove sensitive token from JSON output for security
    if (values.payplus_token) {
      values.masked_token = this.getMaskedToken();
      delete values.payplus_token;
    }

    return values;
  };

  return PaymentMethod;
}