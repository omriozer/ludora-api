import { readFile } from 'fs/promises';
import { join } from 'path';
import models from '../models/index.js';

class DatabaseInitService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('✅ Database already initialized');
      return;
    }

    try {
      console.log('🔧 Checking database initialization...');

      // Test database connection
      await models.sequelize.authenticate();
      console.log('✅ Database connection successful');

      // Check if database has tables
      const tableCount = await this.getTableCount();
      console.log(`📊 Found ${tableCount} tables in database`);

      if (tableCount === 0) {
        console.log('🏗️  Database appears empty, initializing schema...');
        await this.initializeSchema();
      } else if (tableCount < 10) {
        console.log('⚠️  Database has some tables but seems incomplete, checking schema...');
        await this.validateAndFixSchema();
      } else {
        console.log('✅ Database schema appears complete');
      }

      // Run seeders if needed
      await this.runSeedersIfNeeded();

      this.initialized = true;
      console.log('✅ Database initialization complete');

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
      console.log('📋 Reading schema file...');
      const schemaPath = join(process.cwd(), 'scripts', 'create-schema.sql');
      const schemaSQL = await readFile(schemaPath, 'utf8');

      console.log('🏗️  Executing schema creation...');
      await models.sequelize.query(schemaSQL);

      console.log('✅ Schema creation completed');
    } catch (error) {
      console.error('❌ Schema creation failed:', error);
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
        console.log('🏗️  Re-initializing schema...');
        await this.initializeSchema();
      } else {
        console.log('✅ Critical tables exist');
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
      } else {
        console.log('✅ Settings exist, skipping seeders');
      }
    } catch (error) {
      console.error('❌ Seeder check failed:', error);
      // Don't fail the entire initialization for seeder errors
    }
  }
}

export default new DatabaseInitService();