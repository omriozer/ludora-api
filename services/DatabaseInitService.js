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

      console.log(`📊 Found ${tableCount} tables in database`);

      if (tableCount === 0) {
        console.log('🏗️ Empty database detected, initializing schema...');
        await this.initializeSchema();
      } else if (tableCount < 10) {
        console.log('⚠️ Incomplete database detected, validating schema...');
        await this.validateAndFixSchema();
      } else {
        console.log('✅ Database appears to be properly populated, skipping schema initialization');
      }

      // Run seeders if needed
      await this.runSeedersIfNeeded();

      this.initialized = true;
      console.log('✅ Database initialization completed successfully');

    } catch (error) {
      console.error('❌ Database initialization failed:', error);
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
      console.error('Error counting tables:', error);
      return 0;
    }
  }

  async initializeSchema() {
    try {
      console.log('📋 Checking if schema file exists...');
      const schemaPath = join(process.cwd(), 'scripts', 'create-schema.sql');

      try {
        const schemaSQL = await readFile(schemaPath, 'utf8');

        // Check if this is a complex pg_dump file that can't be executed by Sequelize
        if (schemaSQL.includes('\\connect') || schemaSQL.includes('\\restrict') || schemaSQL.includes('pg_dump')) {
          console.log('⚠️ Schema file contains PostgreSQL-specific commands that cannot be executed via Sequelize');
          console.log('💡 Using Sequelize models to create tables instead...');
          await this.createTablesFromModels();
          return;
        }

        console.log('🏗️  Executing schema creation from SQL file...');
        await models.sequelize.query(schemaSQL);
        console.log('✅ Schema creation from SQL completed');

      } catch (fileError) {
        console.log('📄 Schema file not found, using Sequelize models to create tables...');
        await this.createTablesFromModels();
      }
    } catch (error) {
      console.error('❌ Schema creation failed:', error);
      throw error;
    }
  }

  async createTablesFromModels() {
    try {
      console.log('🏗️  Creating tables from Sequelize models...');

      // Force sync all models to create tables
      await models.sequelize.sync({ force: false, alter: false });

      console.log('✅ Tables created from models successfully');
    } catch (error) {
      console.error('❌ Model sync failed:', error);
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
        console.log(`⚠️  Missing critical tables: ${missingTables.join(', ')}`);
        console.log('🏗️  Using Sequelize models to create missing tables...');
        // Use Sequelize sync instead of the problematic schema file
        await this.createTablesFromModels();
      } else {
        console.log('✅ Critical tables exist, database validation passed');
      }
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
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
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  async runSeedersIfNeeded() {
    try {
      // Check if settings table has data
      const settingsCount = await models.Settings.count();

      if (settingsCount === 0) {
        console.log('🌱 No settings found, running seeders...');

        // Import and run seeders
        const seeders = [
          '../seeders/20240101000000-default-settings.cjs',
          '../seeders/20240101000001-users.cjs'
        ];

        for (const seederPath of seeders) {
          try {
            console.log(`🌱 Running seeder: ${seederPath}`);
            const seeder = await import(seederPath);

            if (seeder.default && seeder.default.up) {
              await seeder.default.up(models.sequelize.getQueryInterface(), models.Sequelize);
              console.log(`✅ Seeder completed: ${seederPath}`);
            }
          } catch (seederError) {
            console.error(`❌ Seeder failed: ${seederPath}`, seederError);
            // Don't fail the entire initialization for seeder errors
          }
        }
      }
    } catch (error) {
      console.error('❌ Seeder check failed:', error);
      // Don't fail the entire initialization for seeder errors
    }
  }
}

export default new DatabaseInitService();