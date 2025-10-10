import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const WebhookLog = sequelize.define('WebhookLog', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    // PayPlus webhook identifiers
    payplus_page_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      index: true
    },
    payplus_transaction_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      index: true
    },
    // Request details
    http_method: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'POST'
    },
    request_headers: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    request_body: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true
    },
    // PayPlus data
    payplus_data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    status_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      index: true
    },
    status_name: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    // Processing results
    processing_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'processed', 'failed', 'skipped']]
      }
    },
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    response_data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    error_stack: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // References to related entities
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
      index: true
    },
    session_id: {
      type: DataTypes.STRING,
      allowNull: true,
      index: true
    },
    purchase_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
    },
    // Processing metadata
    processing_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    webhook_source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'payplus'
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
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'webhooklog',
    timestamps: false,
    indexes: [
      {
        fields: ['payplus_page_uid']
      },
      {
        fields: ['payplus_transaction_uid']
      },
      {
        fields: ['status_code']
      },
      {
        fields: ['processing_status']
      },
      {
        fields: ['transaction_id']
      },
      {
        fields: ['session_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['webhook_source', 'processing_status']
      }
    ]
  });

  return WebhookLog;
}