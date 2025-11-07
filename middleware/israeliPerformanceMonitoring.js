/**
 * Israeli Performance Monitoring Middleware
 *
 * Middleware for real-time performance tracking and monitoring
 * of Israeli user connections and application performance.
 */

import IsraeliPerformanceMonitoringService from '../services/IsraeliPerformanceMonitoringService.js';
import moment from 'moment-timezone';

// Global performance monitoring service instance
const performanceService = new IsraeliPerformanceMonitoringService();

// Start monitoring when middleware loads
performanceService.startMonitoring();

// Event listeners for performance alerts
performanceService.on('performance_issues', (alert) => {
  console.warn('🚨 Israeli Performance Alert:', alert);
});

performanceService.on('health_check', (healthData) => {
  if (healthData.overallHealth === 'poor' || healthData.overallHealth === 'critical') {
    console.error('🏥 Israeli Health Check Alert:', healthData);
  }
});

/**
 * Main Israeli performance monitoring middleware
 * Tracks request performance and user experience metrics
 */
export function israeliPerformanceTracker() {
  return (req, res, next) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Store start time for performance calculation
    req.performanceStart = {
      timestamp: startTime,
      hrtime: startHrTime,
      israelTime: moment().tz('Asia/Jerusalem').toISOString()
    };

    // Override res.end to capture completion time
    const originalEnd = res.end;
    const originalJson = res.json;

    let responseData = null;
    let contentLength = 0;

    // Capture response data
    res.json = function(data) {
      responseData = data;
      if (data) {
        contentLength = JSON.stringify(data).length;
      }
      return originalJson.call(this, data);
    };

    res.end = function(chunk, encoding) {
      const endTime = Date.now();
      const hrDiff = process.hrtime(startHrTime);

      // Calculate precise timing
      const responseTime = endTime - startTime;
      const preciseTime = hrDiff[0] * 1000 + hrDiff[1] * 1e-6; // Convert to milliseconds

      // Capture content length if not already set
      if (chunk && !contentLength) {
        contentLength = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk || '', encoding || 'utf8');
      }

      // Build performance data
      const performanceData = {
        // Request details
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,

        // Timing metrics
        responseTime: Math.round(responseTime),
        loadTime: Math.round(preciseTime),
        startTime: req.performanceStart.timestamp,
        endTime: endTime,

        // Content metrics
        contentSize: contentLength,
        contentType: res.getHeader('content-type'),
        content: typeof responseData === 'object' ? JSON.stringify(responseData) : null,

        // CDN and caching info
        cfCacheStatus: req.headers['cf-cache-status'],
        s3LoadTime: req.s3LoadTime || 0,

        // Israeli-specific headers
        israelTime: req.performanceStart.israelTime,
        hebrewSupport: res.getHeader('X-Hebrew-Support'),
        cacheOptimized: res.getHeader('X-Cache-Optimized'),
        israeliCompliance: res.getHeader('X-Israeli-Compliance')
      };

      // Track performance with Israeli monitoring service
      try {
        const metric = performanceService.trackIsraeliRequest(performanceData);

        // Add performance ID to response headers for debugging
        res.setHeader('X-Performance-ID', metric.requestId);
        res.setHeader('X-Response-Time', responseTime.toString());
        res.setHeader('X-Quality-Score', metric.qualityScore.toString());

        // Add Israeli timezone info
        res.setHeader('X-Monitored-At', moment().tz('Asia/Jerusalem').format());

        // Performance insights headers for development
        if (process.env.ENVIRONMENT === 'development') {
          res.setHeader('X-ISP-Estimate', metric.estimatedISP);
          res.setHeader('X-Device-Type', metric.deviceType);
          res.setHeader('X-Peak-Hours', metric.isPeakHours ? 'true' : 'false');
        }

      } catch (error) {
        console.error('Israeli performance tracking error:', error);
        // Don't fail the request on monitoring errors
      }

      // Call original end method
      return originalEnd.apply(this, arguments);
    };

    next();
  };
}

/**
 * S3 performance tracking middleware
 * Specifically tracks S3 operation performance
 */
export function israeliS3PerformanceTracker() {
  return (req, res, next) => {
    // Track S3 operations
    const originalS3Operation = req.s3Operation;

    if (req.path.includes('/api/assets/') || req.path.includes('/api/media/')) {
      const s3StartTime = Date.now();

      // Override S3 operation tracking
      req.trackS3Performance = (operationType, duration) => {
        const s3Performance = {
          operation: operationType,
          duration: duration || (Date.now() - s3StartTime),
          timestamp: moment().tz('Asia/Jerusalem').toISOString(),
          path: req.path,
          fileType: req.headers['content-type'],
          success: res.statusCode < 400
        };

        // Store for main performance tracker
        req.s3LoadTime = s3Performance.duration;

        // Log S3-specific performance
        if (process.env.ENVIRONMENT === 'development') {
          console.log('🗂️ S3 Performance:', s3Performance);
        }
      };
    }

    next();
  };
}

/**
 * Hebrew content performance tracking middleware
 * Special monitoring for Hebrew content delivery performance
 */
export function israeliHebrewContentPerformanceTracker() {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    res.json = function(data) {
      // Check for Hebrew content
      const hasHebrew = data && typeof data === 'object' &&
                       /[\u0590-\u05FF]/.test(JSON.stringify(data));

      if (hasHebrew) {
        const hebrewPerformanceData = {
          timestamp: moment().tz('Asia/Jerusalem').toISOString(),
          path: req.path,
          contentSize: JSON.stringify(data).length,
          hebrewCharCount: (JSON.stringify(data).match(/[\u0590-\u05FF]/g) || []).length,
          compressionUsed: res.getHeader('content-encoding'),
          rtlOptimized: res.getHeader('X-RTL-Formatted') === 'true'
        };

        // Add Hebrew content performance headers
        res.setHeader('X-Hebrew-Performance', 'tracked');
        res.setHeader('X-Hebrew-Chars', hebrewPerformanceData.hebrewCharCount.toString());

        // Store for main performance tracker
        req.hebrewContentData = hebrewPerformanceData;

        if (process.env.ENVIRONMENT === 'development') {
          console.log('🔤 Hebrew Content Performance:', hebrewPerformanceData);
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Israeli peak hours performance tracking middleware
 * Adjusts monitoring based on Israeli usage patterns
 */
export function israeliPeakHoursPerformanceTracker() {
  return (req, res, next) => {
    const israelTime = moment().tz('Asia/Jerusalem');
    const hour = israelTime.hour();

    // Define Israeli peak hours
    const isPeakHours = (hour >= 7 && hour <= 9) ||    // Morning rush
                       (hour >= 12 && hour <= 14) ||   // Lunch break
                       (hour >= 16 && hour <= 18) ||   // After school
                       (hour >= 19 && hour <= 22);     // Evening study

    const isSchoolHours = hour >= 8 && hour <= 16 && israelTime.day() >= 1 && israelTime.day() <= 5;

    // Add Israeli time context to request
    req.israeliTimeContext = {
      localTime: israelTime.format('HH:mm:ss'),
      isPeakHours,
      isSchoolHours,
      dayOfWeek: israelTime.format('dddd'),
      isWeekend: israelTime.day() === 5 || israelTime.day() === 6
    };

    // Add performance monitoring headers based on time
    res.setHeader('X-Israeli-Time-Context', isPeakHours ? 'peak' : 'normal');
    res.setHeader('X-School-Hours', isSchoolHours ? 'true' : 'false');

    // Adjust monitoring sensitivity during peak hours
    if (isPeakHours) {
      req.performanceMonitoringMode = 'enhanced';
      res.setHeader('X-Monitoring-Mode', 'enhanced');
    }

    next();
  };
}

/**
 * Performance dashboard endpoint middleware
 * Provides real-time performance data for admin dashboards
 */
export function israeliPerformanceDashboard() {
  return async (req, res, next) => {
    // Performance dashboard endpoints
    if (req.path === '/api/admin/performance/israel' && req.user?.role === 'admin') {
      try {
        const reportType = req.query.type || 'realtime';
        let report;

        switch (reportType) {
          case 'realtime':
            report = performanceService.collectRealtimeMetrics();
            break;
          case 'health':
            report = await performanceService.performHealthChecks();
            break;
          case 'comprehensive':
            report = performanceService.generatePerformanceReport();
            break;
          default:
            report = performanceService.collectRealtimeMetrics();
        }

        return res.json({
          success: true,
          reportType,
          data: report,
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Performance Dashboard Error',
          message: error.message
        });
      }
    }

    // Performance metrics endpoint for monitoring tools
    if (req.path === '/api/admin/performance/metrics' && req.user?.role === 'admin') {
      try {
        const metrics = {
          realtime: performanceService.realtimeStats,
          health: performanceService.healthChecks.slice(-1)[0] || null,
          connectionProfiles: Array.from(performanceService.connectionProfiles.entries()),
          recentAlerts: performanceService.alertHistory.slice(-10)
        };

        return res.json({
          success: true,
          metrics,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Performance Metrics Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Performance alert webhook middleware
 * Sends alerts to external monitoring systems
 */
export function israeliPerformanceAlerts() {
  return (req, res, next) => {
    // Listen for performance service alerts
    if (!req.performanceAlertsInitialized) {
      req.performanceAlertsInitialized = true;

      performanceService.on('performance_issues', (alert) => {
        // In production, this would send to external alerting systems
        if (process.env.ENVIRONMENT !== 'development') {
          console.warn('🇮🇱 Performance Alert:', {
            timestamp: moment().tz('Asia/Jerusalem').format(),
            alert
          });
        }
      });

      performanceService.on('health_check', (health) => {
        if (health.overallHealth === 'critical') {
          console.error('🚨 Critical Health Alert:', {
            timestamp: moment().tz('Asia/Jerusalem').format(),
            health: health.overallHealth,
            issues: health.checks
          });
        }
      });
    }

    next();
  };
}

/**
 * Cleanup middleware for performance monitoring
 * Graceful shutdown handling
 */
export function cleanupIsraeliPerformanceMonitoring() {
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🇮🇱 Shutting down Israeli performance monitoring...');
    performanceService.stopMonitoring();
  });

  process.on('SIGINT', () => {
    console.log('🇮🇱 Shutting down Israeli performance monitoring...');
    performanceService.stopMonitoring();
  });

  return (req, res, next) => {
    next();
  };
}

export default {
  israeliPerformanceTracker,
  israeliS3PerformanceTracker,
  israeliHebrewContentPerformanceTracker,
  israeliPeakHoursPerformanceTracker,
  israeliPerformanceDashboard,
  israeliPerformanceAlerts,
  cleanupIsraeliPerformanceMonitoring,
  performanceService
};