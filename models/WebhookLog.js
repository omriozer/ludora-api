import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const WebhookLog = sequelize.define('WebhookLog', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['payplus', 'stripe', 'paypal', 'github', 'generic']]
      }
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    event_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    sender_info: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    response_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    process_log: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'received',
      validate: {
        isIn: [['received', 'processing', 'completed', 'failed']]
      }
    },
    page_request_uid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payplus_transaction_uid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'transaction',
        key: 'id'
      }
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'subscription',
        key: 'id'
      }
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processing_duration_ms: {
      type: DataTypes.INTEGER,
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
    tableName: 'webhook_log',
    timestamps: false,
    indexes: [
      {
        fields: ['provider'],
        name: 'idx_webhook_log_provider'
      },
      {
        fields: ['status'],
        name: 'idx_webhook_log_status'
      },
      {
        fields: ['page_request_uid'],
        name: 'idx_webhook_log_page_request_uid'
      },
      {
        fields: ['payplus_transaction_uid'],
        name: 'idx_webhook_log_payplus_transaction_uid'
      },
      {
        fields: ['created_at'],
        name: 'idx_webhook_log_created_at'
      },
      {
        fields: ['transaction_id'],
        name: 'idx_webhook_log_transaction_id'
      },
      {
        fields: ['subscription_id'],
        name: 'idx_webhook_log_subscription_id'
      },
    ],
  });

  WebhookLog.associate = function(models) {
    // Association to transaction
    WebhookLog.belongsTo(models.Transaction, {
      foreignKey: 'transaction_id',
      as: 'transaction'
    });

    // Association to subscription
    WebhookLog.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });
  };

  /**
   * Helper method to add a log entry to the process_log
   */
  WebhookLog.prototype.addProcessLog = function(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;

    if (this.process_log) {
      this.process_log += '\n' + logEntry;
    } else {
      this.process_log = logEntry;
    }
  };

  /**
   * Helper method to update status and add log entry
   */
  WebhookLog.prototype.updateStatus = async function(status, message = null) {
    this.status = status;
    if (message) {
      this.addProcessLog(message);
    }
    this.updated_at = new Date();
    await this.save();
  };

  /**
   * Helper method to complete processing with duration
   */
  WebhookLog.prototype.completeProcessing = async function(startTime, message = null) {
    this.processing_duration_ms = Date.now() - startTime;
    await this.updateStatus('completed', message || 'Processing completed successfully');
  };

  /**
   * Helper method to fail processing with error
   */
  WebhookLog.prototype.failProcessing = async function(startTime, error, message = null) {
    this.processing_duration_ms = Date.now() - startTime;
    this.error_message = error.message || error.toString();
    await this.updateStatus('failed', message || `Processing failed: ${this.error_message}`);
  };

  return WebhookLog;
}