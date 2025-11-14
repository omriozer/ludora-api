import { readFile } from 'fs/promises';
import { join } from 'path';
import models from '../models/index.js';

class DatabaseInitService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Test database connection
      await models.sequelize.authenticate();

      // Check if database has tables
      const tableCount = await this.getTableCount();

      if (tableCount === 0) {
        await this.initializeSchema();
      } else if (tableCount < 10) {
        await this.validateAndFixSchema();
      }

      // Run seeders if needed
      await this.runSeedersIfNeeded();

      this.initialized = true;

    } catch (error) {
      throw error;
    }
  }

  async getTableCount() {
    try {
      const [results] = await models.sequelize.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != 'SequelizeMeta'
      `);
      return parseInt(results[0].table_count);
    } catch (error) {
      return 0;
    }
  }

  async initializeSchema() {
    try {
      const schemaPath = join(process.cwd(), 'scripts', 'create-schema.sql');

      try {
        const schemaSQL = await readFile(schemaPath, 'utf8');

        // Check if this is a complex pg_dump file that can't be executed by Sequelize
        if (schemaSQL.includes('\\connect') || schemaSQL.includes('\\restrict') || schemaSQL.includes('pg_dump')) {
          await this.createTablesFromModels();
          return;
        }

        await models.sequelize.query(schemaSQL);

      } catch (fileError) {
        await this.createTablesFromModels();
      }
    } catch (error) {
      throw error;
    }
  }

  async createTablesFromModels() {
    try {
      // Force sync all models to create tables
      await models.sequelize.sync({ force: false, alter: false });
    } catch (error) {
      throw error;
    }
  }

  async validateAndFixSchema() {
    try {
      // Check for critical tables
      const criticalTables = ['user', 'settings', 'file'];
      const missingTables = [];

      for (const tableName of criticalTables) {
        const exists = await this.tableExists(tableName);
        if (!exists) {
          missingTables.push(tableName);
        }
      }

      if (missingTables.length > 0) {
        // Use Sequelize sync instead of the problematic schema file
        await this.createTablesFromModels();
      }
    } catch (error) {
      throw error;
    }
  }

  async tableExists(tableName) {
    try {
      const [results] = await models.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${tableName}'
        )
      `);
      return results[0].exists;
    } catch (error) {
      return false;
    }
  }

  async runSeedersIfNeeded() {
    try {
      // Check if settings table has data
      const settingsCount = await models.Settings.count();

      if (settingsCount === 0) {
        // Import and run seeders
        const seeders = [
          '../seeders/20240101000000-default-settings.cjs',
          '../seeders/20240101000001-users.cjs'
        ];

        for (const seederPath of seeders) {
          try {
            const seeder = await import(seederPath);

            if (seeder.default && seeder.default.up) {
              await seeder.default.up(models.sequelize.getQueryInterface(), models.Sequelize);
            }
          } catch (seederError) {
            // Don't fail the entire initialization for seeder errors
          }
        }
      }
    } catch (error) {
      // Don't fail the entire initialization for seeder errors
    }
  }
}

export default new DatabaseInitService();