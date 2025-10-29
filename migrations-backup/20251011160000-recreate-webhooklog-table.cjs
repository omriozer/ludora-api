'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Drop existing webhooklog table if it exists
    try {
      await queryInterface.dropTable('webhooklog');
      console.log('Dropped existing webhooklog table');
    } catch (error) {
      console.log('webhooklog table does not exist or error dropping:', error.message);
    }

    // Create new webhooklog table with comprehensive structure
    await queryInterface.createTable('webhooklog', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      // PayPlus webhook identifiers
      payplus_page_uid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payplus_transaction_uid: {
        type: DataTypes.STRING,
        allowNull: true,
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
      },
      status_name: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      // Processing results
      processing_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
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
      },
      session_id: {
        type: DataTypes.STRING,
        allowNull: true,
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
      indexes: [
        {
          fields: ['payplus_page_uid'],
          name: 'idx_webhooklog_payplus_page_uid'
        },
        {
          fields: ['payplus_transaction_uid'],
          name: 'idx_webhooklog_payplus_transaction_uid'
        },
        {
          fields: ['status_code'],
          name: 'idx_webhooklog_status_code'
        },
        {
          fields: ['processing_status'],
          name: 'idx_webhooklog_processing_status'
        },
        {
          fields: ['transaction_id'],
          name: 'idx_webhooklog_transaction_id'
        },
        {
          fields: ['session_id'],
          name: 'idx_webhooklog_session_id'
        },
        {
          fields: ['created_at'],
          name: 'idx_webhooklog_created_at'
        },
        {
          fields: ['webhook_source', 'processing_status'],
          name: 'idx_webhooklog_source_status'
        }
      ]
    });

    console.log('webhooklog table created successfully with comprehensive structure and indexes');
  },

  async down(queryInterface, Sequelize) {
    try {
      // Drop webhooklog table if it exists
      await queryInterface.dropTable('webhooklog');
      console.log('Dropped webhooklog table');
    } catch (error) {
      console.log('webhooklog table does not exist or error dropping:', error.message);
    }

    console.log('Reverted webhooklog table changes');
  }
};