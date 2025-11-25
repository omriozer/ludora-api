import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'ILS'
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
      allowNull: true,
      defaultValue: 'pending'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    environment: {
      type: DataTypes.ENUM('production', 'staging'),
      allowNull: true
    },
    payment_page_request_uid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_page_link: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    provider_response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'transaction',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_transaction_user_id'
      },
      {
        fields: ['payment_status'],
        name: 'idx_transaction_payment_status'
      },
      {
        fields: ['payment_page_request_uid'],
        name: 'idx_transaction_payment_page_request_uid'
      },
      {
        fields: ['environment'],
        name: 'idx_transaction_environment'
      },
      {
        fields: ['created_at'],
        name: 'idx_transaction_created_at'
      },
    ],
  });

  Transaction.associate = function(models) {
    // Transaction has many purchases
    Transaction.hasMany(models.Purchase, {
      foreignKey: 'transaction_id',
      as: 'purchases'
    });

    // Transaction belongs to user
    Transaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Simplified instance methods
  Transaction.prototype.updateStatus = async function(newStatus, metadata = {}) {
    const validTransitions = {
      'pending': ['completed', 'failed', 'cancelled'],
      'completed': [], // Terminal state
      'failed': ['pending'], // Allow retry
      'cancelled': ['pending'], // Allow retry
      'refunded': [] // Terminal state
    };

    if (!validTransitions[this.payment_status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.payment_status} to ${newStatus}`);
    }

    const updateData = {
      payment_status: newStatus,
      updated_at: new Date()
    };

    if (metadata) {
      updateData.provider_response = {
        ...this.provider_response,
        ...metadata
      };
    }

    return await this.update(updateData);
  };

  Transaction.prototype.isCompleted = function() {
    return this.payment_status === 'completed';
  };

  Transaction.prototype.isFailed = function() {
    return ['failed', 'cancelled'].includes(this.payment_status);
  };

  Transaction.prototype.canBeRetried = function() {
    return ['failed', 'cancelled'].includes(this.payment_status);
  };

  Transaction.prototype.setFailureReason = async function(reason) {
    return await this.update({
      failure_reason: reason,
      payment_status: 'failed',
      updated_at: new Date()
    });
  };

  return Transaction;
}