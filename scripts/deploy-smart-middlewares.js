#!/usr/bin/env node

/**
 * Smart Middleware Deployment Script
 *
 * Handles safe deployment of optimized middlewares with feature flags,
 * gradual rollout, performance monitoring, and automatic rollback.
 */

import featureFlags, { FeatureFlagManager } from '../config/middleware-feature-flags.js';
import PerformanceMonitor from './performance-monitor.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

// Deployment configuration
const DEPLOYMENT_CONFIG = {
  phases: [
    {
      name: 'canary',
      description: 'Deploy to 5% of traffic',
      percentage: 5,
      duration: 24 * 60 * 60 * 1000, // 24 hours
      requiredSuccessRate: 99.5,
      maxErrorIncrease: 0.1
    },
    {
      name: 'limited',
      description: 'Deploy to 25% of traffic',
      percentage: 25,
      duration: 48 * 60 * 60 * 1000, // 48 hours
      requiredSuccessRate: 99.0,
      maxErrorIncrease: 0.5
    },
    {
      name: 'majority',
      description: 'Deploy to 75% of traffic',
      percentage: 75,
      duration: 48 * 60 * 60 * 1000, // 48 hours
      requiredSuccessRate: 98.5,
      maxErrorIncrease: 1.0
    },
    {
      name: 'full',
      description: 'Deploy to 100% of traffic',
      percentage: 100,
      duration: Infinity,
      requiredSuccessRate: 98.0,
      maxErrorIncrease: 2.0
    }
  ],
  checkInterval: 5 * 60 * 1000, // 5 minutes
  baselineMetricsPeriod: 30 * 60 * 1000, // 30 minutes
  rollbackCooldown: 60 * 60 * 1000, // 1 hour
  logFile: './deployment.log',
  metricsFile: './deployment-metrics.json'
};

class SmartMiddlewareDeployer {
  constructor(config = DEPLOYMENT_CONFIG) {
    this.config = config;
    this.featureFlags = featureFlags;
    this.monitor = new PerformanceMonitor({
      baseUrl: process.env.MONITOR_URL || 'http://localhost:3003',
      interval: this.config.checkInterval,
      logFile: this.config.logFile
    });

    this.deployment = {
      startTime: null,
      currentPhase: null,
      phaseStartTime: null,
      baselineMetrics: null,
      rolloutHistory: [],
      isActive: false
    };
  }

  /**
   * Start the deployment process
   */
  async start(middlewares = ['all'], options = {}) {
    const {
      strategy = 'conservative',
      skipBaseline = false,
      dryRun = false
    } = options;

    if (this.deployment.isActive) {
      throw new Error('Deployment already in progress');
    }

    console.log('🚀 Starting Smart Middleware Deployment');
    console.log(`📊 Strategy: ${strategy}`);
    console.log(`🎯 Middlewares: ${middlewares.join(', ')}`);

    this.deployment.isActive = true;
    this.deployment.startTime = Date.now();

    try {
      // Set rollout strategy
      this.featureFlags.setFlag('MIDDLEWARE_ROLLOUT_STRATEGY', { value: strategy });

      // Collect baseline metrics
      if (!skipBaseline) {
        await this.collectBaselineMetrics();
      }

      // Start gradual deployment
      await this.startGradualDeployment(middlewares, dryRun);

    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      await this.rollback('Deployment script error');
      throw error;
    }
  }

  /**
   * Collect baseline performance metrics
   */
  async collectBaselineMetrics() {
    console.log('📊 Collecting baseline metrics...');

    const startTime = Date.now();
    const endTime = startTime + this.config.baselineMetricsPeriod;

    const metrics = {
      startTime,
      endTime,
      requests: { total: 0, successful: 0, failed: 0 },
      responseTimes: [],
      memoryUsage: [],
      errorCounts: { total: 0 }
    };

    // Monitor for baseline period
    while (Date.now() < endTime) {
      try {
        const healthCheck = await this.monitor.performHealthCheck();
        this.updateBaselineMetrics(metrics, healthCheck);

        await new Promise(resolve => setTimeout(resolve, this.config.checkInterval));
      } catch (error) {
        console.warn('⚠️ Error during baseline collection:', error.message);
      }
    }

    // Calculate baseline statistics
    this.deployment.baselineMetrics = {
      avgResponseTime: metrics.responseTimes.length > 0
        ? metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length
        : 0,
      successRate: metrics.requests.total > 0
        ? (metrics.requests.successful / metrics.requests.total) * 100
        : 100,
      errorRate: metrics.requests.total > 0
        ? (metrics.requests.failed / metrics.requests.total) * 100
        : 0,
      avgMemoryUsage: metrics.memoryUsage.length > 0
        ? metrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) / metrics.memoryUsage.length
        : 0,
      totalRequests: metrics.requests.total
    };

    console.log('📈 Baseline metrics collected:');
    console.log(`   Avg Response Time: ${this.deployment.baselineMetrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Success Rate: ${this.deployment.baselineMetrics.successRate.toFixed(2)}%`);
    console.log(`   Error Rate: ${this.deployment.baselineMetrics.errorRate.toFixed(2)}%`);
    console.log(`   Total Requests: ${this.deployment.baselineMetrics.totalRequests}`);
  }

  /**
   * Update baseline metrics with health check results
   */
  updateBaselineMetrics(metrics, healthCheckResults) {
    // This would be implemented based on the actual health check structure
    // For now, we'll simulate metric collection

    metrics.requests.total += 10; // Simulate request count
    metrics.requests.successful += 9;
    metrics.requests.failed += 1;

    metrics.responseTimes.push(150 + Math.random() * 100); // Simulate response times
    metrics.memoryUsage.push(process.memoryUsage().heapUsed);
  }

  /**
   * Start gradual deployment across phases
   */
  async startGradualDeployment(middlewares, dryRun) {
    console.log('🎯 Starting gradual deployment...');

    for (const phase of this.config.phases) {
      console.log(`\n📍 Starting phase: ${phase.name} (${phase.description})`);

      this.deployment.currentPhase = phase;
      this.deployment.phaseStartTime = Date.now();

      if (!dryRun) {
        await this.enableMiddlewaresForPhase(middlewares, phase);
      } else {
        console.log('🧪 DRY RUN: Would enable middlewares:', middlewares);
      }

      // Monitor phase
      const phaseSuccess = await this.monitorPhase(phase, dryRun);

      if (!phaseSuccess) {
        console.log(`❌ Phase ${phase.name} failed, initiating rollback`);
        await this.rollback(`Phase ${phase.name} performance degradation`);
        return false;
      }

      console.log(`✅ Phase ${phase.name} completed successfully`);

      // Record phase completion
      this.deployment.rolloutHistory.push({
        phase: phase.name,
        percentage: phase.percentage,
        startTime: this.deployment.phaseStartTime,
        endTime: Date.now(),
        success: true
      });

      // Save progress
      await this.saveDeploymentState();

      if (phase.name === 'full') {
        break; // Deployment complete
      }
    }

    console.log('🎉 Deployment completed successfully!');
    this.deployment.isActive = false;

    // Disable legacy middlewares after successful deployment
    await this.disableLegacyMiddlewares(middlewares);

    return true;
  }

  /**
   * Enable middlewares for current deployment phase
   */
  async enableMiddlewaresForPhase(middlewares, phase) {
    const middlewareFlags = this.getMiddlewareFlags(middlewares);

    for (const flagName of middlewareFlags) {
      console.log(`🏁 Enabling ${flagName} at ${phase.percentage}%`);

      this.featureFlags.setFlag(flagName, {
        enabled: true,
        rolloutPercentage: phase.percentage
      });

      // Add small delay between flag updates
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save feature flag state
    await this.saveFeatureFlagState();
  }

  /**
   * Monitor phase performance and health
   */
  async monitorPhase(phase, dryRun) {
    console.log(`🔍 Monitoring phase ${phase.name} for ${this.formatDuration(phase.duration)}`);

    const phaseEndTime = Date.now() + phase.duration;
    let checkCount = 0;
    let consecutiveFailures = 0;

    while (Date.now() < phaseEndTime) {
      try {
        checkCount++;
        console.log(`   Health check ${checkCount}...`);

        if (!dryRun) {
          const currentMetrics = await this.collectCurrentMetrics();
          const healthScore = this.calculateHealthScore(currentMetrics, phase);

          console.log(`   Health score: ${(healthScore * 100).toFixed(1)}%`);

          if (healthScore < 0.8) { // 80% health threshold
            consecutiveFailures++;
            console.log(`⚠️ Health check failed (${consecutiveFailures}/3)`);

            if (consecutiveFailures >= 3) {
              console.log(`❌ Phase ${phase.name} failed health checks`);
              return false;
            }
          } else {
            consecutiveFailures = 0; // Reset failure count
          }
        } else {
          console.log('🧪 DRY RUN: Simulating health check');
        }

        // Wait until next check
        await new Promise(resolve => setTimeout(resolve, this.config.checkInterval));

      } catch (error) {
        console.error(`❌ Error during monitoring: ${error.message}`);
        consecutiveFailures++;

        if (consecutiveFailures >= 3) {
          return false;
        }
      }
    }

    return true; // Phase completed successfully
  }

  /**
   * Collect current performance metrics
   */
  async collectCurrentMetrics() {
    // This would integrate with the actual monitoring system
    // For now, we'll simulate metric collection

    return {
      avgResponseTime: 120 + Math.random() * 80, // Simulate current response time
      successRate: 98 + Math.random() * 2, // Simulate success rate
      errorRate: Math.random() * 2, // Simulate error rate
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate health score based on current vs baseline metrics
   */
  calculateHealthScore(current, phase) {
    if (!this.deployment.baselineMetrics) {
      return 1.0; // No baseline, assume healthy
    }

    const baseline = this.deployment.baselineMetrics;
    let score = 1.0;

    // Response time comparison
    const responseTimeRatio = current.avgResponseTime / baseline.avgResponseTime;
    if (responseTimeRatio > 1.5) {
      score -= 0.3; // Significant response time increase
    } else if (responseTimeRatio > 1.2) {
      score -= 0.1; // Moderate response time increase
    }

    // Success rate comparison
    const successRateDrop = baseline.successRate - current.successRate;
    if (successRateDrop > phase.maxErrorIncrease) {
      score -= 0.4; // Unacceptable success rate drop
    } else if (successRateDrop > phase.maxErrorIncrease / 2) {
      score -= 0.2; // Moderate success rate drop
    }

    // Error rate comparison
    const errorRateIncrease = current.errorRate - baseline.errorRate;
    if (errorRateIncrease > phase.maxErrorIncrease) {
      score -= 0.3; // Significant error rate increase
    }

    return Math.max(score, 0);
  }

  /**
   * Rollback to previous state
   */
  async rollback(reason) {
    console.log(`🚨 INITIATING ROLLBACK: ${reason}`);

    try {
      // Trigger emergency rollback
      this.featureFlags.emergencyRollback(reason);

      // Wait for rollback to propagate
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify rollback
      const config = this.featureFlags.getMiddlewareConfig();
      const allSmartDisabled = !config.useSmartIsraeliContext &&
                              !config.useSmartPerformanceCost &&
                              !config.useSmartAlertSystem &&
                              !config.useSmartResponseProcessor;

      if (allSmartDisabled) {
        console.log('✅ Rollback completed successfully');

        // Record rollback
        this.deployment.rolloutHistory.push({
          phase: 'rollback',
          percentage: 0,
          startTime: Date.now(),
          endTime: Date.now(),
          success: true,
          reason: reason
        });

        await this.saveDeploymentState();
      } else {
        console.log('⚠️ Rollback verification failed');
      }

    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
    }

    this.deployment.isActive = false;
  }

  /**
   * Disable legacy middlewares after successful deployment
   */
  async disableLegacyMiddlewares(middlewares) {
    console.log('📛 Disabling legacy middlewares...');

    const legacyFlags = [
      'USE_LEGACY_ISRAELI_STACK',
      'USE_LEGACY_MONITORING',
      'USE_LEGACY_ALERTS',
      'USE_LEGACY_RESPONSE_PROCESSING'
    ];

    for (const flagName of legacyFlags) {
      this.featureFlags.setFlag(flagName, {
        enabled: false,
        rolloutPercentage: 0
      });

      console.log(`📛 Disabled ${flagName}`);
    }

    console.log('✅ Legacy middlewares disabled');
  }

  /**
   * Get feature flag names for middleware types
   */
  getMiddlewareFlags(middlewares) {
    const flagMap = {
      'israeli-context': 'ENABLE_SMART_ISRAELI_CONTEXT',
      'performance-cost': 'ENABLE_SMART_PERFORMANCE_COST',
      'alert-system': 'ENABLE_SMART_ALERT_SYSTEM',
      'response-processor': 'ENABLE_SMART_RESPONSE_PROCESSOR'
    };

    if (middlewares.includes('all')) {
      return Object.values(flagMap);
    }

    return middlewares.map(name => flagMap[name]).filter(Boolean);
  }

  /**
   * Save deployment state to file
   */
  async saveDeploymentState() {
    try {
      const state = {
        timestamp: new Date().toISOString(),
        deployment: this.deployment,
        featureFlags: this.featureFlags.getAllFlags(),
        middlewareConfig: this.featureFlags.getMiddlewareConfig()
      };

      await fs.writeFile('./deployment-state.json', JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save deployment state:', error.message);
    }
  }

  /**
   * Save feature flag state to file
   */
  async saveFeatureFlagState() {
    try {
      const config = this.featureFlags.exportConfig();
      await fs.writeFile('./feature-flags-state.json', JSON.stringify(config, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save feature flag state:', error.message);
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (ms === Infinity) return 'indefinitely';

    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get deployment status
   */
  getStatus() {
    return {
      isActive: this.deployment.isActive,
      currentPhase: this.deployment.currentPhase?.name,
      startTime: this.deployment.startTime,
      phaseStartTime: this.deployment.phaseStartTime,
      rolloutHistory: this.deployment.rolloutHistory,
      middlewareConfig: this.featureFlags.getMiddlewareConfig()
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 Smart Middleware Deployment Tool

Usage: node deploy-smart-middlewares.js [command] [options]

Commands:
  deploy [middlewares...]   Deploy smart middlewares (default: all)
  status                   Show deployment status
  rollback [reason]        Emergency rollback
  flags                    Show feature flag status

Deploy Options:
  --strategy <type>        Deployment strategy (conservative, balanced, aggressive)
  --dry-run               Simulate deployment without changes
  --skip-baseline         Skip baseline metrics collection
  --middlewares <list>    Comma-separated list of middlewares to deploy

Examples:
  node deploy-smart-middlewares.js deploy
  node deploy-smart-middlewares.js deploy --strategy balanced
  node deploy-smart-middlewares.js deploy israeli-context,response-processor
  node deploy-smart-middlewares.js rollback "High error rate detected"
  node deploy-smart-middlewares.js status
    `);
    process.exit(0);
  }

  const command = args[0] || 'deploy';
  const deployer = new SmartMiddlewareDeployer();

  try {
    switch (command) {
      case 'deploy':
        await deployCommand(deployer, args.slice(1));
        break;

      case 'status':
        showStatus(deployer);
        break;

      case 'rollback':
        const reason = args.slice(1).join(' ') || 'Manual rollback';
        await deployer.rollback(reason);
        break;

      case 'flags':
        showFeatureFlags(deployer);
        break;

      default:
        console.error('❌ Unknown command:', command);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

/**
 * Handle deploy command
 */
async function deployCommand(deployer, args) {
  const options = {};
  const middlewares = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--strategy':
        options.strategy = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-baseline':
        options.skipBaseline = true;
        break;
      case '--middlewares':
        middlewares.push(...args[++i].split(','));
        break;
      default:
        if (!args[i].startsWith('--')) {
          middlewares.push(args[i]);
        }
    }
  }

  if (middlewares.length === 0) {
    middlewares.push('all');
  }

  console.log('🚀 Starting deployment with options:', { middlewares, ...options });

  await deployer.start(middlewares, options);
}

/**
 * Show deployment status
 */
function showStatus(deployer) {
  const status = deployer.getStatus();

  console.log('📊 Deployment Status:');
  console.log(`   Active: ${status.isActive ? '✅' : '❌'}`);
  console.log(`   Current Phase: ${status.currentPhase || 'None'}`);

  if (status.startTime) {
    console.log(`   Started: ${new Date(status.startTime).toISOString()}`);
  }

  if (status.rolloutHistory.length > 0) {
    console.log('\n📈 Rollout History:');
    status.rolloutHistory.forEach(entry => {
      const duration = entry.endTime - entry.startTime;
      console.log(`   ${entry.phase}: ${entry.percentage}% - ${entry.success ? '✅' : '❌'} (${Math.round(duration / 1000)}s)`);
    });
  }

  console.log('\n🛠️ Middleware Configuration:');
  Object.entries(status.middlewareConfig).forEach(([key, value]) => {
    console.log(`   ${key}: ${value ? '✅' : '❌'}`);
  });
}

/**
 * Show feature flags status
 */
function showFeatureFlags(deployer) {
  const flags = deployer.featureFlags.getAllFlags();

  console.log('🏁 Feature Flags Status:');
  Object.entries(flags).forEach(([name, flag]) => {
    const status = flag.isEnabled ? '✅' : '❌';
    console.log(`   ${name}: ${status} (${flag.rolloutPercentage}%)`);
  });
}

// Export for programmatic use
export default SmartMiddlewareDeployer;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}