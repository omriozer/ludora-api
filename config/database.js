import dotenv from 'dotenv';
import { isProd, getEnv } from '../src/utils/environment.js';

// Load environment-specific .env file
const env = getEnv();
const envFile = isProd() ? '.env' : `.env.${env}`;
dotenv.config({ path: envFile });

export default {
  development: {
    username: process.env.DB_USER || 'ludora_user',
    password: process.env.DB_PASSWORD || 'ludora_dev_pass',
    database: process.env.DB_NAME || 'ludora_development',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Disabled SQL logging for cleaner console output
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  staging: process.env.DATABASE_URL_SSL ? {
    use_env_variable: 'DATABASE_URL_SSL',
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  } : {
    username: process.env.DB_USER || 'ludora_user',
    password: process.env.DB_PASSWORD || 'ludora_staging_pass',
    database: process.env.DB_NAME || 'ludora_staging',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: process.env.DATABASE_URL ? {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  } : {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};