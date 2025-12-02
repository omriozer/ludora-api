/**
 * Jobs monitoring routes
 *
 * Provides API endpoints for monitoring scheduled jobs system:
 * - Job statistics and queue status
 * - Job scheduling and management
 * - Admin controls for job system
 *
 * Features:
 * - Real-time job queue statistics
 * - Job retry and cancellation
 * - Performance monitoring
 * - Admin-only access controls
 */

import express from 'express';
import jobScheduler from '../services/JobScheduler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import Joi from 'joi';
import ludlog, { luderror } from '../lib/ludlog.js';

const router = express.Router();

// Job scheduling validation schemas
const scheduleJobSchema = Joi.object({
  type: Joi.string().valid(
    'SUBSCRIPTION_PAYMENT_CHECK',
    'PAYMENT_STATUS_CHECK',
    'WEBHOOK_SECURITY_MONITOR',
    'SESSION_CLEANUP',
    'FILE_CLEANUP_ORPHANED',
    'DATABASE_MAINTENANCE',
    'ANALYTICS_REPORT'
  ).required(),
  data: Joi.object().required(),
  options: Joi.object({
    delay: Joi.number().min(0).max(86400000), // Max 24 hours delay
    priority: Joi.number().min(1).max(100),
    maxAttempts: Joi.number().min(1).max(10),
    jobOptions: Joi.object()
  }).optional()
});

const scheduleRecurringJobSchema = Joi.object({
  type: Joi.string().valid(
    'SESSION_CLEANUP',
    'FILE_CLEANUP_ORPHANED',
    'DATABASE_MAINTENANCE',
    'WEBHOOK_SECURITY_MONITOR',
    'ANALYTICS_REPORT'
  ).required(),
  data: Joi.object().required(),
  cronExpression: Joi.string().required().description('Cron expression (e.g., "0 2 * * *" for daily at 2am)'),
  options: Joi.object({
    priority: Joi.number().min(1).max(100),
    maxAttempts: Joi.number().min(1).max(10),
    repeatOptions: Joi.object()
  }).optional()
});

// ==========================================
// MONITORING ENDPOINTS (Admin access only)
// ==========================================

/**
 * GET /api/jobs/stats
 * Get comprehensive job system statistics
 */
router.get('/stats', authenticateToken, requireRole(['admin', 'sysadmin']), async (req, res) => {
  try {
    ludlog.generic('Job stats requested', { userId: req.user.id, role: req.user.role });

    // Check if job scheduler is initialized
    if (!jobScheduler.isInitialized) {
      return res.status(503).json({
        error: 'Job scheduler not initialized',
        message: 'The job scheduler system is starting up. Please try again in a moment.'
      });
    }

    const stats = await jobScheduler.getStats();

    res.json({
      status: 'success',
      data: {
        jobScheduler: {
          initialized: jobScheduler.isInitialized,
          shuttingDown: jobScheduler.isShuttingDown,
          lastCheck: new Date().toISOString()
        },
        redis: stats.redis,
        queues: stats.queues,
        workers: stats.workers
      }
    });

  } catch (error) {
    luderror.generic('Failed to get job stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve job statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/health
 * Health check for job system
 */
router.get('/health', authenticateToken, requireRole(['admin', 'sysadmin']), async (req, res) => {
  try {
    const isHealthy = jobScheduler.isInitialized && !jobScheduler.isShuttingDown;

    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      initialized: jobScheduler.isInitialized,
      shuttingDown: jobScheduler.isShuttingDown,
      timestamp: new Date().toISOString()
    };

    if (isHealthy) {
      try {
        // Test Redis connectivity
        await jobScheduler.redis.ping();
        health.redis = 'connected';
      } catch (redisError) {
        health.redis = 'disconnected';
        health.status = 'degraded';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    luderror.generic('Job health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// JOB MANAGEMENT ENDPOINTS (Admin access only)
// ==========================================

/**
 * POST /api/jobs/schedule
 * Schedule a one-time job
 */
router.post('/schedule',
  authenticateToken,
  requireRole(['admin', 'sysadmin']),
  validateBody(scheduleJobSchema),
  async (req, res) => {
    try {
      const { type, data, options = {} } = req.body;

      ludlog.generic('Scheduling job manually', {
        userId: req.user.id,
        role: req.user.role,
        jobType: type,
        options
      });

      // Check if job scheduler is initialized
      if (!jobScheduler.isInitialized) {
        return res.status(503).json({
          error: 'Job scheduler not initialized',
          message: 'Cannot schedule jobs while the system is starting up.'
        });
      }

      const job = await jobScheduler.scheduleJob(type, data, options);

      res.status(201).json({
        status: 'success',
        message: 'Job scheduled successfully',
        data: {
          jobId: job.id,
          jobType: type,
          queueName: jobScheduler.jobTypes[type].queue,
          priority: options.priority || jobScheduler.jobTypes[type].priority,
          delay: options.delay || 0,
          scheduledAt: new Date().toISOString()
        }
      });

    } catch (error) {
      luderror.generic('Failed to schedule job:', error);
      res.status(400).json({
        error: 'Failed to schedule job',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/jobs/schedule-recurring
 * Schedule a recurring job with cron expression
 */
router.post('/schedule-recurring',
  authenticateToken,
  requireRole(['admin', 'sysadmin']),
  validateBody(scheduleRecurringJobSchema),
  async (req, res) => {
    try {
      const { type, data, cronExpression, options = {} } = req.body;

      ludlog.generic('Scheduling recurring job manually', {
        userId: req.user.id,
        role: req.user.role,
        jobType: type,
        cronExpression,
        options
      });

      // Check if job scheduler is initialized
      if (!jobScheduler.isInitialized) {
        return res.status(503).json({
          error: 'Job scheduler not initialized',
          message: 'Cannot schedule jobs while the system is starting up.'
        });
      }

      const job = await jobScheduler.scheduleRecurringJob(type, data, cronExpression, options);

      res.status(201).json({
        status: 'success',
        message: 'Recurring job scheduled successfully',
        data: {
          jobId: job.id,
          jobType: type,
          queueName: jobScheduler.jobTypes[type].queue,
          cronExpression: cronExpression,
          priority: options.priority || jobScheduler.jobTypes[type].priority,
          scheduledAt: new Date().toISOString()
        }
      });

    } catch (error) {
      luderror.generic('Failed to schedule recurring job:', error);
      res.status(400).json({
        error: 'Failed to schedule recurring job',
        message: error.message
      });
    }
  }
);

// ==========================================
// SYSTEM CONTROL ENDPOINTS (Sysadmin only)
// ==========================================

/**
 * POST /api/jobs/initialize
 * Force initialize job scheduler (if not already initialized)
 */
router.post('/initialize',
  authenticateToken,
  requireRole(['sysadmin']),
  async (req, res) => {
    try {
      ludlog.generic('Manual job scheduler initialization requested', {
        userId: req.user.id,
        role: req.user.role
      });

      if (jobScheduler.isInitialized) {
        return res.json({
          status: 'success',
          message: 'Job scheduler already initialized',
          data: { initialized: true }
        });
      }

      await jobScheduler.initialize();

      res.json({
        status: 'success',
        message: 'Job scheduler initialized successfully',
        data: { initialized: jobScheduler.isInitialized }
      });

    } catch (error) {
      luderror.generic('Failed to initialize job scheduler:', error);
      res.status(500).json({
        error: 'Failed to initialize job scheduler',
        message: error.message
      });
    }
  }
);

// ==========================================
// INFORMATION ENDPOINTS (Admin access)
// ==========================================

/**
 * GET /api/jobs/types
 * Get available job types and their configurations
 */
router.get('/types', authenticateToken, requireRole(['admin', 'sysadmin']), async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        jobTypes: jobScheduler.jobTypes,
        description: 'Available job types with their queue assignments and retry configurations'
      }
    });
  } catch (error) {
    luderror.generic('Failed to get job types:', error);
    res.status(500).json({
      error: 'Failed to retrieve job types',
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/info
 * Get general information about the job scheduler system
 */
router.get('/info', authenticateToken, requireRole(['admin', 'sysadmin']), async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        scheduler: {
          name: 'Ludora Job Scheduler',
          technology: 'Bull MQ with Redis',
          features: [
            'Redis-backed job persistence',
            'Priority queues with 4 levels',
            'Automatic retry with exponential backoff',
            'Graceful shutdown handling',
            'Horizontal scaling support',
            'Comprehensive monitoring and logging'
          ],
          queues: ['critical', 'high', 'medium', 'low'],
          initialized: jobScheduler.isInitialized,
          shuttingDown: jobScheduler.isShuttingDown
        },
        endpoints: {
          monitoring: [
            'GET /api/jobs/stats - Queue statistics',
            'GET /api/jobs/health - System health check'
          ],
          management: [
            'POST /api/jobs/schedule - Schedule one-time job',
            'POST /api/jobs/schedule-recurring - Schedule cron job'
          ],
          information: [
            'GET /api/jobs/types - Available job types',
            'GET /api/jobs/info - This endpoint'
          ]
        }
      }
    });
  } catch (error) {
    luderror.generic('Failed to get job info:', error);
    res.status(500).json({
      error: 'Failed to retrieve job information',
      message: error.message
    });
  }
});

export default router;