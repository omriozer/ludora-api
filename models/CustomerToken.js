import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const CustomerToken = sequelize.define('CustomerToken', {
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
        key: 'id'
      }
    },
    payplus_customer_uid: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'PayPlus customer UID for token-based payments'
    },
    token_value: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'PayPlus customer token for charging'
    },
    card_mask: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Masked card number for display (e.g., ****1234)'
    },
    card_brand: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Card brand (Visa, Mastercard, etc.)'
    },
    expiry_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Card expiry month (1-12)'
    },
    expiry_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 2024,
        max: 2050
      },
      comment: 'Card expiry year'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this token is active and can be used for payments'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is the user\'s default payment method'
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time this token was used for a payment'
    },
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
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Token expiration date from PayPlus'
    },
    payplus_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Full PayPlus response when token was created'
    },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'production',
      validate: {
        isIn: [['development', 'staging', 'production']]
      },
      comment: 'Environment where token was created'
    },
  }, {
    tableName: 'customer_token',
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_customer_token_user_id'
      },
      {
        fields: ['payplus_customer_uid'],
        name: 'idx_customer_token_payplus_customer_uid'
      },
      {
        fields: ['user_id', 'is_active'],
        name: 'idx_customer_token_user_active'
      },
      {
        fields: ['user_id', 'is_default'],
        name: 'idx_customer_token_user_default'
      },
      {
        fields: ['is_active', 'expires_at'],
        name: 'idx_customer_token_active_expires'
      },
      {
        fields: ['last_used_at'],
        name: 'idx_customer_token_last_used'
      },
      {
        fields: ['environment'],
        name: 'idx_customer_token_environment'
      },
    ],
  });

  CustomerToken.associate = function(models) {
    // CustomerToken belongs to User
    CustomerToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Instance methods
  CustomerToken.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Don't expose the actual token value in API responses for security
    delete values.token_value;
    return values;
  };

  CustomerToken.prototype.isExpired = function() {
    if (!this.expires_at) return false;
    return new Date() > this.expires_at;
  };

  CustomerToken.prototype.isValidForUse = function() {
    return this.is_active && !this.isExpired();
  };

  CustomerToken.prototype.markAsUsed = async function() {
    return await this.update({
      last_used_at: new Date(),
      updated_at: new Date()
    });
  };

  CustomerToken.prototype.setAsDefault = async function() {
    const models = require('./index.js').default;

    // First, unset all other tokens for this user as default
    await models.CustomerToken.update(
      { is_default: false, updated_at: new Date() },
      { where: { user_id: this.user_id, id: { [models.sequelize.Op.ne]: this.id } } }
    );

    // Then set this token as default
    return await this.update({
      is_default: true,
      updated_at: new Date()
    });
  };

  CustomerToken.prototype.deactivate = async function(reason = null) {
    const updateData = {
      is_active: false,
      updated_at: new Date()
    };

    if (reason) {
      updateData.payplus_response = {
        ...this.payplus_response,
        deactivation_reason: reason,
        deactivated_at: new Date().toISOString()
      };
    }

    return await this.update(updateData);
  };

  // Static methods
  CustomerToken.findActiveTokensForUser = async function(userId) {
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true
      },
      order: [
        ['is_default', 'DESC'],
        ['last_used_at', 'DESC NULLS LAST'],
        ['created_at', 'DESC']
      ]
    });
  };

  CustomerToken.findDefaultTokenForUser = async function(userId) {
    return await this.findOne({
      where: {
        user_id: userId,
        is_active: true,
        is_default: true
      }
    });
  };

  return CustomerToken;
}