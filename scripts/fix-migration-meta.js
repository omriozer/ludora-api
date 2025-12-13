import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load development environment
dotenv.config({ path: '.env.development' });

// Database configuration for development (and fallback for production)
let sequelize;
if (process.env.DATABASE_URL) {
  // Production or staging with DATABASE_URL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Development with individual settings
  sequelize = new Sequelize({
    database: process.env.DB_NAME || 'ludora_development',
    username: process.env.DB_USER || 'ludora_user',
    password: process.env.DB_PASSWORD || 'ludora_pass',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

async function fixMigrationMeta() {
  const env = process.env.DATABASE_URL ? 'production/staging' : 'development';
  try {
    console.log(`🔗 Connecting to ${env} database...`);
    await sequelize.authenticate();
    console.log('✅ Connection successful');

    // Check if the problematic migration exists in SequelizeMeta
    const [results] = await sequelize.query(
      "SELECT * FROM \"SequelizeMeta\" WHERE name = '20251019000000-add-original-curriculum-id.cjs'"
    );

    if (results.length > 0) {
      console.log('🔍 Found problematic migration in SequelizeMeta table');

      // Remove the problematic migration record
      await sequelize.query(
        "DELETE FROM \"SequelizeMeta\" WHERE name = '20251019000000-add-original-curriculum-id.cjs'"
      );

      console.log('🗑️  Removed problematic migration record from SequelizeMeta');
    } else {
      console.log('ℹ️  No problematic migration found in SequelizeMeta');
    }

    // Show current migration status
    const [allMigrations] = await sequelize.query(
      "SELECT name FROM \"SequelizeMeta\" ORDER BY name"
    );

    console.log('📋 Current migrations in SequelizeMeta:');
    allMigrations.forEach(migration => {
      console.log(`   - ${migration.name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
    console.log('🔒 Database connection closed');
  }
}

fixMigrationMeta();