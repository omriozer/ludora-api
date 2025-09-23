import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.join(__dirname, '..', 'test.env') });

export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');
  
  // Set global test flag
  global.__TEST_ENV__ = true;
  
  // Skip database setup if SKIP_DB_SETUP is true
  if (process.env.SKIP_DB_SETUP === 'true') {
    console.log('⚠️  Skipping database setup (SKIP_DB_SETUP=true)');
    console.log('✅ Test environment setup complete (no database)');
    return;
  }
  
  try {
    // Create test database connection
    const sequelize = new Sequelize(
      process.env.DB_NAME || 'ludora_test',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
      }
    );

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Test database connection established');

    // Create test database if it doesn't exist
    const [results] = await sequelize.query(`
      SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'ludora_test'}'
    `);
    
    if (results.length === 0) {
      await sequelize.query(`CREATE DATABASE "${process.env.DB_NAME || 'ludora_test'}"`);
      console.log('✅ Test database created');
    }

    await sequelize.close();
    
    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running and accessible');
    console.log('💡 Or set SKIP_DB_SETUP=true for unit tests only');
    process.exit(1);
  }
}