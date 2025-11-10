/**
 * Middleware Monitoring Dashboard API Routes
 *
 * Provides real-time monitoring endpoints for smart middleware performance,
 * feature flag status, and deployment tracking.
 */

import express from 'express';
import featureFlags from '../config/middleware-feature-flags.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// In-memory storage for real-time metrics (in production, use Redis or similar)
let realtimeMetrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    lastReset: Date.now()
  },
  responseTimes: [],
  middlewarePerformance: {
    smartIsraeliContext: { executions: 0, avgTime: 0, errors: 0 },
    smartPerformanceCost: { executions: 0, avgTime: 0, errors: 0 },
    smartAlertSystem: { executions: 0, avgTime: 0, errors: 0 },
    smartResponseProcessor: { executions: 0, avgTime: 0, errors: 0 }
  },
  memoryUsage: [],
  alerts: [],
  deploymentStatus: null
};

/**
 * Main dashboard data endpoint
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = {
      timestamp: new Date().toISOString(),
      overview: {
        middlewareCount: {
          smart: 4,
          legacy: 24,
          active: getActiveMiddlewareCount()
        },
        performance: {
          avgResponseTime: calculateAverageResponseTime(),
          throughput: calculateThroughput(),
          errorRate: calculateErrorRate(),
          memoryUsage: getCurrentMemoryUsage()
        },
        optimization: {
          enabled: featureFlags.getMiddlewareConfig(),
          rolloutPercentages: getRolloutPercentages(),
          expectedSavings: calculateExpectedSavings()
        }
      },
      featureFlags: {
        status: featureFlags.getAllFlags(),
        config: featureFlags.getMiddlewareConfig(),
        rolloutStrategy: featureFlags.getFlag('MIDDLEWARE_ROLLOUT_STRATEGY')?.value || 'conservative'
      },
      metrics: {
        realtime: getRealtimeMetrics(),
        trends: await getTrendData(),
        middleware: realtimeMetrics.middlewarePerformance
      },
      alerts: {
        active: getActiveAlerts(),
        recent: getRecentAlerts(20),
        summary: getAlertsSummary()
      },
      deployment: await getDeploymentStatus()
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Dashboard data collection failed',
      message: error.message
    });
  }
});

/**
 * Real-time metrics stream (Server-Sent Events)
 */
router.get('/metrics/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial data
  const initialData = {
    timestamp: Date.now(),
    metrics: getRealtimeMetrics(),
    featureFlags: featureFlags.getMiddlewareConfig(),
    alerts: getActiveAlerts().slice(0, 5)
  };

  res.write(`data: ${JSON.stringify(initialData)}\n\n`);

  // Send updates every 5 seconds
  const interval = setInterval(() => {
    try {
      const updateData = {
        timestamp: Date.now(),
        metrics: getRealtimeMetrics(),
        middleware: realtimeMetrics.middlewarePerformance,
        memoryUsage: getCurrentMemoryUsage(),
        newAlerts: getRecentAlerts(1)
      };

      res.write(`data: ${JSON.stringify(updateData)}\n\n`);
    } catch (error) {
      console.error('Error sending metrics update:', error);
      clearInterval(interval);
      res.end();
    }
  }, 5000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * Performance comparison endpoint
 */
router.get('/performance/comparison', async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    const comparison = await generatePerformanceComparison(timeRange);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Performance comparison failed',
      message: error.message
    });
  }
});

/**
 * Feature flag management endpoint
 */
router.post('/feature-flags/:flagName', async (req, res) => {
  try {
    const { flagName } = req.params;
    const { enabled, rolloutPercentage } = req.body;

    const flag = featureFlags.getFlag(flagName);
    if (!flag) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found'
      });
    }

    const updates = {};
    if (typeof enabled === 'boolean') {
      updates.enabled = enabled;
    }
    if (typeof rolloutPercentage === 'number') {
      updates.rolloutPercentage = Math.max(0, Math.min(100, rolloutPercentage));
    }

    featureFlags.setFlag(flagName, updates);

    res.json({
      success: true,
      message: 'Feature flag updated',
      flag: featureFlags.getFlag(flagName)
    });

    // Log the change
    console.log(`🏁 Feature flag ${flagName} updated by admin:`, updates);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Feature flag update failed',
      message: error.message
    });
  }
});

/**
 * Emergency rollback endpoint
 */
router.post('/emergency/rollback', async (req, res) => {
  try {
    const { reason, userId } = req.body;

    featureFlags.emergencyRollback(reason || 'Manual emergency rollback');

    // Record the rollback
    realtimeMetrics.alerts.unshift({
      id: `rollback-${Date.now()}`,
      type: 'emergency_rollback',
      severity: 'critical',
      message: 'Emergency rollback executed',
      details: { reason, userId },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Emergency rollback executed',
      newConfig: featureFlags.getMiddlewareConfig()
    });

    console.log(`🚨 Emergency rollback executed by ${userId}: ${reason}`);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Emergency rollback failed',
      message: error.message
    });
  }
});

/**
 * Middleware health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      middlewares: {
        smartIsraeliContext: {
          enabled: featureFlags.isEnabled('ENABLE_SMART_ISRAELI_CONTEXT'),
          healthy: true, // Would check actual health
          responseTime: realtimeMetrics.middlewarePerformance.smartIsraeliContext.avgTime
        },
        smartPerformanceCost: {
          enabled: featureFlags.isEnabled('ENABLE_SMART_PERFORMANCE_COST'),
          healthy: true,
          responseTime: realtimeMetrics.middlewarePerformance.smartPerformanceCost.avgTime
        },
        smartAlertSystem: {
          enabled: featureFlags.isEnabled('ENABLE_SMART_ALERT_SYSTEM'),
          healthy: true,
          responseTime: realtimeMetrics.middlewarePerformance.smartAlertSystem.avgTime
        },
        smartResponseProcessor: {
          enabled: featureFlags.isEnabled('ENABLE_SMART_RESPONSE_PROCESSOR'),
          healthy: true,
          responseTime: realtimeMetrics.middlewarePerformance.smartResponseProcessor.avgTime
        }
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      },
      metrics: {
        totalRequests: realtimeMetrics.requests.total,
        errorRate: calculateErrorRate(),
        avgResponseTime: calculateAverageResponseTime()
      }
    };

    // Determine overall health
    const errorRate = calculateErrorRate();
    const avgResponseTime = calculateAverageResponseTime();

    if (errorRate > 5 || avgResponseTime > 2000) {
      health.status = 'degraded';
    }

    if (errorRate > 10 || avgResponseTime > 5000) {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;

    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * Performance history endpoint
 */
router.get('/metrics/history', async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    const granularity = req.query.granularity || '1h';

    const history = await loadPerformanceHistory(timeRange, granularity);

    res.json({
      success: true,
      data: {
        timeRange,
        granularity,
        dataPoints: history.length,
        metrics: history
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Performance history retrieval failed',
      message: error.message
    });
  }
});

/**
 * Alert management endpoints
 */
router.get('/alerts', (req, res) => {
  const { severity, limit = 50, offset = 0 } = req.query;

  let alerts = [...realtimeMetrics.alerts];

  if (severity) {
    alerts = alerts.filter(alert => alert.severity === severity);
  }

  const totalAlerts = alerts.length;
  alerts = alerts.slice(offset, offset + parseInt(limit));

  res.json({
    success: true,
    data: {
      alerts,
      pagination: {
        total: totalAlerts,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalAlerts > offset + parseInt(limit)
      },
      summary: getAlertsSummary()
    }
  });
});

router.post('/alerts/:alertId/acknowledge', (req, res) => {
  const { alertId } = req.params;
  const { userId, notes } = req.body;

  const alert = realtimeMetrics.alerts.find(a => a.id === alertId);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  alert.acknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date().toISOString();
  alert.notes = notes;

  res.json({
    success: true,
    message: 'Alert acknowledged',
    alert
  });
});

/**
 * Deployment status and control endpoints
 */
router.get('/deployment/status', async (req, res) => {
  try {
    const status = await getDeploymentStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Deployment status retrieval failed',
      message: error.message
    });
  }
});

// Middleware to track performance metrics
export function trackMiddlewarePerformance(middlewareName) {
  return (req, res, next) => {
    const startTime = Date.now();

    const originalEnd = res.end;
    res.end = function(...args) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Update middleware metrics
      updateMiddlewareMetrics(middlewareName, duration, res.statusCode >= 400);

      // Update general metrics
      updateGeneralMetrics(duration, res.statusCode);

      return originalEnd.apply(this, args);
    };

    next();
  };
}

// Helper functions
function getActiveMiddlewareCount() {
  const config = featureFlags.getMiddlewareConfig();
  let count = 8; // Base security middlewares

  if (config.useSmartIsraeliContext) count += 1;
  else if (config.useLegacyIsraeliStack) count += 5;

  if (config.useSmartPerformanceCost) count += 1;
  else if (config.useLegacyMonitoring) count += 10;

  if (config.useSmartAlertSystem) count += 1;
  else if (config.useLegacyAlerts) count += 5;

  if (config.useSmartResponseProcessor) count += 1;
  else if (config.useLegacyResponseProcessing) count += 4;

  return count;
}

function calculateAverageResponseTime() {
  if (realtimeMetrics.responseTimes.length === 0) return 0;
  const sum = realtimeMetrics.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / realtimeMetrics.responseTimes.length);
}

function calculateThroughput() {
  const timeElapsed = Date.now() - realtimeMetrics.requests.lastReset;
  const secondsElapsed = timeElapsed / 1000;
  return secondsElapsed > 0 ? Math.round(realtimeMetrics.requests.total / secondsElapsed) : 0;
}

function calculateErrorRate() {
  if (realtimeMetrics.requests.total === 0) return 0;
  return Math.round((realtimeMetrics.requests.failed / realtimeMetrics.requests.total) * 100);
}

function getCurrentMemoryUsage() {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024); // MB
}

function getRolloutPercentages() {
  return {
    smartIsraeliContext: featureFlags.getFlag('ENABLE_SMART_ISRAELI_CONTEXT')?.rolloutPercentage || 0,
    smartPerformanceCost: featureFlags.getFlag('ENABLE_SMART_PERFORMANCE_COST')?.rolloutPercentage || 0,
    smartAlertSystem: featureFlags.getFlag('ENABLE_SMART_ALERT_SYSTEM')?.rolloutPercentage || 0,
    smartResponseProcessor: featureFlags.getFlag('ENABLE_SMART_RESPONSE_PROCESSOR')?.rolloutPercentage || 0
  };
}

function calculateExpectedSavings() {
  const config = featureFlags.getMiddlewareConfig();
  let totalSavings = 0;

  if (config.useSmartIsraeliContext && !config.useLegacyIsraeliStack) totalSavings += 25; // 25ms saved
  if (config.useSmartPerformanceCost && !config.useLegacyMonitoring) totalSavings += 35; // 35ms saved
  if (config.useSmartAlertSystem && !config.useLegacyAlerts) totalSavings += 15; // 15ms saved
  if (config.useSmartResponseProcessor && !config.useLegacyResponseProcessing) totalSavings += 10; // 10ms saved

  return {
    responseTimeReduction: totalSavings,
    percentageImprovement: Math.round((totalSavings / 100) * 100), // Assuming 100ms baseline
    middlewareCountReduction: getActiveMiddlewareCount() < 35 ? 35 - getActiveMiddlewareCount() : 0
  };
}

function getRealtimeMetrics() {
  return {
    requests: realtimeMetrics.requests,
    responseTime: {
      current: calculateAverageResponseTime(),
      recent: realtimeMetrics.responseTimes.slice(-10) // Last 10 response times
    },
    throughput: calculateThroughput(),
    errorRate: calculateErrorRate(),
    memoryUsage: getCurrentMemoryUsage()
  };
}

function getActiveAlerts() {
  return realtimeMetrics.alerts.filter(alert => !alert.acknowledged);
}

function getRecentAlerts(limit) {
  return realtimeMetrics.alerts.slice(0, limit);
}

function getAlertsSummary() {
  const alerts = realtimeMetrics.alerts;
  return {
    total: alerts.length,
    active: getActiveAlerts().length,
    bySeverity: {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length
    },
    byType: alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {})
  };
}

function updateMiddlewareMetrics(middlewareName, duration, isError) {
  const metrics = realtimeMetrics.middlewarePerformance[middlewareName];
  if (metrics) {
    metrics.executions += 1;
    metrics.avgTime = Math.round((metrics.avgTime * (metrics.executions - 1) + duration) / metrics.executions);
    if (isError) {
      metrics.errors += 1;
    }
  }
}

function updateGeneralMetrics(duration, statusCode) {
  realtimeMetrics.requests.total += 1;

  if (statusCode < 400) {
    realtimeMetrics.requests.successful += 1;
  } else {
    realtimeMetrics.requests.failed += 1;
  }

  realtimeMetrics.responseTimes.push(duration);

  // Keep only last 100 response times
  if (realtimeMetrics.responseTimes.length > 100) {
    realtimeMetrics.responseTimes.shift();
  }

  // Update memory usage
  realtimeMetrics.memoryUsage.push(getCurrentMemoryUsage());
  if (realtimeMetrics.memoryUsage.length > 50) {
    realtimeMetrics.memoryUsage.shift();
  }
}

async function getTrendData() {
  // This would load from a time-series database in production
  // For now, return simulated trend data
  return {
    responseTime: Array.from({ length: 24 }, (_, i) => ({
      timestamp: Date.now() - (23 - i) * 60 * 60 * 1000,
      value: 120 + Math.random() * 50
    })),
    throughput: Array.from({ length: 24 }, (_, i) => ({
      timestamp: Date.now() - (23 - i) * 60 * 60 * 1000,
      value: 45 + Math.random() * 20
    })),
    errorRate: Array.from({ length: 24 }, (_, i) => ({
      timestamp: Date.now() - (23 - i) * 60 * 60 * 1000,
      value: Math.random() * 2
    }))
  };
}

async function loadPerformanceHistory(timeRange, granularity) {
  // This would load from persistent storage in production
  // For now, return simulated historical data
  const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
  const interval = granularity === '1h' ? 1 : granularity === '1m' ? 1/60 : 1;

  return Array.from({ length: Math.ceil(hours / interval) }, (_, i) => ({
    timestamp: Date.now() - (hours - i * interval) * 60 * 60 * 1000,
    responseTime: 120 + Math.random() * 30,
    throughput: 50 + Math.random() * 15,
    errorRate: Math.random() * 1.5,
    memoryUsage: 250 + Math.random() * 50,
    activeRequests: Math.floor(Math.random() * 20)
  }));
}

async function generatePerformanceComparison(timeRange) {
  // This would compare current performance with baseline
  // For now, return simulated comparison data
  return {
    timeRange,
    baseline: {
      responseTime: 150,
      throughput: 40,
      errorRate: 2.5,
      memoryUsage: 320
    },
    current: {
      responseTime: 95,
      throughput: 65,
      errorRate: 1.2,
      memoryUsage: 180
    },
    improvement: {
      responseTime: '36.7%',
      throughput: '62.5%',
      errorRate: '52.0%',
      memoryUsage: '43.8%'
    },
    middlewareImpact: {
      smartIsraeliContext: { enabled: true, responseTimeReduction: 25 },
      smartPerformanceCost: { enabled: true, responseTimeReduction: 35 },
      smartAlertSystem: { enabled: false, responseTimeReduction: 0 },
      smartResponseProcessor: { enabled: true, responseTimeReduction: 10 }
    }
  };
}

async function getDeploymentStatus() {
  try {
    const data = await fs.readFile('./deployment-state.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {
      isActive: false,
      currentPhase: null,
      lastDeployment: null,
      rolloutHistory: []
    };
  }
}

// Export the metrics for external use
export { realtimeMetrics };

export default router;