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
    // Enhanced audit trail fields
    processing_source: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Source that processed the payment: webhook, polling, manual'
    },
    processing_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When payment processing began'
    },
    processing_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When payment processing finished'
    },
    status_history: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of status changes with timestamps and sources'
    },
    processing_attempts: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Number of processing attempts (for retry tracking)'
    },
    race_condition_winner: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Which method won the race condition: webhook or polling'
    },
    last_polling_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time polling service checked this transaction'
    },
    webhook_received_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When webhook was received for this transaction'
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
      // Audit trail indexes
      {
        fields: ['processing_source'],
        name: 'idx_transaction_processing_source'
      },
      {
        fields: ['processing_started_at'],
        name: 'idx_transaction_processing_started_at'
      },
      {
        fields: ['race_condition_winner'],
        name: 'idx_transaction_race_winner'
      },
      {
        fields: ['last_polling_check_at'],
        name: 'idx_transaction_last_polling_check'
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

  // Enhanced audit trail methods
  Transaction.prototype.addStatusHistoryEntry = function(newStatus, source, details = {}) {
    const currentHistory = this.status_history || [];
    const historyEntry = {
      timestamp: new Date().toISOString(),
      from_status: this.payment_status,
      to_status: newStatus,
      source: source, // 'webhook', 'polling', 'manual', etc.
      processing_time_ms: details.processing_time_ms,
      race_condition_result: details.race_condition_result,
      details: details
    };

    return [...currentHistory, historyEntry];
  };

  Transaction.prototype.updateStatusWithAudit = async function(newStatus, source, metadata = {}) {
    const processingStartTime = Date.now();

    // Add to status history
    const newStatusHistory = this.addStatusHistoryEntry(newStatus, source, {
      ...metadata,
      processing_time_ms: Date.now() - processingStartTime
    });

    const updateData = {
      payment_status: newStatus,
      status_last_checked_at: new Date(),
      updated_at: new Date(),
      status_history: newStatusHistory,
      processing_attempts: (this.processing_attempts || 0) + 1
    };

    // Set processing source if this is the first processing attempt
    if (!this.processing_source) {
      updateData.processing_source = source;
      updateData.processing_started_at = new Date();
    }

    // Set completion timestamp and source
    if (newStatus === 'completed') {
      updateData.completed_at = new Date();
      updateData.processing_completed_at = new Date();
      updateData.race_condition_winner = source;
    }

    // Update webhook received timestamp
    if (source === 'webhook' && !this.webhook_received_at) {
      updateData.webhook_received_at = new Date();
    }

    // Update polling check timestamp
    if (source === 'polling') {
      updateData.last_polling_check_at = new Date();
    }

    if (metadata) {
      updateData.payplus_response = {
        ...this.payplus_response,
        ...metadata,
        audit_trail: {
          last_updated_by: source,
          last_updated_at: new Date().toISOString(),
          processing_attempts: updateData.processing_attempts
        }
      };
    }

    return await this.update(updateData);
  };

  Transaction.prototype.markPollingCheck = async function() {
    return await this.update({
      last_polling_check_at: new Date(),
      updated_at: new Date()
    });
  };

  Transaction.prototype.markWebhookReceived = async function() {
    return await this.update({
      webhook_received_at: new Date(),
      updated_at: new Date()
    });
  };

  Transaction.prototype.getProcessingTimeline = function() {
    const timeline = [];

    if (this.created_at) {
      timeline.push({
        event: 'transaction_created',
        timestamp: this.created_at,
        source: 'system'
      });
    }

    if (this.processing_started_at) {
      timeline.push({
        event: 'processing_started',
        timestamp: this.processing_started_at,
        source: this.processing_source
      });
    }

    if (this.webhook_received_at) {
      timeline.push({
        event: 'webhook_received',
        timestamp: this.webhook_received_at,
        source: 'webhook'
      });
    }

    if (this.last_polling_check_at) {
      timeline.push({
        event: 'polling_check',
        timestamp: this.last_polling_check_at,
        source: 'polling'
      });
    }

    if (this.completed_at) {
      timeline.push({
        event: 'payment_completed',
        timestamp: this.completed_at,
        source: this.race_condition_winner || this.processing_source
      });
    }

    // Add status history events
    if (this.status_history && this.status_history.length > 0) {
      this.status_history.forEach(entry => {
        timeline.push({
          event: 'status_change',
          timestamp: new Date(entry.timestamp),
          source: entry.source,
          details: `${entry.from_status} → ${entry.to_status}`,
          race_result: entry.race_condition_result
        });
      });
    }

    // Sort by timestamp
    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  Transaction.prototype.getRaceConditionSummary = function() {
    return {
      processing_source: this.processing_source,
      race_condition_winner: this.race_condition_winner,
      webhook_received: !!this.webhook_received_at,
      polling_checked: !!this.last_polling_check_at,
      processing_attempts: this.processing_attempts || 0,
      total_processing_time: this.processing_started_at && this.processing_completed_at
        ? new Date(this.processing_completed_at) - new Date(this.processing_started_at)
        : null
    };
  };

  return Transaction;
}