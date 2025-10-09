import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const PaymentSession = sequelize.define('PaymentSession', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    session_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'created',
      validate: {
        isIn: [['created', 'pending', 'completed', 'failed', 'expired', 'cancelled']]
      }
    },
    purchase_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    total_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    original_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true,
    },
    coupon_discount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true,
      defaultValue: 0.00,
    },
    applied_coupons: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    payplus_page_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    payplus_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    payment_page_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    return_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    callback_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'production',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
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
  }, {
    tableName: 'payment_session',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_payment_session_user_id'
      },
      {
        fields: ['session_status'],
        name: 'idx_payment_session_status'
      },
      {
        fields: ['payplus_page_uid'],
        name: 'idx_payment_session_payplus_page_uid'
      },
      {
        fields: ['created_at'],
        name: 'idx_payment_session_created_at'
      },
      {
        fields: ['expires_at'],
        name: 'idx_payment_session_expires_at'
      },
      {
        fields: ['user_id', 'session_status'],
        name: 'idx_payment_session_user_status'
      },
    ],
  });

  PaymentSession.associate = function(models) {
    // PaymentSession belongs to a User
    PaymentSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Instance methods for session management
  PaymentSession.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  PaymentSession.prototype.isActive = function() {
    return ['created', 'pending'].includes(this.session_status) && !this.isExpired();
  };

  PaymentSession.prototype.canRetry = function() {
    return ['failed', 'expired', 'cancelled'].includes(this.session_status);
  };

  PaymentSession.prototype.markExpired = function() {
    return this.update({
      session_status: 'expired',
      updated_at: new Date()
    });
  };

  PaymentSession.prototype.markCompleted = function(payplusResponse = {}) {
    return this.update({
      session_status: 'completed',
      completed_at: new Date(),
      payplus_response: {
        ...this.payplus_response,
        ...payplusResponse
      },
      updated_at: new Date()
    });
  };

  PaymentSession.prototype.markFailed = function(errorMessage = '', payplusResponse = {}) {
    return this.update({
      session_status: 'failed',
      failed_at: new Date(),
      error_message: errorMessage,
      payplus_response: {
        ...this.payplus_response,
        ...payplusResponse
      },
      updated_at: new Date()
    });
  };

  return PaymentSession;
}