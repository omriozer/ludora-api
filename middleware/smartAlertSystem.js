/**
 * Smart Alert System Middleware
 *
 * Unified alert system that combines all Israeli market alert functionality
 * into a single smart middleware with configurable rules and async processing.
 *
 * Replaces 5 separate alert middlewares:
 * - israeliPerformanceAlertsMonitor
 * - israeliHebrewContentAlertsMonitor
 * - israeliEducationalAlertsMonitor
 * - israeliRealtimeMarketMonitor
 * - israeliSystemHealthMonitor
 */

import IsraeliMarketAlertsService from '../services/IsraeliMarketAlertsService.js';
import moment from 'moment-timezone';
import EventEmitter from 'events';

// Global alert service instance
const alertsService = new IsraeliMarketAlertsService();

// Smart alert system class
class SmartAlertSystem extends EventEmitter {
  constructor() {
    super();

    // Alert configuration
    this.alertRules = {
      performance: {
        response_time: { threshold: 2000, severity: 'high', cooldown: 300000 }, // 5 min cooldown
        error_rate: { threshold: 400, severity: 'high', cooldown: 60000 } // 1 min cooldown
      },
      hebrew_content: {
        unicode_escape_sequences: { threshold: 1, severity: 'medium', cooldown: 600000 }, // 10 min cooldown
        charset_missing: { threshold: 1, severity: 'medium', cooldown: 300000 }, // 5 min cooldown
        rtl_formatting_missing: { threshold: 3, severity: 'low', cooldown: 900000 } // 15 min cooldown
      },
      educational: {
        student_inactivity: { threshold: 30, severity: 'low', cooldown: 1800000 }, // 30 min cooldown
        unusual_access_pattern: { threshold: 5, severity: 'medium', cooldown: 600000 } // 10 min cooldown
      },
      system_health: {
        server_error: { threshold: 500, severity: 'critical', cooldown: 60000 }, // 1 min cooldown
        high_load: { threshold: 0.8, severity: 'high', cooldown: 300000 } // 5 min cooldown
      }
    };

    // Alert deduplication and rate limiting
    this.activeAlerts = new Map();
    this.alertCooldowns = new Map();
    this.alertCounts = new Map();

    // Monitoring state
    this.lastMonitoringCheck = 0;
    this.monitoringInterval = 60000; // 1 minute

    // Statistics
    this.stats = {
      totalAlerts: 0,
      alertsByType: {},
      alertsBySeverity: {},
      deduplicated: 0,
      rateLimited: 0
    };

    this.initialize();
  }

  /**
   * Initialize the smart alert system
   */
  initialize() {
    console.log('🚨 Initializing Smart Alert System...');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize monitoring
    this.startMonitoring();
  }

  /**
   * Set up event listeners for alert processing
   */
  setupEventListeners() {
    this.on('alert_created', (alert) => {
      this.processAlert(alert);
    });

    this.on('alert_resolved', (alertId) => {
      this.resolveAlert(alertId);
    });

    // Forward events to external systems
    this.on('critical_alert', (alert) => {
      console.error('🚨 CRITICAL ALERT:', alert);
      // In production: send to external monitoring systems
    });

    this.on('alert_suppressed', (alert) => {
      console.log('🔇 Alert suppressed:', alert.type, alert.reason);
    });
  }

  /**
   * Start background monitoring
   */
  startMonitoring() {
    // Periodic cleanup of old alerts and cooldowns
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // 5 minutes

    console.log('✅ Smart Alert System monitoring started');
  }

  /**
   * Process incoming alert
   */
  processAlert(alert) {
    try {
      // Check if alert should be suppressed
      if (this.shouldSuppressAlert(alert)) {
        this.emit('alert_suppressed', {
          ...alert,
          reason: 'rate_limited_or_duplicate'
        });
        return null;
      }

      // Determine alert severity and actions
      const processedAlert = this.enrichAlert(alert);

      // Store alert
      this.storeAlert(processedAlert);

      // Update statistics
      this.updateStats(processedAlert);

      // Trigger immediate actions for critical alerts
      if (processedAlert.severity === 'critical') {
        this.emit('critical_alert', processedAlert);
      }

      console.log(`🚨 Alert processed: ${processedAlert.type} [${processedAlert.severity}]`);

      return processedAlert;

    } catch (error) {
      console.error('Alert processing error:', error);
      return null;
    }
  }

  /**
   * Check if alert should be suppressed
   */
  shouldSuppressAlert(alert) {
    const alertKey = `${alert.type}-${alert.path || 'global'}`;

    // Check cooldown period
    const cooldownKey = `cooldown-${alertKey}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    const rule = this.getAlertRule(alert.type);

    if (lastAlert && Date.now() - lastAlert < rule.cooldown) {
      this.stats.rateLimited += 1;
      return true; // Still in cooldown
    }

    // Check for duplicate active alerts
    if (this.activeAlerts.has(alertKey)) {
      this.stats.deduplicated += 1;
      return true; // Duplicate alert
    }

    return false;
  }

  /**
   * Enrich alert with additional context and metadata
   */
  enrichAlert(alert) {
    const israelTime = moment().tz('Asia/Jerusalem');

    return {
      id: this.generateAlertId(),
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('DD/MM/YYYY HH:mm:ss'),
      ...alert,

      // Israeli context
      isPeakHours: this.isIsraeliPeakHours(israelTime.hour()),
      isSchoolHours: this.isIsraeliSchoolHours(israelTime),
      isShabbat: this.isShabbat(israelTime),
      peakHourType: this.getCurrentPeakHourType(israelTime.hour()),

      // Alert metadata
      severity: this.calculateAlertSeverity(alert),
      status: 'active',
      acknowledgedBy: null,
      resolvedBy: null,
      resolvedAt: null,

      // Recommendations
      recommendations: this.generateRecommendations(alert)
    };
  }

  /**
   * Store alert in active alerts
   */
  storeAlert(alert) {
    const alertKey = `${alert.type}-${alert.path || 'global'}`;

    this.activeAlerts.set(alertKey, alert);
    this.alertCooldowns.set(`cooldown-${alertKey}`, Date.now());

    // Store in alerts service for persistence
    alertsService.activeAlerts.set(alert.id, alert);
    alertsService.alertHistory.push(alert);
  }

  /**
   * Update statistics
   */
  updateStats(alert) {
    this.stats.totalAlerts += 1;

    // Count by type
    this.stats.alertsByType[alert.type] = (this.stats.alertsByType[alert.type] || 0) + 1;

    // Count by severity
    this.stats.alertsBySeverity[alert.severity] = (this.stats.alertsBySeverity[alert.severity] || 0) + 1;
  }

  /**
   * Calculate alert severity based on rules
   */
  calculateAlertSeverity(alert) {
    const rule = this.getAlertRule(alert.type);

    if (rule) {
      return rule.severity;
    }

    // Default severity based on alert value/threshold
    if (alert.value !== undefined && alert.threshold !== undefined) {
      if (alert.value > alert.threshold * 3) return 'critical';
      if (alert.value > alert.threshold * 2) return 'high';
      if (alert.value > alert.threshold * 1.5) return 'medium';
      return 'low';
    }

    return 'medium'; // Default
  }

  /**
   * Get alert rule by type
   */
  getAlertRule(alertType) {
    // Navigate through nested rule structure
    for (const category of Object.keys(this.alertRules)) {
      if (this.alertRules[category][alertType]) {
        return this.alertRules[category][alertType];
      }
    }

    return {
      threshold: 1,
      severity: 'medium',
      cooldown: 300000 // 5 minutes default
    };
  }

  /**
   * Generate recommendations based on alert type
   */
  generateRecommendations(alert) {
    const recommendations = [];

    switch (alert.type) {
      case 'response_time':
        recommendations.push('Check server performance');
        if (alert.isPeakHours) {
          recommendations.push('Consider Israeli peak hours optimization');
        }
        if (alert.hebrewContent) {
          recommendations.push('Optimize Hebrew content compression');
        }
        break;

      case 'error_rate':
        recommendations.push('Review error logs');
        recommendations.push('Check database connectivity');
        if (alert.educationalContent) {
          recommendations.push('Monitor Israeli student experience');
        }
        break;

      case 'unicode_escape_sequences':
      case 'charset_missing':
      case 'rtl_formatting_missing':
        recommendations.push('Fix Hebrew content encoding');
        recommendations.push('Verify UTF-8 charset');
        recommendations.push('Check RTL formatting');
        break;

      case 'student_inactivity':
        recommendations.push('Check student engagement');
        recommendations.push('Review educational content accessibility');
        break;

      case 'server_error':
        recommendations.push('Immediate server investigation required');
        recommendations.push('Check system resources');
        recommendations.push('Review recent deployments');
        break;

      default:
        recommendations.push('Review system logs');
        recommendations.push('Monitor Israeli user experience');
    }

    return recommendations;
  }

  /**
   * Cleanup old data
   */
  cleanupOldData() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean old cooldowns
    for (const [key, timestamp] of this.alertCooldowns.entries()) {
      if (now - timestamp > maxAge) {
        this.alertCooldowns.delete(key);
      }
    }

    console.log('🧹 Alert system cleanup completed');
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `IL-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Israeli time context helpers
   */
  isIsraeliPeakHours(hour) {
    return (hour >= 7 && hour <= 9) ||    // Morning rush
           (hour >= 12 && hour <= 14) ||  // Lunch break
           (hour >= 16 && hour <= 18) ||  // After school
           (hour >= 19 && hour <= 22);    // Evening study
  }

  isIsraeliSchoolHours(israelTime) {
    const hour = israelTime.hour();
    const day = israelTime.day();
    return (day >= 0 && day <= 4) && (hour >= 8 && hour <= 16);
  }

  isShabbat(israelTime) {
    const day = israelTime.day();
    const hour = israelTime.hour();
    return (day === 5 && hour >= 18) || (day === 6 && hour <= 20);
  }

  getCurrentPeakHourType(hour) {
    if (hour >= 7 && hour <= 9) return 'morning';
    if (hour >= 12 && hour <= 14) return 'lunch';
    if (hour >= 16 && hour <= 18) return 'afternoon';
    if (hour >= 19 && hour <= 22) return 'evening';
    return 'off-peak';
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeAlertsCount: this.activeAlerts.size,
      cooldownsActive: this.alertCooldowns.size
    };
  }
}

// Create global smart alert system instance
const smartAlertSystem = new SmartAlertSystem();

/**
 * Main Smart Alert System Middleware
 * Replaces 5 separate alert monitoring middlewares
 */
export function smartAlertSystemMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Single response override for all alert monitoring
    const originalEnd = res.end;
    const originalJson = res.json;

    let responseData = null;

    // Capture response data
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    res.end = function(...args) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const israelTime = moment().tz('Asia/Jerusalem');

      try {
        // Performance alerts
        if (responseTime > 2000 && smartAlertSystem.isIsraeliPeakHours(israelTime.hour())) {
          smartAlertSystem.emit('alert_created', {
            type: 'response_time',
            value: responseTime,
            threshold: 2000,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            hebrewContent: responseData && typeof responseData === 'object' &&
                          /[\u0590-\u05FF]/.test(JSON.stringify(responseData)),
            educationalContent: isEducationalPath(req.path)
          });
        }

        // Error rate alerts
        if (res.statusCode >= 400) {
          const alertType = res.statusCode >= 500 ? 'server_error' : 'error_rate';
          smartAlertSystem.emit('alert_created', {
            type: alertType,
            value: res.statusCode,
            threshold: 400,
            path: req.path,
            method: req.method,
            error: res.statusMessage || 'Unknown error',
            hebrewContent: req.headers['accept-language']?.includes('he'),
            educationalContent: isEducationalPath(req.path)
          });
        }

        // Hebrew content alerts
        if (responseData && typeof responseData === 'object') {
          const content = JSON.stringify(responseData);
          const hebrewChars = content.match(/[\u0590-\u05FF]/g);

          if (hebrewChars && hebrewChars.length > 0) {
            const hebrewIssue = detectHebrewContentIssues(content, req, res);
            if (hebrewIssue) {
              smartAlertSystem.emit('alert_created', {
                type: hebrewIssue.type,
                value: 1,
                threshold: 1,
                content: content.substring(0, 200),
                error: hebrewIssue.error,
                path: req.path,
                userAgent: req.headers['user-agent'],
                rtlFormatting: res.getHeader('X-RTL-Formatted') === 'true',
                compressionIssue: !res.getHeader('content-encoding'),
                encodingIssue: !req.headers['accept-charset']?.includes('utf-8')
              });
            }
          }
        }

        // Educational usage pattern alerts (only for educational paths)
        if (isEducationalPath(req.path)) {
          trackEducationalUsage(req, res, responseTime);
        }

        // Real-time market monitoring (throttled)
        performRealtimeMonitoring(req, res);

      } catch (error) {
        console.error('Smart alert processing error:', error);
        // Don't block response on alert processing errors
      }

      return originalEnd.apply(this, arguments);
    };

    next();
  };
}

/**
 * Check if path is educational content
 */
function isEducationalPath(path) {
  const educationalPaths = [
    '/api/entities/',
    '/api/products/',
    '/api/games/',
    '/api/tools/',
    '/api/dashboard/',
    '/api/workshops/',
    '/api/courses/'
  ];
  return educationalPaths.some(edPath => path?.includes(edPath));
}

/**
 * Detect Hebrew content issues
 */
function detectHebrewContentIssues(content, req, res) {
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
}

/**
 * Track educational usage patterns
 */
function trackEducationalUsage(req, res, responseTime) {
  const israelTime = moment().tz('Asia/Jerusalem');

  // Track educational usage pattern
  const usagePattern = {
    type: 'educational_access',
    value: 1,
    users: req.user ? [req.user.id] : [],
    content: req.path,
    timestamp: israelTime.toISOString(),
    responseTime: responseTime,

    // User type analysis
    studentCount: req.user?.role === 'student' ? 1 : 0,
    teacherCount: req.user?.role === 'teacher' ? 1 : 0,
    parentCount: req.user?.role === 'parent' ? 1 : 0,

    // Content analysis
    subjectAreas: extractSubjectFromPath(req.path),
    gradeLevel: req.query.grade || req.user?.grade || 'unknown',
    hebrewContentUsage: req.headers['accept-language']?.includes('he') ? 1 : 0
  };

  // Check for unusual patterns
  if (responseTime > 5000) {
    smartAlertSystem.emit('alert_created', {
      type: 'unusual_access_pattern',
      value: responseTime,
      threshold: 5000,
      path: req.path,
      userId: req.user?.id,
      userType: req.user?.role,
      pattern: 'slow_educational_access'
    });
  }

  // Track student activity
  if (req.user?.role === 'student') {
    alertsService.trackStudentActivity({
      studentId: req.user.id,
      type: getActivityTypeFromPath(req.path),
      duration: responseTime,
      content: req.path,
      completionRate: res.locals?.completionData?.completionRate || 0,
      hebrewContent: req.headers['accept-language']?.includes('he'),
      rtlInteraction: req.headers['content-language'] === 'he'
    });
  }
}

/**
 * Perform real-time market monitoring (throttled)
 */
function performRealtimeMonitoring(req, res) {
  const now = Date.now();

  // Perform monitoring check every 60 seconds maximum
  if (now - smartAlertSystem.lastMonitoringCheck > smartAlertSystem.monitoringInterval) {
    smartAlertSystem.lastMonitoringCheck = now;

    const israelTime = moment().tz('Asia/Jerusalem');

    // Add monitoring headers for debugging
    if (process.env.ENVIRONMENT === 'development' && !res.headersSent) {
      res.setHeader('X-Israeli-Monitoring', 'smart-alert-system');
      res.setHeader('X-Israeli-Time', israelTime.format('HH:mm:ss'));
      res.setHeader('X-Peak-Hours', smartAlertSystem.isIsraeliPeakHours(israelTime.hour()) ? 'true' : 'false');
    }

    // Emit monitoring check event
    smartAlertSystem.emit('realtime_check', {
      timestamp: israelTime.toISOString(),
      context: {
        hour: israelTime.hour(),
        isPeakHours: smartAlertSystem.isIsraeliPeakHours(israelTime.hour()),
        isSchoolHours: smartAlertSystem.isIsraeliSchoolHours(israelTime),
        activeRequests: 1 // Simplified metric
      }
    });
  }
}

/**
 * Smart Alert Dashboard Endpoints
 * Combines functionality from israeliMarketAlertsDashboard
 */
export function smartAlertDashboard() {
  return async (req, res, next) => {
    if (!req.user?.role === 'admin') {
      return next();
    }

    // Main alerts dashboard endpoint
    if (req.path === '/api/admin/alerts/israel') {
      try {
        const reportType = req.query.type || 'active';
        let alertsData;

        switch (reportType) {
          case 'active':
            alertsData = Array.from(smartAlertSystem.activeAlerts.values());
            break;
          case 'history':
            alertsData = alertsService.alertHistory.slice(-50);
            break;
          case 'summary':
            alertsData = generateAlertsSummary();
            break;
          case 'stats':
            alertsData = smartAlertSystem.getStats();
            break;
          default:
            alertsData = Array.from(smartAlertSystem.activeAlerts.values());
        }

        return res.json({
          success: true,
          type: reportType,
          data: alertsData,
          context: {
            israelTime: moment().tz('Asia/Jerusalem').format('DD/MM/YYYY HH:mm:ss'),
            isPeakHours: smartAlertSystem.isIsraeliPeakHours(moment().tz('Asia/Jerusalem').hour()),
            isSchoolHours: smartAlertSystem.isIsraeliSchoolHours(moment().tz('Asia/Jerusalem')),
            totalActiveAlerts: smartAlertSystem.activeAlerts.size,
            systemStats: smartAlertSystem.getStats()
          },
          generatedBy: req.user.id
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Smart Alert Dashboard Error',
          message: error.message
        });
      }
    }

    // Alert acknowledgment endpoint
    if (req.path === '/api/admin/alerts/acknowledge' && req.method === 'POST') {
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
    if (req.path === '/api/admin/alerts/resolve' && req.method === 'POST') {
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
        const alertKey = `${alert.type}-${alert.path || 'global'}`;
        smartAlertSystem.activeAlerts.delete(alertKey);
        alertsService.activeAlerts.delete(alertId);

        smartAlertSystem.emit('alert_resolved', alertId);

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

    next();
  };
}

/**
 * Generate alerts summary
 */
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
    schoolHoursAlerts: last24Hours.filter(a => a.isSchoolHours).length,
    smartSystemStats: smartAlertSystem.getStats()
  };
}

/**
 * Helper functions
 */
function extractSubjectFromPath(path) {
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

/**
 * Cleanup function
 */
export function cleanupSmartAlertSystem() {
  console.log('🚨 Shutting down Smart Alert System...');

  // Process any remaining alerts
  smartAlertSystem.cleanupOldData();

  // Stop monitoring
  alertsService.stopMarketMonitoring();

  console.log('✅ Smart Alert System shutdown complete');
}

export default {
  smartAlertSystemMiddleware,
  smartAlertDashboard,
  cleanupSmartAlertSystem,
  smartAlertSystem, // Export for testing
  isEducationalPath, // Export for testing
  detectHebrewContentIssues, // Export for testing
  alertsService
};