/**
 * Feature Flag Configuration for Smart Middleware Deployment
 *
 * Controls the rollout of smart middlewares with gradual deployment,
 * rollback capabilities, and environment-specific settings.
 */

// Feature flag defaults
const DEFAULT_FLAGS = {
  // Smart middleware enables
  ENABLE_SMART_ISRAELI_CONTEXT: {
    enabled: false,
    rolloutPercentage: 0, // 0-100
    environments: ['development'], // enabled environments
    description: 'Smart Israeli Context Middleware - replaces 5 compliance middlewares'
  },

  ENABLE_SMART_PERFORMANCE_COST: {
    enabled: false,
    rolloutPercentage: 0,
    environments: ['development'],
    description: 'Smart Performance & Cost Tracker - replaces 10 monitoring middlewares'
  },

  ENABLE_SMART_ALERT_SYSTEM: {
    enabled: false,
    rolloutPercentage: 0,
    environments: ['development'],
    description: 'Smart Alert System - replaces 5 alert middlewares'
  },

  ENABLE_SMART_RESPONSE_PROCESSOR: {
    enabled: false,
    rolloutPercentage: 0,
    environments: ['development'],
    description: 'Smart Response Processor - replaces 4 response middlewares'
  },

  // Legacy middleware controls
  USE_LEGACY_ISRAELI_STACK: {
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    description: 'Use legacy Israeli middleware stack - disable as smart middlewares are enabled'
  },

  USE_LEGACY_MONITORING: {
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    description: 'Use legacy monitoring middlewares'
  },

  USE_LEGACY_ALERTS: {
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    description: 'Use legacy alert middlewares'
  },

  USE_LEGACY_RESPONSE_PROCESSING: {
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    description: 'Use legacy response processing middlewares'
  },

  // Gradual rollout control
  MIDDLEWARE_ROLLOUT_STRATEGY: {
    enabled: true,
    value: 'conservative', // conservative, balanced, aggressive
    environments: ['development', 'staging', 'production'],
    description: 'Strategy for rolling out smart middlewares'
  },

  // Emergency controls
  EMERGENCY_DISABLE_OPTIMIZATIONS: {
    enabled: false,
    rolloutPercentage: 0,
    environments: ['development', 'staging', 'production'],
    description: 'Emergency switch to disable all optimization middlewares'
  },

  // Performance monitoring
  ENABLE_PERFORMANCE_METRICS: {
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    description: 'Enable performance metrics collection for middleware optimization'
  },

  ENABLE_DETAILED_MONITORING: {
    enabled: false,
    rolloutPercentage: 0,
    environments: ['development'],
    description: 'Enable detailed monitoring and debugging headers'
  }
};

// Rollout strategy configurations
const ROLLOUT_STRATEGIES = {
  conservative: {
    phases: [
      { name: 'canary', percentage: 5, duration: '24h' },
      { name: 'limited', percentage: 25, duration: '48h' },
      { name: 'majority', percentage: 75, duration: '48h' },
      { name: 'full', percentage: 100, duration: '∞' }
    ],
    rollbackThresholds: {
      errorRate: 1, // 1% error rate triggers rollback
      responseTime: 1.5, // 1.5x response time increase triggers rollback
      memoryUsage: 1.3 // 1.3x memory usage triggers rollback
    }
  },
  balanced: {
    phases: [
      { name: 'canary', percentage: 10, duration: '12h' },
      { name: 'limited', percentage: 50, duration: '24h' },
      { name: 'full', percentage: 100, duration: '∞' }
    ],
    rollbackThresholds: {
      errorRate: 2,
      responseTime: 2,
      memoryUsage: 1.5
    }
  },
  aggressive: {
    phases: [
      { name: 'limited', percentage: 25, duration: '6h' },
      { name: 'full', percentage: 100, duration: '∞' }
    ],
    rollbackThresholds: {
      errorRate: 3,
      responseTime: 2.5,
      memoryUsage: 2
    }
  }
};

class FeatureFlagManager {
  constructor(overrides = {}) {
    this.flags = { ...DEFAULT_FLAGS, ...overrides };
    this.environment = process.env.NODE_ENV || 'development';
    this.instanceId = this.generateInstanceId();
    this.rolloutStrategy = ROLLOUT_STRATEGIES[this.getFlag('MIDDLEWARE_ROLLOUT_STRATEGY').value] || ROLLOUT_STRATEGIES.conservative;
  }

  /**
   * Check if a feature flag is enabled for the current environment and instance
   */
  isEnabled(flagName) {
    const flag = this.flags[flagName];

    if (!flag) {
      console.warn(`⚠️ Unknown feature flag: ${flagName}`);
      return false;
    }

    // Check emergency disable
    if (this.isEnabled('EMERGENCY_DISABLE_OPTIMIZATIONS') && flagName.startsWith('ENABLE_SMART_')) {
      return false;
    }

    // Check environment
    if (!flag.environments.includes(this.environment)) {
      return false;
    }

    // Check enabled state
    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const instanceHash = this.hashInstanceId(this.instanceId);
      const instancePercentile = instanceHash % 100;
      return instancePercentile < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get feature flag details
   */
  getFlag(flagName) {
    return this.flags[flagName] || null;
  }

  /**
   * Set feature flag (for dynamic updates)
   */
  setFlag(flagName, updates) {
    if (this.flags[flagName]) {
      this.flags[flagName] = { ...this.flags[flagName], ...updates };
      console.log(`🏁 Feature flag updated: ${flagName}`, updates);
    }
  }

  /**
   * Get middleware configuration based on feature flags
   */
  getMiddlewareConfig() {
    return {
      // Smart middleware enables
      useSmartIsraeliContext: this.isEnabled('ENABLE_SMART_ISRAELI_CONTEXT'),
      useSmartPerformanceCost: this.isEnabled('ENABLE_SMART_PERFORMANCE_COST'),
      useSmartAlertSystem: this.isEnabled('ENABLE_SMART_ALERT_SYSTEM'),
      useSmartResponseProcessor: this.isEnabled('ENABLE_SMART_RESPONSE_PROCESSOR'),

      // Legacy middleware enables
      useLegacyIsraeliStack: this.isEnabled('USE_LEGACY_ISRAELI_STACK'),
      useLegacyMonitoring: this.isEnabled('USE_LEGACY_MONITORING'),
      useLegacyAlerts: this.isEnabled('USE_LEGACY_ALERTS'),
      useLegacyResponseProcessing: this.isEnabled('USE_LEGACY_RESPONSE_PROCESSING'),

      // Monitoring
      enablePerformanceMetrics: this.isEnabled('ENABLE_PERFORMANCE_METRICS'),
      enableDetailedMonitoring: this.isEnabled('ENABLE_DETAILED_MONITORING'),

      // Strategy
      rolloutStrategy: this.getFlag('MIDDLEWARE_ROLLOUT_STRATEGY').value,
      emergencyDisabled: this.isEnabled('EMERGENCY_DISABLE_OPTIMIZATIONS')
    };
  }

  /**
   * Check if we should use hybrid mode (both smart and legacy)
   */
  shouldUseHybridMode(smartFlag, legacyFlag) {
    const smartEnabled = this.isEnabled(smartFlag);
    const legacyEnabled = this.isEnabled(legacyFlag);

    // Hybrid mode when both are enabled (for gradual migration)
    return smartEnabled && legacyEnabled;
  }

  /**
   * Get rollout phase for a flag
   */
  getCurrentRolloutPhase(flagName) {
    const flag = this.getFlag(flagName);
    if (!flag) return null;

    const percentage = flag.rolloutPercentage;

    for (const phase of this.rolloutStrategy.phases) {
      if (percentage <= phase.percentage) {
        return phase;
      }
    }

    return this.rolloutStrategy.phases[this.rolloutStrategy.phases.length - 1];
  }

  /**
   * Generate instance ID for consistent rollout
   */
  generateInstanceId() {
    // Use hostname + process ID for consistency
    const os = require('os');
    return `${os.hostname()}-${process.pid}`;
  }

  /**
   * Hash instance ID for rollout percentage
   */
  hashInstanceId(instanceId) {
    let hash = 0;
    for (let i = 0; i < instanceId.length; i++) {
      const char = instanceId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all flags status
   */
  getAllFlags() {
    const status = {};

    Object.keys(this.flags).forEach(flagName => {
      status[flagName] = {
        ...this.flags[flagName],
        isEnabled: this.isEnabled(flagName),
        currentPhase: this.getCurrentRolloutPhase(flagName)
      };
    });

    return status;
  }

  /**
   * Load flags from environment variables
   */
  loadFromEnvironment() {
    Object.keys(this.flags).forEach(flagName => {
      // Check for environment variable override
      const envVar = `FF_${flagName}`;
      const envValue = process.env[envVar];

      if (envValue !== undefined) {
        try {
          if (envValue === 'true' || envValue === 'false') {
            this.flags[flagName].enabled = envValue === 'true';
          } else if (!isNaN(envValue)) {
            this.flags[flagName].rolloutPercentage = parseInt(envValue);
          } else {
            // Try to parse as JSON for complex values
            const parsed = JSON.parse(envValue);
            this.flags[flagName] = { ...this.flags[flagName], ...parsed };
          }

          console.log(`🏁 Feature flag loaded from env: ${flagName} = ${envValue}`);
        } catch (error) {
          console.warn(`⚠️ Invalid environment value for ${envVar}: ${envValue}`);
        }
      }
    });
  }

  /**
   * Emergency rollback - disable all smart middlewares
   */
  emergencyRollback(reason = 'Emergency rollback triggered') {
    console.log(`🚨 EMERGENCY ROLLBACK: ${reason}`);

    // Disable all smart middlewares
    this.setFlag('ENABLE_SMART_ISRAELI_CONTEXT', { enabled: false });
    this.setFlag('ENABLE_SMART_PERFORMANCE_COST', { enabled: false });
    this.setFlag('ENABLE_SMART_ALERT_SYSTEM', { enabled: false });
    this.setFlag('ENABLE_SMART_RESPONSE_PROCESSOR', { enabled: false });

    // Enable all legacy middlewares
    this.setFlag('USE_LEGACY_ISRAELI_STACK', { enabled: true, rolloutPercentage: 100 });
    this.setFlag('USE_LEGACY_MONITORING', { enabled: true, rolloutPercentage: 100 });
    this.setFlag('USE_LEGACY_ALERTS', { enabled: true, rolloutPercentage: 100 });
    this.setFlag('USE_LEGACY_RESPONSE_PROCESSING', { enabled: true, rolloutPercentage: 100 });

    // Set emergency flag
    this.setFlag('EMERGENCY_DISABLE_OPTIMIZATIONS', { enabled: true, rolloutPercentage: 100 });

    console.log('✅ Emergency rollback completed');
  }

  /**
   * Gradual rollout helper
   */
  async startGradualRollout(flagName, options = {}) {
    const {
      startPercentage = 5,
      endPercentage = 100,
      incrementPercentage = 25,
      intervalMinutes = 60,
      enableMonitoring = true
    } = options;

    console.log(`🎯 Starting gradual rollout for ${flagName}`);
    console.log(`   From ${startPercentage}% to ${endPercentage}% in ${incrementPercentage}% increments`);

    let currentPercentage = startPercentage;

    const rolloutInterval = setInterval(() => {
      if (currentPercentage >= endPercentage) {
        clearInterval(rolloutInterval);
        console.log(`✅ Gradual rollout completed for ${flagName} at ${endPercentage}%`);
        return;
      }

      currentPercentage = Math.min(currentPercentage + incrementPercentage, endPercentage);

      this.setFlag(flagName, {
        enabled: true,
        rolloutPercentage: currentPercentage
      });

      console.log(`📈 Rollout progress for ${flagName}: ${currentPercentage}%`);

    }, intervalMinutes * 60 * 1000);

    // Initial setting
    this.setFlag(flagName, {
      enabled: true,
      rolloutPercentage: startPercentage
    });

    return rolloutInterval;
  }

  /**
   * Export configuration for external monitoring
   */
  exportConfig() {
    return {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      instanceId: this.instanceId,
      flags: this.getAllFlags(),
      middlewareConfig: this.getMiddlewareConfig(),
      rolloutStrategy: this.rolloutStrategy
    };
  }
}

// Create singleton instance
const featureFlags = new FeatureFlagManager();

// Load from environment on startup
featureFlags.loadFromEnvironment();

// Export both the instance and class
export default featureFlags;
export { FeatureFlagManager, ROLLOUT_STRATEGIES, DEFAULT_FLAGS };