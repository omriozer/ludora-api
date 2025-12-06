#!/usr/bin/env node

/**
 * Migration Health Check Script
 *
 * Provides detailed migration status for monitoring and CI/CD validation
 * Can be integrated into health check endpoints
 */

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class MigrationHealthChecker {
  constructor() {
    this.environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  }

  async checkMigrationStatus() {
    try {
      const { stdout, stderr } = await execAsync('npx sequelize-cli db:migrate:status', {
        env: { ...process.env, NODE_ENV: this.environment }
      });

      // Parse migration status
      const lines = stdout.split('\n').filter(line => line.trim());
      const upMigrations = lines.filter(line => line.includes('up ')).map(line => {
        const match = line.match(/up\s+(.+)/);
        return match ? match[1].trim() : line.trim();
      });
      const downMigrations = lines.filter(line => line.includes('down ')).map(line => {
        const match = line.match(/down\s+(.+)/);
        return match ? match[1].trim() : line.trim();
      });

      return {
        healthy: downMigrations.length === 0,
        status: downMigrations.length === 0 ? 'up_to_date' : 'pending_migrations',
        appliedMigrations: {
          count: upMigrations.length,
          list: upMigrations
        },
        pendingMigrations: {
          count: downMigrations.length,
          list: downMigrations
        },
        environment: this.environment,
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        error: error.message,
        environment: this.environment,
        lastCheck: new Date().toISOString()
      };
    }
  }

  async checkDatabaseConnection() {
    try {
      // Simple connection test
      const { stdout } = await execAsync(
        'node -e "const models = require(\'./models\'); models.sequelize.authenticate().then(() => console.log(\'OK\')).catch(e => { console.error(e.message); process.exit(1); })"',
        { env: { ...process.env, NODE_ENV: this.environment } }
      );

      return {
        healthy: stdout.includes('OK'),
        status: 'connected'
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'connection_failed',
        error: error.message
      };
    }
  }

  async generateHealthReport() {
    const [migrationStatus, dbConnection] = await Promise.all([
      this.checkMigrationStatus(),
      this.checkDatabaseConnection()
    ]);

    const overallHealth = migrationStatus.healthy && dbConnection.healthy;

    return {
      healthy: overallHealth,
      status: overallHealth ? 'healthy' : 'unhealthy',
      database: dbConnection,
      migrations: migrationStatus,
      environment: this.environment,
      timestamp: new Date().toISOString()
    };
  }

  async run() {
    const report = await this.generateHealthReport();

    // Output for command line usage
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(report.healthy ? 0 : 1);
  }
}

// For use in other modules
module.exports = MigrationHealthChecker;

// Run if called directly
if (require.main === module) {
  const checker = new MigrationHealthChecker();
  checker.run();
}