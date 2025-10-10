import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    payplus_page_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'expired']]
      }
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'payplus',
    },
    payplus_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'production',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // PaymentIntent enhancement fields
    payment_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status_last_checked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'transaction',
    timestamps: false,
    indexes: [
      {
        fields: ['payplus_page_uid'],
        name: 'idx_transaction_payplus_page_uid'
      },
      {
        fields: ['payment_status'],
        name: 'idx_transaction_payment_status'
      },
      {
        fields: ['created_at'],
        name: 'idx_transaction_created_at'
      },
      {
        fields: ['status_last_checked_at'],
        name: 'idx_transaction_status_last_checked_at'
      },
      {
        fields: ['expires_at'],
        name: 'idx_transaction_expires_at'
      },
      {
        fields: ['session_id'],
        name: 'idx_transaction_session_id'
      },
    ],
  });

  Transaction.associate = function(models) {
    // Transaction has many purchases
    Transaction.hasMany(models.Purchase, {
      foreignKey: 'transaction_id',
      as: 'purchases'
    });
  };

  // Instance methods for PaymentIntent functionality
  Transaction.prototype.updateStatus = async function(newStatus, metadata = {}) {
    const validTransitions = {
      'pending': ['in_progress', 'expired', 'cancelled'],
      'in_progress': ['completed', 'failed', 'expired', 'cancelled'],
      'completed': [], // Terminal state
      'failed': ['pending'], // Allow retry
      'cancelled': ['pending'], // Allow retry
      'expired': ['pending'] // Allow retry
    };

    if (!validTransitions[this.payment_status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.payment_status} to ${newStatus}`);
    }

    const updateData = {
      payment_status: newStatus,
      status_last_checked_at: new Date(),
      updated_at: new Date()
    };

    if (newStatus === 'completed') {
      updateData.completed_at = new Date();
    }

    if (metadata) {
      updateData.payplus_response = {
        ...this.payplus_response,
        ...metadata
      };
    }

    return await this.update(updateData);
  };

  Transaction.prototype.setExpiration = async function(minutes = 30) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);

    return await this.update({
      expires_at: expiresAt,
      updated_at: new Date()
    });
  };

  Transaction.prototype.isExpired = function() {
    if (!this.expires_at) return false;
    return new Date() > this.expires_at;
  };

  Transaction.prototype.canBeRetried = function() {
    return ['failed', 'cancelled', 'expired'].includes(this.payment_status);
  };

  return Transaction;
}