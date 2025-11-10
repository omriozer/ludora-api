/**
 * Israeli Cost Optimization Middleware
 *
 * Middleware for tracking costs and providing cost optimization
 * insights specific to the Israeli market and usage patterns.
 */

import IsraeliCostOptimizationService from '../services/IsraeliCostOptimizationService.js';
import moment from 'moment-timezone';

// Global cost optimization service instance
const costOptimizationService = new IsraeliCostOptimizationService();

// Event listeners for cost alerts
costOptimizationService.on('daily_cost_analysis', (analysis) => {
  console.log('📊 Daily Israeli cost analysis completed:', {
    totalCosts: analysis.totalCosts.total,
    totalSavings: analysis.savings.total,
    optimizationCount: analysis.optimizations.length
  });
});

costOptimizationService.on('cost_alerts', (alerts) => {
  console.warn('💰 Israeli cost alerts:', alerts.map(alert => ({
    type: alert.type,
    severity: alert.severity,
    message: alert.message
  })));
});

/**
 * Cost tracking middleware for S3 operations
 * Tracks costs associated with file operations
 */
export function israeliS3CostTracker() {
  return (req, res, next) => {
    // Track S3 operations for cost analysis
    if (req.path.includes('/api/assets/') || req.path.includes('/api/media/')) {
      const startTime = Date.now();

      // Override the response to capture operation details
      const originalEnd = res.end;
      const originalJson = res.json;

      let responseData = null;
      let contentLength = 0;

      res.json = function(data) {
        responseData = data;
        if (data) {
          contentLength = JSON.stringify(data).length;
        }
        return originalJson.call(this, data);
      };

      res.end = function(chunk, encoding) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Capture content length if not already set
        if (chunk && !contentLength) {
          contentLength = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk || '', encoding || 'utf8');
        }

        // Build S3 operation data for cost tracking
        const s3Operation = {
          type: req.method,
          path: req.path,
          fileSize: contentLength,
          duration: duration,
          timestamp: moment().tz('Asia/Jerusalem').toISOString(),
          success: res.statusCode < 400,

          // Check for Hebrew content
          hebrewContent: responseData && typeof responseData === 'object' &&
                        /[\u0590-\u05FF]/.test(JSON.stringify(responseData)),

          // Check compression usage
          compressionUsed: res.getHeader('content-encoding') === 'gzip',

          // Check cache status
          cacheHit: req.headers['if-none-match'] && res.statusCode === 304
        };

        // Track S3 cost
        try {
          const costMetric = costOptimizationService.trackS3OperationCost(s3Operation);

          // Add cost tracking headers for debugging (only if headers haven't been sent)
          if (process.env.ENVIRONMENT === 'development' && !res.headersSent) {
            res.setHeader('X-S3-Cost-Tracking', 'enabled');
            res.setHeader('X-Estimated-Cost', (costMetric.netCost || costMetric.transferCost || 0).toFixed(6));
          }

        } catch (error) {
          console.error('S3 cost tracking error:', error);
        }

        return originalEnd.apply(this, arguments);
      };
    }

    next();
  };
}

/**
 * Bandwidth cost tracking middleware
 * Tracks costs associated with content delivery
 */
export function israeliBandwidthCostTracker() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Override response to capture bandwidth metrics
    const originalEnd = res.end;
    const originalJson = res.json;

    let responseData = null;
    let contentSize = 0;

    res.json = function(data) {
      responseData = data;
      if (data) {
        contentSize = JSON.stringify(data).length;
      }
      return originalJson.call(this, data);
    };

    res.end = function(chunk, encoding) {
      // Capture content size
      if (chunk && !contentSize) {
        contentSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk || '', encoding || 'utf8');
      }

      // Build bandwidth request data
      const bandwidthRequest = {
        path: req.path,
        method: req.method,
        contentSize: contentSize,
        userAgent: req.headers['user-agent'],
        timestamp: moment().tz('Asia/Jerusalem').toISOString(),

        // Cache status
        cacheStatus: req.headers['if-none-match'] && res.statusCode === 304 ? 'hit' : 'miss',

        // Compression ratio (if available)
        compressionRatio: res.getHeader('content-encoding') === 'gzip' ? 2.5 : 1, // Estimate

        // Content type for analysis
        contentType: res.getHeader('content-type')
      };

      // Track bandwidth cost
      try {
        const costMetric = costOptimizationService.trackBandwidthCost(bandwidthRequest);

        // Add cost headers (only if headers haven't been sent)
        if (process.env.ENVIRONMENT === 'development' && !res.headersSent) {
          res.setHeader('X-Bandwidth-Cost-Tracking', 'enabled');
          res.setHeader('X-Net-Cost', costMetric.netCost.toFixed(6));
          res.setHeader('X-Cache-Savings', costMetric.cacheSavings.toFixed(6));
        }

      } catch (error) {
        console.error('Bandwidth cost tracking error:', error);
      }

      return originalEnd.apply(this, arguments);
    };

    next();
  };
}

/**
 * Hebrew content cost tracking middleware
 * Specifically tracks costs related to Hebrew content delivery
 */
export function israeliHebrewContentCostTracker() {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    res.json = function(data) {
      // Analyze Hebrew content if present
      if (data && typeof data === 'object') {
        const content = JSON.stringify(data);
        const hebrewMatches = content.match(/[\u0590-\u05FF]/g);

        if (hebrewMatches && hebrewMatches.length > 0) {
          const hebrewContentData = {
            size: Buffer.byteLength(content, 'utf8'),
            hebrewCharCount: hebrewMatches.length,
            timestamp: moment().tz('Asia/Jerusalem').toISOString(),

            // Check compression
            compressionRatio: res.getHeader('content-encoding') === 'gzip' ?
                             this.estimateHebrewCompressionRatio(hebrewMatches.length, content.length) : 1,

            // Check RTL formatting
            rtlFormatting: res.getHeader('X-RTL-Formatted') === 'true'
          };

          // Track Hebrew content costs
          try {
            const hebrewCostMetric = costOptimizationService.trackHebrewContentCosts(hebrewContentData);

            // Add Hebrew cost tracking headers (only if headers haven't been sent)
            if (!res.headersSent) {
              res.setHeader('X-Hebrew-Cost-Tracking', 'enabled');
              res.setHeader('X-Hebrew-Chars', hebrewContentData.hebrewCharCount.toString());

              if (process.env.ENVIRONMENT === 'development') {
                res.setHeader('X-Hebrew-Cost', hebrewCostMetric.netCost.toFixed(6));
                res.setHeader('X-Hebrew-Compression-Savings', hebrewCostMetric.compressionSavings.toFixed(6));
              }
            }

          } catch (error) {
            console.error('Hebrew content cost tracking error:', error);
          }
        }
      }

      return originalJson.call(this, data);
    };

    // Helper method to estimate Hebrew compression ratio
    res.estimateHebrewCompressionRatio = function(hebrewCharCount, totalLength) {
      // Hebrew text typically compresses better due to character patterns
      const hebrewRatio = Math.min(hebrewCharCount / totalLength, 1);
      return 1 + (hebrewRatio * 1.5); // Hebrew content adds 1.5x compression efficiency
    };

    next();
  };
}

/**
 * Cost optimization dashboard endpoints middleware
 * Provides admin access to cost optimization insights
 */
export function israeliCostOptimizationDashboard() {
  return async (req, res, next) => {
    // Cost optimization dashboard endpoint
    if (req.path === '/api/admin/cost-optimization/israel' && req.user?.role === 'admin') {
      try {
        const reportType = req.query.type || 'comprehensive';
        let report;

        switch (reportType) {
          case 'insights':
            report = costOptimizationService.generateCostOptimizationInsights();
            break;
          case 'realtime':
            report = costOptimizationService.analyzeCostMetrics();
            break;
          case 'trends':
            report = costOptimizationService.analyzeCostTrends();
            break;
          case 'comprehensive':
          default:
            report = costOptimizationService.generateCostOptimizationInsights();
            break;
        }

        return res.json({
          success: true,
          reportType,
          data: report,
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString(),
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

    // Cost savings summary endpoint
    if (req.path === '/api/admin/cost-optimization/savings' && req.user?.role === 'admin') {
      try {
        const savings = costOptimizationService.calculateTotalSavings();
        const costs = costOptimizationService.calculateTotalCosts();

        const summary = {
          totalCosts: costs,
          totalSavings: savings,
          savingsPercentage: costs.total > 0 ? (savings.total / costs.total) * 100 : 0,
          optimizationRecommendations: costOptimizationService.getOptimizationRecommendations(),
          lastAnalysis: costOptimizationService.lastCostAnalysis?.timestamp
        };

        return res.json({
          success: true,
          data: summary,
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Cost Savings Summary Error',
          message: error.message
        });
      }
    }

    // Cost optimization recommendations endpoint
    if (req.path === '/api/admin/cost-optimization/recommendations' && req.user?.role === 'admin') {
      try {
        const recommendations = costOptimizationService.getOptimizationRecommendations();
        const marketFactors = costOptimizationService.analyzeIsraeliMarketFactors();

        return res.json({
          success: true,
          data: {
            recommendations,
            marketFactors,
            implementationPriority: recommendations.sort((a, b) => {
              const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            })
          },
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Cost Optimization Recommendations Error',
          message: error.message
        });
      }
    }

    // Cost projection endpoint
    if (req.path === '/api/admin/cost-optimization/projections' && req.user?.role === 'admin') {
      try {
        const projections = costOptimizationService.projectFutureCosts();
        const trends = costOptimizationService.analyzeCostTrends();

        return res.json({
          success: true,
          data: {
            projections,
            trends,
            israeliMarketFactors: {
              peakHoursImpact: costOptimizationService.calculatePeakHoursImpact(),
              hebrewContentEfficiency: costOptimizationService.getHebrewCompressionEfficiency()
            }
          },
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Cost Projections Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Cost alert webhook middleware
 * Handles cost alerts and notifications
 */
export function israeliCostAlerts() {
  return (req, res, next) => {
    // Initialize cost alert listeners if not already done
    if (!req.costAlertsInitialized) {
      req.costAlertsInitialized = true;

      costOptimizationService.on('cost_alerts', (alerts) => {
        // In production, this would send to external alerting systems
        if (process.env.ENVIRONMENT !== 'development') {
          console.warn('💰 Israeli Cost Alerts:', {
            timestamp: moment().tz('Asia/Jerusalem').format(),
            alertCount: alerts.length,
            alerts: alerts.map(alert => ({
              type: alert.type,
              severity: alert.severity,
              message: alert.message
            }))
          });

          // Here you could send to Telegram, Slack, email, etc.
          // Example: sendTelegramAlert(alerts);
        }
      });

      costOptimizationService.on('daily_cost_analysis', (analysis) => {
        if (analysis.totalCosts.total > 50) { // Log significant daily costs
          console.log('📊 Significant daily Israeli market costs:', {
            timestamp: moment().tz('Asia/Jerusalem').format(),
            totalCosts: analysis.totalCosts.total.toFixed(2),
            totalSavings: analysis.savings.total.toFixed(2),
            savingsPercentage: ((analysis.savings.total / analysis.totalCosts.total) * 100).toFixed(1)
          });
        }
      });
    }

    next();
  };
}

/**
 * Real-time cost monitoring middleware
 * Provides real-time cost insights for high-traffic endpoints
 */
export function israeliRealtimeCostMonitor() {
  return (req, res, next) => {
    // Monitor costs for high-traffic educational endpoints
    const highTrafficPaths = [
      '/api/entities/',
      '/api/products/',
      '/api/games/',
      '/api/dashboard/',
      '/api/assets/'
    ];

    const isHighTrafficPath = highTrafficPaths.some(path => req.path.includes(path));

    if (isHighTrafficPath) {
      const startTime = Date.now();

      // Override response to capture real-time metrics
      const originalEnd = res.end;

      res.end = function(...args) {
        const duration = Date.now() - startTime;

        // Real-time cost analysis for high-traffic paths
        if (duration > 1000) { // Slow requests over 1 second
          const israelTime = moment().tz('Asia/Jerusalem');

          console.log('⏱️ Slow request cost impact:', {
            timestamp: israelTime.format('HH:mm:ss'),
            path: req.path,
            duration: `${duration}ms`,
            isPeakHours: israelTime.hour() >= 8 && israelTime.hour() <= 18,
            estimatedExtraCost: (duration / 1000) * 0.001 // Rough estimate
          });
        }

        return originalEnd.apply(this, args);
      };
    }

    next();
  };
}

/**
 * Cleanup middleware for cost optimization
 * Graceful shutdown handling
 */
export function cleanupIsraeliCostOptimization() {
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('💰 Shutting down Israeli cost optimization...');
    costOptimizationService.stopCostTracking();
  });

  process.on('SIGINT', () => {
    console.log('💰 Shutting down Israeli cost optimization...');
    costOptimizationService.stopCostTracking();
  });

  return (req, res, next) => {
    next();
  };
}

export default {
  israeliS3CostTracker,
  israeliBandwidthCostTracker,
  israeliHebrewContentCostTracker,
  israeliCostOptimizationDashboard,
  israeliCostAlerts,
  israeliRealtimeCostMonitor,
  cleanupIsraeliCostOptimization,
  costOptimizationService
};