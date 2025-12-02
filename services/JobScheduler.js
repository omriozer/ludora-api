/**
 * JobScheduler - Core scheduled jobs system for Ludora API
 *
 * Replaces all setTimeout/setInterval workarounds with Redis-backed persistent jobs.
 * Provides retry logic, monitoring, and deployment-safe job persistence.
 *
 * Features:
 * - Redis-backed job persistence (survives server restarts)
 * - Priority queues (critical payments get priority over cleanup)
 * - Automatic retry with exponential backoff
 * - Comprehensive logging and monitoring
 * - Graceful shutdown handling
 * - Horizontal scaling support
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { ludlog, luderror } from '../lib/ludlog.js';

class JobScheduler {
  constructor() {
    this.redis = null;
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.redisAvailable = true; // Assume available until proven otherwise

    // Job type definitions with priorities and default settings
    this.jobTypes = {
      // CRITICAL - Payment and subscription jobs (highest priority)
      SUBSCRIPTION_PAYMENT_CHECK: {
        queue: 'critical',
        priority: 100,
        maxAttempts: 6,
        backoffType: 'exponential',
        backoffSettings: { delay: 5000 }
      },
      PAYMENT_STATUS_CHECK: {
        queue: 'critical',
        priority: 90,
        maxAttempts: 3,
        backoffType: 'exponential',
        backoffSettings: { delay: 2000 }
      },

      // HIGH - Security and session management
      WEBHOOK_SECURITY_MONITOR: {
        queue: 'high',
        priority: 70,
        maxAttempts: 3,
        backoffType: 'fixed',
        backoffSettings: { delay: 10000 }
      },
      SESSION_CLEANUP: {
        queue: 'high',
        priority: 60,
        maxAttempts: 2,
        backoffType: 'fixed',
        backoffSettings: { delay: 30000 }
      },

      // MEDIUM - Maintenance and cleanup
      FILE_CLEANUP_ORPHANED: {
        queue: 'medium',
        priority: 40,
        maxAttempts: 2,
        backoffType: 'fixed',
        backoffSettings: { delay: 60000 }
      },
      DATABASE_MAINTENANCE: {
        queue: 'medium',
        priority: 30,
        maxAttempts: 2,
        backoffType: 'fixed',
        backoffSettings: { delay: 120000 }
      },

      // LOW - Background analytics and reporting
      ANALYTICS_REPORT: {
        queue: 'low',
        priority: 10,
        maxAttempts: 1,
        backoffType: 'fixed',
        backoffSettings: { delay: 300000 }
      }
    };
  }

  /**
   * Initialize Redis connection and create queues
   */
  async initialize() {
    if (this.isInitialized) {
      ludlog.generic('JobScheduler already initialized');
      return;
    }

    try {
      // Create Redis connection
      const redisUrl = process.env.REDIS_URL || process.env.REDISTOGO_URL || 'redis://localhost:6379';
      const environment = process.env.ENVIRONMENT || 'development';
      const hasRedisUrl = !!(process.env.REDIS_URL || process.env.REDISTOGO_URL);

      // Development or staging without Redis should fail gracefully
      const shouldFailGracefully = environment === 'development' || !hasRedisUrl;

      // In non-production environments without Redis, do a quick availability check first
      if (shouldFailGracefully) {
        try {
          const testConnection = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            connectTimeout: 2000
          });

          await testConnection.ping();
          await testConnection.disconnect();
          // If we get here, Redis is available
          ludlog.generic('JobScheduler Redis available in non-production environment');
        } catch (testError) {
          // Redis is not available - fail gracefully
          ludlog.generic(`JobScheduler Redis not available in ${environment} environment`, {
            message: `Job scheduling disabled - Redis not configured. Jobs will be manual-only.`,
            environment,
            error: testError.code || 'ECONNREFUSED',
            hasRedisUrl,
            note: environment === 'development'
              ? 'To enable automatic job scheduling: brew install redis && brew services start redis (macOS)'
              : 'Configure Redis addon to enable automatic job scheduling'
          });

          this.redisAvailable = false;
          this.isInitialized = false; // Keep false so job scheduling is disabled

          // Don't throw error - let server start without job scheduling
          return;
        }
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: shouldFailGracefully ? null : 3,
        retryDelayOnFailover: shouldFailGracefully ? 0 : 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 1000,
        lazyConnect: true,
        connectTimeout: shouldFailGracefully ? 2000 : 10000,
        retryDelayOnClusterDown: shouldFailGracefully ? 0 : 100,
        retryDelayOnClusterFailover: shouldFailGracefully ? 0 : 100
      });

      this.redis.on('connect', () => {
        ludlog.generic('JobScheduler Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        if (!shouldFailGracefully) {
          luderror.generic('JobScheduler Redis connection error:', error);
        }
      });

      // Test Redis connection
      await this.redis.ping();

      // Create priority-based queues
      const queueNames = ['critical', 'high', 'medium', 'low'];

      for (const queueName of queueNames) {
        // Create queue
        const queue = new Queue(queueName, {
          connection: this.redis,
          defaultJobOptions: {
            removeOnComplete: 50,  // Keep last 50 completed jobs
            removeOnFail: 100,     // Keep last 100 failed jobs
          }
        });

        // Create worker for this queue
        const worker = new Worker(queueName, async (job) => {
          return this.processJob(job);
        }, {
          connection: this.redis,
          concurrency: this.getWorkerConcurrency(queueName),
          maxStalledCount: 3,
          stalledInterval: 30000,
          maxStalledTime: 60000
        });

        // Create queue events for monitoring
        const queueEvents = new QueueEvents(queueName, {
          connection: this.redis
        });

        // Set up event listeners
        this.setupEventListeners(worker, queueEvents, queueName);

        // Store references
        this.queues.set(queueName, queue);
        this.workers.set(queueName, worker);
        this.queueEvents.set(queueName, queueEvents);
      }

      this.isInitialized = true;
      ludlog.generic('JobScheduler initialized successfully with Redis-backed persistence');

    } catch (error) {
      const environment = process.env.ENVIRONMENT || 'development';
      const hasRedisUrl = !!(process.env.REDIS_URL || process.env.REDISTOGO_URL);
      const shouldFailGracefully = environment === 'development' || !hasRedisUrl;

      if (shouldFailGracefully && (error.code === 'ECONNREFUSED' || error.message.includes('Redis connection timeout'))) {
        // Graceful failure in non-production environments without Redis
        ludlog.generic(`JobScheduler Redis not available in ${environment} environment`, {
          message: 'Job scheduling disabled - Redis not configured',
          environment,
          redisUrl: process.env.REDIS_URL || process.env.REDISTOGO_URL || 'redis://localhost:6379',
          hasRedisUrl,
          installInstructions: environment === 'development'
            ? 'Run: brew install redis && brew services start redis (macOS) or install Redis for your OS'
            : 'Configure Redis addon in Heroku to enable job scheduling'
        });

        // Mark as not initialized and Redis unavailable
        this.isInitialized = false; // Keep false so job scheduling is disabled
        this.redisAvailable = false;

        // Don't throw error - let server start without job scheduling
        return;
      } else {
        // In production with Redis or with other critical errors, this is a failure
        luderror.generic('Failed to initialize JobScheduler:', error);
        throw new Error(`JobScheduler initialization failed: ${error.message}`);
      }
    }
  }

  /**
   * Get worker concurrency based on queue priority
   */
  getWorkerConcurrency(queueName) {
    const concurrencyMap = {
      critical: 10,  // High concurrency for payments
      high: 5,       // Medium concurrency for security/sessions
      medium: 3,     // Low concurrency for maintenance
      low: 1         // Single worker for background tasks
    };
    return concurrencyMap[queueName] || 1;
  }

  /**
   * Set up event listeners for monitoring and logging
   */
  setupEventListeners(worker, queueEvents, queueName) {
    // Job completion
    worker.on('completed', (job) => {
      ludlog.generic(`Job completed: ${job.name} in queue ${queueName}`, {
        jobId: job.id,
        processingTime: Date.now() - job.timestamp,
        data: job.data
      });
    });

    // Job failure
    worker.on('failed', (job, error) => {
      luderror.generic(`Job failed: ${job.name} in queue ${queueName}`, {
        jobId: job.id,
        error: error.message,
        attemptsMade: job.attemptsMade,
        data: job.data
      });
    });

    // Job stalled
    worker.on('stalled', (jobId) => {
      luderror.generic(`Job stalled: ${jobId} in queue ${queueName}`);
    });

    // Queue events
    queueEvents.on('waiting', ({ jobId }) => {
      ludlog.generic(`Job waiting: ${jobId} in queue ${queueName}`);
    });

    queueEvents.on('active', ({ jobId }) => {
      ludlog.generic(`Job started: ${jobId} in queue ${queueName}`);
    });
  }

  /**
   * Process a job based on its type
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      ludlog.generic(`Processing job: ${type}`, { jobId: job.id, data });

      switch (type) {
        case 'SUBSCRIPTION_PAYMENT_CHECK':
          return await this.processSubscriptionPaymentCheck(data);

        case 'PAYMENT_STATUS_CHECK':
          return await this.processPaymentStatusCheck(data);

        case 'WEBHOOK_SECURITY_MONITOR':
          return await this.processWebhookSecurityMonitor(data);

        case 'SESSION_CLEANUP':
          return await this.processSessionCleanup(data);

        case 'FILE_CLEANUP_ORPHANED':
          return await this.processFileCleanupOrphaned(data);

        case 'DATABASE_MAINTENANCE':
          return await this.processDatabaseMaintenance(data);

        case 'ANALYTICS_REPORT':
          return await this.processAnalyticsReport(data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

    } catch (error) {
      luderror.generic(`Job processing failed: ${type}`, {
        jobId: job.id,
        error: error.message,
        data
      });
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Schedule a job with the appropriate queue and settings
   */
  async scheduleJob(type, data, options = {}) {
    if (!this.isInitialized) {
      const environment = process.env.ENVIRONMENT || 'development';
      const hasRedisUrl = !!(process.env.REDIS_URL || process.env.REDISTOGO_URL);
      const shouldFailGracefully = environment === 'development' || !hasRedisUrl;

      if (shouldFailGracefully && this.redisAvailable === false) {
        // Graceful failure in non-production environments without Redis - just log and return null
        ludlog.generic(`JobScheduler: Skipping job scheduling in ${environment} (Redis not available)`, {
          jobType: type,
          environment,
          hasRedisUrl,
          message: environment === 'development'
            ? 'Install Redis to enable job scheduling'
            : 'Configure Redis addon to enable job scheduling'
        });
        return null;
      }

      throw new Error('JobScheduler not initialized. Call initialize() first.');
    }

    if (this.isShuttingDown) {
      ludlog.generic('JobScheduler is shutting down, rejecting new jobs');
      return null;
    }

    const jobConfig = this.jobTypes[type];
    if (!jobConfig) {
      throw new Error(`Unknown job type: ${type}`);
    }

    const queue = this.queues.get(jobConfig.queue);
    if (!queue) {
      throw new Error(`Queue ${jobConfig.queue} not found`);
    }

    try {
      const jobOptions = {
        priority: options.priority || jobConfig.priority,
        attempts: options.maxAttempts || jobConfig.maxAttempts,
        backoff: {
          type: options.backoffType || jobConfig.backoffType,
          settings: options.backoffSettings || jobConfig.backoffSettings
        },
        delay: options.delay || 0,
        removeOnComplete: options.removeOnComplete || 50,
        removeOnFail: options.removeOnFail || 100,
        ...options.jobOptions
      };

      const job = await queue.add(type, { type, data }, jobOptions);

      ludlog.generic(`Job scheduled: ${type}`, {
        jobId: job.id,
        queue: jobConfig.queue,
        priority: jobOptions.priority,
        delay: jobOptions.delay,
        data
      });

      return job;

    } catch (error) {
      luderror.generic(`Failed to schedule job: ${type}`, { error: error.message, data });
      throw error;
    }
  }

  /**
   * Schedule a recurring job using cron syntax
   */
  async scheduleRecurringJob(type, data, cronExpression, options = {}) {
    const jobOptions = {
      ...options,
      repeat: {
        pattern: cronExpression,
        ...options.repeatOptions
      }
    };

    return this.scheduleJob(type, data, jobOptions);
  }

  /**
   * Get job statistics and queue status
   */
  async getStats() {
    if (!this.isInitialized) {
      return { error: 'JobScheduler not initialized' };
    }

    const stats = {
      queues: {},
      workers: {},
      redis: {
        connected: this.redis.status === 'ready'
      }
    };

    for (const [queueName, queue] of this.queues) {
      try {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        stats.queues[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        };

        const worker = this.workers.get(queueName);
        stats.workers[queueName] = {
          running: worker.isRunning(),
          concurrency: this.getWorkerConcurrency(queueName)
        };

      } catch (error) {
        stats.queues[queueName] = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Graceful shutdown - wait for active jobs to complete
   */
  async shutdown(timeoutMs = 10000) {
    if (!this.isInitialized || this.isShuttingDown) {
      return;
    }

    ludlog.generic('JobScheduler graceful shutdown initiated');
    this.isShuttingDown = true;

    const shutdownPromises = [];

    // Close all workers
    for (const [queueName, worker] of this.workers) {
      ludlog.generic(`Closing worker for queue: ${queueName}`);
      shutdownPromises.push(worker.close());
    }

    // Close all queue events
    for (const [, queueEvents] of this.queueEvents) {
      shutdownPromises.push(queueEvents.close());
    }

    // Wait for all to close or timeout
    try {
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs)
        )
      ]);

      ludlog.generic('JobScheduler workers closed gracefully');
    } catch (error) {
      luderror.generic('JobScheduler shutdown timeout, forcing close:', error);
    }

    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
      ludlog.generic('JobScheduler Redis connection closed');
    }

    ludlog.generic('JobScheduler shutdown complete');
  }

  // Placeholder methods for job processors - will be implemented in following todos
  async processSubscriptionPaymentCheck(data) {
    const {
      subscriptionId,
      attemptNumber = 1,
      maxAttempts = 6,
      isRetryPayment = false
    } = data;

    try {
      ludlog.payment(`🔄 Subscription payment check attempt ${attemptNumber}/${maxAttempts}`, {
        subscriptionId: subscriptionId.substring(0, 20) + '...',
        attemptNumber,
        maxAttempts,
        isRetryPayment,
        source: 'job_scheduler'
      });

      // Import SubscriptionPaymentStatusService dynamically
      const SubscriptionPaymentStatusService = (await import('./SubscriptionPaymentStatusService.js')).default;

      const pollResult = await SubscriptionPaymentStatusService.checkAndHandleSubscriptionPaymentPageStatus(
        subscriptionId,
        { attemptNumber, maxAttempts }
      );

      // Determine if we should continue polling
      const shouldContinuePolling = pollResult.success &&
        pollResult.action_taken === 'none' &&
        (pollResult.shouldRetryLater || pollResult.pageStatus === 'unknown' || pollResult.pageStatus === 'pending_processing');

      if (shouldContinuePolling && attemptNumber < maxAttempts) {
        // Progressive delays: 5s → 10s → 15s → 20s → 30s → 60s
        const delays = [5000, 10000, 15000, 20000, 30000, 60000];
        const nextDelay = delays[attemptNumber - 1] || 60000; // Default to 60s for attempts beyond array

        ludlog.payment(`⏳ Scheduling next subscription poll in ${nextDelay / 1000}s`, {
          subscriptionId: subscriptionId.substring(0, 20) + '...',
          nextAttempt: attemptNumber + 1,
          delaySeconds: nextDelay / 1000,
          source: 'job_scheduler'
        });

        // Schedule next attempt with progressive delay using job scheduler
        await this.scheduleJob('SUBSCRIPTION_PAYMENT_CHECK', {
          subscriptionId,
          attemptNumber: attemptNumber + 1,
          maxAttempts,
          isRetryPayment
        }, {
          delay: nextDelay,
          priority: 100 // Highest priority for payment checking
        });

        return {
          success: true,
          action: 'scheduled_next_attempt',
          nextAttempt: attemptNumber + 1,
          delayMs: nextDelay,
          pollResult
        };
      } else {
        ludlog.payment('✅ Subscription payment polling complete', {
          subscriptionId: subscriptionId.substring(0, 20) + '...',
          finalStatus: pollResult.action_taken,
          totalAttempts: attemptNumber,
          source: 'job_scheduler'
        });

        return {
          success: true,
          action: 'polling_complete',
          finalStatus: pollResult.action_taken,
          totalAttempts: attemptNumber,
          pollResult
        };
      }

    } catch (error) {
      luderror.payment(`❌ Subscription payment check failed for ${subscriptionId}:`, {
        error: error.message,
        attemptNumber,
        maxAttempts,
        subscriptionId: subscriptionId.substring(0, 20) + '...'
      });

      // Don't schedule retry on error to prevent infinite loops
      return {
        success: false,
        action: 'failed',
        error: error.message,
        attemptNumber,
        pollResult: null
      };
    }
  }

  async processPaymentStatusCheck(data) {
    const {
      checkType = 'pending_subscriptions',
      batchSize = 50,
      maxAge = 48, // hours - check subscriptions pending for max 48 hours
      transactionId = null,
      attemptNumber = 1,
      maxAttempts = 10,
      source = 'automated'
    } = data;

    try {
      ludlog.payment(`Processing payment status check - type: ${checkType}`, {
        checkType,
        batchSize,
        maxAge,
        transactionId,
        attemptNumber,
        maxAttempts,
        source: 'job_scheduler'
      });

      // Import services dynamically
      const models = (await import('../models/index.js')).default;
      const PaymentPollingService = (await import('./PaymentPollingService.js')).default;

      let processedCount = 0;
      let activatedCount = 0;
      let cancelledCount = 0;
      let errorCount = 0;

      // Handle single transaction polling
      if (checkType === 'single_transaction' && transactionId) {
        try {
          ludlog.payment(`Polling single transaction: ${transactionId} (attempt ${attemptNumber}/${maxAttempts})`, {
            transactionId,
            attemptNumber,
            maxAttempts,
            source: 'job_scheduler'
          });

          const pollResult = await PaymentPollingService.pollTransactionStatus(transactionId);

          processedCount = 1;

          // Determine if we should continue polling
          const shouldContinuePolling = pollResult.should_retry &&
            !pollResult.success &&
            pollResult.status !== 'abandoned' &&
            attemptNumber < maxAttempts;

          if (shouldContinuePolling) {
            // Schedule next polling attempt with progressive delay
            const delays = [5000, 10000, 15000, 20000, 30000, 60000]; // Progressive delays
            const nextDelay = delays[Math.min(attemptNumber - 1, delays.length - 1)] || 60000;

            ludlog.payment(`Scheduling next payment poll in ${nextDelay / 1000}s for ${transactionId}`, {
              transactionId,
              nextAttempt: attemptNumber + 1,
              delaySeconds: nextDelay / 1000,
              source: 'job_scheduler'
            });

            // Schedule next attempt
            await this.scheduleJob('PAYMENT_STATUS_CHECK', {
              checkType: 'single_transaction',
              transactionId,
              attemptNumber: attemptNumber + 1,
              maxAttempts,
              source
            }, {
              delay: nextDelay,
              priority: 90 // High priority for payment checks
            });

            return {
              success: true,
              action: 'polling_continued',
              nextAttempt: attemptNumber + 1,
              delayMs: nextDelay,
              pollResult
            };
          } else {
            // Polling complete
            if (pollResult.success && pollResult.status === 'completed') {
              activatedCount = 1;
            }

            ludlog.payment(`Payment polling complete for ${transactionId}`, {
              transactionId,
              finalStatus: pollResult.status,
              totalAttempts: attemptNumber,
              success: pollResult.success,
              source: 'job_scheduler'
            });

            return {
              success: true,
              action: 'polling_completed',
              finalStatus: pollResult.status,
              totalAttempts: attemptNumber,
              pollResult
            };
          }

        } catch (error) {
          errorCount = 1;
          luderror.payment(`Payment polling failed for ${transactionId}:`, {
            error: error.message,
            transactionId,
            attemptNumber,
            source: 'job_scheduler'
          });

          return {
            success: false,
            action: 'polling_failed',
            error: error.message,
            transactionId,
            attemptNumber
          };
        }
      } else if (checkType === 'pending_subscriptions') {
        const SubscriptionPaymentStatusService = (await import('./SubscriptionPaymentStatusService.js')).default;

        // Find pending subscriptions that might need status checking
        const maxAgeDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

        const pendingSubscriptions = await models.SubscriptionHistory.findAll({
          where: {
            status: 'pending',
            created_at: {
              [models.Sequelize.Op.gte]: maxAgeDate // Only check recent ones
            }
          },
          limit: batchSize,
          order: [['created_at', 'ASC']] // Oldest first
        });

        ludlog.payment(`Found ${pendingSubscriptions.length} pending subscriptions to check`, {
          count: pendingSubscriptions.length,
          maxAge,
          source: 'job_scheduler'
        });

        // Process each pending subscription
        for (const subscription of pendingSubscriptions) {
          try {
            processedCount++;

            const result = await SubscriptionPaymentStatusService.checkAndHandleSubscriptionPaymentPageStatus(
              subscription.id,
              {
                attemptNumber: 1,
                maxAttempts: 1, // Single check, don't chain
                source: 'automated_monitoring'
              }
            );

            if (result.action_taken === 'activated') {
              activatedCount++;
            } else if (result.action_taken === 'cancelled') {
              cancelledCount++;
            }

          } catch (error) {
            errorCount++;
            luderror.payment(`Error checking subscription ${subscription.id}:`, {
              error: error.message,
              subscriptionId: subscription.id,
              source: 'job_scheduler'
            });
          }
        }
      }

      ludlog.payment('Payment status monitoring completed', {
        checkType,
        processedCount,
        activatedCount,
        cancelledCount,
        errorCount,
        batchSize,
        source: 'job_scheduler'
      });

      return {
        success: true,
        action: 'monitoring_completed',
        results: {
          processedCount,
          activatedCount,
          cancelledCount,
          errorCount
        },
        checkType,
        batchSize
      };

    } catch (error) {
      luderror.payment('Payment status monitoring failed:', {
        error: error.message,
        checkType,
        batchSize,
        transactionId,
        attemptNumber,
        source: 'job_scheduler'
      });

      return {
        success: false,
        action: 'monitoring_failed',
        error: error.message,
        checkType,
        batchSize,
        transactionId,
        attemptNumber
      };
    }
  }

  async processWebhookSecurityMonitor(data) {
    const {
      checkMetrics = true,
      alertingEnabled = true,
      dashboardUpdate = false
    } = data;

    try {
      ludlog.generic('Processing webhook security monitoring', {
        checkMetrics,
        alertingEnabled,
        dashboardUpdate,
        source: 'job_scheduler'
      });

      // Import webhook security monitor
      const { runSecurityMonitoring, getWebhookSecurityMetrics, getSecurityDashboard } = await import('../monitoring/webhookMonitor.js');

      let monitoringResults = null;
      let securityMetrics = null;
      let dashboardMetrics = null;

      // Run main security monitoring (checks for threshold violations and triggers alerts)
      if (alertingEnabled) {
        monitoringResults = await runSecurityMonitoring();

        ludlog.generic('Webhook security monitoring completed', {
          securityFailures: monitoringResults.securityFailures,
          threshold: monitoringResults.threshold,
          alertTriggered: monitoringResults.alertTriggered,
          source: 'job_scheduler'
        });

        // Log security alert if triggered
        if (monitoringResults.alertTriggered) {
          luderror.generic('🚨 WEBHOOK SECURITY ALERT: Threshold exceeded', {
            failures: monitoringResults.securityFailures,
            threshold: monitoringResults.threshold,
            source: 'job_scheduler',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Get detailed security metrics if requested
      if (checkMetrics) {
        securityMetrics = await getWebhookSecurityMetrics({
          startDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        });

        ludlog.generic('Webhook security metrics collected', {
          totalWebhooks: securityMetrics.summary.totalWebhooks,
          securityFailures: securityMetrics.summary.securityFailed,
          securityRate: securityMetrics.summary.securityRate,
          uniqueAttackersIPs: securityMetrics.patterns.uniqueIPCount,
          source: 'job_scheduler'
        });
      }

      // Get dashboard data if requested
      if (dashboardUpdate) {
        dashboardMetrics = await getSecurityDashboard();

        ludlog.generic('Webhook security dashboard updated', {
          realTimeFailures: dashboardMetrics.realTime.securityFailed,
          hourlyFailures: dashboardMetrics.hourly.securityFailed,
          dailyFailures: dashboardMetrics.daily.securityFailed,
          source: 'job_scheduler'
        });
      }

      return {
        success: true,
        action: 'security_monitoring_completed',
        results: {
          monitoring: monitoringResults,
          metrics: securityMetrics?.summary,
          dashboard: dashboardMetrics?.realTime,
          alertTriggered: monitoringResults?.alertTriggered || false
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      luderror.generic('Webhook security monitoring failed:', {
        error: error.message,
        checkMetrics,
        alertingEnabled,
        dashboardUpdate,
        source: 'job_scheduler'
      });

      return {
        success: false,
        action: 'security_monitoring_failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async processSessionCleanup(data) {
    const { type = 'full', batchSize = 1000, playerCleanup = false } = data;

    try {
      ludlog.generic(`Processing session cleanup - type: ${type}`, {
        type,
        batchSize,
        playerCleanup,
        source: 'job_scheduler'
      });

      // Import models dynamically
      const models = (await import('../models/index.js')).default;

      let deletedSessions = 0;
      let deletedTokens = 0;
      let deletedPlayerSessions = 0;
      let deletedInactivePlayers = 0;

      // Standard session cleanup
      if (!playerCleanup || type === 'full') {
        // Clean expired sessions with batch limit
        deletedSessions = await models.UserSession.destroy({
          where: {
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: batchSize
        });

        // Clean expired refresh tokens with batch limit
        deletedTokens = await models.RefreshToken.destroy({
          where: {
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: batchSize
        });
      }

      // Player-specific cleanup (safety net from PlayerService)
      if (playerCleanup || type === 'player_safety_net') {
        ludlog.generic('Running player safety net cleanup...');

        // Clean expired player sessions with batch limit
        deletedPlayerSessions = await models.UserSession.destroy({
          where: {
            player_id: { [models.Sequelize.Op.ne]: null }, // Only player sessions
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: Math.floor(batchSize / 2) // Use half batch size for player sessions
        });

        // Clean inactive players (365 days) with smaller batch limit
        const inactiveCutoff = new Date();
        inactiveCutoff.setDate(inactiveCutoff.getDate() - 365);

        deletedInactivePlayers = await models.Player.destroy({
          where: {
            last_seen: { [models.Sequelize.Op.lt]: inactiveCutoff },
            is_active: false
          },
          limit: Math.floor(batchSize / 10) // Use smaller batch for player deletion
        });

        ludlog.generic('Player safety net cleanup completed', {
          deletedPlayerSessions,
          deletedInactivePlayers,
          source: 'job_scheduler'
        });
      }

      // Additional cleanup for invalidated sessions (soft deletes)
      let deletedInvalidSessions = 0;
      if (type === 'full' && !playerCleanup) {
        deletedInvalidSessions = await models.UserSession.destroy({
          where: {
            [models.Sequelize.Op.or]: [
              { is_active: false },
              { invalidated_at: { [models.Sequelize.Op.ne]: null } }
            ],
            // Only delete sessions that have been inactive for more than 24 hours
            updated_at: { [models.Sequelize.Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          },
          limit: batchSize
        });
      }

      const totalCleaned = deletedSessions + deletedTokens + deletedInvalidSessions + deletedPlayerSessions + deletedInactivePlayers;

      ludlog.generic('Session cleanup completed', {
        deletedSessions,
        deletedTokens,
        deletedInvalidSessions,
        deletedPlayerSessions,
        deletedInactivePlayers,
        totalCleaned,
        type,
        batchSize,
        playerCleanup,
        source: 'job_scheduler'
      });

      return {
        success: true,
        action: 'cleanup_completed',
        results: {
          deletedSessions,
          deletedTokens,
          deletedInvalidSessions,
          deletedPlayerSessions,
          deletedInactivePlayers,
          totalCleaned
        },
        type,
        batchSize,
        playerCleanup
      };

    } catch (error) {
      luderror.generic('Session cleanup failed:', {
        error: error.message,
        type,
        batchSize,
        playerCleanup,
        source: 'job_scheduler'
      });

      return {
        success: false,
        action: 'cleanup_failed',
        error: error.message,
        type,
        batchSize,
        playerCleanup
      };
    }
  }

  async processFileCleanupOrphaned(data) {
    const {
      environment = process.env.ENVIRONMENT || 'development',
      batchSize = 100,
      maxFiles = 1000, // Max files to process in one job run
      checkThreshold = '24h',
      dryRun = false
    } = data;

    try {
      ludlog.generic(`Processing orphaned file cleanup - env: ${environment}`, {
        environment,
        batchSize,
        maxFiles,
        checkThreshold,
        dryRun,
        source: 'job_scheduler'
      });

      // Import cleanup utilities dynamically
      const { collectAllFileReferences } = await import('../scripts/utils/databaseReferenceCollector.js');
      const { listS3Files, detectOrphans } = await import('../scripts/utils/s3FileAnalyzer.js');
      const { initS3Client, getBucketName, moveToTrash } = await import('../scripts/utils/trashManager.js');
      const { FileCheckCache } = await import('../scripts/utils/fileCheckCache.js');

      let processedFiles = 0;
      let orphansFound = 0;
      let orphansProcessed = 0;
      let bytesFreed = 0;
      const errors = [];

      // Initialize components
      const s3Client = initS3Client(environment);
      const bucketName = getBucketName(environment);
      const fileCheckCache = new FileCheckCache(checkThreshold);

      // Step 1: Collect database references
      ludlog.generic('Collecting database file references...');
      const databaseReferences = await collectAllFileReferences(environment);

      if (databaseReferences.length === 0) {
        ludlog.generic('Warning: No database references found');
        return {
          success: false,
          action: 'cleanup_aborted',
          error: 'No database references found',
          environment
        };
      }

      ludlog.generic(`Found ${databaseReferences.length} database file references`);

      // Step 2: Scan S3 files (limited batch for automated runs)
      ludlog.generic('Scanning S3 files and detecting orphans...');

      const s3Result = await listS3Files(s3Client, bucketName, environment, null, maxFiles);

      if (!s3Result.success) {
        throw new Error(`Error listing S3 files: ${s3Result.error}`);
      }

      if (s3Result.files.length === 0) {
        ludlog.generic('No S3 files found to process');
        return {
          success: true,
          action: 'cleanup_completed',
          results: { processedFiles: 0, orphansFound: 0, orphansProcessed: 0, bytesFreed: 0 },
          environment
        };
      }

      // Filter out recently checked files
      const { needsCheck, skipCheck } = fileCheckCache.filterRecentlyChecked(s3Result.files, environment);

      if (skipCheck.length > 0) {
        ludlog.generic(`Skipping ${skipCheck.length} recently checked files`);
      }

      processedFiles = needsCheck.length;

      if (needsCheck.length === 0) {
        ludlog.generic('All files were recently checked, nothing to process');
        return {
          success: true,
          action: 'cleanup_completed',
          results: { processedFiles: 0, orphansFound: 0, orphansProcessed: 0, bytesFreed: 0 },
          environment
        };
      }

      // Detect orphans
      const detection = detectOrphans(needsCheck, databaseReferences);
      const orphans = detection.orphans;
      orphansFound = orphans.length;

      ludlog.generic(`Found ${orphansFound} orphaned files out of ${needsCheck.length} checked`);

      // Mark files as checked in cache
      fileCheckCache.markBatchChecked(
        needsCheck.map(f => f.key),
        environment,
        needsCheck.map(f => ({
          isOrphan: orphans.some(o => o.key === f.key),
          size: f.size,
          lastModified: f.lastModified
        }))
      );

      // Process orphans in batches
      if (orphans.length > 0 && !dryRun) {
        const batches = [];
        for (let i = 0; i < orphans.length; i += batchSize) {
          batches.push(orphans.slice(i, i + batchSize));
        }

        ludlog.generic(`Processing ${orphans.length} orphans in ${batches.length} batches`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];

          for (const file of batch) {
            try {
              const result = await moveToTrash(s3Client, bucketName, file.key);

              if (result.success) {
                orphansProcessed++;
                bytesFreed += file.size;
                ludlog.generic(`Moved to trash: ${file.key}`);
              } else {
                errors.push({
                  file: file.key,
                  error: result.error || 'Unknown error'
                });
              }
            } catch (error) {
              errors.push({
                file: file.key,
                error: error.message
              });
            }
          }

          ludlog.generic(`Completed batch ${batchIndex + 1}/${batches.length}`);
        }
      } else if (dryRun) {
        ludlog.generic('DRY RUN: Would move to trash:', orphans.map(f => f.key));
      }

      // Cleanup cache
      fileCheckCache.cleanup();

      const results = {
        processedFiles,
        orphansFound,
        orphansProcessed,
        bytesFreed,
        errorCount: errors.length,
        dryRun
      };

      ludlog.generic('Orphaned file cleanup completed', {
        ...results,
        environment,
        source: 'job_scheduler'
      });

      return {
        success: true,
        action: 'cleanup_completed',
        results,
        environment,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Include first 10 errors
      };

    } catch (error) {
      luderror.generic('Orphaned file cleanup failed:', {
        error: error.message,
        environment,
        batchSize,
        maxFiles,
        source: 'job_scheduler'
      });

      return {
        success: false,
        action: 'cleanup_failed',
        error: error.message,
        environment,
        batchSize,
        maxFiles
      };
    }
  }

  async processDatabaseMaintenance(data) {
    const {
      maintenanceType = 'full',
      includeVacuum = true,
      includeAnalyze = true,
      includeReindex = false, // More aggressive, disabled by default
      checkConnectionPool = true,
      reportPerformance = true,
      maxExecutionTime = 300000 // 5 minutes max execution time
    } = data;

    const startTime = Date.now();
    const results = {
      vacuum: null,
      analyze: null,
      reindex: null,
      connectionPool: null,
      performance: null,
      totalExecutionTime: 0,
      errors: []
    };

    try {
      ludlog.db(`Starting database maintenance - type: ${maintenanceType}`, {
        maintenanceType,
        includeVacuum,
        includeAnalyze,
        includeReindex,
        checkConnectionPool,
        reportPerformance,
        maxExecutionTimeMinutes: maxExecutionTime / 1000 / 60,
        source: 'job_scheduler'
      });

      // Import models and Sequelize dynamically
      const models = (await import('../models/index.js')).default;
      const sequelize = models.sequelize;

      // Set statement timeout for safety
      await sequelize.query('SET statement_timeout = :timeout', {
        replacements: { timeout: maxExecutionTime + 'ms' },
        type: models.Sequelize.QueryTypes.RAW
      });

      // 1. VACUUM operations (PostgreSQL dead tuple cleanup)
      if (includeVacuum && this.isTimeRemaining(startTime, maxExecutionTime)) {
        try {
          ludlog.db('Running VACUUM operations...');

          // Light VACUUM on critical tables (non-blocking)
          const criticalTables = [
            'UserSessions', 'RefreshTokens', 'Purchases',
            'SubscriptionHistory', 'GameSessions', 'Logs'
          ];

          const vacuumResults = [];
          for (const table of criticalTables) {
            if (!this.isTimeRemaining(startTime, maxExecutionTime)) break;

            const startVacuum = Date.now();
            try {

              // Use non-blocking VACUUM (concurrent safe)
              await sequelize.query(`VACUUM ANALYZE "${table}";`, {
                type: models.Sequelize.QueryTypes.RAW,
                timeout: 60000 // 1 minute per table max
              });

              vacuumResults.push({
                table,
                duration: Date.now() - startVacuum,
                success: true
              });

              ludlog.db(`VACUUM completed for table: ${table}`);

            } catch (vacuumError) {
              results.errors.push({
                operation: 'vacuum',
                table,
                error: vacuumError.message
              });

              vacuumResults.push({
                table,
                duration: Date.now() - startVacuum,
                success: false,
                error: vacuumError.message
              });

              luderror.db(`VACUUM failed for table ${table}:`, vacuumError);
            }
          }

          results.vacuum = {
            tablesProcessed: vacuumResults.length,
            successful: vacuumResults.filter(r => r.success).length,
            failed: vacuumResults.filter(r => !r.success).length,
            totalDuration: vacuumResults.reduce((sum, r) => sum + r.duration, 0),
            results: vacuumResults
          };

        } catch (vacuumError) {
          results.errors.push({
            operation: 'vacuum_setup',
            error: vacuumError.message
          });
          luderror.db('VACUUM setup failed:', vacuumError);
        }
      }

      // 2. ANALYZE operations (update table statistics)
      if (includeAnalyze && this.isTimeRemaining(startTime, maxExecutionTime)) {
        try {
          ludlog.db('Running ANALYZE operations...');

          // Update statistics for frequently queried tables
          const analyzeResults = [];
          const importantTables = [
            'Products', 'Users', 'Games', 'Files', 'Workshops',
            'Purchases', 'EduContent', 'EduContentUse'
          ];

          for (const table of importantTables) {
            if (!this.isTimeRemaining(startTime, maxExecutionTime)) break;

            const startAnalyze = Date.now();
            try {

              await sequelize.query(`ANALYZE "${table}";`, {
                type: models.Sequelize.QueryTypes.RAW,
                timeout: 30000 // 30 seconds per table
              });

              analyzeResults.push({
                table,
                duration: Date.now() - startAnalyze,
                success: true
              });

            } catch (analyzeError) {
              results.errors.push({
                operation: 'analyze',
                table,
                error: analyzeError.message
              });

              analyzeResults.push({
                table,
                duration: Date.now() - startAnalyze,
                success: false,
                error: analyzeError.message
              });
            }
          }

          results.analyze = {
            tablesProcessed: analyzeResults.length,
            successful: analyzeResults.filter(r => r.success).length,
            failed: analyzeResults.filter(r => !r.success).length,
            totalDuration: analyzeResults.reduce((sum, r) => sum + r.duration, 0)
          };

          ludlog.db('ANALYZE operations completed', results.analyze);

        } catch (analyzeError) {
          results.errors.push({
            operation: 'analyze_setup',
            error: analyzeError.message
          });
          luderror.db('ANALYZE setup failed:', analyzeError);
        }
      }

      // 3. REINDEX operations (aggressive maintenance, only if enabled)
      if (includeReindex && maintenanceType === 'full' && this.isTimeRemaining(startTime, maxExecutionTime)) {
        try {
          ludlog.db('Running REINDEX operations (aggressive mode)...');

          // Only reindex if we have sufficient time remaining
          const timeRemaining = maxExecutionTime - (Date.now() - startTime);
          if (timeRemaining > 120000) { // Need at least 2 minutes

            const reindexResults = [];
            // Focus on most critical indexes only
            const criticalIndexes = [
              'Users_id', 'Products_id', 'Purchases_buyer_user_id_idx',
              'UserSessions_user_id_idx', 'GameSessions_game_id_idx'
            ];

            for (const indexName of criticalIndexes) {
              if (!this.isTimeRemaining(startTime, maxExecutionTime)) break;

              try {
                const startReindex = Date.now();

                await sequelize.query(`REINDEX INDEX CONCURRENTLY "${indexName}";`, {
                  type: models.Sequelize.QueryTypes.RAW,
                  timeout: 90000 // 1.5 minutes per index
                });

                reindexResults.push({
                  index: indexName,
                  duration: Date.now() - startReindex,
                  success: true
                });

              } catch (reindexError) {
                results.errors.push({
                  operation: 'reindex',
                  index: indexName,
                  error: reindexError.message
                });

                reindexResults.push({
                  index: indexName,
                  success: false,
                  error: reindexError.message
                });
              }
            }

            results.reindex = {
              indexesProcessed: reindexResults.length,
              successful: reindexResults.filter(r => r.success).length,
              failed: reindexResults.filter(r => !r.success).length,
              totalDuration: reindexResults.reduce((sum, r) => sum + (r.duration || 0), 0)
            };

          } else {
            ludlog.db('Skipping REINDEX - insufficient time remaining');
            results.reindex = { skipped: 'insufficient_time', timeRemaining };
          }

        } catch (reindexError) {
          results.errors.push({
            operation: 'reindex_setup',
            error: reindexError.message
          });
          luderror.db('REINDEX setup failed:', reindexError);
        }
      }

      // 4. Connection pool health check
      if (checkConnectionPool && this.isTimeRemaining(startTime, maxExecutionTime)) {
        try {
          ludlog.db('Checking connection pool health...');

          const poolStats = {
            totalConnections: sequelize.connectionManager.pool.size,
            activeConnections: sequelize.connectionManager.pool.using,
            idleConnections: sequelize.connectionManager.pool.waiting,
            maxConnections: sequelize.connectionManager.pool.max,
            minConnections: sequelize.connectionManager.pool.min
          };

          // Test connection responsiveness
          const connectionTestStart = Date.now();
          await sequelize.authenticate();
          const connectionResponseTime = Date.now() - connectionTestStart;

          results.connectionPool = {
            stats: poolStats,
            responseTime: connectionResponseTime,
            healthy: connectionResponseTime < 1000 && poolStats.activeConnections < poolStats.maxConnections * 0.8,
            utilization: (poolStats.activeConnections / poolStats.maxConnections * 100).toFixed(1) + '%'
          };

          ludlog.db('Connection pool health check completed', results.connectionPool);

        } catch (poolError) {
          results.errors.push({
            operation: 'connection_pool',
            error: poolError.message
          });
          luderror.db('Connection pool check failed:', poolError);
        }
      }

      // 5. Performance analysis
      if (reportPerformance && this.isTimeRemaining(startTime, maxExecutionTime)) {
        try {
          ludlog.db('Generating performance report...');

          // Get database size and table statistics
          const [dbSizeResult] = await sequelize.query(`
            SELECT
              pg_size_pretty(pg_database_size(current_database())) as database_size,
              current_database() as database_name;
          `, { type: models.Sequelize.QueryTypes.SELECT });

          // Get top 10 largest tables
          const largestTables = await sequelize.query(`
            SELECT
              schemaname,
              tablename,
              pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
              pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY size_bytes DESC
            LIMIT 10;
          `, { type: models.Sequelize.QueryTypes.SELECT });

          // Get recent slow queries (if log_min_duration_statement is enabled)
          let slowQueries = [];
          try {
            slowQueries = await sequelize.query(`
              SELECT
                query,
                calls,
                total_time,
                mean_time,
                rows
              FROM pg_stat_statements
              WHERE calls > 10
              ORDER BY mean_time DESC
              LIMIT 5;
            `, { type: models.Sequelize.QueryTypes.SELECT });
          } catch (pgStatError) {
            // pg_stat_statements extension might not be available
            ludlog.db('pg_stat_statements not available for slow query analysis');
          }

          results.performance = {
            database: dbSizeResult,
            largestTables: largestTables.slice(0, 5), // Top 5 for brevity
            slowQueries: slowQueries.slice(0, 3), // Top 3 slow queries
            analysisTimestamp: new Date().toISOString()
          };

          ludlog.db('Performance analysis completed', {
            databaseSize: dbSizeResult.database_size,
            largestTablesCount: largestTables.length,
            slowQueriesFound: slowQueries.length
          });

        } catch (performanceError) {
          results.errors.push({
            operation: 'performance_analysis',
            error: performanceError.message
          });
          luderror.db('Performance analysis failed:', performanceError);
        }
      }

      // Calculate total execution time
      results.totalExecutionTime = Date.now() - startTime;

      // Reset statement timeout
      await sequelize.query('SET statement_timeout = DEFAULT', {
        type: models.Sequelize.QueryTypes.RAW
      });

      ludlog.db('Database maintenance completed successfully', {
        maintenanceType,
        totalExecutionTime: results.totalExecutionTime,
        errorCount: results.errors.length,
        operationsCompleted: Object.keys(results).filter(key =>
          results[key] !== null && key !== 'errors' && key !== 'totalExecutionTime'
        ),
        source: 'job_scheduler'
      });

      return {
        success: true,
        action: 'maintenance_completed',
        results,
        maintenanceType,
        executionTime: results.totalExecutionTime
      };

    } catch (error) {
      // Calculate execution time even on failure
      results.totalExecutionTime = Date.now() - startTime;

      // Reset statement timeout on error
      try {
        const models = (await import('../models/index.js')).default;
        await models.sequelize.query('SET statement_timeout = DEFAULT', {
          type: models.Sequelize.QueryTypes.RAW
        });
      } catch (resetError) {
        luderror.db('Failed to reset statement timeout:', resetError);
      }

      luderror.db('Database maintenance failed:', {
        error: error.message,
        maintenanceType,
        executionTime: results.totalExecutionTime,
        errorCount: results.errors.length,
        source: 'job_scheduler'
      });

      return {
        success: false,
        action: 'maintenance_failed',
        error: error.message,
        results,
        maintenanceType,
        executionTime: results.totalExecutionTime
      };
    }
  }

  /**
   * Helper method to check if there's enough time remaining for operations
   */
  isTimeRemaining(startTime, maxExecutionTime, bufferMs = 30000) {
    const elapsed = Date.now() - startTime;
    return (elapsed + bufferMs) < maxExecutionTime;
  }

  async processAnalyticsReport(data) {
    ludlog.generic('Processing analytics report (placeholder)', data);
    // TODO: Implement analytics reporting
    return { success: true, message: 'Placeholder implementation' };
  }
}

// Export singleton instance
const jobScheduler = new JobScheduler();
export default jobScheduler;