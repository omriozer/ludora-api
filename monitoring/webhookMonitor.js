import models from '../models/index.js';
import { error as logger } from '../lib/errorLogger.js';
import { getWebhookConfig, getSecurityRules } from '../config/payplus.js';
import { Op } from 'sequelize';

/**
 * Webhook Security Monitor
 *
 * Monitors webhook security events, tracks signature failures,
 * and provides alerting capabilities for PayPlus webhook security.
 */

class WebhookSecurityMonitor {
  constructor() {
    this.alertCache = new Map(); // Cache to prevent duplicate alerts
    this.config = getWebhookConfig();
    this.securityRules = getSecurityRules();
  }

  /**
   * Monitor webhook security events and trigger alerts if thresholds are exceeded
   * @returns {Promise<Object>} Monitoring results
   */
  async monitorWebhookSecurity() {
    try {
      const timeWindow = new Date(Date.now() - this.config.monitoring.alertThresholds.timeWindowMinutes * 60 * 1000);

      // Check for signature failures in the configured time window
      const securityFailures = await models.WebhookLog.count({
        where: {
          provider: 'payplus',
          security_check: 'failed',
          created_at: {
            [Op.gte]: timeWindow
          }
        }
      });

      logger.payment('Webhook security monitoring check', {
        timeWindowMinutes: this.config.monitoring.alertThresholds.timeWindowMinutes,
        securityFailures,
        threshold: this.config.monitoring.alertThresholds.failures
      });

      // Check if we should trigger an alert
      if (securityFailures > this.config.monitoring.alertThresholds.failures) {
        await this.sendSecurityAlert({
          type: 'webhook_signature_failures',
          count: securityFailures,
          timeWindowMinutes: this.config.monitoring.alertThresholds.timeWindowMinutes,
          severity: this.config.monitoring.alertThresholds.severity,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        securityFailures,
        threshold: this.config.monitoring.alertThresholds.failures,
        alertTriggered: securityFailures > this.config.monitoring.alertThresholds.failures
      };

    } catch (error) {
      logger.payment('Webhook security monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive webhook security metrics
   * @param {Object} options - Query options
   * @param {Date} options.startDate - Start date for metrics (default: last 24 hours)
   * @param {Date} options.endDate - End date for metrics (default: now)
   * @returns {Promise<Object>} Security metrics
   */
  async getSecurityMetrics(options = {}) {
    try {
      const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      const endDate = options.endDate || new Date();

      const whereClause = {
        provider: 'payplus',
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      };

      // Get basic webhook counts
      const [
        totalWebhooks,
        securityPassed,
        securityFailed,
        processingFailed
      ] = await Promise.all([
        models.WebhookLog.count({ where: whereClause }),
        models.WebhookLog.count({ where: { ...whereClause, security_check: 'passed' } }),
        models.WebhookLog.count({ where: { ...whereClause, security_check: 'failed' } }),
        models.WebhookLog.count({ where: { ...whereClause, status: 'failed' } })
      ]);

      // Get recent security failures with details
      const recentFailures = await models.WebhookLog.findAll({
        where: {
          ...whereClause,
          security_check: 'failed'
        },
        order: [['created_at', 'DESC']],
        limit: 10,
        attributes: ['id', 'created_at', 'sender_info', 'security_reason', 'event_data']
      });

      // Calculate security metrics
      const securityRate = totalWebhooks > 0 ? (securityPassed / totalWebhooks) * 100 : 100;
      const failureRate = totalWebhooks > 0 ? (securityFailed / totalWebhooks) * 100 : 0;

      // Analyze failure patterns
      const failurePatterns = this.analyzeFailurePatterns(recentFailures);

      return {
        summary: {
          totalWebhooks,
          securityPassed,
          securityFailed,
          processingFailed,
          securityRate: Math.round(securityRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100
        },
        timeRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          durationHours: Math.round((endDate - startDate) / (1000 * 60 * 60))
        },
        recentFailures: recentFailures.map(failure => ({
          id: failure.id,
          timestamp: failure.created_at,
          ip: failure.sender_info?.ip,
          userAgent: failure.sender_info?.userAgent,
          reason: failure.security_reason,
          transactionUid: failure.event_data?.transaction_uid
        })),
        patterns: failurePatterns,
        alerts: {
          currentThreshold: this.config.monitoring.alertThresholds.failures,
          timeWindow: this.config.monitoring.alertThresholds.timeWindowMinutes,
          severity: this.config.monitoring.alertThresholds.severity
        }
      };

    } catch (error) {
      logger.payment('Failed to get webhook security metrics:', error);
      throw error;
    }
  }

  /**
   * Analyze patterns in security failures to identify potential attacks
   * @param {Array} failures - Array of failure records
   * @returns {Object} Analysis results
   */
  analyzeFailurePatterns(failures) {
    const patterns = {
      uniqueIPs: new Set(),
      repeatedIPs: {},
      suspiciousUserAgents: [],
      timeDistribution: {}
    };

    for (const failure of failures) {
      const ip = failure.sender_info?.ip;
      const userAgent = failure.sender_info?.userAgent;
      const hour = new Date(failure.created_at).getHours();

      if (ip) {
        patterns.uniqueIPs.add(ip);
        patterns.repeatedIPs[ip] = (patterns.repeatedIPs[ip] || 0) + 1;
      }

      if (userAgent && this.securityRules.suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
        patterns.suspiciousUserAgents.push({ userAgent, ip, timestamp: failure.created_at });
      }

      patterns.timeDistribution[hour] = (patterns.timeDistribution[hour] || 0) + 1;
    }

    // Find IPs with multiple failures
    const repeatedAttackers = Object.entries(patterns.repeatedIPs)
      .filter(([ip, count]) => count > 2)
      .map(([ip, count]) => ({ ip, failureCount: count }));

    return {
      uniqueIPCount: patterns.uniqueIPs.size,
      repeatedAttackers,
      suspiciousUserAgents: patterns.suspiciousUserAgents,
      peakHours: Object.entries(patterns.timeDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: parseInt(hour), failures: count }))
    };
  }

  /**
   * Send security alert (placeholder for actual alerting system integration)
   * @param {Object} alertData - Alert information
   * @returns {Promise<void>}
   */
  async sendSecurityAlert(alertData) {
    try {
      const alertKey = `${alertData.type}_${Math.floor(Date.now() / (5 * 60 * 1000))}`; // 5-minute alert deduplication

      // Prevent duplicate alerts within 5 minutes
      if (this.alertCache.has(alertKey)) {
        logger.payment('Security alert deduplicated', { alertKey, type: alertData.type });
        return;
      }

      this.alertCache.set(alertKey, true);

      // Log the security alert
      logger.payment('SECURITY ALERT: PayPlus webhook signature failures detected', {
        type: alertData.type,
        count: alertData.count,
        timeWindow: `${alertData.timeWindowMinutes} minutes`,
        severity: alertData.severity,
        timestamp: alertData.timestamp
      });

      // TODO: Integrate with actual alerting system
      // Examples of integrations:
      // - Send to Slack webhook
      // - Send email notification
      // - Create incident in PagerDuty
      // - Push to monitoring dashboard

      // For now, create a record in the database for tracking
      await models.SecurityAlert?.create?.({
        alert_type: alertData.type,
        severity: alertData.severity,
        count: alertData.count,
        time_window_minutes: alertData.timeWindowMinutes,
        metadata: alertData,
        created_at: new Date(),
        resolved_at: null
      }).catch(() => {
        // SecurityAlert model might not exist, ignore gracefully
        logger.payment('SecurityAlert model not found, alert logged only');
      });

      // Clean up old alert cache entries
      setTimeout(() => {
        this.alertCache.delete(alertKey);
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.payment('Failed to send security alert:', error);
    }
  }

  /**
   * Get real-time security dashboard data
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getDashboardMetrics() {
    try {
      // Last 15 minutes for real-time monitoring
      const metrics15Min = await this.getSecurityMetrics({
        startDate: new Date(Date.now() - 15 * 60 * 1000)
      });

      // Last 1 hour for trend analysis
      const metrics1Hour = await this.getSecurityMetrics({
        startDate: new Date(Date.now() - 60 * 60 * 1000)
      });

      // Last 24 hours for context
      const metrics24Hour = await this.getSecurityMetrics({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      });

      return {
        realTime: metrics15Min.summary,
        hourly: metrics1Hour.summary,
        daily: metrics24Hour.summary,
        trends: {
          securityRateTrend: metrics1Hour.summary.securityRate - metrics24Hour.summary.securityRate,
          failureRateTrend: metrics1Hour.summary.failureRate - metrics24Hour.summary.failureRate
        },
        recentFailures: metrics15Min.recentFailures,
        patterns: metrics1Hour.patterns
      };

    } catch (error) {
      logger.payment('Failed to get dashboard metrics:', error);
      throw error;
    }
  }
}

/**
 * Global webhook monitor instance
 */
const webhookMonitor = new WebhookSecurityMonitor();

/**
 * Scheduled monitoring function (to be called by cron job or scheduler)
 * @returns {Promise<Object>} Monitoring results
 */
async function runSecurityMonitoring() {
  return await webhookMonitor.monitorWebhookSecurity();
}

/**
 * Get webhook security metrics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Security metrics
 */
async function getWebhookSecurityMetrics(options = {}) {
  return await webhookMonitor.getSecurityMetrics(options);
}

/**
 * Get dashboard metrics for real-time monitoring
 * @returns {Promise<Object>} Dashboard data
 */
async function getSecurityDashboard() {
  return await webhookMonitor.getDashboardMetrics();
}

export default webhookMonitor;

export {
  WebhookSecurityMonitor,
  runSecurityMonitoring,
  getWebhookSecurityMetrics,
  getSecurityDashboard
};