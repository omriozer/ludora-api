/**
 * Metrics Batch Processor Service
 *
 * Background service for efficiently processing middleware metrics in batches.
 * Reduces per-request overhead by aggregating and processing metrics asynchronously.
 */

import EventEmitter from 'events';

class MetricsBatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.batchSize = options.batchSize || 100;
    this.batchInterval = options.batchInterval || 30000; // 30 seconds
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds

    // Processing state
    this.metricsQueue = [];
    this.processingQueue = [];
    this.isProcessing = false;
    this.processingInterval = null;

    // Statistics
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      batchesProcessed: 0,
      lastBatchTime: null,
      avgBatchSize: 0,
      avgProcessingTime: 0
    };

    // Error handling
    this.failedBatches = [];
    this.maxFailedBatches = 100;

    this.initialize();
  }

  /**
   * Initialize the batch processor
   */
  initialize() {
    console.log('📊 Initializing Metrics Batch Processor...');
    console.log(`📊 Batch size: ${this.batchSize}, Interval: ${this.batchInterval}ms`);

    this.startBatchProcessing();
    this.setupErrorHandling();
  }

  /**
   * Add metrics to processing queue
   */
  addMetrics(metrics) {
    if (!Array.isArray(metrics)) {
      metrics = [metrics];
    }

    // Check queue size limit
    if (this.metricsQueue.length + metrics.length > this.maxQueueSize) {
      const overflow = (this.metricsQueue.length + metrics.length) - this.maxQueueSize;
      console.warn(`⚠️ Metrics queue overflow, dropping ${overflow} oldest metrics`);

      // Remove oldest metrics to make room
      this.metricsQueue.splice(0, overflow);

      this.emit('queue_overflow', {
        droppedMetrics: overflow,
        queueSize: this.metricsQueue.length
      });
    }

    // Add new metrics
    this.metricsQueue.push(...metrics);

    this.emit('metrics_added', {
      added: metrics.length,
      queueSize: this.metricsQueue.length
    });
  }

  /**
   * Start batch processing interval
   */
  startBatchProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      await this.processBatch();
    }, this.batchInterval);

    console.log('✅ Batch processing started');
  }

  /**
   * Stop batch processing
   */
  stopBatchProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('🛑 Batch processing stopped');
  }

  /**
   * Process a batch of metrics
   */
  async processBatch() {
    if (this.isProcessing || this.metricsQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batchStartTime = Date.now();

    try {
      // Extract batch from queue
      const batchSize = Math.min(this.batchSize, this.metricsQueue.length);
      const batch = this.metricsQueue.splice(0, batchSize);

      console.log(`📊 Processing batch of ${batch.length} metrics...`);

      // Group metrics by type for efficient processing
      const groupedMetrics = this.groupMetricsByType(batch);

      // Process each group
      const processingPromises = [];

      if (groupedMetrics.performance.length > 0) {
        processingPromises.push(
          this.processPerformanceMetrics(groupedMetrics.performance)
        );
      }

      if (groupedMetrics.cost.length > 0) {
        processingPromises.push(
          this.processCostMetrics(groupedMetrics.cost)
        );
      }

      if (groupedMetrics.hebrew.length > 0) {
        processingPromises.push(
          this.processHebrewMetrics(groupedMetrics.hebrew)
        );
      }

      if (groupedMetrics.s3.length > 0) {
        processingPromises.push(
          this.processS3Metrics(groupedMetrics.s3)
        );
      }

      // Wait for all processing to complete
      const results = await Promise.allSettled(processingPromises);

      // Check for failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`⚠️ ${failures.length} metric processing operations failed:`, failures);
        this.stats.totalErrors += failures.length;
      }

      // Update statistics
      const processingTime = Date.now() - batchStartTime;
      this.updateStats(batch.length, processingTime);

      this.emit('batch_processed', {
        batchSize: batch.length,
        processingTime,
        failures: failures.length,
        queueSize: this.metricsQueue.length
      });

      console.log(`✅ Batch processing completed in ${processingTime}ms`);

    } catch (error) {
      console.error('❌ Batch processing error:', error);
      this.handleProcessingError(error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Group metrics by type for efficient processing
   */
  groupMetricsByType(batch) {
    const groups = {
      performance: [],
      cost: [],
      hebrew: [],
      s3: []
    };

    batch.forEach(metric => {
      // Performance metrics (always present)
      groups.performance.push({
        requestId: metric.requestId,
        timestamp: metric.timestamp,
        method: metric.method,
        path: metric.path,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode,
        contentSize: metric.contentSize,
        isPeakHours: metric.isPeakHours,
        isSchoolHours: metric.isSchoolHours,
        userId: metric.userId,
        userType: metric.userType
      });

      // Cost metrics
      if (metric.costs) {
        groups.cost.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          costs: metric.costs,
          isPeakHours: metric.isPeakHours,
          path: metric.path,
          contentSize: metric.contentSize
        });
      }

      // Hebrew content metrics
      if (metric.hebrewContent) {
        groups.hebrew.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          hebrewCharCount: metric.hebrewCharCount,
          contentSize: metric.contentSize,
          rtlFormatted: metric.rtlFormatted,
          costs: metric.costs?.hebrew,
          compressionUsed: metric.compressionUsed
        });
      }

      // S3 operation metrics
      if (metric.isS3Operation && metric.s3Operation) {
        groups.s3.push({
          requestId: metric.requestId,
          timestamp: metric.timestamp,
          operation: metric.s3Operation,
          costs: metric.costs?.s3,
          path: metric.path,
          hebrewContent: metric.hebrewContent
        });
      }
    });

    return groups;
  }

  /**
   * Process performance metrics
   */
  async processPerformanceMetrics(performanceMetrics) {
    console.log(`📊 Processing ${performanceMetrics.length} performance metrics`);

    // Aggregate performance data
    const aggregated = this.aggregatePerformanceData(performanceMetrics);

    // Store aggregated results (in production, this would go to database)
    this.emit('performance_processed', {
      metrics: performanceMetrics,
      aggregated: aggregated,
      count: performanceMetrics.length
    });

    return aggregated;
  }

  /**
   * Process cost metrics
   */
  async processCostMetrics(costMetrics) {
    console.log(`💰 Processing ${costMetrics.length} cost metrics`);

    // Aggregate cost data
    const aggregated = this.aggregateCostData(costMetrics);

    // Check for cost alerts
    this.checkCostAlerts(aggregated);

    this.emit('cost_processed', {
      metrics: costMetrics,
      aggregated: aggregated,
      count: costMetrics.length
    });

    return aggregated;
  }

  /**
   * Process Hebrew content metrics
   */
  async processHebrewMetrics(hebrewMetrics) {
    console.log(`🔤 Processing ${hebrewMetrics.length} Hebrew content metrics`);

    const aggregated = this.aggregateHebrewData(hebrewMetrics);

    this.emit('hebrew_processed', {
      metrics: hebrewMetrics,
      aggregated: aggregated,
      count: hebrewMetrics.length
    });

    return aggregated;
  }

  /**
   * Process S3 operation metrics
   */
  async processS3Metrics(s3Metrics) {
    console.log(`🗂️ Processing ${s3Metrics.length} S3 operation metrics`);

    const aggregated = this.aggregateS3Data(s3Metrics);

    this.emit('s3_processed', {
      metrics: s3Metrics,
      aggregated: aggregated,
      count: s3Metrics.length
    });

    return aggregated;
  }

  /**
   * Aggregate performance data
   */
  aggregatePerformanceData(metrics) {
    const total = metrics.length;
    const responseTimes = metrics.map(m => m.responseTime);
    const errors = metrics.filter(m => m.statusCode >= 400).length;

    return {
      totalRequests: total,
      errorRate: (errors / total) * 100,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / total,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p95ResponseTime: this.percentile(responseTimes, 0.95),
      peakHoursRequests: metrics.filter(m => m.isPeakHours).length,
      schoolHoursRequests: metrics.filter(m => m.isSchoolHours).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Aggregate cost data
   */
  aggregateCostData(metrics) {
    const totalBandwidthCost = metrics.reduce((sum, m) =>
      sum + (m.costs.bandwidth?.netCost || 0), 0);

    const totalS3Cost = metrics.reduce((sum, m) =>
      sum + (m.costs.s3?.transferCost || 0), 0);

    const totalSavings = metrics.reduce((sum, m) =>
      sum + (m.costs.bandwidth?.cacheSavings || 0) + (m.costs.bandwidth?.compressionSavings || 0), 0);

    return {
      totalRequests: metrics.length,
      bandwidthCost: totalBandwidthCost,
      s3Cost: totalS3Cost,
      totalCost: totalBandwidthCost + totalS3Cost,
      totalSavings: totalSavings,
      savingsPercentage: totalBandwidthCost > 0 ? (totalSavings / totalBandwidthCost) * 100 : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Aggregate Hebrew content data
   */
  aggregateHebrewData(metrics) {
    const totalHebrewChars = metrics.reduce((sum, m) => sum + (m.hebrewCharCount || 0), 0);
    const rtlFormattedCount = metrics.filter(m => m.rtlFormatted).length;
    const compressedCount = metrics.filter(m => m.compressionUsed).length;

    return {
      totalRequests: metrics.length,
      totalHebrewChars: totalHebrewChars,
      avgHebrewCharsPerRequest: totalHebrewChars / metrics.length,
      rtlFormattedPercentage: (rtlFormattedCount / metrics.length) * 100,
      compressionUsagePercentage: (compressedCount / metrics.length) * 100,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Aggregate S3 operation data
   */
  aggregateS3Data(metrics) {
    const operations = metrics.reduce((acc, m) => {
      const type = m.operation.operationType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const totalFileSize = metrics.reduce((sum, m) => sum + (m.operation.fileSize || 0), 0);
    const successCount = metrics.filter(m => m.operation.success).length;

    return {
      totalOperations: metrics.length,
      operationsByType: operations,
      totalFileSize: totalFileSize,
      avgFileSize: totalFileSize / metrics.length,
      successRate: (successCount / metrics.length) * 100,
      hebrewFilesCount: metrics.filter(m => m.hebrewContent).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check for cost alerts
   */
  checkCostAlerts(aggregatedCostData) {
    const alerts = [];

    // High daily cost alert
    if (aggregatedCostData.totalCost > 10) { // $10 threshold
      alerts.push({
        type: 'high_cost_alert',
        severity: 'medium',
        message: `Batch processing detected high costs: $${aggregatedCostData.totalCost.toFixed(2)}`,
        data: aggregatedCostData
      });
    }

    // Low savings alert
    if (aggregatedCostData.savingsPercentage < 10) {
      alerts.push({
        type: 'low_savings_alert',
        severity: 'low',
        message: `Low savings percentage: ${aggregatedCostData.savingsPercentage.toFixed(1)}%`,
        data: aggregatedCostData
      });
    }

    if (alerts.length > 0) {
      this.emit('cost_alerts', alerts);
    }
  }

  /**
   * Calculate percentile
   */
  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  /**
   * Update processing statistics
   */
  updateStats(batchSize, processingTime) {
    this.stats.totalProcessed += batchSize;
    this.stats.batchesProcessed += 1;
    this.stats.lastBatchTime = new Date().toISOString();

    // Calculate rolling averages
    this.stats.avgBatchSize = this.stats.totalProcessed / this.stats.batchesProcessed;
    this.stats.avgProcessingTime = ((this.stats.avgProcessingTime * (this.stats.batchesProcessed - 1)) + processingTime) / this.stats.batchesProcessed;
  }

  /**
   * Handle processing errors
   */
  handleProcessingError(error) {
    this.stats.totalErrors += 1;

    this.failedBatches.push({
      error: error.message,
      timestamp: new Date().toISOString(),
      queueSize: this.metricsQueue.length
    });

    // Keep only recent failed batches
    if (this.failedBatches.length > this.maxFailedBatches) {
      this.failedBatches.shift();
    }

    this.emit('processing_error', {
      error: error.message,
      totalErrors: this.stats.totalErrors,
      queueSize: this.metricsQueue.length
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception in batch processor:', error);
      this.handleProcessingError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection in batch processor:', reason);
      this.handleProcessingError(new Error(reason));
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down Metrics Batch Processor...');

    this.stopBatchProcessing();

    // Process remaining metrics
    if (this.metricsQueue.length > 0) {
      console.log(`📊 Processing final batch of ${this.metricsQueue.length} metrics...`);
      await this.processBatch();
    }

    console.log('✅ Metrics Batch Processor shutdown complete');
    console.log('📊 Final statistics:', this.getStats());
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.metricsQueue.length,
      isProcessing: this.isProcessing,
      recentFailures: this.failedBatches.slice(-5)
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const queueUtilization = (this.metricsQueue.length / this.maxQueueSize) * 100;
    const errorRate = this.stats.batchesProcessed > 0 ?
      (this.stats.totalErrors / this.stats.batchesProcessed) * 100 : 0;

    return {
      status: this.isProcessing ? 'processing' : 'idle',
      queueUtilization: queueUtilization.toFixed(1),
      errorRate: errorRate.toFixed(1),
      health: queueUtilization < 80 && errorRate < 5 ? 'healthy' : 'degraded'
    };
  }
}

export default MetricsBatchProcessor;