'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Seed data for webhook_log table
     * Generated: 2025-10-30T08:30:00.000Z
     * Rows: 4 (complete backup data)
     */

    // Check if table exists
    const tableExists = await queryInterface.tableExists('webhook_log');
    if (!tableExists) {
      console.log('Table webhook_log does not exist, skipping seed');
      return;
    }

    // Check if data already exists
    const [results] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "webhook_log"'
    );

    if (results[0].count > 0) {
      console.log('Table webhook_log already has data, skipping seed');
      return;
    }

    // Insert complete seed data from backup
    await queryInterface.bulkInsert('webhook_log', [
      {
        id: '1761332340713bywm4uppf',
        provider: 'payplus',
        event_type: 'purchase',
        event_data: {
          amount: 100,
          status: 'success',
          currency: 'ILS',
          transaction_uid: 'test_transaction_456',
          page_request_uid: 'test_page_request_123',
          transaction_type: 'purchase'
        },
        sender_info: {
          ip: '::1',
          url: '/payplus',
          host: 'localhost:3003',
          query: {},
          method: 'POST',
          secure: false,
          headers: {
            authorization: null,
            'x-webhook-signature': null
          },
          protocol: 'http',
          timestamp: '2025-10-24T18:59:00.713Z',
          userAgent: 'PayPlus-Webhook/1.0',
          contentType: 'application/json',
          contentLength: '204'
        },
        response_data: {
          error: 'No transaction found for page_request_uid: test_page_request_123',
          message: 'PayPlus webhook received but processing failed',
          timestamp: '2025-10-24T18:59:00.736Z',
          webhookId: '1761332340713bywm4uppf'
        },
        process_log: '[2025-10-24T18:59:00.728Z] Webhook received and logged\n[2025-10-24T18:59:00.729Z] Sender IP: ::1, User-Agent: PayPlus-Webhook/1.0\n[2025-10-24T18:59:00.729Z] Starting webhook processing\n[2025-10-24T18:59:00.731Z] Processing webhook for page_request_uid: test_page_request_123\n[2025-10-24T18:59:00.736Z] Webhook processing failed: No transaction found for page_request_uid: test_page_request_123',
        status: 'failed',
        page_request_uid: 'test_page_request_123',
        payplus_transaction_uid: 'test_transaction_456',
        transaction_id: null,
        subscription_id: null,
        error_message: 'No transaction found for page_request_uid: test_page_request_123',
        processing_duration_ms: 23,
        created_at: new Date('2025-10-24T18:59:00.713Z'),
        updated_at: new Date('2025-10-24T18:59:00.736Z')
      },
      {
        id: '1761332361845l5j9hofby',
        provider: 'payplus',
        event_type: 'purchase',
        event_data: {
          amount: 100,
          status: 'success',
          currency: 'ILS',
          transaction_uid: 'payplus_transaction_789',
          page_request_uid: '00ce0be2-a28b-4839-b612-e7e5ed24c57d',
          transaction_type: 'purchase'
        },
        sender_info: {
          ip: '::1',
          url: '/payplus',
          host: 'localhost:3003',
          query: {},
          method: 'POST',
          secure: false,
          headers: {
            authorization: null,
            'x-webhook-signature': null
          },
          protocol: 'http',
          timestamp: '2025-10-24T18:59:21.844Z',
          userAgent: 'PayPlus-Webhook/1.0',
          contentType: 'application/json',
          contentLength: '222'
        },
        response_data: {
          status: 'success',
          message: 'PayPlus webhook processed successfully',
          timestamp: '2025-10-24T18:59:21.866Z',
          webhookId: '1761332361845l5j9hofby',
          transactionId: 'txn_1761329007728_ahk2nvju1'
        },
        process_log: '[2025-10-24T18:59:21.851Z] Webhook received and logged\n[2025-10-24T18:59:21.851Z] Sender IP: ::1, User-Agent: PayPlus-Webhook/1.0\n[2025-10-24T18:59:21.851Z] Starting webhook processing\n[2025-10-24T18:59:21.852Z] Processing webhook for page_request_uid: 00ce0be2-a28b-4839-b612-e7e5ed24c57d\n[2025-10-24T18:59:21.855Z] Found transaction: txn_1761329007728_ahk2nvju1\n[2025-10-24T18:59:21.857Z] Transaction type detected: subscription\n[2025-10-24T18:59:21.857Z] Subscription ID: sub_1761329006413_0w7qjxpks\n[2025-10-24T18:59:21.861Z] Transaction updated to completed status\n[2025-10-24T18:59:21.861Z] Processing subscription payment completion for subscription: sub_1761329006413_0w7qjxpks\n[2025-10-24T18:59:21.862Z] Found subscription: sub_1761329006413_0w7qjxpks, status: pending\n[2025-10-24T18:59:21.864Z] Subscription sub_1761329006413_0w7qjxpks activated successfully\n[2025-10-24T18:59:21.864Z] Payment success processing completed',
        status: 'completed',
        page_request_uid: '00ce0be2-a28b-4839-b612-e7e5ed24c57d',
        payplus_transaction_uid: 'payplus_transaction_789',
        transaction_id: null,
        subscription_id: null,
        error_message: null,
        processing_duration_ms: 20,
        created_at: new Date('2025-10-24T18:59:21.845Z'),
        updated_at: new Date('2025-10-24T18:59:21.864Z')
      },
      {
        id: '1761332412518uul5u5izu',
        provider: 'payplus',
        event_type: 'purchase',
        event_data: {
          amount: 150,
          status: 'success',
          currency: 'ILS',
          transaction_uid: 'payplus_transaction_999',
          page_request_uid: 'cc4483b8-e09d-47dd-a34b-f34d2eec585c',
          transaction_type: 'purchase'
        },
        sender_info: {
          ip: '::1',
          url: '/payplus',
          host: 'localhost:3003',
          query: {},
          method: 'POST',
          secure: false,
          headers: {
            authorization: null,
            'x-webhook-signature': null
          },
          protocol: 'http',
          timestamp: '2025-10-24T19:00:12.517Z',
          userAgent: 'PayPlus-Webhook/1.0',
          contentType: 'application/json',
          contentLength: '222'
        },
        response_data: {
          status: 'success',
          message: 'PayPlus webhook processed successfully',
          timestamp: '2025-10-24T19:00:12.559Z',
          webhookId: '1761332412518uul5u5izu',
          transactionId: 'txn_1761329789641_a0bjfigal'
        },
        process_log: '[2025-10-24T19:00:12.531Z] Webhook received and logged\n[2025-10-24T19:00:12.531Z] Sender IP: ::1, User-Agent: PayPlus-Webhook/1.0\n[2025-10-24T19:00:12.531Z] Starting webhook processing\n[2025-10-24T19:00:12.535Z] Processing webhook for page_request_uid: cc4483b8-e09d-47dd-a34b-f34d2eec585c\n[2025-10-24T19:00:12.542Z] Found transaction: txn_1761329789641_a0bjfigal\n[2025-10-24T19:00:12.543Z] Transaction type detected: subscription\n[2025-10-24T19:00:12.543Z] Subscription ID: sub_1761329006413_0w7qjxpks\n[2025-10-24T19:00:12.546Z] Transaction updated to completed status\n[2025-10-24T19:00:12.546Z] Processing subscription payment completion for subscription: sub_1761329006413_0w7qjxpks\n[2025-10-24T19:00:12.547Z] Found subscription: sub_1761329006413_0w7qjxpks, status: active\n[2025-10-24T19:00:12.554Z] Failed to process subscription payment: Cannot activate subscription with status: active\n[2025-10-24T19:00:12.554Z] Payment success processing completed',
        status: 'completed',
        page_request_uid: 'cc4483b8-e09d-47dd-a34b-f34d2eec585c',
        payplus_transaction_uid: 'payplus_transaction_999',
        transaction_id: null,
        subscription_id: null,
        error_message: null,
        processing_duration_ms: 37,
        created_at: new Date('2025-10-24T19:00:12.518Z'),
        updated_at: new Date('2025-10-24T19:00:12.554Z')
      },
      {
        id: '1761332432143zi9cyn53e',
        provider: 'payplus',
        event_type: 'purchase',
        event_data: {
          amount: 200,
          reason: 'Insufficient funds',
          status: 'failed',
          currency: 'ILS',
          transaction_uid: 'payplus_transaction_failed_123',
          page_request_uid: '47d19f33-d8d5-4e54-9f65-838b53008585',
          transaction_type: 'purchase'
        },
        sender_info: {
          ip: '::1',
          url: '/payplus',
          host: 'localhost:3003',
          query: {},
          method: 'POST',
          secure: false,
          headers: {
            authorization: null,
            'x-webhook-signature': null
          },
          protocol: 'http',
          timestamp: '2025-10-24T19:00:32.143Z',
          userAgent: 'PayPlus-Webhook/1.0',
          contentType: 'application/json',
          contentLength: '264'
        },
        response_data: {
          status: 'failed',
          message: 'PayPlus webhook processed successfully',
          timestamp: '2025-10-24T19:00:32.164Z',
          webhookId: '1761332432143zi9cyn53e',
          transactionId: 'txn_1761329986971_5xbzpvb1z'
        },
        process_log: '[2025-10-24T19:00:32.149Z] Webhook received and logged\n[2025-10-24T19:00:32.149Z] Sender IP: ::1, User-Agent: PayPlus-Webhook/1.0\n[2025-10-24T19:00:32.149Z] Starting webhook processing\n[2025-10-24T19:00:32.152Z] Processing webhook for page_request_uid: 47d19f33-d8d5-4e54-9f65-838b53008585\n[2025-10-24T19:00:32.156Z] Found transaction: txn_1761329986971_5xbzpvb1z\n[2025-10-24T19:00:32.157Z] Transaction type detected: subscription\n[2025-10-24T19:00:32.157Z] Subscription ID: sub_1761329006413_0w7qjxpks\n[2025-10-24T19:00:32.159Z] Processing payment failure with status: failed\n[2025-10-24T19:00:32.160Z] Transaction updated to failed status\n[2025-10-24T19:00:32.160Z] Processing subscription payment failure for subscription: sub_1761329006413_0w7qjxpks\n[2025-10-24T19:00:32.160Z] Found subscription: sub_1761329006413_0w7qjxpks, handling payment failure\n[2025-10-24T19:00:32.162Z] Subscription sub_1761329006413_0w7qjxpks payment failure handled successfully\n[2025-10-24T19:00:32.162Z] Payment failure processing completed',
        status: 'completed',
        page_request_uid: '47d19f33-d8d5-4e54-9f65-838b53008585',
        payplus_transaction_uid: 'payplus_transaction_failed_123',
        transaction_id: null,
        subscription_id: null,
        error_message: null,
        processing_duration_ms: 19,
        created_at: new Date('2025-10-24T19:00:32.143Z'),
        updated_at: new Date('2025-10-24T19:00:32.162Z')
      }
    ]);

    console.log('✅ Seeded 4 rows into webhook_log');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove seeded data from webhook_log table
     */
    await queryInterface.bulkDelete('webhook_log', null, {});
  }
};
