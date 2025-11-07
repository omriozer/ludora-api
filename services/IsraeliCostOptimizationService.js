/**
 * Israeli Cost Optimization Service
 *
 * Service for tracking, analyzing, and optimizing costs
 * specific to Israeli market usage patterns and requirements.
 */

import moment from 'moment-timezone';
import EventEmitter from 'events';

class IsraeliCostOptimizationService extends EventEmitter {
  constructor() {
    super();

    // Cost tracking data structures
    this.s3CostMetrics = new Map();
    this.bandwidthCostMetrics = new Map();
    this.performanceCostMetrics = new Map();
    this.hebrewContentCostMetrics = new Map();

    // Israeli market specific cost factors
    this.israeliCostFactors = {
      peakHourMultiplier: 1.3,  // 30% higher during Israeli peak hours
      s3StorageEU: 0.023,       // EU region storage cost per GB
      bandwidthEU: 0.09,        // EU bandwidth cost per GB
      compressionSavings: 0.15,  // 15% savings from Hebrew compression
      cachingEfficiency: 0.40    // 40% bandwidth savings from Israeli caching
    };

    // Cost optimization recommendations cache
    this.optimizationCache = new Map();
    this.lastCostAnalysis = null;

    // Initialize cost tracking
    this.startCostTracking();
  }

  /**
   * Start cost tracking and monitoring
   */
  startCostTracking() {
    console.log('🇮🇱 Starting Israeli cost optimization tracking...');

    // Track costs every hour
    this.costTrackingInterval = setInterval(() => {
      this.analyzeCostMetrics();
    }, 60 * 60 * 1000); // 1 hour

    // Daily cost optimization analysis
    this.dailyAnalysisInterval = setInterval(() => {
      this.performDailyCostAnalysis();
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log('📊 Israeli cost optimization tracking active');
  }

  /**
   * Track S3 operation costs for Israeli market
   */
  trackS3OperationCost(operation) {
    const israelTime = moment().tz('Asia/Jerusalem');
    const hour = israelTime.hour();
    const isPeakHours = (hour >= 8 && hour <= 18);

    const costMetric = {
      operation: operation.type,
      timestamp: israelTime.toISOString(),
      fileSize: operation.fileSize || 0,
      duration: operation.duration || 0,
      isPeakHours,

      // Calculate estimated costs
      storageCost: this.calculateStorageCost(operation.fileSize),
      requestCost: this.calculateRequestCost(operation.type),
      transferCost: this.calculateTransferCost(operation.fileSize),

      // Israeli specific factors
      hebrewContent: operation.hebrewContent || false,
      compressionUsed: operation.compressionUsed || false,
      cacheHit: operation.cacheHit || false
    };

    // Apply Israeli peak hour multiplier
    if (isPeakHours) {
      costMetric.adjustedCost = costMetric.transferCost * this.israeliCostFactors.peakHourMultiplier;
    }

    // Apply compression savings for Hebrew content
    if (costMetric.hebrewContent && costMetric.compressionUsed) {
      costMetric.compressionSavings = costMetric.transferCost * this.israeliCostFactors.compressionSavings;
      costMetric.netCost = costMetric.transferCost - costMetric.compressionSavings;
    }

    // Store cost metric
    const key = `${israelTime.format('YYYY-MM-DD-HH')}`;
    if (!this.s3CostMetrics.has(key)) {
      this.s3CostMetrics.set(key, []);
    }
    this.s3CostMetrics.get(key).push(costMetric);

    return costMetric;
  }

  /**
   * Track bandwidth costs for Israeli users
   */
  trackBandwidthCost(request) {
    const israelTime = moment().tz('Asia/Jerusalem');
    const dataTransferred = request.contentSize || 0;

    const bandwidthMetric = {
      timestamp: israelTime.toISOString(),
      path: request.path,
      dataTransferred,
      userAgent: request.userAgent,
      cacheStatus: request.cacheStatus,
      compressionRatio: request.compressionRatio || 1,

      // Calculate bandwidth costs
      baseCost: this.calculateBandwidthCost(dataTransferred),
      cacheSavings: 0,
      compressionSavings: 0
    };

    // Calculate cache savings for Israeli users
    if (request.cacheStatus === 'hit') {
      bandwidthMetric.cacheSavings = bandwidthMetric.baseCost * this.israeliCostFactors.cachingEfficiency;
    }

    // Calculate compression savings for Hebrew content
    if (request.compressionRatio > 1) {
      const originalSize = dataTransferred * request.compressionRatio;
      const originalCost = this.calculateBandwidthCost(originalSize);
      bandwidthMetric.compressionSavings = originalCost - bandwidthMetric.baseCost;
    }

    bandwidthMetric.netCost = bandwidthMetric.baseCost - bandwidthMetric.cacheSavings - bandwidthMetric.compressionSavings;

    // Store bandwidth metric
    const key = `${israelTime.format('YYYY-MM-DD')}`;
    if (!this.bandwidthCostMetrics.has(key)) {
      this.bandwidthCostMetrics.set(key, []);
    }
    this.bandwidthCostMetrics.get(key).push(bandwidthMetric);

    return bandwidthMetric;
  }

  /**
   * Track Hebrew content specific cost patterns
   */
  trackHebrewContentCosts(content) {
    const israelTime = moment().tz('Asia/Jerusalem');

    const hebrewMetric = {
      timestamp: israelTime.toISOString(),
      contentSize: content.size,
      hebrewCharCount: content.hebrewCharCount,
      compressionRatio: content.compressionRatio || 1,
      rtlFormatting: content.rtlFormatting || false,

      // Calculate Hebrew-specific costs
      baseCost: this.calculateBandwidthCost(content.size),
      compressionSavings: 0,
      rtlOptimizationSavings: 0
    };

    // Hebrew text compression is typically more effective
    if (hebrewMetric.compressionRatio > 1.2) {
      const uncompressedCost = this.calculateBandwidthCost(content.size * hebrewMetric.compressionRatio);
      hebrewMetric.compressionSavings = uncompressedCost - hebrewMetric.baseCost;
    }

    // RTL formatting optimization savings
    if (hebrewMetric.rtlFormatting) {
      hebrewMetric.rtlOptimizationSavings = hebrewMetric.baseCost * 0.05; // 5% savings
    }

    hebrewMetric.netCost = hebrewMetric.baseCost - hebrewMetric.compressionSavings - hebrewMetric.rtlOptimizationSavings;

    // Store Hebrew content metric
    const key = `${israelTime.format('YYYY-MM-DD')}`;
    if (!this.hebrewContentCostMetrics.has(key)) {
      this.hebrewContentCostMetrics.set(key, []);
    }
    this.hebrewContentCostMetrics.get(key).push(hebrewMetric);

    return hebrewMetric;
  }

  /**
   * Generate comprehensive cost optimization insights
   */
  generateCostOptimizationInsights() {
    const israelTime = moment().tz('Asia/Jerusalem');
    const insights = {
      timestamp: israelTime.toISOString(),
      reportPeriod: 'last_7_days',
      totalCosts: this.calculateTotalCosts(),
      savings: this.calculateTotalSavings(),
      optimizations: this.getOptimizationRecommendations(),
      israeliMarketFactors: this.analyzeIsraeliMarketFactors(),
      trends: this.analyzeCostTrends(),
      projections: this.projectFutureCosts()
    };

    this.lastCostAnalysis = insights;
    return insights;
  }

  /**
   * Calculate total costs across all categories
   */
  calculateTotalCosts() {
    const last7Days = this.getLastNDays(7);
    let totalCosts = {
      s3Storage: 0,
      s3Requests: 0,
      bandwidth: 0,
      total: 0
    };

    last7Days.forEach(date => {
      const key = date.format('YYYY-MM-DD');

      // S3 costs
      if (this.s3CostMetrics.has(key)) {
        const s3Metrics = this.s3CostMetrics.get(key);
        s3Metrics.forEach(metric => {
          totalCosts.s3Storage += metric.storageCost || 0;
          totalCosts.s3Requests += metric.requestCost || 0;
        });
      }

      // Bandwidth costs
      if (this.bandwidthCostMetrics.has(key)) {
        const bandwidthMetrics = this.bandwidthCostMetrics.get(key);
        bandwidthMetrics.forEach(metric => {
          totalCosts.bandwidth += metric.netCost || 0;
        });
      }
    });

    totalCosts.total = totalCosts.s3Storage + totalCosts.s3Requests + totalCosts.bandwidth;
    return totalCosts;
  }

  /**
   * Calculate total savings from optimizations
   */
  calculateTotalSavings() {
    const last7Days = this.getLastNDays(7);
    let totalSavings = {
      compression: 0,
      caching: 0,
      hebrewOptimizations: 0,
      total: 0
    };

    last7Days.forEach(date => {
      const key = date.format('YYYY-MM-DD');

      // Bandwidth savings
      if (this.bandwidthCostMetrics.has(key)) {
        const bandwidthMetrics = this.bandwidthCostMetrics.get(key);
        bandwidthMetrics.forEach(metric => {
          totalSavings.compression += metric.compressionSavings || 0;
          totalSavings.caching += metric.cacheSavings || 0;
        });
      }

      // Hebrew content savings
      if (this.hebrewContentCostMetrics.has(key)) {
        const hebrewMetrics = this.hebrewContentCostMetrics.get(key);
        hebrewMetrics.forEach(metric => {
          totalSavings.hebrewOptimizations += metric.compressionSavings + metric.rtlOptimizationSavings || 0;
        });
      }
    });

    totalSavings.total = totalSavings.compression + totalSavings.caching + totalSavings.hebrewOptimizations;
    return totalSavings;
  }

  /**
   * Get optimization recommendations specific to Israeli market
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    const costs = this.calculateTotalCosts();
    const savings = this.calculateTotalSavings();

    // High bandwidth costs during Israeli peak hours
    if (this.isPeakHourCostHigh()) {
      recommendations.push({
        type: 'peak_hours_optimization',
        priority: 'high',
        title: 'Optimize Israeli Peak Hours Performance',
        description: 'High bandwidth costs detected during Israeli peak hours (8 AM - 6 PM)',
        impact: 'potential_savings_15_25_percent',
        actions: [
          'Increase CDN caching for static assets during Israeli peak hours',
          'Pre-compress Hebrew content more aggressively',
          'Implement request queuing during peak times',
          'Use Israeli timezone-aware content delivery'
        ]
      });
    }

    // Hebrew content compression opportunity
    if (this.getHebrewCompressionEfficiency() < 0.8) {
      recommendations.push({
        type: 'hebrew_compression_improvement',
        priority: 'medium',
        title: 'Improve Hebrew Content Compression',
        description: 'Hebrew content compression efficiency below optimal levels',
        impact: 'potential_savings_10_20_percent',
        actions: [
          'Implement Hebrew-specific compression algorithms',
          'Optimize RTL text encoding',
          'Use Hebrew character frequency analysis for better compression'
        ]
      });
    }

    // S3 storage optimization for Israeli educational content
    if (costs.s3Storage > costs.bandwidth) {
      recommendations.push({
        type: 's3_storage_optimization',
        priority: 'medium',
        title: 'Optimize S3 Storage Costs',
        description: 'S3 storage costs are higher than bandwidth costs',
        impact: 'potential_savings_20_40_percent',
        actions: [
          'Implement S3 lifecycle policies for educational content',
          'Use S3 Intelligent Tiering for Israeli user-uploaded content',
          'Archive old Hebrew educational materials to cheaper storage tiers',
          'Deduplicate similar educational content'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Analyze Israeli market specific cost factors
   */
  analyzeIsraeliMarketFactors() {
    return {
      peakHoursImpact: this.calculatePeakHoursImpact(),
      hebrewContentEfficiency: this.getHebrewCompressionEfficiency(),
      israeliTimezoneOptimization: this.analyzeTimezoneOptimization(),
      educationalContentPatterns: this.analyzeEducationalContentCosts(),
      mobileOptimization: this.analyzeMobileOptimizationCosts()
    };
  }

  /**
   * Helper function to calculate storage costs
   */
  calculateStorageCost(sizeInBytes) {
    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    return sizeInGB * this.israeliCostFactors.s3StorageEU;
  }

  /**
   * Helper function to calculate request costs
   */
  calculateRequestCost(requestType) {
    const requestCosts = {
      'GET': 0.0004 / 1000,    // per 1000 requests
      'PUT': 0.005 / 1000,     // per 1000 requests
      'POST': 0.005 / 1000,    // per 1000 requests
      'DELETE': 0.0004 / 1000  // per 1000 requests
    };
    return requestCosts[requestType] || 0;
  }

  /**
   * Helper function to calculate bandwidth costs
   */
  calculateBandwidthCost(sizeInBytes) {
    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    return sizeInGB * this.israeliCostFactors.bandwidthEU;
  }

  /**
   * Helper function to check if peak hour costs are high
   */
  isPeakHourCostHigh() {
    // Check if peak hour bandwidth usage is significantly higher
    const last24Hours = this.getLastNHours(24);
    let peakHourCosts = 0;
    let offPeakCosts = 0;

    last24Hours.forEach(hour => {
      const key = hour.format('YYYY-MM-DD-HH');
      if (this.bandwidthCostMetrics.has(key)) {
        const metrics = this.bandwidthCostMetrics.get(key);
        const totalCost = metrics.reduce((sum, m) => sum + (m.netCost || 0), 0);

        if (hour.hour() >= 8 && hour.hour() <= 18) {
          peakHourCosts += totalCost;
        } else {
          offPeakCosts += totalCost;
        }
      }
    });

    return peakHourCosts > (offPeakCosts * 1.5); // Peak costs > 150% of off-peak
  }

  /**
   * Helper function to get Hebrew compression efficiency
   */
  getHebrewCompressionEfficiency() {
    const last7Days = this.getLastNDays(7);
    let totalSavings = 0;
    let totalPotential = 0;

    last7Days.forEach(date => {
      const key = date.format('YYYY-MM-DD');
      if (this.hebrewContentCostMetrics.has(key)) {
        const metrics = this.hebrewContentCostMetrics.get(key);
        metrics.forEach(metric => {
          totalSavings += metric.compressionSavings || 0;
          totalPotential += metric.baseCost || 0;
        });
      }
    });

    return totalPotential > 0 ? totalSavings / totalPotential : 0;
  }

  /**
   * Calculate peak hours impact on costs
   */
  calculatePeakHoursImpact() {
    const last7Days = this.getLastNDays(7);
    let peakHourCosts = 0;
    let offPeakCosts = 0;
    let totalRequests = 0;

    last7Days.forEach(date => {
      for (let hour = 0; hour < 24; hour++) {
        const hourMoment = date.clone().hour(hour);
        const key = hourMoment.format('YYYY-MM-DD-HH');

        if (this.s3CostMetrics.has(key)) {
          const metrics = this.s3CostMetrics.get(key);
          const hourCost = metrics.reduce((sum, m) => sum + (m.netCost || m.transferCost || 0), 0);
          totalRequests += metrics.length;

          if (hour >= 8 && hour <= 18) {
            peakHourCosts += hourCost;
          } else {
            offPeakCosts += hourCost;
          }
        }
      }
    });

    return {
      peakHourCosts,
      offPeakCosts,
      peakToOffPeakRatio: offPeakCosts > 0 ? peakHourCosts / offPeakCosts : 0,
      totalRequests,
      recommendation: peakHourCosts > offPeakCosts * 1.3 ? 'optimize_peak_hours' : 'current_distribution_optimal'
    };
  }

  /**
   * Analyze timezone optimization effectiveness
   */
  analyzeTimezoneOptimization() {
    // Analyze how well content delivery aligns with Israeli timezone
    const israelTime = moment().tz('Asia/Jerusalem');
    const currentHour = israelTime.hour();

    return {
      currentIsraeliHour: currentHour,
      isCurrentlyPeakHours: currentHour >= 8 && currentHour <= 18,
      cachingEffectiveness: this.israeliCostFactors.cachingEfficiency,
      recommendation: 'timezone_awareness_active'
    };
  }

  /**
   * Analyze educational content cost patterns
   */
  analyzeEducationalContentCosts() {
    const educationalPaths = ['/api/entities/', '/api/products/', '/api/games/'];
    const last7Days = this.getLastNDays(7);
    let educationalCosts = 0;
    let totalCosts = 0;

    last7Days.forEach(date => {
      const key = date.format('YYYY-MM-DD');
      if (this.bandwidthCostMetrics.has(key)) {
        const metrics = this.bandwidthCostMetrics.get(key);
        metrics.forEach(metric => {
          totalCosts += metric.netCost || 0;
          if (educationalPaths.some(path => metric.path?.includes(path))) {
            educationalCosts += metric.netCost || 0;
          }
        });
      }
    });

    return {
      educationalContentPercentage: totalCosts > 0 ? (educationalCosts / totalCosts) * 100 : 0,
      educationalCosts,
      totalCosts,
      optimization: educationalCosts > totalCosts * 0.7 ? 'high_educational_usage' : 'balanced_usage'
    };
  }

  /**
   * Analyze mobile optimization cost impact
   */
  analyzeMobileOptimizationCosts() {
    const last7Days = this.getLastNDays(7);
    let mobileCosts = 0;
    let desktopCosts = 0;

    last7Days.forEach(date => {
      const key = date.format('YYYY-MM-DD');
      if (this.bandwidthCostMetrics.has(key)) {
        const metrics = this.bandwidthCostMetrics.get(key);
        metrics.forEach(metric => {
          const isMobile = metric.userAgent && /mobile|android|iphone|ipad/i.test(metric.userAgent);
          if (isMobile) {
            mobileCosts += metric.netCost || 0;
          } else {
            desktopCosts += metric.netCost || 0;
          }
        });
      }
    });

    return {
      mobileCosts,
      desktopCosts,
      mobilePercentage: (mobileCosts + desktopCosts) > 0 ? (mobileCosts / (mobileCosts + desktopCosts)) * 100 : 0,
      recommendation: mobileCosts > desktopCosts ? 'optimize_mobile_experience' : 'current_optimization_sufficient'
    };
  }

  /**
   * Analyze cost trends over time
   */
  analyzeCostTrends() {
    const last30Days = this.getLastNDays(30);
    const weeklyTrends = [];

    // Group by weeks
    for (let i = 0; i < 4; i++) {
      const weekStart = last30Days[i * 7];
      const weekEnd = last30Days[Math.min((i + 1) * 7 - 1, last30Days.length - 1)];

      let weekCosts = 0;
      for (let j = i * 7; j < Math.min((i + 1) * 7, last30Days.length); j++) {
        const date = last30Days[j];
        const key = date.format('YYYY-MM-DD');

        // Sum all costs for this day
        if (this.bandwidthCostMetrics.has(key)) {
          const metrics = this.bandwidthCostMetrics.get(key);
          weekCosts += metrics.reduce((sum, m) => sum + (m.netCost || 0), 0);
        }
      }

      weeklyTrends.push({
        week: i + 1,
        startDate: weekStart?.format('YYYY-MM-DD'),
        endDate: weekEnd?.format('YYYY-MM-DD'),
        totalCosts: weekCosts
      });
    }

    return {
      weeklyTrends,
      trend: this.calculateTrendDirection(weeklyTrends),
      volatility: this.calculateCostVolatility(weeklyTrends)
    };
  }

  /**
   * Project future costs based on current trends
   */
  projectFutureCosts() {
    const trends = this.analyzeCostTrends();
    const averageWeeklyCost = trends.weeklyTrends.reduce((sum, week) => sum + week.totalCosts, 0) / trends.weeklyTrends.length;

    return {
      nextWeekProjection: averageWeeklyCost * (trends.trend === 'increasing' ? 1.1 : trends.trend === 'decreasing' ? 0.9 : 1),
      nextMonthProjection: averageWeeklyCost * 4.3 * (trends.trend === 'increasing' ? 1.2 : trends.trend === 'decreasing' ? 0.8 : 1),
      confidence: trends.volatility < 0.2 ? 'high' : trends.volatility < 0.5 ? 'medium' : 'low'
    };
  }

  /**
   * Perform daily cost analysis
   */
  performDailyCostAnalysis() {
    try {
      const insights = this.generateCostOptimizationInsights();

      // Emit cost analysis event
      this.emit('daily_cost_analysis', insights);

      // Check for cost alerts
      this.checkCostAlerts(insights);

      console.log('🇮🇱 Daily Israeli cost analysis completed');
    } catch (error) {
      console.error('Error in daily cost analysis:', error);
    }
  }

  /**
   * Check for cost alerts and thresholds
   */
  checkCostAlerts(insights) {
    const alerts = [];

    // High cost alert
    if (insights.totalCosts.total > 100) { // $100 threshold
      alerts.push({
        type: 'high_cost_alert',
        severity: 'high',
        message: `Daily costs exceeded $100 (${insights.totalCosts.total.toFixed(2)})`,
        recommendations: insights.optimizations.filter(opt => opt.priority === 'high')
      });
    }

    // Savings opportunity alert
    if (insights.savings.total < insights.totalCosts.total * 0.1) {
      alerts.push({
        type: 'low_savings_alert',
        severity: 'medium',
        message: 'Savings opportunities below 10% of total costs',
        recommendations: insights.optimizations.filter(opt => opt.type.includes('compression') || opt.type.includes('caching'))
      });
    }

    // Emit alerts
    if (alerts.length > 0) {
      this.emit('cost_alerts', alerts);
    }
  }

  /**
   * Helper: Get last N days as moment objects
   */
  getLastNDays(n) {
    const days = [];
    const israelTime = moment().tz('Asia/Jerusalem');

    for (let i = n - 1; i >= 0; i--) {
      days.push(israelTime.clone().subtract(i, 'days').startOf('day'));
    }

    return days;
  }

  /**
   * Helper: Get last N hours as moment objects
   */
  getLastNHours(n) {
    const hours = [];
    const israelTime = moment().tz('Asia/Jerusalem');

    for (let i = n - 1; i >= 0; i--) {
      hours.push(israelTime.clone().subtract(i, 'hours').startOf('hour'));
    }

    return hours;
  }

  /**
   * Helper: Calculate trend direction
   */
  calculateTrendDirection(weeklyTrends) {
    if (weeklyTrends.length < 2) return 'stable';

    const recent = weeklyTrends[weeklyTrends.length - 1].totalCosts;
    const previous = weeklyTrends[weeklyTrends.length - 2].totalCosts;

    if (recent > previous * 1.1) return 'increasing';
    if (recent < previous * 0.9) return 'decreasing';
    return 'stable';
  }

  /**
   * Helper: Calculate cost volatility
   */
  calculateCostVolatility(weeklyTrends) {
    if (weeklyTrends.length < 2) return 0;

    const costs = weeklyTrends.map(w => w.totalCosts);
    const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
    const standardDeviation = Math.sqrt(variance);

    return mean > 0 ? standardDeviation / mean : 0;
  }

  /**
   * Analyze current metrics for real-time insights
   */
  analyzeCostMetrics() {
    const israelTime = moment().tz('Asia/Jerusalem');
    const currentHour = israelTime.format('YYYY-MM-DD-HH');

    // Get current hour metrics
    const s3Metrics = this.s3CostMetrics.get(currentHour) || [];
    const bandwidthMetrics = this.bandwidthCostMetrics.get(currentHour) || [];

    const analysis = {
      timestamp: israelTime.toISOString(),
      currentHourCosts: {
        s3: s3Metrics.reduce((sum, m) => sum + (m.netCost || m.transferCost || 0), 0),
        bandwidth: bandwidthMetrics.reduce((sum, m) => sum + (m.netCost || 0), 0)
      },
      requestCount: s3Metrics.length + bandwidthMetrics.length,
      averageCostPerRequest: 0,
      isPeakHours: israelTime.hour() >= 8 && israelTime.hour() <= 18
    };

    if (analysis.requestCount > 0) {
      analysis.averageCostPerRequest = (analysis.currentHourCosts.s3 + analysis.currentHourCosts.bandwidth) / analysis.requestCount;
    }

    return analysis;
  }

  /**
   * Stop cost tracking
   */
  stopCostTracking() {
    if (this.costTrackingInterval) {
      clearInterval(this.costTrackingInterval);
      this.costTrackingInterval = null;
    }

    if (this.dailyAnalysisInterval) {
      clearInterval(this.dailyAnalysisInterval);
      this.dailyAnalysisInterval = null;
    }

    console.log('🇮🇱 Israeli cost optimization tracking stopped');
  }
}

export default IsraeliCostOptimizationService;