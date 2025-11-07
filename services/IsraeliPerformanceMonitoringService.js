/**
 * Israeli Performance Monitoring Service
 *
 * Real-time performance monitoring service optimized for Israeli internet
 * infrastructure, connection patterns, and geographic considerations.
 *
 * Features:
 * - Israeli ISP performance tracking
 * - Geographic latency monitoring (Israel to EU servers)
 * - CDN performance optimization
 * - Mobile connection quality analysis
 * - Peak hours performance tracking
 * - Hebrew content delivery optimization
 * - Real-time performance alerts
 * - Connection quality recommendations
 */

import moment from 'moment-timezone';
import { EventEmitter } from 'events';

/**
 * Israeli performance monitoring configuration
 */
const ISRAELI_PERFORMANCE_CONFIG = {
  // Israeli timezone for accurate performance tracking
  TIMEZONE: 'Asia/Jerusalem',

  // Major Israeli ISPs for targeted monitoring
  ISRAELI_ISPS: {
    BEZEQ: { name: 'Bezeq', expectedLatency: 45, marketShare: 35 },
    HOT: { name: 'Hot', expectedLatency: 50, marketShare: 25 },
    PARTNER: { name: 'Partner', expectedLatency: 55, marketShare: 20 },
    CELLCOM: { name: 'Cellcom', expectedLatency: 60, marketShare: 15 },
    OTHER: { name: 'Other', expectedLatency: 65, marketShare: 5 }
  },

  // Performance thresholds optimized for Israeli connections
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: { latency: 30, loadTime: 1000, uptime: 99.9 },
    GOOD: { latency: 50, loadTime: 2000, uptime: 99.5 },
    ACCEPTABLE: { latency: 80, loadTime: 3000, uptime: 99.0 },
    POOR: { latency: 120, loadTime: 5000, uptime: 98.0 }
  },

  // Israeli peak hours for performance correlation
  PEAK_HOURS: {
    MORNING: { start: 7, end: 9 },
    LUNCH: { start: 12, end: 14 },
    EVENING: { start: 18, end: 22 },
    SCHOOL_PEAK: { start: 15, end: 17 }
  },

  // Monitoring intervals
  MONITORING: {
    REAL_TIME_INTERVAL: 30000, // 30 seconds
    HEALTH_CHECK_INTERVAL: 60000, // 1 minute
    REPORT_INTERVAL: 300000, // 5 minutes
    ALERT_THRESHOLD_COUNT: 3 // 3 consecutive alerts
  }
};

/**
 * Israeli Performance Monitoring Service Class
 */
class IsraeliPerformanceMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.timezone = ISRAELI_PERFORMANCE_CONFIG.TIMEZONE;

    // Performance data storage
    this.performanceMetrics = new Map();
    this.connectionProfiles = new Map();
    this.alertHistory = [];
    this.healthChecks = [];

    // Monitoring state
    this.isMonitoring = false;
    this.monitoringIntervals = [];

    // Real-time statistics
    this.realtimeStats = {
      activeConnections: 0,
      averageLatency: 0,
      averageLoadTime: 0,
      errorRate: 0,
      lastUpdated: null
    };

    // Performance baselines
    this.baselines = this.initializeBaselines();
  }

  /**
   * Start Israeli performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('Israeli performance monitoring already active');
      return;
    }

    console.log('🇮🇱 Starting Israeli performance monitoring...');
    this.isMonitoring = true;

    // Real-time monitoring
    const realtimeInterval = setInterval(() => {
      this.collectRealtimeMetrics();
    }, ISRAELI_PERFORMANCE_CONFIG.MONITORING.REAL_TIME_INTERVAL);

    // Health checks
    const healthInterval = setInterval(() => {
      this.performHealthChecks();
    }, ISRAELI_PERFORMANCE_CONFIG.MONITORING.HEALTH_CHECK_INTERVAL);

    // Performance reports
    const reportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, ISRAELI_PERFORMANCE_CONFIG.MONITORING.REPORT_INTERVAL);

    this.monitoringIntervals = [realtimeInterval, healthInterval, reportInterval];

    this.emit('monitoring_started', {
      timestamp: moment().tz(this.timezone).toISOString(),
      message: 'Israeli performance monitoring activated'
    });
  }

  /**
   * Stop Israeli performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    console.log('🇮🇱 Stopping Israeli performance monitoring...');
    this.isMonitoring = false;

    // Clear all intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];

    this.emit('monitoring_stopped', {
      timestamp: moment().tz(this.timezone).toISOString(),
      message: 'Israeli performance monitoring deactivated'
    });
  }

  /**
   * Track performance metrics for Israeli user request
   */
  trackIsraeliRequest(requestData) {
    const israelTime = moment().tz(this.timezone);
    const requestId = this.generateRequestId();

    const performanceMetric = {
      requestId,
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('YYYY-MM-DD HH:mm:ss'),

      // Request details
      method: requestData.method,
      path: requestData.path,
      statusCode: requestData.statusCode,

      // Performance metrics
      responseTime: requestData.responseTime,
      contentSize: requestData.contentSize,
      loadTime: requestData.loadTime,

      // Israeli connection context
      userAgent: requestData.userAgent,
      estimatedISP: this.estimateISP(requestData.ip),
      connectionType: this.detectConnectionType(requestData.userAgent),
      deviceType: this.detectDeviceType(requestData.userAgent),

      // Geographic and infrastructure
      serverRegion: process.env.AWS_REGION || 'eu-central-1',
      cdnHit: requestData.cfCacheStatus === 'HIT',
      s3Performance: requestData.s3LoadTime,

      // Israeli-specific context
      isPeakHours: this.isPeakHours(israelTime),
      isSchoolHours: this.isSchoolHours(israelTime),
      hourOfDay: israelTime.hour(),
      dayOfWeek: israelTime.format('dddd'),

      // Content analysis
      hasHebrewContent: this.detectHebrewContent(requestData.content),
      contentType: requestData.contentType,
      isEducationalContent: this.isEducationalContent(requestData.path),

      // Quality indicators
      qualityScore: this.calculateQualityScore(requestData),
      userExperienceImpact: this.assessUserExperienceImpact(requestData)
    };

    // Store metric
    this.performanceMetrics.set(requestId, performanceMetric);

    // Update connection profile
    this.updateConnectionProfile(performanceMetric);

    // Check for performance issues
    this.analyzePerformanceIssues(performanceMetric);

    // Update real-time stats
    this.updateRealtimeStats(performanceMetric);

    return performanceMetric;
  }

  /**
   * Collect real-time performance metrics
   */
  collectRealtimeMetrics() {
    const israelTime = moment().tz(this.timezone);
    const recentMetrics = this.getRecentMetrics(5); // Last 5 minutes

    if (recentMetrics.length === 0) return;

    const aggregated = {
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('HH:mm:ss'),

      // Core metrics
      totalRequests: recentMetrics.length,
      averageResponseTime: this.calculateAverage(recentMetrics, 'responseTime'),
      averageLoadTime: this.calculateAverage(recentMetrics, 'loadTime'),
      errorRate: this.calculateErrorRate(recentMetrics),

      // Israeli ISP breakdown
      ispPerformance: this.analyzeISPPerformance(recentMetrics),

      // Peak hours analysis
      peakHoursImpact: this.analyzePeakHoursImpact(recentMetrics),

      // Device type performance
      devicePerformance: this.analyzeDevicePerformance(recentMetrics),

      // Content delivery performance
      cdnPerformance: {
        hitRate: this.calculateCDNHitRate(recentMetrics),
        s3AverageLoadTime: this.calculateAverage(recentMetrics, 's3Performance'),
        hebrewContentPerformance: this.analyzeHebrewContentPerformance(recentMetrics)
      },

      // Quality assessment
      overallQuality: this.assessOverallQuality(recentMetrics),
      performanceAlerts: this.checkPerformanceAlerts(recentMetrics)
    };

    this.emit('realtime_metrics', aggregated);

    // Store for historical analysis
    this.storeRealtimeMetrics(aggregated);

    return aggregated;
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    const israelTime = moment().tz(this.timezone);

    const healthCheck = {
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('HH:mm:ss'),
      checks: {}
    };

    try {
      // S3 connectivity check
      healthCheck.checks.s3Connectivity = await this.checkS3Connectivity();

      // CDN performance check
      healthCheck.checks.cdnPerformance = await this.checkCDNPerformance();

      // API response time check
      healthCheck.checks.apiResponseTime = await this.checkAPIResponseTime();

      // Database connectivity check
      healthCheck.checks.databaseConnectivity = await this.checkDatabaseConnectivity();

      // Israeli-specific checks
      healthCheck.checks.israeliRouting = await this.checkIsraeliRouting();
      healthCheck.checks.hebrewContentDelivery = await this.checkHebrewContentDelivery();

      // Overall health assessment
      healthCheck.overallHealth = this.assessOverallHealth(healthCheck.checks);
      healthCheck.recommendations = this.generateHealthRecommendations(healthCheck.checks);

    } catch (error) {
      console.error('Health check error:', error);
      healthCheck.error = error.message;
      healthCheck.overallHealth = 'critical';
    }

    this.healthChecks.push(healthCheck);

    // Keep only recent health checks
    if (this.healthChecks.length > 100) {
      this.healthChecks = this.healthChecks.slice(-50);
    }

    this.emit('health_check', healthCheck);

    // Generate alerts if needed
    if (healthCheck.overallHealth === 'critical' || healthCheck.overallHealth === 'poor') {
      this.generateHealthAlert(healthCheck);
    }

    return healthCheck;
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const israelTime = moment().tz(this.timezone);
    const reportPeriod = 15; // Last 15 minutes
    const metrics = this.getRecentMetrics(reportPeriod);

    const report = {
      generatedAt: israelTime.toISOString(),
      israelTime: israelTime.format('YYYY-MM-DD HH:mm:ss'),
      reportPeriod: `${reportPeriod} minutes`,

      // Executive summary
      summary: {
        totalRequests: metrics.length,
        averageResponseTime: this.calculateAverage(metrics, 'responseTime'),
        successRate: this.calculateSuccessRate(metrics),
        userSatisfactionScore: this.calculateUserSatisfactionScore(metrics)
      },

      // Israeli-specific performance insights
      israeliInsights: {
        peakHoursPerformance: this.analyzePeakHoursPerformance(metrics, israelTime),
        ispPerformanceBreakdown: this.analyzeISPPerformanceBreakdown(metrics),
        mobileVsDesktopPerformance: this.compareMobileDesktopPerformance(metrics),
        schoolHoursImpact: this.analyzeSchoolHoursImpact(metrics, israelTime)
      },

      // Content delivery analysis
      contentDelivery: {
        s3Performance: this.analyzeS3Performance(metrics),
        cdnEffectiveness: this.analyzeCDNEffectiveness(metrics),
        hebrewContentOptimization: this.analyzeHebrewContentOptimization(metrics),
        compressionEffectiveness: this.analyzeCompressionEffectiveness(metrics)
      },

      // Quality metrics
      qualityMetrics: {
        coreWebVitals: this.analyzeCoreWebVitals(metrics),
        userExperience: this.analyzeUserExperience(metrics),
        accessibilityPerformance: this.analyzeAccessibilityPerformance(metrics)
      },

      // Performance trends
      trends: this.analyzePerformanceTrends(metrics, israelTime),

      // Recommendations and alerts
      recommendations: this.generatePerformanceRecommendations(metrics),
      activeAlerts: this.getActiveAlerts(),

      // Next steps
      actionItems: this.generateActionItems(metrics)
    };

    this.emit('performance_report', report);

    return report;
  }

  /**
   * Estimate Israeli ISP from request data
   */
  estimateISP(ip) {
    // Simplified ISP detection - in production would use IP geolocation service
    if (!ip) return 'UNKNOWN';

    // Common Israeli IP ranges (simplified)
    const ipRanges = {
      'BEZEQ': ['212.150.', '80.179.', '109.186.'],
      'HOT': ['85.250.', '94.188.', '176.231.'],
      'PARTNER': ['2.55.', '5.29.', '37.142.'],
      'CELLCOM': ['185.131.', '185.132.', '185.133.']
    };

    for (const [isp, ranges] of Object.entries(ipRanges)) {
      if (ranges.some(range => ip.startsWith(range))) {
        return isp;
      }
    }

    return 'OTHER';
  }

  /**
   * Calculate quality score for request
   */
  calculateQualityScore(requestData) {
    let score = 100;

    // Response time impact (0-40 points)
    if (requestData.responseTime > 3000) score -= 40;
    else if (requestData.responseTime > 2000) score -= 25;
    else if (requestData.responseTime > 1000) score -= 10;

    // Load time impact (0-30 points)
    if (requestData.loadTime > 5000) score -= 30;
    else if (requestData.loadTime > 3000) score -= 20;
    else if (requestData.loadTime > 2000) score -= 10;

    // Error impact (0-30 points)
    if (requestData.statusCode >= 500) score -= 30;
    else if (requestData.statusCode >= 400) score -= 15;

    return Math.max(score, 0);
  }

  /**
   * Assess user experience impact for Israeli users
   */
  assessUserExperienceImpact(requestData) {
    let impact = 'excellent';

    // Response time impact
    if (requestData.responseTime > 5000) {
      impact = 'critical';
    } else if (requestData.responseTime > 3000) {
      impact = 'poor';
    } else if (requestData.responseTime > 2000) {
      impact = 'moderate';
    } else if (requestData.responseTime > 1000) {
      impact = 'minor';
    }

    // Error impact (overrides response time if errors)
    if (requestData.statusCode >= 500) {
      impact = 'critical';
    } else if (requestData.statusCode >= 400) {
      impact = 'poor';
    }

    // Content size impact for mobile users
    const isMobile = this.detectDeviceType(requestData.userAgent) === 'mobile';
    if (isMobile && requestData.contentSize > 1000000) { // 1MB
      impact = impact === 'excellent' ? 'minor' : impact;
    }

    return impact;
  }

  /**
   * Check if current time is during Israeli peak hours
   */
  isPeakHours(time) {
    const hour = time.hour();
    const { MORNING, LUNCH, EVENING, SCHOOL_PEAK } = ISRAELI_PERFORMANCE_CONFIG.PEAK_HOURS;

    return (hour >= MORNING.start && hour <= MORNING.end) ||
           (hour >= LUNCH.start && hour <= LUNCH.end) ||
           (hour >= EVENING.start && hour <= EVENING.end) ||
           (hour >= SCHOOL_PEAK.start && hour <= SCHOOL_PEAK.end);
  }

  /**
   * Check if current time is during Israeli school hours
   */
  isSchoolHours(time) {
    const hour = time.hour();
    const day = time.day();

    // Not school hours on Friday afternoon/Saturday
    if (day === 5 && hour >= 14) return false;
    if (day === 6) return false;

    return hour >= 8 && hour <= 16;
  }

  /**
   * Update connection profile for user
   */
  updateConnectionProfile(metric) {
    const profileKey = `${metric.estimatedISP}_${metric.deviceType}`;

    if (!this.connectionProfiles.has(profileKey)) {
      this.connectionProfiles.set(profileKey, {
        isp: metric.estimatedISP,
        deviceType: metric.deviceType,
        requestCount: 0,
        totalResponseTime: 0,
        totalLoadTime: 0,
        errorCount: 0,
        lastSeen: metric.timestamp
      });
    }

    const profile = this.connectionProfiles.get(profileKey);
    profile.requestCount++;
    profile.totalResponseTime += metric.responseTime;
    profile.totalLoadTime += metric.loadTime;
    if (metric.statusCode >= 400) profile.errorCount++;
    profile.lastSeen = metric.timestamp;

    // Calculate averages
    profile.averageResponseTime = profile.totalResponseTime / profile.requestCount;
    profile.averageLoadTime = profile.totalLoadTime / profile.requestCount;
    profile.errorRate = (profile.errorCount / profile.requestCount) * 100;
  }

  /**
   * Analyze performance issues
   */
  analyzePerformanceIssues(metric) {
    const issues = [];

    // High response time
    if (metric.responseTime > ISRAELI_PERFORMANCE_CONFIG.PERFORMANCE_THRESHOLDS.POOR.latency) {
      issues.push({
        type: 'high_response_time',
        severity: 'high',
        value: metric.responseTime,
        threshold: ISRAELI_PERFORMANCE_CONFIG.PERFORMANCE_THRESHOLDS.GOOD.latency,
        recommendation: 'Optimize server processing or consider CDN improvements'
      });
    }

    // High load time
    if (metric.loadTime > ISRAELI_PERFORMANCE_CONFIG.PERFORMANCE_THRESHOLDS.POOR.loadTime) {
      issues.push({
        type: 'high_load_time',
        severity: 'high',
        value: metric.loadTime,
        threshold: ISRAELI_PERFORMANCE_CONFIG.PERFORMANCE_THRESHOLDS.GOOD.loadTime,
        recommendation: 'Optimize content delivery and compression'
      });
    }

    // ISP-specific issues
    if (metric.estimatedISP !== 'UNKNOWN') {
      const expectedLatency = ISRAELI_PERFORMANCE_CONFIG.ISRAELI_ISPS[metric.estimatedISP]?.expectedLatency;
      if (expectedLatency && metric.responseTime > expectedLatency * 2) {
        issues.push({
          type: 'isp_performance_degradation',
          severity: 'medium',
          isp: metric.estimatedISP,
          value: metric.responseTime,
          expected: expectedLatency,
          recommendation: `Performance issue detected for ${metric.estimatedISP} users`
        });
      }
    }

    if (issues.length > 0) {
      this.emit('performance_issues', {
        requestId: metric.requestId,
        timestamp: metric.timestamp,
        issues
      });
    }
  }

  /**
   * Generate performance recommendations
   */
  generatePerformanceRecommendations(metrics) {
    const recommendations = [];

    if (metrics.length === 0) return recommendations;

    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    const avgLoadTime = this.calculateAverage(metrics, 'loadTime');
    const errorRate = this.calculateErrorRate(metrics);
    const mobilePercentage = this.calculateMobilePercentage(metrics);

    // Response time recommendations
    if (avgResponseTime > 2000) {
      recommendations.push({
        category: 'server_performance',
        priority: 'high',
        title: 'Optimize Server Response Time',
        description: `Average response time (${avgResponseTime}ms) exceeds recommended threshold for Israeli users`,
        actions: [
          'Consider server scaling or optimization',
          'Review database query performance',
          'Implement server-side caching'
        ]
      });
    }

    // Load time recommendations
    if (avgLoadTime > 3000) {
      recommendations.push({
        category: 'content_delivery',
        priority: 'high',
        title: 'Improve Content Delivery Performance',
        description: `Average load time (${avgLoadTime}ms) impacts Israeli user experience`,
        actions: [
          'Optimize compression for Hebrew content',
          'Implement image optimization',
          'Consider CDN improvements'
        ]
      });
    }

    // Mobile optimization
    if (mobilePercentage > 60) {
      recommendations.push({
        category: 'mobile_optimization',
        priority: 'medium',
        title: 'Mobile-First Optimization',
        description: `${mobilePercentage.toFixed(1)}% of traffic is mobile - optimize accordingly`,
        actions: [
          'Implement mobile-first design',
          'Optimize for slower mobile connections',
          'Reduce mobile data usage'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  generateRequestId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  getRecentMetrics(minutes) {
    const cutoff = moment().tz(this.timezone).subtract(minutes, 'minutes');
    return Array.from(this.performanceMetrics.values())
      .filter(metric => moment(metric.timestamp).isAfter(cutoff));
  }

  calculateAverage(metrics, field) {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + (m[field] || 0), 0) / metrics.length;
  }

  calculateErrorRate(metrics) {
    if (metrics.length === 0) return 0;
    const errors = metrics.filter(m => m.statusCode >= 400).length;
    return (errors / metrics.length) * 100;
  }

  calculateMobilePercentage(metrics) {
    if (metrics.length === 0) return 0;
    const mobile = metrics.filter(m => m.deviceType === 'mobile').length;
    return (mobile / metrics.length) * 100;
  }

  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    if (/Mobile|Android|iPhone/i.test(userAgent)) return 'mobile';
    if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  detectConnectionType(userAgent) {
    // Simplified connection type detection
    if (/Mobile|Android|iPhone/i.test(userAgent)) return 'cellular';
    return 'broadband';
  }

  detectHebrewContent(content) {
    if (!content) return false;
    return /[\u0590-\u05FF]/.test(content);
  }

  isEducationalContent(path) {
    return /\/(course|workshop|lesson|exercise|assignment)/.test(path);
  }

  updateRealtimeStats(metric) {
    this.realtimeStats.activeConnections++;
    this.realtimeStats.averageLatency =
      (this.realtimeStats.averageLatency + metric.responseTime) / 2;
    this.realtimeStats.averageLoadTime =
      (this.realtimeStats.averageLoadTime + metric.loadTime) / 2;
    this.realtimeStats.lastUpdated = metric.timestamp;
  }

  initializeBaselines() {
    return {
      responseTime: { excellent: 500, good: 1000, acceptable: 2000 },
      loadTime: { excellent: 1000, good: 2000, acceptable: 3000 },
      errorRate: { excellent: 0.1, good: 1.0, acceptable: 2.0 }
    };
  }

  // Placeholder methods for health checks (would implement actual checks)
  async checkS3Connectivity() { return { status: 'healthy', responseTime: 150 }; }
  async checkCDNPerformance() { return { status: 'healthy', hitRate: 85 }; }
  async checkAPIResponseTime() { return { status: 'healthy', avgTime: 450 }; }
  async checkDatabaseConnectivity() { return { status: 'healthy', connectionTime: 50 }; }
  async checkIsraeliRouting() { return { status: 'optimal', latency: 45 }; }
  async checkHebrewContentDelivery() { return { status: 'optimal', compressionRatio: 75 }; }

  assessOverallHealth(checks) {
    const healthyChecks = Object.values(checks).filter(c => c.status === 'healthy' || c.status === 'optimal').length;
    const totalChecks = Object.keys(checks).length;
    const healthPercentage = (healthyChecks / totalChecks) * 100;

    if (healthPercentage >= 95) return 'excellent';
    if (healthPercentage >= 80) return 'good';
    if (healthPercentage >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Analyze ISP performance breakdown for Israeli providers
   */
  analyzeISPPerformance(metrics) {
    const ispPerformance = {};
    const isps = Object.keys(ISRAELI_PERFORMANCE_CONFIG.ISRAELI_ISPS);

    // Initialize ISP performance data
    isps.forEach(isp => {
      ispPerformance[isp] = {
        name: ISRAELI_PERFORMANCE_CONFIG.ISRAELI_ISPS[isp].name,
        requestCount: 0,
        averageResponseTime: 0,
        averageLoadTime: 0,
        errorRate: 0,
        qualityScore: 0,
        marketShare: ISRAELI_PERFORMANCE_CONFIG.ISRAELI_ISPS[isp].marketShare,
        expectedLatency: ISRAELI_PERFORMANCE_CONFIG.ISRAELI_ISPS[isp].expectedLatency
      };
    });

    // Group metrics by ISP
    const ispMetrics = {};
    metrics.forEach(metric => {
      const isp = metric.estimatedISP || 'OTHER';
      if (!ispMetrics[isp]) {
        ispMetrics[isp] = [];
      }
      ispMetrics[isp].push(metric);
    });

    // Calculate performance for each ISP
    Object.keys(ispMetrics).forEach(isp => {
      const ispData = ispMetrics[isp];
      if (ispData.length === 0) return;

      const performance = ispPerformance[isp] || ispPerformance['OTHER'];
      performance.requestCount = ispData.length;
      performance.averageResponseTime = this.calculateAverage(ispData, 'responseTime');
      performance.averageLoadTime = this.calculateAverage(ispData, 'loadTime');
      performance.errorRate = this.calculateErrorRate(ispData);
      performance.qualityScore = this.calculateAverage(ispData, 'qualityScore');

      // Performance grade
      if (performance.averageResponseTime <= performance.expectedLatency) {
        performance.grade = 'excellent';
      } else if (performance.averageResponseTime <= performance.expectedLatency * 1.5) {
        performance.grade = 'good';
      } else if (performance.averageResponseTime <= performance.expectedLatency * 2) {
        performance.grade = 'fair';
      } else {
        performance.grade = 'poor';
      }
    });

    return ispPerformance;
  }

  /**
   * Generate health recommendations based on check results
   */
  generateHealthRecommendations(checks) {
    const recommendations = [];

    // S3 connectivity recommendations
    if (checks.s3Connectivity?.status !== 'healthy') {
      recommendations.push({
        category: 's3_connectivity',
        priority: 'high',
        title: 'S3 Connection Issues Detected',
        description: 'File storage connectivity problems affecting Israeli users',
        actions: ['Check S3 endpoint health', 'Verify AWS region configuration', 'Review network routing']
      });
    }

    // CDN performance recommendations
    if (checks.cdnPerformance?.status !== 'healthy') {
      recommendations.push({
        category: 'cdn_performance',
        priority: 'high',
        title: 'CDN Performance Degradation',
        description: 'Content delivery network issues impacting Israeli user experience',
        actions: ['Review CDN cache hit rates', 'Check geographic routing', 'Optimize for Middle East region']
      });
    }

    // API response time recommendations
    if (checks.apiResponseTime?.status !== 'healthy') {
      recommendations.push({
        category: 'api_performance',
        priority: 'high',
        title: 'API Response Time Issues',
        description: 'Server response times affecting Israeli user experience',
        actions: ['Scale server resources', 'Optimize database queries', 'Implement caching']
      });
    }

    // Database connectivity recommendations
    if (checks.databaseConnectivity?.status !== 'healthy') {
      recommendations.push({
        category: 'database_connectivity',
        priority: 'critical',
        title: 'Database Connection Problems',
        description: 'Database connectivity issues requiring immediate attention',
        actions: ['Check database server status', 'Review connection pool', 'Verify network connectivity']
      });
    }

    // Israeli routing recommendations
    if (checks.israeliRouting?.status !== 'optimal') {
      recommendations.push({
        category: 'israeli_routing',
        priority: 'medium',
        title: 'Network Routing Optimization',
        description: 'Network routing to Israel can be optimized',
        actions: ['Review ISP peering agreements', 'Consider Israeli CDN presence', 'Optimize for major Israeli ISPs']
      });
    }

    // Hebrew content delivery recommendations
    if (checks.hebrewContentDelivery?.status !== 'optimal') {
      recommendations.push({
        category: 'hebrew_content',
        priority: 'medium',
        title: 'Hebrew Content Optimization',
        description: 'Hebrew content delivery can be improved',
        actions: ['Optimize Hebrew text compression', 'Review RTL layout performance', 'Improve font loading']
      });
    }

    return recommendations;
  }

  /**
   * Analyze peak hours impact on performance
   */
  analyzePeakHoursImpact(metrics) {
    const impact = {
      isPeakTime: false,
      currentLoad: 'normal',
      performance: 'stable',
      recommendations: []
    };

    if (metrics.length === 0) return impact;

    const israelTime = moment().tz(this.timezone);
    const currentHour = israelTime.hour();

    // Determine if we're in peak hours
    impact.isPeakTime = this.isPeakHours(israelTime);

    // Calculate current load based on request volume
    const currentLoad = this.estimateCurrentLoad(metrics);
    impact.currentLoad = currentLoad;

    // Analyze performance during peak hours
    if (impact.isPeakTime) {
      const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
      const errorRate = this.calculateErrorRate(metrics);

      // Performance assessment
      if (avgResponseTime > 3000 || errorRate > 5) {
        impact.performance = 'degraded';
        impact.recommendations.push({
          type: 'peak_hours_optimization',
          priority: 'high',
          description: 'Performance degraded during Israeli peak hours',
          actions: ['Scale server resources', 'Implement load balancing', 'Optimize caching']
        });
      } else if (avgResponseTime > 2000 || errorRate > 2) {
        impact.performance = 'stressed';
        impact.recommendations.push({
          type: 'peak_hours_monitoring',
          priority: 'medium',
          description: 'Performance stressed during peak hours',
          actions: ['Monitor resource usage', 'Prepare for scaling', 'Review caching strategy']
        });
      }

      // Peak time specific recommendations
      if (currentHour >= 18 && currentHour <= 21) {
        impact.recommendations.push({
          type: 'evening_peak_optimization',
          priority: 'medium',
          description: 'Evening peak hours in Israel - highest usage period',
          actions: ['Ensure maximum server capacity', 'Monitor educational content delivery', 'Optimize for family usage']
        });
      } else if (currentHour >= 15 && currentHour <= 17) {
        impact.recommendations.push({
          type: 'school_peak_optimization',
          priority: 'medium',
          description: 'School hours peak - high educational content usage',
          actions: ['Optimize educational content delivery', 'Prioritize homework/assignment features', 'Monitor student usage patterns']
        });
      }
    }

    // Load-based recommendations
    if (currentLoad === 'high') {
      impact.recommendations.push({
        type: 'high_load_response',
        priority: 'high',
        description: 'High load detected - proactive scaling needed',
        actions: ['Scale server resources immediately', 'Activate load balancing', 'Monitor system health']
      });
    } else if (currentLoad === 'moderate') {
      impact.recommendations.push({
        type: 'moderate_load_monitoring',
        priority: 'medium',
        description: 'Moderate load - prepare for potential scaling',
        actions: ['Monitor trends closely', 'Prepare scaling resources', 'Review performance metrics']
      });
    }

    return impact;
  }

  /**
   * Estimate current system load based on metrics
   */
  estimateCurrentLoad(metrics) {
    if (metrics.length === 0) return 'low';

    const recentMinutes = 5;
    const recentMetrics = this.getRecentMetrics(recentMinutes);
    const requestRate = recentMetrics.length / recentMinutes; // requests per minute
    const avgResponseTime = this.calculateAverage(recentMetrics, 'responseTime');
    const errorRate = this.calculateErrorRate(recentMetrics);

    // Load assessment based on multiple factors
    if (requestRate > 50 || avgResponseTime > 3000 || errorRate > 5) {
      return 'high';
    } else if (requestRate > 20 || avgResponseTime > 2000 || errorRate > 2) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * Analyze device performance breakdown (mobile vs desktop vs tablet)
   */
  analyzeDevicePerformance(metrics) {
    const devicePerformance = {
      mobile: { requestCount: 0, averageResponseTime: 0, averageLoadTime: 0, errorRate: 0 },
      desktop: { requestCount: 0, averageResponseTime: 0, averageLoadTime: 0, errorRate: 0 },
      tablet: { requestCount: 0, averageResponseTime: 0, averageLoadTime: 0, errorRate: 0 },
      unknown: { requestCount: 0, averageResponseTime: 0, averageLoadTime: 0, errorRate: 0 }
    };

    if (metrics.length === 0) return devicePerformance;

    // Group metrics by device type
    const deviceMetrics = { mobile: [], desktop: [], tablet: [], unknown: [] };
    metrics.forEach(metric => {
      const deviceType = metric.deviceType || 'unknown';
      if (deviceMetrics[deviceType]) {
        deviceMetrics[deviceType].push(metric);
      }
    });

    // Calculate performance for each device type
    Object.keys(deviceMetrics).forEach(deviceType => {
      const deviceData = deviceMetrics[deviceType];
      const performance = devicePerformance[deviceType];

      performance.requestCount = deviceData.length;
      performance.averageResponseTime = this.calculateAverage(deviceData, 'responseTime');
      performance.averageLoadTime = this.calculateAverage(deviceData, 'loadTime');
      performance.errorRate = this.calculateErrorRate(deviceData);
    });

    return devicePerformance;
  }

  /**
   * Calculate CDN hit rate from metrics
   */
  calculateCDNHitRate(metrics) {
    if (metrics.length === 0) return 0;
    const cdnHits = metrics.filter(m => m.cdnHit).length;
    return (cdnHits / metrics.length) * 100;
  }

  /**
   * Analyze Hebrew content performance
   */
  analyzeHebrewContentPerformance(metrics) {
    const hebrewMetrics = metrics.filter(m => m.hasHebrewContent);
    const nonHebrewMetrics = metrics.filter(m => !m.hasHebrewContent);

    return {
      hebrewContentRequests: hebrewMetrics.length,
      hebrewAverageResponseTime: this.calculateAverage(hebrewMetrics, 'responseTime'),
      hebrewAverageLoadTime: this.calculateAverage(hebrewMetrics, 'loadTime'),
      nonHebrewAverageResponseTime: this.calculateAverage(nonHebrewMetrics, 'responseTime'),
      performance: hebrewMetrics.length > 0 ? 'measured' : 'no_hebrew_content'
    };
  }

  /**
   * Assess overall quality from metrics
   */
  assessOverallQuality(metrics) {
    if (metrics.length === 0) return { grade: 'insufficient_data', score: 0 };

    const avgQualityScore = this.calculateAverage(metrics, 'qualityScore');
    let grade = 'poor';

    if (avgQualityScore >= 90) grade = 'excellent';
    else if (avgQualityScore >= 80) grade = 'good';
    else if (avgQualityScore >= 70) grade = 'fair';

    return { grade, score: avgQualityScore };
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts(metrics) {
    const alerts = [];

    if (metrics.length === 0) return alerts;

    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    const errorRate = this.calculateErrorRate(metrics);

    if (avgResponseTime > 5000) {
      alerts.push({ type: 'high_response_time', severity: 'critical', value: avgResponseTime });
    } else if (avgResponseTime > 3000) {
      alerts.push({ type: 'elevated_response_time', severity: 'warning', value: avgResponseTime });
    }

    if (errorRate > 5) {
      alerts.push({ type: 'high_error_rate', severity: 'critical', value: errorRate });
    } else if (errorRate > 2) {
      alerts.push({ type: 'elevated_error_rate', severity: 'warning', value: errorRate });
    }

    return alerts;
  }

  /**
   * Store realtime metrics (stub implementation)
   */
  storeRealtimeMetrics(aggregated) {
    // Stub implementation - in production might store in database/cache
    console.log('📊 Realtime metrics collected:', {
      timestamp: aggregated.israelTime,
      requests: aggregated.totalRequests,
      avgResponseTime: Math.round(aggregated.averageResponseTime),
      errorRate: aggregated.errorRate
    });
  }

  /**
   * Calculate success rate from metrics
   */
  calculateSuccessRate(metrics) {
    if (metrics.length === 0) return 100;
    const successfulRequests = metrics.filter(m => m.statusCode < 400).length;
    return (successfulRequests / metrics.length) * 100;
  }

  /**
   * Calculate user satisfaction score
   */
  calculateUserSatisfactionScore(metrics) {
    if (metrics.length === 0) return 0;
    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    const errorRate = this.calculateErrorRate(metrics);

    let score = 100;
    // Response time impact
    if (avgResponseTime > 3000) score -= 40;
    else if (avgResponseTime > 2000) score -= 20;
    else if (avgResponseTime > 1000) score -= 10;

    // Error rate impact
    score -= (errorRate * 10); // Each 1% error rate reduces score by 10 points

    return Math.max(score, 0);
  }

  /**
   * Generate health alert for critical issues
   */
  generateHealthAlert(healthCheck) {
    const alert = {
      type: 'health_alert',
      severity: healthCheck.overallHealth === 'critical' ? 'critical' : 'warning',
      timestamp: healthCheck.timestamp,
      israelTime: healthCheck.israelTime,
      overallHealth: healthCheck.overallHealth,
      failedChecks: Object.entries(healthCheck.checks)
        .filter(([key, check]) => check.status !== 'healthy' && check.status !== 'optimal')
        .map(([key, check]) => ({ name: key, status: check.status, details: check })),
      recommendations: healthCheck.recommendations || [],
      message: `Israeli performance monitoring detected ${healthCheck.overallHealth} health status`
    };

    // Store alert
    this.alertHistory.push(alert);

    // Keep only recent alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-50);
    }

    // Emit alert event
    this.emit('health_alert', alert);

    // Log alert for debugging
    console.log(`🚨 Israeli Performance Alert [${alert.severity}]: ${alert.message}`, {
      failedChecks: alert.failedChecks.length,
      overallHealth: alert.overallHealth,
      timestamp: alert.israelTime
    });

    return alert;
  }
}

export default IsraeliPerformanceMonitoringService;