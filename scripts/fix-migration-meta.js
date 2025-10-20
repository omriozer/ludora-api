import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

// Database configuration for production
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

async function fixMigrationMeta() {
  try {
    console.log('🔗 Connecting to production database...');
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