#!/usr/bin/env node

/**
 * Legacy Middleware Cleanup Script
 *
 * Safely removes legacy middleware files after smart middlewares have been
 * validated in production. Includes safety checks and rollback capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import featureFlags from '../config/middleware-feature-flags.js';

// Configuration
const CLEANUP_CONFIG = {
  dryRun: process.env.CLEANUP_DRY_RUN === 'true',
  backupDir: './middleware-backup',
  minimumValidationPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  logFile: './cleanup.log',
  checkDeploymentStatus: true
};

// Legacy middleware files to clean up
const LEGACY_MIDDLEWARE_FILES = {
  israeliCompliance: [
    'middleware/israeliComplianceHeaders.js',
    'middleware/israeliTimezoneCompliance.js',
    'middleware/israeliDataResidencyCompliance.js',
    'middleware/israeliPrivacyCompliance.js',
    'middleware/israeliHebrewContentCompliance.js'
  ],
  monitoring: [
    'middleware/israeliPerformanceTracker.js',
    'middleware/israeliS3PerformanceMonitor.js',
    'middleware/israeliHebrewPerformanceTracker.js',
    'middleware/israeliPeakHoursMonitor.js',
    'middleware/israeliPerformanceAlerts.js',
    'middleware/israeliS3CostTracker.js',
    'middleware/israeliBandwidthCostTracker.js',
    'middleware/israeliHebrewContentCostTracker.js',
    'middleware/israeliCostAlerts.js',
    'middleware/israeliRealtimeCostMonitor.js'
  ],
  alerts: [
    'middleware/israeliPerformanceAlertsMonitor.js',
    'middleware/israeliHebrewContentAlertsMonitor.js',
    'middleware/israeliEducationalAlertsMonitor.js',
    'middleware/israeliRealtimeMarketMonitor.js',
    'middleware/israeliSystemHealthMonitor.js'
  ],
  responseProcessing: [
    'middleware/dynamicCors.js',
    'middleware/israeliCompressionMiddleware.js',
    'middleware/hebrewContentCompressionMiddleware.js'
  ],
  services: [
    'services/IsraeliComplianceService.js',
    'services/IsraeliPerformanceMonitoringService.js',
    'services/IsraeliCostOptimizationService.js',
    'services/IsraeliMarketAlertsService.js'
  ],
  tests: [
    'tests/middleware/israeli-compliance.test.js',
    'tests/middleware/israeli-performance.test.js',
    'tests/middleware/israeli-cost.test.js',
    'tests/middleware/israeli-alerts.test.js'
  ]
};

class LegacyCleanupManager {
  constructor(config = CLEANUP_CONFIG) {
    this.config = config;
    this.cleanupLog = [];
    this.backupManifest = [];
  }

  /**
   * Start the cleanup process
   */
  async start(options = {}) {
    const {
      categories = ['all'],
      force = false,
      createBackup = true
    } = options;

    console.log('🧹 Starting Legacy Middleware Cleanup');
    console.log(`📁 Dry run: ${this.config.dryRun ? 'Yes' : 'No'}`);

    try {
      // Safety checks
      if (!force) {
        await this.performSafetyChecks();
      }

      // Create backup if requested
      if (createBackup && !this.config.dryRun) {
        await this.createBackup();
      }

      // Clean up files by category
      await this.cleanupByCategories(categories);

      // Update index.js if needed
      await this.updateIndexFile();

      // Generate cleanup report
      await this.generateCleanupReport();

      console.log('✅ Legacy middleware cleanup completed successfully');

    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      throw error;
    }
  }

  /**
   * Perform safety checks before cleanup
   */
  async performSafetyChecks() {
    console.log('🔍 Performing safety checks...');

    // Check if smart middlewares are enabled and stable
    const config = featureFlags.getMiddlewareConfig();

    const safetyChecks = [
      {
        name: 'Smart Israeli Context enabled',
        check: () => config.useSmartIsraeliContext,
        required: true
      },
      {
        name: 'Smart Performance & Cost enabled',
        check: () => config.useSmartPerformanceCost,
        required: true
      },
      {
        name: 'Smart Alert System enabled',
        check: () => config.useSmartAlertSystem,
        required: true
      },
      {
        name: 'Smart Response Processor enabled',
        check: () => config.useSmartResponseProcessor,
        required: true
      },
      {
        name: 'Legacy middlewares disabled',
        check: () => !config.useLegacyIsraeliStack &&
                    !config.useLegacyMonitoring &&
                    !config.useLegacyAlerts &&
                    !config.useLegacyResponseProcessing,
        required: true
      },
      {
        name: 'Emergency mode disabled',
        check: () => !config.emergencyDisabled,
        required: true
      }
    ];

    // Check deployment status
    if (this.config.checkDeploymentStatus) {
      safetyChecks.push({
        name: 'Deployment validation period met',
        check: async () => {
          const deploymentStatus = await this.getDeploymentStatus();
          if (deploymentStatus?.lastSuccessfulDeployment) {
            const timeSinceDeployment = Date.now() - new Date(deploymentStatus.lastSuccessfulDeployment);
            return timeSinceDeployment >= this.config.minimumValidationPeriod;
          }
          return false;
        },
        required: true
      });
    }

    const results = [];
    for (const check of safetyChecks) {
      try {
        const result = typeof check.check === 'function'
          ? await check.check()
          : check.check;

        results.push({
          name: check.name,
          passed: result,
          required: check.required
        });

        const status = result ? '✅' : '❌';
        console.log(`   ${status} ${check.name}`);

      } catch (error) {
        results.push({
          name: check.name,
          passed: false,
          required: check.required,
          error: error.message
        });

        console.log(`   ❌ ${check.name} (Error: ${error.message})`);
      }
    }

    // Check if any required checks failed
    const failedRequired = results.filter(r => r.required && !r.passed);

    if (failedRequired.length > 0) {
      throw new Error(`Safety checks failed: ${failedRequired.map(r => r.name).join(', ')}`);
    }

    console.log('✅ All safety checks passed');
  }

  /**
   * Create backup of files before deletion
   */
  async createBackup() {
    console.log('📦 Creating backup of legacy files...');

    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.config.backupDir, `backup-${backupTimestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    const allFiles = Object.values(LEGACY_MIDDLEWARE_FILES).flat();

    for (const filePath of allFiles) {
      try {
        const fullPath = path.resolve(filePath);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          const backupFilePath = path.join(backupPath, filePath);
          const backupDir = path.dirname(backupFilePath);

          await fs.mkdir(backupDir, { recursive: true });
          await fs.copyFile(fullPath, backupFilePath);

          this.backupManifest.push({
            original: fullPath,
            backup: backupFilePath,
            size: stats.size,
            modified: stats.mtime
          });

          console.log(`   📁 Backed up ${filePath}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`   ⚠️ Failed to backup ${filePath}: ${error.message}`);
        }
      }
    }

    // Save backup manifest
    const manifestPath = path.join(backupPath, 'backup-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      backupPath: backupPath,
      files: this.backupManifest,
      smartMiddlewareVersions: this.getSmartMiddlewareVersions()
    }, null, 2));

    console.log(`✅ Backup created at: ${backupPath}`);
  }

  /**
   * Clean up files by categories
   */
  async cleanupByCategories(categories) {
    console.log('🗑️ Starting file cleanup...');

    const categoriesToProcess = categories.includes('all')
      ? Object.keys(LEGACY_MIDDLEWARE_FILES)
      : categories;

    for (const category of categoriesToProcess) {
      if (!LEGACY_MIDDLEWARE_FILES[category]) {
        console.warn(`⚠️ Unknown category: ${category}`);
        continue;
      }

      console.log(`\n📂 Cleaning up ${category} middleware files...`);

      const files = LEGACY_MIDDLEWARE_FILES[category];
      let cleanedCount = 0;
      let skipCount = 0;

      for (const filePath of files) {
        try {
          const fullPath = path.resolve(filePath);

          if (this.config.dryRun) {
            console.log(`   🧪 DRY RUN: Would delete ${filePath}`);
            cleanedCount++;
          } else {
            await fs.access(fullPath);
            await fs.unlink(fullPath);

            this.cleanupLog.push({
              file: filePath,
              action: 'deleted',
              timestamp: new Date().toISOString()
            });

            console.log(`   ✅ Deleted ${filePath}`);
            cleanedCount++;
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            console.log(`   📝 File not found (already cleaned): ${filePath}`);
            skipCount++;
          } else {
            console.warn(`   ⚠️ Failed to delete ${filePath}: ${error.message}`);

            this.cleanupLog.push({
              file: filePath,
              action: 'failed',
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      console.log(`   📊 Category ${category}: ${cleanedCount} cleaned, ${skipCount} already missing`);
    }
  }

  /**
   * Update index.js to remove legacy middleware imports
   */
  async updateIndexFile() {
    console.log('📝 Updating index.js file...');

    const indexPath = './index.js';

    try {
      const content = await fs.readFile(indexPath, 'utf8');

      // Legacy import patterns to remove
      const legacyPatterns = [
        /import.*israeliCompliance.*from.*['"].*middleware\/.*['"];?\n?/g,
        /import.*israeliPerformance.*from.*['"].*middleware\/.*['"];?\n?/g,
        /import.*israeliCost.*from.*['"].*middleware\/.*['"];?\n?/g,
        /import.*israeliAlerts.*from.*['"].*middleware\/.*['"];?\n?/g,
        /import.*dynamicCors.*from.*['"].*middleware\/.*['"];?\n?/g,
        /import.*israeliCompression.*from.*['"].*middleware\/.*['"];?\n?/g,
        /\/\/ Legacy middleware.*\n(.*app\.use.*\n)*/g,
        /app\.use\(israeliCompliance.*\);?\n?/g,
        /app\.use\(israeliPerformance.*\);?\n?/g,
        /app\.use\(israeliCost.*\);?\n?/g,
        /app\.use\(israeliAlerts.*\);?\n?/g,
        /app\.use\(dynamicCors.*\);?\n?/g,
        /app\.use\(israeliCompression.*\);?\n?/g
      ];

      let updatedContent = content;
      let changesMade = false;

      for (const pattern of legacyPatterns) {
        const before = updatedContent;
        updatedContent = updatedContent.replace(pattern, '');
        if (before !== updatedContent) {
          changesMade = true;
        }
      }

      if (changesMade) {
        if (this.config.dryRun) {
          console.log('   🧪 DRY RUN: Would update index.js to remove legacy middleware imports');
        } else {
          await fs.writeFile(indexPath, updatedContent);
          console.log('   ✅ Updated index.js to remove legacy middleware imports');

          this.cleanupLog.push({
            file: indexPath,
            action: 'updated',
            description: 'Removed legacy middleware imports',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('   📝 No legacy middleware imports found in index.js');
      }

    } catch (error) {
      console.warn(`   ⚠️ Failed to update index.js: ${error.message}`);
    }
  }

  /**
   * Generate cleanup report
   */
  async generateCleanupReport() {
    const report = {
      timestamp: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: {
        totalFiles: this.cleanupLog.length,
        deleted: this.cleanupLog.filter(l => l.action === 'deleted').length,
        failed: this.cleanupLog.filter(l => l.action === 'failed').length,
        updated: this.cleanupLog.filter(l => l.action === 'updated').length
      },
      backupManifest: this.backupManifest,
      cleanupLog: this.cleanupLog,
      smartMiddlewareStatus: featureFlags.getMiddlewareConfig(),
      featureFlags: featureFlags.getAllFlags()
    };

    const reportPath = `./cleanup-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    if (!this.config.dryRun) {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }

    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   Total files processed: ${report.summary.totalFiles}`);
    console.log(`   Successfully deleted: ${report.summary.deleted}`);
    console.log(`   Failed to delete: ${report.summary.failed}`);
    console.log(`   Files updated: ${report.summary.updated}`);
    console.log(`   Backup files created: ${this.backupManifest.length}`);

    if (!this.config.dryRun) {
      console.log(`   Report saved to: ${reportPath}`);
    }

    return report;
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus() {
    try {
      const data = await fs.readFile('./deployment-state.json', 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get smart middleware versions/hashes
   */
  getSmartMiddlewareVersions() {
    // This would return actual version info in production
    return {
      smartIsraeliContext: 'v1.0.0',
      smartPerformanceCost: 'v1.0.0',
      smartAlertSystem: 'v1.0.0',
      smartResponseProcessor: 'v1.0.0'
    };
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath) {
    console.log(`🔄 Restoring from backup: ${backupPath}`);

    const manifestPath = path.join(backupPath, 'backup-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    for (const file of manifest.files) {
      try {
        const targetDir = path.dirname(file.original);
        await fs.mkdir(targetDir, { recursive: true });
        await fs.copyFile(file.backup, file.original);

        console.log(`   ✅ Restored ${file.original}`);
      } catch (error) {
        console.error(`   ❌ Failed to restore ${file.original}: ${error.message}`);
      }
    }

    console.log('✅ Backup restoration completed');
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backupDirs = await fs.readdir(this.config.backupDir);
      const backups = [];

      for (const dir of backupDirs) {
        if (dir.startsWith('backup-')) {
          const manifestPath = path.join(this.config.backupDir, dir, 'backup-manifest.json');
          try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            backups.push({
              path: path.join(this.config.backupDir, dir),
              timestamp: manifest.timestamp,
              fileCount: manifest.files.length,
              smartMiddlewareVersions: manifest.smartMiddlewareVersions
            });
          } catch (error) {
            console.warn(`⚠️ Invalid backup manifest in ${dir}`);
          }
        }
      }

      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      return [];
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧹 Legacy Middleware Cleanup Tool

Usage: node cleanup-legacy-middlewares.js [command] [options]

Commands:
  cleanup [categories...]    Clean up legacy middleware files (default)
  list-backups              List available backups
  restore <backup-path>     Restore from backup

Cleanup Options:
  --dry-run                 Simulate cleanup without deleting files
  --force                   Skip safety checks
  --no-backup              Don't create backup before cleanup
  --categories <list>       Comma-separated categories to clean

Categories:
  israeliCompliance         Israeli compliance middleware files
  monitoring               Performance and cost monitoring files
  alerts                   Alert system files
  responseProcessing       Response processing files
  services                 Related service files
  tests                    Test files
  all                      All categories (default)

Examples:
  node cleanup-legacy-middlewares.js cleanup --dry-run
  node cleanup-legacy-middlewares.js cleanup israeliCompliance,monitoring
  node cleanup-legacy-middlewares.js cleanup --force --no-backup
  node cleanup-legacy-middlewares.js list-backups
  node cleanup-legacy-middlewares.js restore ./middleware-backup/backup-2024-01-15
    `);
    process.exit(0);
  }

  const command = args[0] || 'cleanup';
  const manager = new LegacyCleanupManager();

  try {
    switch (command) {
      case 'cleanup':
        await cleanupCommand(manager, args.slice(1));
        break;

      case 'list-backups':
        await listBackupsCommand(manager);
        break;

      case 'restore':
        if (args.length < 2) {
          throw new Error('Backup path required for restore command');
        }
        await manager.restoreFromBackup(args[1]);
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
 * Handle cleanup command
 */
async function cleanupCommand(manager, args) {
  const options = {
    categories: ['all'],
    force: false,
    createBackup: true
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        manager.config.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--no-backup':
        options.createBackup = false;
        break;
      case '--categories':
        if (args[i + 1]) {
          options.categories = args[++i].split(',').map(c => c.trim());
        }
        break;
      default:
        if (!args[i].startsWith('--')) {
          options.categories = args[i].split(',').map(c => c.trim());
        }
    }
  }

  console.log('🧹 Starting cleanup with options:', options);

  await manager.start(options);
}

/**
 * Handle list-backups command
 */
async function listBackupsCommand(manager) {
  const backups = await manager.listBackups();

  if (backups.length === 0) {
    console.log('📦 No backups found');
    return;
  }

  console.log('📦 Available backups:');
  backups.forEach((backup, index) => {
    console.log(`   ${index + 1}. ${backup.path}`);
    console.log(`      Timestamp: ${backup.timestamp}`);
    console.log(`      Files: ${backup.fileCount}`);
    console.log(`      Smart Middleware Versions:`, backup.smartMiddlewareVersions);
    console.log();
  });
}

// Export for programmatic use
export default LegacyCleanupManager;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}