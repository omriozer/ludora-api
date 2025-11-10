/**
 * Smart Performance & Cost Tracker Middleware
 *
 * Optimized middleware that combines all performance monitoring and cost tracking
 * functionality into a single smart middleware with background batch processing.
 *
 * Replaces 10 separate middlewares:
 * Performance: israeliPerformanceTracker, israeliS3PerformanceTracker,
 *             israeliHebrewContentPerformanceTracker, israeliPeakHoursPerformanceTracker,
 *             israeliPerformanceAlerts
 * Cost: israeliS3CostTracker, israeliBandwidthCostTracker,
 *       israeliHebrewContentCostTracker, israeliCostAlerts, israeliRealtimeCostMonitor
 */

import IsraeliPerformanceMonitoringService from '../services/IsraeliPerformanceMonitoringService.js';
import IsraeliCostOptimizationService from '../services/IsraeliCostOptimizationService.js';
import moment from 'moment-timezone';

// Global service instances
const performanceService = new IsraeliPerformanceMonitoringService();
const costOptimizationService = new IsraeliCostOptimizationService();

// Metrics batching system
const metricsQueue = [];
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 30000; // 30 seconds

// Caching system
const israeliTimeCache = new Map();
const hebrewDetectionCache = new Map();
const peakHoursCache = new Map();

// Smart sampling configuration
const SAMPLING_RATES = {
  peak_hours: 1.0,      // 100% sampling during peak hours
  school_hours: 0.8,    // 80% sampling during school hours
  business_hours: 0.6,  // 60% sampling during business hours
  off_peak: 0.3,        // 30% sampling during off-peak
  weekend: 0.2          // 20% sampling during weekends
};

/**
 * Get cached Israeli time (expensive timezone conversion)
 */
function getCachedIsraeliTime() {
  const minute = Math.floor(Date.now() / 60000); // Cache per minute

  if (israeliTimeCache.has(minute)) {
    return israeliTimeCache.get(minute);
  }

  const israelTime = moment.tz('Asia/Jerusalem');
  israeliTimeCache.set(minute, israelTime);

  // Clean up old cache entries
  setTimeout(() => israeliTimeCache.delete(minute), 120000);

  return israelTime;
}

/**
 * Check if request needs detailed tracking
 */
function needsDetailedTracking(req) {
  // Always track critical paths
  const criticalPaths = ['/api/auth/', '/api/admin/', '/api/payments/'];
  if (criticalPaths.some(path => req.path.includes(path))) {
    return true;
  }

  // Smart sampling based on Israeli time context
  const israelTime = getCachedIsraeliTime();
  const samplingRate = getSamplingRate(israelTime);

  return Math.random() < samplingRate;
}

/**
 * Get sampling rate based on Israeli time context
 */
function getSamplingRate(israelTime) {
  const hour = israelTime.hour();
  const day = israelTime.day();

  // Cache sampling rate calculation
  const cacheKey = `${day}-${hour}`;
  if (peakHoursCache.has(cacheKey)) {
    return peakHoursCache.get(cacheKey);
  }

  let samplingRate;

  // Weekend (Friday evening - Saturday)
  if ((day === 5 && hour >= 18) || (day === 6)) {
    samplingRate = SAMPLING_RATES.weekend;
  }
  // Peak hours (high usage periods)
  else if (isIsraeliPeakHours(hour)) {
    samplingRate = SAMPLING_RATES.peak_hours;
  }
  // School hours (Sunday-Thursday 8-16)
  else if (day >= 0 && day <= 4 && hour >= 8 && hour <= 16) {
    samplingRate = SAMPLING_RATES.school_hours;
  }
  // Business hours (Sunday-Thursday 8-18)
  else if (day >= 0 && day <= 4 && hour >= 8 && hour <= 18) {
    samplingRate = SAMPLING_RATES.business_hours;
  }
  // Off-peak hours
  else {
    samplingRate = SAMPLING_RATES.off_peak;
  }

  // Cache for 1 hour
  peakHoursCache.set(cacheKey, samplingRate);
  setTimeout(() => peakHoursCache.delete(cacheKey), 3600000);

  return samplingRate;
}

/**
 * Check if current hour is Israeli peak hours
 */
function isIsraeliPeakHours(hour) {
  return (hour >= 7 && hour <= 9) ||    // Morning rush
         (hour >= 12 && hour <= 14) ||  // Lunch break
         (hour >= 16 && hour <= 18) ||  // After school
         (hour >= 19 && hour <= 22);    // Evening study
}

/**
 * Efficient Hebrew content detection with caching
 */
function hasHebrewContent(text) {
  if (!text || typeof text !== 'string') return false;

  const cacheKey = text.substring(0, 100);
  if (hebrewDetectionCache.has(cacheKey)) {
    return hebrewDetectionCache.get(cacheKey);
  }

  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  hebrewDetectionCache.set(cacheKey, hasHebrew);

  // Clean cache every 10 minutes
  setTimeout(() => hebrewDetectionCache.delete(cacheKey), 600000);

  return hasHebrew;
}

/**
 * Check if path is S3/file operation
 */
function isS3Operation(path) {
  return path.includes('/api/assets/') ||
         path.includes('/api/media/') ||
         path.includes('/api/videos/');
}

/**
 * Check if path is high-traffic educational endpoint
 */
function isHighTrafficPath(path) {
  const highTrafficPaths = [
    '/api/entities/',
    '/api/products/',
    '/api/games/',
    '/api/dashboard/'
  ];
  return highTrafficPaths.some(p => path.includes(p));
}

/**
 * Collect comprehensive metrics from request/response
 */
function collectAllMetrics(req, res, startTime) {
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  const israelTime = getCachedIsraeliTime();

  // Get response data and size
  let responseData = res._responseData;
  let contentLength = res._contentLength || 0;

  // Capture content from chunk if needed
  if (res._lastChunk && !contentLength) {
    const chunk = res._lastChunk;
    contentLength = Buffer.isBuffer(chunk) ?
      chunk.length :
      Buffer.byteLength(chunk || '', res._lastEncoding || 'utf8');
  }

  const stringifiedData = responseData && typeof responseData === 'object' ?
    JSON.stringify(responseData) : null;

  // Hebrew content analysis
  const hebrewContent = stringifiedData ? hasHebrewContent(stringifiedData) : false;
  const hebrewCharCount = hebrewContent && stringifiedData ?
    (stringifiedData.match(/[\u0590-\u05FF]/g) || []).length : 0;

  // Base metrics object
  const metrics = {
    // Request identification
    requestId: req.headers['x-request-id'] || generateRequestId(),
    timestamp: israelTime.toISOString(),

    // Request details
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection?.remoteAddress,

    // Performance metrics
    responseTime: Math.round(responseTime),
    startTime: startTime,
    endTime: endTime,

    // Content metrics
    contentSize: contentLength,
    contentType: res.getHeader('content-type'),

    // Israeli context
    israelHour: israelTime.hour(),
    isPeakHours: isIsraeliPeakHours(israelTime.hour()),
    isSchoolHours: israelTime.day() >= 0 && israelTime.day() <= 4 &&
                   israelTime.hour() >= 8 && israelTime.hour() <= 16,
    dayOfWeek: israelTime.format('dddd'),

    // Hebrew content analysis
    hebrewContent: hebrewContent,
    hebrewCharCount: hebrewCharCount,
    rtlFormatted: res.getHeader('X-RTL-Formatted') === 'true',

    // Caching and compression
    cacheStatus: req.headers['if-none-match'] && res.statusCode === 304 ? 'hit' : 'miss',
    compressionUsed: res.getHeader('content-encoding') === 'gzip',
    compressionRatio: res.getHeader('content-encoding') === 'gzip' ? 2.5 : 1,

    // Operation classification
    isS3Operation: isS3Operation(req.path),
    isHighTrafficPath: isHighTrafficPath(req.path),
    isEducationalContent: req.path.includes('/entities/') || req.path.includes('/products/'),

    // User context
    userId: req.user?.id,
    userType: req.user?.role,

    // Error context
    isError: res.statusCode >= 400,
    errorType: res.statusCode >= 500 ? 'server_error' :
               res.statusCode >= 400 ? 'client_error' : null
  };

  // Add S3-specific metrics
  if (metrics.isS3Operation) {
    metrics.s3Operation = {
      fileSize: contentLength,
      duration: responseTime,
      success: res.statusCode < 400,
      operationType: req.method
    };
  }

  // Add cost calculations
  if (contentLength > 0) {
    metrics.costs = calculateRequestCosts(metrics, israelTime);
  }

  return metrics;
}

/**
 * Calculate cost metrics for request
 */
function calculateRequestCosts(metrics, israelTime) {
  const costs = {
    timestamp: israelTime.toISOString(),
    isPeakHours: metrics.isPeakHours
  };

  // S3 costs (only for S3 operations)
  if (metrics.isS3Operation && metrics.s3Operation) {
    const sizeInGB = metrics.contentSize / (1024 * 1024 * 1024);

    costs.s3 = {
      storageCost: sizeInGB * 0.023, // EU storage cost per GB
      requestCost: getS3RequestCost(metrics.method),
      transferCost: sizeInGB * 0.09, // EU bandwidth cost per GB
    };

    // Apply peak hour multiplier
    if (metrics.isPeakHours) {
      costs.s3.adjustedCost = costs.s3.transferCost * 1.3;
    }
  }

  // Bandwidth costs (all requests)
  const sizeInGB = metrics.contentSize / (1024 * 1024 * 1024);
  costs.bandwidth = {
    baseCost: sizeInGB * 0.09,
    cacheSavings: metrics.cacheStatus === 'hit' ? sizeInGB * 0.09 * 0.4 : 0,
    compressionSavings: metrics.compressionUsed ? sizeInGB * 0.09 * 0.15 : 0
  };

  costs.bandwidth.netCost = costs.bandwidth.baseCost -
                           costs.bandwidth.cacheSavings -
                           costs.bandwidth.compressionSavings;

  // Hebrew content costs
  if (metrics.hebrewContent && metrics.hebrewCharCount > 0) {
    costs.hebrew = {
      baseCost: costs.bandwidth.baseCost,
      compressionBonus: metrics.compressionUsed ? costs.bandwidth.baseCost * 0.1 : 0,
      rtlOptimizationSavings: metrics.rtlFormatted ? costs.bandwidth.baseCost * 0.05 : 0
    };

    costs.hebrew.netCost = costs.hebrew.baseCost -
                          costs.hebrew.compressionBonus -
                          costs.hebrew.rtlOptimizationSavings;
  }

  return costs;
}

/**
 * Get S3 request cost by operation type
 */
function getS3RequestCost(method) {
  const requestCosts = {
    'GET': 0.0004 / 1000,    // per 1000 requests
    'PUT': 0.005 / 1000,     // per 1000 requests
    'POST': 0.005 / 1000,    // per 1000 requests
    'DELETE': 0.0004 / 1000  // per 1000 requests
  };
  return requestCosts[method] || 0;
}

/**
 * Generate simple request ID
 */
function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Process batched metrics (background processing)
 */
async function processBatchedMetrics(metrics) {
  if (metrics.length === 0) return;

  try {
    console.log(`📊 Processing ${metrics.length} batched metrics...`);

    // Group metrics by type for efficient processing
    const performanceMetrics = [];
    const costMetrics = [];
    const hebrewMetrics = [];
    const s3Metrics = [];

    metrics.forEach(metric => {
      // Always collect performance data
      performanceMetrics.push({
        requestId: metric.requestId,
        timestamp: metric.timestamp,
        method: metric.method,
        path: metric.path,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode,
        contentSize: metric.contentSize,
        isPeakHours: metric.isPeakHours,
        isSchoolHours: metric.isSchoolHours,
        userId: metric.userId
      });

      // Collect cost data if available
      if (metric.costs) {
        costMetrics.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          costs: metric.costs,
          isPeakHours: metric.isPeakHours,
          path: metric.path
        });
      }

      // Collect Hebrew content data
      if (metric.hebrewContent) {
        hebrewMetrics.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          hebrewCharCount: metric.hebrewCharCount,
          contentSize: metric.contentSize,
          rtlFormatted: metric.rtlFormatted,
          costs: metric.costs?.hebrew
        });
      }

      // Collect S3 operation data
      if (metric.isS3Operation && metric.s3Operation) {
        s3Metrics.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          operation: metric.s3Operation,
          costs: metric.costs?.s3,
          path: metric.path
        });
      }
    });

    // Process with services (async, non-blocking)
    const processingPromises = [];

    if (performanceMetrics.length > 0) {
      processingPromises.push(
        performanceService.processBatchedMetrics(performanceMetrics)
          .catch(err => console.error('Performance metrics processing error:', err))
      );
    }

    if (costMetrics.length > 0) {
      processingPromises.push(
        costOptimizationService.processBatchedCostMetrics(costMetrics)
          .catch(err => console.error('Cost metrics processing error:', err))
      );
    }

    // Wait for all processing to complete
    await Promise.allSettled(processingPromises);

    console.log(`✅ Batch processing completed for ${metrics.length} metrics`);

  } catch (error) {
    console.error('Batch processing error:', error);
    // Don't throw - we don't want to break the batch processing cycle
  }
}

/**
 * Main Smart Performance & Cost Tracker Middleware
 * Replaces 10 separate performance and cost tracking middlewares
 */
export function smartPerformanceCostTracker() {
  return (req, res, next) => {
    // Quick check if tracking is needed
    if (!needsDetailedTracking(req)) {
      return next(); // Skip tracking for this request
    }

    const startTime = Date.now();

    // Single response override (replaces 10+ separate overrides)
    const originalEnd = res.end;
    const originalJson = res.json;

    // Capture response data
    res.json = function(data) {
      res._responseData = data;
      if (data) {
        res._contentLength = JSON.stringify(data).length;
      }
      return originalJson.call(this, data);
    };

    res.end = function(chunk, encoding) {
      // Capture chunk data
      res._lastChunk = chunk;
      res._lastEncoding = encoding;

      try {
        // Collect all metrics in one pass
        const metrics = collectAllMetrics(req, res, startTime);

        // Queue for batch processing (non-blocking)
        metricsQueue.push(metrics);

        // Add performance headers for debugging
        if (process.env.ENVIRONMENT === 'development' && !res.headersSent) {
          res.setHeader('X-Performance-Tracked', 'true');
          res.setHeader('X-Response-Time', metrics.responseTime.toString());
          res.setHeader('X-Israeli-Context', metrics.isPeakHours ? 'peak' : 'normal');

          if (metrics.costs) {
            res.setHeader('X-Estimated-Cost',
              (metrics.costs.bandwidth?.netCost || 0).toFixed(6));
          }

          if (metrics.hebrewContent) {
            res.setHeader('X-Hebrew-Chars', metrics.hebrewCharCount.toString());
          }
        }

        // Real-time alerts for critical issues
        if (shouldTriggerRealTimeAlert(metrics)) {
          triggerRealTimeAlert(metrics);
        }

      } catch (error) {
        console.error('Smart performance tracking error:', error);
        // Don't block the response on tracking errors
      }

      return originalEnd.apply(this, arguments);
    };

    next();
  };
}

/**
 * Check if metrics should trigger real-time alert
 */
function shouldTriggerRealTimeAlert(metrics) {
  return (
    // Slow response during peak hours
    (metrics.responseTime > 2000 && metrics.isPeakHours) ||
    // Server errors
    (metrics.statusCode >= 500) ||
    // High cost operations
    (metrics.costs?.bandwidth?.netCost > 0.01) ||
    // S3 operation failures
    (metrics.isS3Operation && metrics.statusCode >= 400)
  );
}

/**
 * Trigger real-time alert for critical issues
 */
function triggerRealTimeAlert(metrics) {
  const alertData = {
    type: 'realtime_performance_issue',
    severity: metrics.statusCode >= 500 ? 'critical' : 'high',
    metrics: metrics,
    timestamp: metrics.timestamp,
    recommendations: generateRecommendations(metrics)
  };

  // Log immediately for critical issues
  console.warn('🚨 Real-time Performance Alert:', alertData);

  // Emit events to services for immediate processing
  if (metrics.responseTime > 2000) {
    performanceService.emit('performance_issues', alertData);
  }

  if (metrics.costs?.bandwidth?.netCost > 0.01) {
    costOptimizationService.emit('cost_alerts', [alertData]);
  }
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(metrics) {
  const recommendations = [];

  if (metrics.responseTime > 2000) {
    recommendations.push('Optimize response time');
    if (metrics.isPeakHours) {
      recommendations.push('Consider peak hours optimization');
    }
  }

  if (metrics.hebrewContent && !metrics.compressionUsed) {
    recommendations.push('Enable Hebrew content compression');
  }

  if (metrics.cacheStatus === 'miss' && metrics.isHighTrafficPath) {
    recommendations.push('Improve caching for high-traffic endpoints');
  }

  if (metrics.isS3Operation && metrics.responseTime > 1000) {
    recommendations.push('Optimize S3 operation performance');
  }

  return recommendations;
}

/**
 * Performance dashboard endpoint
 * Combines functionality from israeliPerformanceDashboard and israeliCostOptimizationDashboard
 */
export function smartPerformanceCostDashboard() {
  return async (req, res, next) => {
    if (!req.user?.role === 'admin') {
      return next();
    }

    // Performance metrics endpoint
    if (req.path === '/api/admin/performance/israel') {
      try {
        const reportType = req.query.type || 'realtime';
        const report = await generatePerformanceReport(reportType);

        return res.json({
          success: true,
          reportType,
          data: report,
          generatedBy: req.user.id,
          timestamp: getCachedIsraeliTime().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Performance Dashboard Error',
          message: error.message
        });
      }
    }

    // Cost optimization endpoint
    if (req.path === '/api/admin/cost-optimization/israel') {
      try {
        const reportType = req.query.type || 'comprehensive';
        const report = await generateCostOptimizationReport(reportType);

        return res.json({
          success: true,
          reportType,
          data: report,
          generatedBy: req.user.id,
          timestamp: getCachedIsraeliTime().toISOString(),
          israeliMarket: true
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Cost Optimization Dashboard Error',
          message: error.message,
          israeliMarket: true
        });
      }
    }

    // Combined metrics endpoint
    if (req.path === '/api/admin/metrics/israel') {
      try {
        const combinedMetrics = await generateCombinedMetrics();

        return res.json({
          success: true,
          data: combinedMetrics,
          generatedBy: req.user.id,
          timestamp: getCachedIsraeliTime().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Combined Metrics Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Generate performance report
 */
async function generatePerformanceReport(reportType) {
  switch (reportType) {
    case 'realtime':
      return performanceService.collectRealtimeMetrics();
    case 'health':
      return await performanceService.performHealthChecks();
    case 'comprehensive':
      return performanceService.generatePerformanceReport();
    default:
      return performanceService.collectRealtimeMetrics();
  }
}

/**
 * Generate cost optimization report
 */
async function generateCostOptimizationReport(reportType) {
  switch (reportType) {
    case 'insights':
      return costOptimizationService.generateCostOptimizationInsights();
    case 'realtime':
      return costOptimizationService.analyzeCostMetrics();
    case 'trends':
      return costOptimizationService.analyzeCostTrends();
    case 'comprehensive':
    default:
      return costOptimizationService.generateCostOptimizationInsights();
  }
}

/**
 * Generate combined performance and cost metrics
 */
async function generateCombinedMetrics() {
  return {
    performance: performanceService.collectRealtimeMetrics(),
    costs: costOptimizationService.analyzeCostMetrics(),
    hebrew: {
      totalRequests: Array.from(hebrewDetectionCache.values()).filter(Boolean).length,
      cacheEfficiency: hebrewDetectionCache.size
    },
    sampling: {
      rates: SAMPLING_RATES,
      currentRate: getSamplingRate(getCachedIsraeliTime())
    },
    queue: {
      pendingMetrics: metricsQueue.length,
      batchSize: BATCH_SIZE,
      batchInterval: BATCH_INTERVAL
    }
  };
}

/**
 * Background batch processing setup
 */
function initializeBatchProcessing() {
  // Process batches every 30 seconds
  setInterval(async () => {
    if (metricsQueue.length === 0) return;

    // Extract batch of metrics
    const batch = metricsQueue.splice(0, BATCH_SIZE);

    // Process in background (non-blocking)
    processBatchedMetrics(batch);

  }, BATCH_INTERVAL);

  console.log(`📊 Smart performance & cost tracker batch processing initialized`);
  console.log(`📊 Batch size: ${BATCH_SIZE}, Interval: ${BATCH_INTERVAL}ms`);
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupSmartPerformanceCostTracker() {
  console.log('🚨 Shutting down smart performance & cost tracking...');

  // Process remaining metrics in queue
  if (metricsQueue.length > 0) {
    console.log(`📊 Processing final batch of ${metricsQueue.length} metrics...`);
    processBatchedMetrics(metricsQueue.splice(0));
  }

  // Stop services
  performanceService.stopMonitoring();
  costOptimizationService.stopCostTracking();

  console.log('✅ Smart performance & cost tracking shutdown complete');
}

// Initialize batch processing when middleware loads
initializeBatchProcessing();

export default {
  smartPerformanceCostTracker,
  smartPerformanceCostDashboard,
  cleanupSmartPerformanceCostTracker,
  needsDetailedTracking, // Export for testing
  collectAllMetrics, // Export for testing
  processBatchedMetrics, // Export for testing
  performanceService,
  costOptimizationService
};