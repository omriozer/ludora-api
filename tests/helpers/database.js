import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.join(__dirname, '..', '..', 'test.env') });

let sequelize = null;
let models = null;

// Database connection for tests
export const getTestDB = () => {
  if (!sequelize) {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'ludora_test',
      process.env.DB_USER || 'postgres', 
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false, // Disable SQL logging in tests
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      }
    );
  }
  return sequelize;
};

// Initialize models for testing
export const initTestModels = async () => {
  if (models) return models;
  
  const db = getTestDB();
  
  // Import models (adjust path as needed)
  const { default: User } = await import('../../models/User.js');
  const { default: Product } = await import('../../models/Product.js');
  const { default: Registration } = await import('../../models/Registration.js');
  const { default: Settings } = await import('../../models/Settings.js');
  const { default: Category } = await import('../../models/Category.js');
  const { default: Purchase } = await import('../../models/Purchase.js');
  
  models = {
    User: User(db),
    Product: Product(db),
    Registration: Registration(db),
    Settings: Settings(db),
    Category: Category(db),
    Purchase: Purchase(db),
  };
  
  // Set up associations if needed
  Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });
  
  return models;
};

// Database test utilities
export const dbHelpers = {
  // Clean all tables
  async cleanDatabase() {
    const db = getTestDB();
    await db.query('TRUNCATE TABLE "Users", "Products", "Registrations", "Settings", "Categories", "Purchases" RESTART IDENTITY CASCADE');
  },

  // Sync database schema
  async syncDatabase() {
    const db = getTestDB();
    await db.sync({ force: true });
  },

  // Create test transaction
  async createTransaction() {
    const db = getTestDB();
    return await db.transaction();
  },

  // Seed basic test data
  async seedTestData() {
    const models = await initTestModels();
    
    // Create test settings
    await models.Settings.create({
      site_name: 'Test Site',
      maintenance_mode: false,
      subscription_system_enabled: true,
      nav_workshops_visibility: 'public',
      nav_games_visibility: 'public',
      nav_files_visibility: 'public',
      nav_courses_visibility: 'public',
      nav_classrooms_visibility: 'public',
      nav_account_visibility: 'public',
      nav_content_creators_visibility: 'admins_and_creators',
    });

    // Create test categories
    await models.Category.bulkCreate([
      { name: 'תכנות' },
      { name: 'עיצוב' },
      { name: 'שיווק' },
    ]);

    // Create test users
    await models.User.bulkCreate([
      {
        id: 'test-user-1',
        email: 'test@example.com',
        display_name: 'Test User',
        role: 'user',
      },
      {
        id: 'admin-user-1',
        email: 'admin@example.com',
        display_name: 'Admin User',
        role: 'admin',
      },
    ]);
    
    return models;
  },

  // Close database connection
  async closeConnection() {
    if (sequelize) {
      await sequelize.close();
      sequelize = null;
      models = null;
    }
  },
};

// Test database lifecycle hooks
export const setupTestDB = async () => {
  await dbHelpers.syncDatabase();
  await dbHelpers.seedTestData();
};

export const cleanupTestDB = async () => {
  await dbHelpers.cleanDatabase();
};

export const teardownTestDB = async () => {
  await dbHelpers.closeConnection();
};