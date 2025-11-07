/**
 * Israeli Market Alerts Middleware
 *
 * Middleware for comprehensive Israeli market monitoring and alerting,
 * including real-time alerts, educational usage monitoring, and
 * Hebrew content issue tracking.
 */

import IsraeliMarketAlertsService from '../services/IsraeliMarketAlertsService.js';
import moment from 'moment-timezone';

// Global Israeli market alerts service instance
const alertsService = new IsraeliMarketAlertsService();

// Event listeners for different types of alerts
alertsService.on('israeli_market_alert', (alert) => {
  console.log(`🚨 Israeli Market Alert [${alert.severity}]:`, alert.message);
});

alertsService.on('realtime_check', (check) => {
  if (process.env.ENVIRONMENT === 'development') {
    console.log('🇮🇱 Realtime Check:', check.timestamp, check.context);
  }
});

alertsService.on('daily_health_check', (healthCheck) => {
  console.log('🏥 Daily Israeli Market Health Check:', {
    date: healthCheck.date,
    health: healthCheck.marketHealth,
    totalAlerts: healthCheck.totalAlerts
  });
});

alertsService.on('peak_hours_monitoring', (monitoring) => {
  if (process.env.ENVIRONMENT === 'development') {
    console.log('⏰ Peak Hours Monitoring:', monitoring.peakHourType);
  }
});

/**
 * Performance monitoring with Israeli market alerts
 */
export function israeliPerformanceAlertsMonitor() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Override response to capture performance metrics
    const originalEnd = res.end;
    const originalJson = res.json;

    let responseData = null;

    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    res.end = function(...args) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const israelTime = moment().tz('Asia/Jerusalem');

      // Track performance metrics for Israeli market alerts
      if (responseTime > 2000 && alertsService.isIsraeliPeakHours(israelTime)) {
        alertsService.trackPerformanceAlert({
          type: 'response_time',
          value: responseTime,
          threshold: 2000,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          hebrewContent: responseData && typeof responseData === 'object' &&
                        /[\u0590-\u05FF]/.test(JSON.stringify(responseData)),
          educationalContent: alertsService.isEducationalPath(req.path)
        });
      }

      // Track error rate alerts
      if (res.statusCode >= 400) {
        alertsService.trackPerformanceAlert({
          type: 'error_rate',
          value: res.statusCode,
          threshold: 400,
          path: req.path,
          method: req.method,
          error: res.statusMessage || 'Unknown error',
          hebrewContent: req.headers['accept-language']?.includes('he'),
          educationalContent: alertsService.isEducationalPath(req.path)
        });
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Hebrew content issues monitoring
 */
export function israeliHebrewContentAlertsMonitor() {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    res.json = function(data) {
      // Monitor Hebrew content for issues
      if (data && typeof data === 'object') {
        const content = JSON.stringify(data);
        const hebrewChars = content.match(/[\u0590-\u05FF]/g);

        if (hebrewChars && hebrewChars.length > 0) {
          try {
            // Check for Hebrew content rendering issues
            const hebrewIssue = this.detectHebrewContentIssues(content, req, res);
            if (hebrewIssue) {
              alertsService.trackHebrewContentIssue({
                type: hebrewIssue.type,
                content: content.substring(0, 200), // Truncate for logging
                error: hebrewIssue.error,
                path: req.path,
                userAgent: req.headers['user-agent'],
                rtlFormatting: res.getHeader('X-RTL-Formatted') === 'true',
                compressionIssue: !res.getHeader('content-encoding'),
                encodingIssue: !req.headers['accept-charset']?.includes('utf-8')
              });
            }
          } catch (error) {
            console.error('Hebrew content monitoring error:', error);
          }
        }
      }

      return originalJson.call(this, data);
    };

    // Helper method to detect Hebrew content issues
    res.detectHebrewContentIssues = function(content, req, res) {
      // Check for common Hebrew content issues
      if (content.includes('\\u05')) {
        return { type: 'unicode_escape_sequences', error: 'Hebrew text not properly decoded' };
      }

      if (res.getHeader('content-type') && !res.getHeader('content-type').includes('charset=utf-8')) {
        return { type: 'charset_missing', error: 'UTF-8 charset not specified' };
      }

      // Check for RTL direction issues
      if (!res.getHeader('X-RTL-Formatted') && content.match(/[\u0590-\u05FF]/)) {
        return { type: 'rtl_formatting_missing', error: 'RTL formatting not applied to Hebrew content' };
      }

      return null; // No issues detected
    };

    next();
  };
}

/**
 * Educational usage patterns monitoring
 */
export function israeliEducationalAlertsMonitor() {
  return (req, res, next) => {
    // Monitor educational endpoints
    if (alertsService.isEducationalPath(req.path)) {
      const israelTime = moment().tz('Asia/Jerusalem');

      // Track educational usage pattern
      const usagePattern = {
        type: 'educational_access',
        value: 1,
        users: req.user ? [req.user.id] : [],
        content: req.path,
        timestamp: israelTime.toISOString(),

        // User type analysis
        studentCount: req.user?.role === 'student' ? 1 : 0,
        teacherCount: req.user?.role === 'teacher' ? 1 : 0,
        parentCount: req.user?.role === 'parent' ? 1 : 0,

        // Content analysis
        subjectAreas: this.extractSubjectFromPath(req.path),
        gradeLevel: req.query.grade || req.user?.grade || 'unknown',
        hebrewContentUsage: req.headers['accept-language']?.includes('he') ? 1 : 0
      };

      alertsService.trackEducationalUsagePattern(usagePattern);

      // Track student activity if applicable
      if (req.user?.role === 'student') {
        const studentActivity = {
          studentId: req.user.id,
          type: this.getActivityTypeFromPath(req.path),
          duration: 0, // Will be updated on response
          content: req.path,

          hebrewContent: req.headers['accept-language']?.includes('he'),
          rtlInteraction: req.headers['content-language'] === 'he'
        };

        // Store for completion tracking
        req.studentActivity = studentActivity;
      }
    }

    // Override response to capture completion data
    if (req.studentActivity) {
      const originalEnd = res.end;
      const startTime = Date.now();

      res.end = function(...args) {
        req.studentActivity.duration = Date.now() - startTime;

        // Extract completion data from response if available
        if (res.locals.completionData) {
          req.studentActivity.completionRate = res.locals.completionData.completionRate;
          req.studentActivity.correctAnswers = res.locals.completionData.correctAnswers;
          req.studentActivity.totalQuestions = res.locals.completionData.totalQuestions;
        }

        alertsService.trackStudentActivity(req.studentActivity);

        return originalEnd.apply(this, args);
      };
    }

    next();
  };
}

/**
 * Real-time Israeli market monitoring
 */
export function israeliRealtimeMarketMonitor() {
  // Store monitoring state to prevent excessive monitoring calls
  let lastMonitoringCheck = 0;

  return (req, res, next) => {
    const now = Date.now();
    const israelTime = moment().tz('Asia/Jerusalem');

    // Perform monitoring check every 60 seconds maximum
    if (now - lastMonitoringCheck > 60000) {
      lastMonitoringCheck = now;

      // Check for system-wide issues
      const monitoringData = {
        timestamp: israelTime.toISOString(),
        activeRequests: req.requestId ? 1 : 0, // Simplified metric
        currentLoad: this.estimateCurrentLoad(),
        responseTimeThreshold: israelTime.hour() >= 8 && israelTime.hour() <= 18 ? 2000 : 3000
      };

      // Add monitoring headers for debugging
      if (process.env.ENVIRONMENT === 'development') {
        res.setHeader('X-Israeli-Monitoring', 'active');
        res.setHeader('X-Israeli-Time', israelTime.format('HH:mm:ss'));
        res.setHeader('X-Peak-Hours', alertsService.isIsraeliPeakHours(israelTime) ? 'true' : 'false');
      }
    }

    next();
  };
}

/**
 * Israeli market alerts dashboard endpoints
 */
export function israeliMarketAlertsDashboard() {
  return async (req, res, next) => {
    // Main alerts dashboard endpoint
    if (req.path === '/api/admin/alerts/israel' && req.user?.role === 'admin') {
      try {
        const reportType = req.query.type || 'active';
        let alertsData;

        switch (reportType) {
          case 'active':
            alertsData = Array.from(alertsService.activeAlerts.values());
            break;
          case 'history':
            alertsData = alertsService.alertHistory.slice(-50); // Last 50 alerts
            break;
          case 'summary':
            alertsData = this.generateAlertsSummary();
            break;
          default:
            alertsData = Array.from(alertsService.activeAlerts.values());
        }

        return res.json({
          success: true,
          type: reportType,
          data: alertsData,
          context: {
            israelTime: moment().tz('Asia/Jerusalem').format('DD/MM/YYYY HH:mm:ss'),
            isPeakHours: alertsService.isIsraeliPeakHours(moment().tz('Asia/Jerusalem')),
            isSchoolHours: alertsService.isIsraeliSchoolHours(moment().tz('Asia/Jerusalem')),
            totalActiveAlerts: alertsService.activeAlerts.size
          },
          generatedBy: req.user.id
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Israeli Market Alerts Dashboard Error',
          message: error.message
        });
      }
    }

    // Alert acknowledgment endpoint
    if (req.path === '/api/admin/alerts/acknowledge' && req.method === 'POST' && req.user?.role === 'admin') {
      try {
        const { alertId } = req.body;
        const alert = alertsService.activeAlerts.get(alertId);

        if (!alert) {
          return res.status(404).json({
            error: 'Alert Not Found',
            message: `Alert with ID ${alertId} not found`
          });
        }

        // Acknowledge alert
        alert.status = 'acknowledged';
        alert.acknowledgedBy = req.user.id;
        alert.acknowledgedAt = moment().tz('Asia/Jerusalem').toISOString();

        return res.json({
          success: true,
          message: 'Alert acknowledged successfully',
          alert: alert
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Alert Acknowledgment Error',
          message: error.message
        });
      }
    }

    // Alert resolution endpoint
    if (req.path === '/api/admin/alerts/resolve' && req.method === 'POST' && req.user?.role === 'admin') {
      try {
        const { alertId, resolution } = req.body;
        const alert = alertsService.activeAlerts.get(alertId);

        if (!alert) {
          return res.status(404).json({
            error: 'Alert Not Found',
            message: `Alert with ID ${alertId} not found`
          });
        }

        // Resolve alert
        alert.status = 'resolved';
        alert.resolvedBy = req.user.id;
        alert.resolvedAt = moment().tz('Asia/Jerusalem').toISOString();
        alert.resolution = resolution;

        // Remove from active alerts
        alertsService.activeAlerts.delete(alertId);

        return res.json({
          success: true,
          message: 'Alert resolved successfully',
          alert: alert
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Alert Resolution Error',
          message: error.message
        });
      }
    }

    // Israeli market health status endpoint
    if (req.path === '/api/admin/alerts/health-status' && req.user?.role === 'admin') {
      try {
        const israelTime = moment().tz('Asia/Jerusalem');
        const healthStatus = {
          timestamp: israelTime.toISOString(),
          israelTime: israelTime.format('DD/MM/YYYY HH:mm:ss'),

          // Current status
          marketHealth: 'good', // This would be calculated based on current metrics
          activeAlertsCount: alertsService.activeAlerts.size,
          criticalAlertsCount: Array.from(alertsService.activeAlerts.values())
            .filter(alert => alert.severity === 'critical').length,

          // Israeli context
          currentContext: {
            isPeakHours: alertsService.isIsraeliPeakHours(israelTime),
            isSchoolHours: alertsService.isIsraeliSchoolHours(israelTime),
            isShabbat: alertsService.isShabbat(israelTime),
            peakHourType: alertsService.getCurrentPeakHourType(israelTime)
          },

          // Recent activity
          recentAlerts: alertsService.alertHistory.slice(-10),
          lastHealthCheck: alertsService.israeliMetrics.systemHealthChecks.get(israelTime.format('YYYY-MM-DD'))
        };

        return res.json({
          success: true,
          data: healthStatus,
          generatedBy: req.user.id
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Health Status Error',
          message: error.message
        });
      }
    }

    // Israeli market metrics endpoint
    if (req.path === '/api/admin/alerts/metrics' && req.user?.role === 'admin') {
      try {
        const israelTime = moment().tz('Asia/Jerusalem');

        const metrics = {
          timestamp: israelTime.toISOString(),

          // Performance metrics
          peakHourPerformance: Array.from(alertsService.israeliMetrics.peakHourPerformance.entries())
            .slice(-24), // Last 24 hours

          // Hebrew content metrics
          hebrewContentIssues: Array.from(alertsService.israeliMetrics.hebrewContentIssues.entries())
            .slice(-24), // Last 24 hours

          // Educational usage metrics
          educationalUsage: Array.from(alertsService.israeliMetrics.educationalUsagePatterns.entries())
            .slice(-7), // Last 7 days

          // Student activity metrics
          studentActivity: Array.from(alertsService.israeliMetrics.studentActivityAlerts.entries())
            .slice(-50), // Last 50 activities

          // Alert trends
          alertTrends: this.calculateAlertTrends()
        };

        return res.json({
          success: true,
          data: metrics,
          generatedBy: req.user.id
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Metrics Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * System health monitoring with Israeli market context
 */
export function israeliSystemHealthMonitor() {
  return (req, res, next) => {
    // Monitor for system health issues
    const originalEnd = res.end;

    res.end = function(...args) {
      // Check for system health indicators
      if (res.statusCode >= 500) {
        alertsService.createAlert({
          type: 'system_health_issue',
          severity: 'high',
          message: `System error ${res.statusCode} detected`,
          data: {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent'],
            timestamp: moment().tz('Asia/Jerusalem').toISOString()
          },
          recommendations: [
            'Check server health',
            'Verify database connectivity',
            'Review error logs',
            'Monitor Israeli user experience'
          ]
        });
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Israeli market alerts webhook handler
 */
export function israeliMarketAlertsWebhook() {
  return (req, res, next) => {
    // Handle external webhooks for Israeli market alerts
    if (req.path === '/api/webhooks/israeli-market-alerts') {
      try {
        const alertData = req.body;

        // Validate webhook data
        if (!alertData.type || !alertData.message) {
          return res.status(400).json({
            error: 'Invalid Alert Data',
            message: 'Alert type and message are required'
          });
        }

        // Create alert from webhook
        const alert = alertsService.createAlert({
          type: `webhook_${alertData.type}`,
          severity: alertData.severity || 'medium',
          message: alertData.message,
          data: alertData.data || {},
          recommendations: alertData.recommendations || []
        });

        return res.json({
          success: true,
          message: 'Alert created from webhook',
          alertId: alert.id
        });

      } catch (error) {
        return res.status(500).json({
          error: 'Webhook Processing Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Cleanup middleware for Israeli market alerts
 */
export function cleanupIsraeliMarketAlerts() {
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🚨 Shutting down Israeli market alerts monitoring...');
    alertsService.stopMarketMonitoring();
  });

  process.on('SIGINT', () => {
    console.log('🚨 Shutting down Israeli market alerts monitoring...');
    alertsService.stopMarketMonitoring();
  });

  return (req, res, next) => {
    next();
  };
}

// Helper methods for middleware
function extractSubjectFromPath(path) {
  // Extract subject from educational path
  if (path.includes('/math')) return ['mathematics'];
  if (path.includes('/hebrew')) return ['hebrew_language'];
  if (path.includes('/science')) return ['science'];
  if (path.includes('/history')) return ['history'];
  return ['general'];
}

function getActivityTypeFromPath(path) {
  if (path.includes('/games')) return 'game';
  if (path.includes('/tools')) return 'tool_usage';
  if (path.includes('/dashboard')) return 'dashboard_view';
  if (path.includes('/entities')) return 'content_access';
  return 'general_access';
}

function estimateCurrentLoad() {
  // Simple load estimation - in production this would be more sophisticated
  return Math.random() > 0.7 ? 'high' : 'normal';
}

function generateAlertsSummary() {
  const last24Hours = alertsService.alertHistory.filter(alert =>
    moment(alert.timestamp).isAfter(moment().subtract(24, 'hours'))
  );

  return {
    total24Hours: last24Hours.length,
    bySeverity: {
      critical: last24Hours.filter(a => a.severity === 'critical').length,
      high: last24Hours.filter(a => a.severity === 'high').length,
      medium: last24Hours.filter(a => a.severity === 'medium').length,
      low: last24Hours.filter(a => a.severity === 'low').length
    },
    byType: last24Hours.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {}),
    peakHoursAlerts: last24Hours.filter(a => a.isPeakHours).length,
    schoolHoursAlerts: last24Hours.filter(a => a.isSchoolHours).length
  };
}

function calculateAlertTrends() {
  const last7Days = Array.from({ length: 7 }, (_, i) =>
    moment().tz('Asia/Jerusalem').subtract(i, 'days').format('YYYY-MM-DD')
  ).reverse();

  return last7Days.map(date => {
    const dayAlerts = alertsService.alertHistory.filter(alert =>
      moment(alert.timestamp).tz('Asia/Jerusalem').format('YYYY-MM-DD') === date
    );

    return {
      date,
      totalAlerts: dayAlerts.length,
      criticalAlerts: dayAlerts.filter(a => a.severity === 'critical').length,
      hebrewContentAlerts: dayAlerts.filter(a => a.type.includes('hebrew')).length,
      performanceAlerts: dayAlerts.filter(a => a.type.includes('performance')).length
    };
  });
}

export default {
  israeliPerformanceAlertsMonitor,
  israeliHebrewContentAlertsMonitor,
  israeliEducationalAlertsMonitor,
  israeliRealtimeMarketMonitor,
  israeliMarketAlertsDashboard,
  israeliSystemHealthMonitor,
  israeliMarketAlertsWebhook,
  cleanupIsraeliMarketAlerts,
  alertsService
};