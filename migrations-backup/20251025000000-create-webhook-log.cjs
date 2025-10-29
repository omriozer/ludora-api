'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if webhook_log table already exists
    const tableExists = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_log';`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tableExists.length > 0) {
      console.log('webhook_log table already exists, skipping creation');
      return;
    }

    await queryInterface.createTable('webhook_log', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Webhook provider (payplus, stripe, etc.)'
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Type of webhook event'
      },
      event_data: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Complete webhook payload data'
      },
      sender_info: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Information about who sent the webhook (IP, user-agent, headers, etc.)'
      },
      response_data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Response data sent back to webhook sender'
      },
      process_log: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Log of processing steps and any errors'
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'received',
        comment: 'Status: received, processing, completed, failed'
      },
      page_request_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'PayPlus page request UID for tracking'
      },
      payplus_transaction_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'PayPlus transaction UID for tracking'
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'transaction',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Related transaction ID if found'
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'subscription',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Related subscription ID if found'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if processing failed'
      },
      processing_duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time taken to process webhook in milliseconds'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('webhook_log', ['provider'], {
      name: 'idx_webhook_log_provider'
    });

    await queryInterface.addIndex('webhook_log', ['status'], {
      name: 'idx_webhook_log_status'
    });

    await queryInterface.addIndex('webhook_log', ['page_request_uid'], {
      name: 'idx_webhook_log_page_request_uid'
    });

    await queryInterface.addIndex('webhook_log', ['payplus_transaction_uid'], {
      name: 'idx_webhook_log_payplus_transaction_uid'
    });

    await queryInterface.addIndex('webhook_log', ['created_at'], {
      name: 'idx_webhook_log_created_at'
    });

    await queryInterface.addIndex('webhook_log', ['transaction_id'], {
      name: 'idx_webhook_log_transaction_id'
    });

    await queryInterface.addIndex('webhook_log', ['subscription_id'], {
      name: 'idx_webhook_log_subscription_id'
    });

    console.log('✅ webhook_log table created successfully');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('webhook_log');
    console.log('✅ webhook_log table dropped successfully');
  }
};