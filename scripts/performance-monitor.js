#!/usr/bin/env node

/**
 * Continuous Performance Monitoring Script
 *
 * Monitors middleware performance in production and sends alerts
 * when performance degrades beyond acceptable thresholds.
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';

// Monitor configuration
const MONITOR_CONFIG = {
  baseUrl: process.env.MONITOR_URL || 'http://localhost:3003',
  interval: process.env.MONITOR_INTERVAL || 30000, // 30 seconds
  alertThresholds: {
    responseTime: 2000, // 2 seconds
    errorRate: 5, // 5%
    throughput: 50, // 50 req/sec minimum
    memoryUsage: 500 * 1024 * 1024 // 500MB
  },
  testPaths: [
    '/health',
    '/api/entities/games',
    '/api/dashboard/student',
    '/api/auth/status'
  ],
  logFile: './performance-monitor.log',
  metricsFile: './performance-metrics.json',
  alertWebhook: process.env.ALERT_WEBHOOK_URL,
  maxLogSize: 10 * 1024 * 1024 // 10MB
};

class PerformanceMonitor {
  constructor(config) {
    this.config = config;
    this.metrics = {
      timestamp: Date.now(),
      responseTimes: [],
      errorCounts: { total: 0, last24h: 0 },
      memoryUsage: [],
      requests: { total: 0, successful: 0, failed: 0 },
      middlewareHealth: {
        smartIsraeliContext: true,
        smartPerformanceCost: true,
        smartAlertSystem: true,
        smartResponseProcessor: true
      }
    };
    this.running = false;
    this.intervalId = null;
  }

  /**
   * Start continuous monitoring
   */
  async start() {
    if (this.running) {
      console.log('⚠️ Monitor is already running');
      return;
    }

    console.log('🔍 Starting Performance Monitor...');
    console.log(`📊 Monitoring ${this.config.baseUrl} every ${this.config.interval / 1000}s`);

    this.running = true;

    // Initial health check
    await this.performHealthCheck();

    // Start monitoring interval
    this.intervalId = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        await this.log(`❌ Monitoring error: ${error.message}`, 'error');
      }
    }, this.config.interval);

    console.log('✅ Performance Monitor started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.running) {
      console.log('⚠️ Monitor is not running');
      return;
    }

    console.log('🛑 Stopping Performance Monitor...');

    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Performance Monitor stopped');
  }

  /**
   * Perform health check on all test paths
   */
  async performHealthCheck() {
    const checkTime = Date.now();
    const results = [];

    // Test each path
    for (const path of this.config.testPaths) {
      try {
        const result = await this.testPath(path);
        results.push(result);

        // Update metrics
        this.updateMetrics(result);

      } catch (error) {
        const failedResult = {
          path: path,
          success: false,
          error: error.message,
          responseTime: -1,
          timestamp: checkTime
        };

        results.push(failedResult);
        this.updateMetrics(failedResult);
      }
    }

    // Check thresholds and send alerts
    await this.checkThresholds(results);

    // Log summary
    await this.logHealthCheck(results);

    // Save metrics
    await this.saveMetrics();
  }

  /**
   * Test a specific path
   */
  async testPath(path) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const url = new URL(path, this.config.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers: {
          'User-Agent': 'LudoraPerformanceMonitor/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      };

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          resolve({
            path: path,
            success: res.statusCode < 400,
            statusCode: res.statusCode,
            responseTime: responseTime,
            contentLength: data.length,
            headers: res.headers,
            smartMiddlewares: {
              israeliContext: res.headers['x-israeli-context'] === 'enabled',
              smartProcessor: res.headers['x-smart-processor'] === 'enabled',
              hebrewSupport: res.headers['x-hebrew-support'] === 'enabled',
              compressionType: res.headers['x-compression-type']
            },
            timestamp: Date.now()
          });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Update internal metrics
   */
  updateMetrics(result) {
    this.metrics.requests.total++;

    if (result.success) {
      this.metrics.requests.successful++;
      this.metrics.responseTimes.push(result.responseTime);

      // Keep only last 100 response times
      if (this.metrics.responseTimes.length > 100) {
        this.metrics.responseTimes.shift();
      }
    } else {
      this.metrics.requests.failed++;
      this.metrics.errorCounts.total++;
    }

    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push(memUsage.heapUsed);

    // Keep only last 50 memory measurements
    if (this.metrics.memoryUsage.length > 50) {
      this.metrics.memoryUsage.shift();
    }

    // Update middleware health based on headers
    if (result.smartMiddlewares) {
      // Check if smart middlewares are responding correctly
      this.metrics.middlewareHealth.smartResponseProcessor = !!result.smartMiddlewares.smartProcessor;
    }
  }

  /**
   * Check performance thresholds and send alerts
   */
  async checkThresholds(results) {
    const alerts = [];

    // Calculate current metrics
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length
      : 0;

    const errorRate = this.metrics.requests.total > 0
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100
      : 0;

    const currentMemory = this.metrics.memoryUsage.length > 0
      ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
      : 0;

    // Check thresholds
    if (avgResponseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'high_response_time',
        severity: 'high',
        message: `Average response time is ${avgResponseTime.toFixed(2)}ms (threshold: ${this.config.alertThresholds.responseTime}ms)`,
        value: avgResponseTime,
        threshold: this.config.alertThresholds.responseTime
      });
    }

    if (errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `Error rate is ${errorRate.toFixed(2)}% (threshold: ${this.config.alertThresholds.errorRate}%)`,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }

    if (currentMemory > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'medium',
        message: `Memory usage is ${(currentMemory / 1024 / 1024).toFixed(2)}MB (threshold: ${this.config.alertThresholds.memoryUsage / 1024 / 1024}MB)`,
        value: currentMemory,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }

    // Check middleware health
    Object.entries(this.metrics.middlewareHealth).forEach(([middleware, healthy]) => {
      if (!healthy) {
        alerts.push({
          type: 'middleware_health',
          severity: 'high',
          message: `Smart middleware ${middleware} appears to be unhealthy or not responding`,
          middleware: middleware
        });
      }
    });

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * Send alert notification
   */
  async sendAlert(alert) {
    const alertMessage = {
      timestamp: new Date().toISOString(),
      service: 'ludora-api-middleware',
      environment: process.env.NODE_ENV || 'development',
      ...alert
    };

    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Log alert
    await this.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, 'alert');

    // Send to webhook if configured
    if (this.config.alertWebhook) {
      try {
        await this.sendWebhookAlert(alertMessage);
      } catch (error) {
        await this.log(`❌ Failed to send webhook alert: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Send alert to webhook
   */
  async sendWebhookAlert(alert) {
    const webhookUrl = new URL(this.config.alertWebhook);
    const isHttps = webhookUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const postData = JSON.stringify({
      text: `🚨 Ludora API Alert: ${alert.message}`,
      alert: alert
    });

    const options = {
      hostname: webhookUrl.hostname,
      port: webhookUrl.port || (isHttps ? 443 : 80),
      path: webhookUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = httpModule.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Log health check results
   */
  async logHealthCheck(results) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const avgResponseTime = successful > 0
      ? results.filter(r => r.success).reduce((sum, r) => sum + r.responseTime, 0) / successful
      : 0;

    const logMessage = `Health Check: ${successful}/${results.length} passed, avg: ${avgResponseTime.toFixed(2)}ms`;

    if (failed > 0) {
      await this.log(`⚠️ ${logMessage} (${failed} failed)`, 'warn');
    } else {
      await this.log(`✅ ${logMessage}`, 'info');
    }
  }

  /**
   * Log message with timestamp
   */
  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    console.log(message);

    try {
      // Rotate log file if it's too large
      await this.rotateLogIfNeeded();

      await fs.appendFile(this.config.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Rotate log file if it exceeds maximum size
   */
  async rotateLogIfNeeded() {
    try {
      const stats = await fs.stat(this.config.logFile);
      if (stats.size > this.config.maxLogSize) {
        const backupFile = this.config.logFile + '.old';
        await fs.rename(this.config.logFile, backupFile);
      }
    } catch (error) {
      // File doesn't exist or other error, ignore
    }
  }

  /**
   * Save current metrics to file
   */
  async saveMetrics() {
    try {
      const metricsSnapshot = {
        timestamp: Date.now(),
        uptime: Date.now() - this.metrics.timestamp,
        totalRequests: this.metrics.requests.total,
        successfulRequests: this.metrics.requests.successful,
        failedRequests: this.metrics.requests.failed,
        errorRate: this.metrics.requests.total > 0
          ? (this.metrics.requests.failed / this.metrics.requests.total) * 100
          : 0,
        avgResponseTime: this.metrics.responseTimes.length > 0
          ? this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length
          : 0,
        currentMemoryUsage: this.metrics.memoryUsage.length > 0
          ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
          : 0,
        middlewareHealth: this.metrics.middlewareHealth
      };

      await fs.writeFile(this.config.metricsFile, JSON.stringify(metricsSnapshot, null, 2));
    } catch (error) {
      await this.log(`❌ Failed to save metrics: ${error.message}`, 'error');
    }
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    return {
      uptime: Date.now() - this.metrics.timestamp,
      totalRequests: this.metrics.requests.total,
      successRate: this.metrics.requests.total > 0
        ? (this.metrics.requests.successful / this.metrics.requests.total) * 100
        : 100,
      avgResponseTime: this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length
        : 0,
      memoryUsage: this.metrics.memoryUsage.length > 0
        ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
        : 0,
      middlewareHealth: this.metrics.middlewareHealth
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Ludora Middleware Performance Monitor

Usage: node performance-monitor.js [options]

Options:
  --url <url>           API base URL (default: http://localhost:3003)
  --interval <ms>       Monitoring interval in milliseconds (default: 30000)
  --log-file <path>     Log file path (default: ./performance-monitor.log)
  --webhook <url>       Alert webhook URL
  --status              Show current status and exit
  --help, -h           Show this help message

Environment Variables:
  MONITOR_URL           API base URL
  MONITOR_INTERVAL      Monitoring interval
  ALERT_WEBHOOK_URL     Alert webhook URL

Examples:
  node performance-monitor.js
  node performance-monitor.js --url https://api.ludora.app --interval 60000
  node performance-monitor.js --status
    `);
    process.exit(0);
  }

  // Parse arguments
  const config = { ...MONITOR_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--url':
        config.baseUrl = args[i + 1];
        break;
      case '--interval':
        config.interval = parseInt(args[i + 1]);
        break;
      case '--log-file':
        config.logFile = args[i + 1];
        break;
      case '--webhook':
        config.alertWebhook = args[i + 1];
        break;
      case '--status':
        await showStatus(config);
        process.exit(0);
        break;
    }
  }

  const monitor = new PerformanceMonitor(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n📊 Shutting down monitor...');
    monitor.stop();
    console.log('✅ Monitor stopped gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });

  try {
    await monitor.start();

    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Monitor failed to start:', error.message);
    process.exit(1);
  }
}

/**
 * Show current monitoring status
 */
async function showStatus(config) {
  try {
    const data = await fs.readFile(config.metricsFile, 'utf8');
    const metrics = JSON.parse(data);

    console.log('📊 Performance Monitor Status:');
    console.log(`   Uptime: ${Math.round(metrics.uptime / 1000)}s`);
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`   Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Memory Usage: ${(metrics.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log('\n🛠️ Middleware Health:');
    Object.entries(metrics.middlewareHealth).forEach(([name, healthy]) => {
      console.log(`   ${name}: ${healthy ? '✅' : '❌'}`);
    });
  } catch (error) {
    console.log('❌ No monitoring data found');
  }
}

// Export for programmatic use
export default PerformanceMonitor;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}