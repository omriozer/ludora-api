# Ludora API Development Setup Guide

> **Complete guide for setting up the Ludora Educational Platform API development environment**

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Firebase Integration](#firebase-integration)
5. [PayPlus Integration](#payplus-integration)
6. [Development Commands](#development-commands)
7. [Testing Setup](#testing-setup)
8. [IDE Configuration](#ide-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** 18.0+ (LTS recommended)
- **npm** 9.0+
- **PostgreSQL** 14.0+
- **Git** 2.30+

### Optional Tools

- **Redis** (for job scheduling)
- **Docker** (alternative database setup)
- **Postman** (API testing)

### Installation

```bash
# macOS with Homebrew
brew install node postgresql redis git

# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm postgresql redis-server git

# Windows (via Chocolatey)
choco install nodejs postgresql redis git

# Verify installations
node --version    # v18.0.0+
npm --version     # 9.0.0+
psql --version    # 14.0+
```

---

## Environment Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/ludora-api.git
cd ludora-api

# Install dependencies
npm install

# Verify installation
npm run lint:check
```

### 2. Environment Files

Create environment files for different environments:

```bash
# Copy example files
cp .env.example .env.development
cp .env.example .env.staging
cp .env.example .env

# Edit each file with your specific configuration
```

### 3. Development Environment (.env.development)

```bash
# ================================
# LUDORA API - DEVELOPMENT CONFIG
# ================================

# Environment
ENVIRONMENT=development
NODE_ENV=development
PORT=3003

# Database (PostgreSQL)
DATABASE_URL=postgresql://ludora_user:dev_password@localhost:5432/ludora_development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ludora_development
DB_USER=ludora_user
DB_PASSWORD=dev_password

# PostgreSQL Admin (for setup scripts)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Security
JWT_SECRET=your_super_secure_jwt_secret_for_development_min_32_chars
REFRESH_TOKEN_SECRET=your_refresh_token_secret_for_development_min_32_chars

# Firebase (Development Project)
FIREBASE_PROJECT_ID=ludora-dev
FIREBASE_PRIVATE_KEY_ID=your_dev_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_DEV_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@ludora-dev.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_dev_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# PayPlus (Staging/Testing)
PAYPLUS_API_KEY=your_payplus_staging_api_key
PAYPLUS_SECRET_KEY=your_payplus_staging_secret_key
PAYPLUS_MODE=staging
PAYPLUS_WEBHOOK_URL=http://localhost:3003/api/webhooks/payplus

# AWS S3 (Development Bucket)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=eu-central-1
AWS_S3_BUCKET=ludora-files-dev

# Frontend URLs
FRONTEND_URL=http://localhost:5173
ADDITIONAL_FRONTEND_URLS=http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

# API Configuration
API_URL=http://localhost:3003
API_DOCS_URL=http://localhost:3003/api-docs
CORS_DEV_OVERRIDE=true

# Redis (optional for development)
REDIS_URL=redis://localhost:6379

# Email (development - use mailhog or similar)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=dev@ludora.app

# Logging
LOG_LEVEL=debug
LOG_TO_FILE=false
```

### 4. Secrets Management

```bash
# Never commit real secrets to git
echo ".env*" >> .gitignore

# Use environment-specific secrets
# Development: Lower security, easier debugging
# Staging: Production-like but separate credentials
# Production: Maximum security, real credentials
```

---

## Database Configuration

### 1. PostgreSQL Setup

```bash
# Start PostgreSQL service
# macOS
brew services start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Windows (if installed as service)
net start postgresql

# Docker alternative (recommended for development)
docker run -d \
  --name ludora-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ludora_development \
  -p 5432:5432 \
  postgres:14

# Verify PostgreSQL is running
pg_isready -h localhost -p 5432 -U postgres
```

### 2. Database Creation and Setup

#### Automated Setup (Recommended)

```bash
# Full database setup for development
npm run db:setup

# Environment-specific setup
npm run db:setup:staging     # Staging database
npm run db:setup:prod       # Production database

# Test database connection
./scripts/setup-db.sh development test
```

#### Manual Setup with Scripts

The `setup-db.sh` script provides comprehensive database management:

```bash
# Full setup (creates database, user, and tables)
./scripts/setup-db.sh development setup

# Create database and user only
./scripts/setup-db.sh development create

# Drop database (with confirmation)
./scripts/setup-db.sh development drop

# Test database connection
./scripts/setup-db.sh development test

# Production setup
./scripts/setup-db.sh production setup
```

#### Docker Setup

```bash
# Start PostgreSQL container
docker run -d \
  --name ludora-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ludora_development \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  postgres:14

# Connect to container
docker exec -it ludora-postgres psql -U postgres -d ludora_development
```

### 3. Database Schema Overview

Ludora uses a comprehensive **33-table schema** based on the Base44 export, organized into functional areas:

#### 🧑‍💻 User Management System
- **`user`** - User accounts with roles, verification, app integration
- **`registration`** - Registration tracking and workflow management
- **`settings`** - Comprehensive system settings and navigation configuration

#### 🛒 E-commerce & Product Management
- **`product`** - Rich product catalog (courses, workshops, files) with YouTube integration
- **`purchase`** - Detailed purchase tracking with payment, access, and subscription data
- **`coupon`** - Advanced coupon system with stacking and targeting capabilities
- **`category`** - Product categorization and organization

#### 📚 Educational Content System
- **`word`** - Vocalized Hebrew words with difficulty and approval workflow
- **`worden`** - English words with approval system
- **`qa`** - Questions and answers with correct/incorrect options
- **`grammar`** - Grammar rules and examples
- **`image`** - Image content with approval workflow
- **`audiofile`** - Audio files with metadata and processing
- **`contentlist`** - Content collections and grouping
- **`contentrelationship`** - Complex content relationships and difficulty mapping

#### 🎮 Gaming System
- **`game`** - Game definitions (extensible schema)
- **`gamesession`** - Detailed game session tracking with scores and analytics
- **`gametemplate`** - Game templates with usage tracking
- **`gameaudiosettings`** - Audio configuration per game type
- **`gamecontenttag`** - Game content tagging system
- **`contenttag`** - Content tagging junction table

#### 🏫 Educational Workflow
- **`school`** - School entities (extensible schema)
- **`classroom`** - Classroom management with teacher assignment
- **`studentinvitation`** - Complete invitation workflow with parent consent
- **`parentconsent`** - Detailed parental consent tracking with digital signatures
- **`classroommembership`** - Student-classroom relationships

#### 💳 Subscription Management
- **`subscriptionplan`** - Subscription plans with billing and benefits configuration
- **`subscriptionhistory`** - Complete subscription lifecycle tracking
- **`pendingsubscription`** - Pending subscription processing workflow

#### 📧 Communication System
- **`emailtemplate`** - Email templates with triggers and targeting
- **`emaillog`** - Email delivery tracking and status monitoring
- **`supportmessage`** - Customer support ticket system
- **`notification`** - User notifications (expandable schema)

#### 🔧 System & Metadata
- **`sitetext`** - Site content management
- **`attribute`** - Dynamic attributes with approval workflow
- **`webhooklog`** - Webhook logging and monitoring

### 4. Database Migrations

```bash
# Run pending migrations
npm run db:migrate:dev

# Environment-specific migrations
npm run db:migrate:staging
npm run db:migrate:prod

# Create new migration
npx sequelize-cli migration:generate --name add-new-feature

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all migrations
npx sequelize-cli db:migrate:undo:all

# Check migration status
npm run db:status
```

### 5. Database Seeding

```bash
# Run all seeders
npm run db:seed:dev

# Run specific seeder
npx sequelize-cli db:seed --seed 20231201-create-test-users.js

# Undo all seeders
npx sequelize-cli db:seed:undo:all

# Undo specific seeder
npx sequelize-cli db:seed:undo --seed 20231201-create-test-users.js
```

### 6. Advanced Database Operations

#### Daily Subscription Testing (NEW)

For testing PayPlus subscription webhooks with rapid turnaround:

```bash
# Preview test subscription (dry run)
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic \
  --dryRun

# Create actual daily test subscription
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_abc123 \
  --planId=plan_monthly_basic

# Monitoring test subscriptions
SELECT * FROM subscription WHERE metadata->>'test_mode' = 'daily_subscription_testing';

# Cleanup test subscriptions
UPDATE subscription
SET status = 'cancelled'
WHERE metadata->>'test_mode' = 'daily_subscription_testing';
```

**Daily Testing Benefits:**
- Test recurring webhook processing in 24 hours instead of 30 days
- Validate subscription lifecycle management
- Debug PayPlus integration issues rapidly
- Safely test subscription renewal flows

#### Database Backup and Restore

```bash
# Backup development database
npm run backup:dev

# Restore from backup
npm run restore:dev

# Manual backup
pg_dump ludora_development > backup_$(date +%Y%m%d_%H%M%S).sql

# Manual restore
psql ludora_development < backup_20231201_140500.sql
```

#### Database Inspection Tools

```bash
# Connect to development database
psql postgresql://ludora_user:dev_password@localhost:5432/ludora_development

# Database GUI (if installed)
npm run db:gui:dev

# Useful inspection queries
\dt                           # List all tables
\d+ products                  # Describe products table with details
\du                          # List database users
\l                           # List all databases

# Check table sizes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  most_common_vals
FROM pg_stats
WHERE tablename = 'product';

# Monitor active connections
SELECT * FROM pg_stat_activity WHERE datname = 'ludora_development';
```

### 7. Production Database Considerations

#### Security Configuration

```sql
-- Create secure production user
CREATE USER ludora_prod WITH PASSWORD 'secure_random_password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE ludora_production TO ludora_prod;
GRANT USAGE ON SCHEMA public TO ludora_prod;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ludora_prod;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ludora_prod;

-- Revoke unnecessary permissions
REVOKE CREATE ON SCHEMA public FROM ludora_prod;
```

#### Performance Optimization

```sql
-- Add essential indexes for performance
CREATE INDEX idx_product_type_published ON product(product_type, is_published);
CREATE INDEX idx_purchase_user_status ON purchase(buyer_user_id, payment_status);
CREATE INDEX idx_gamesession_created ON gamesession(created_at);
CREATE INDEX idx_user_email ON user(email);

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM product WHERE product_type = 'course' AND is_published = true;
```

#### Connection Pooling

```javascript
// config/database.js - Production configuration
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  pool: {
    max: 20,          // Maximum connections in pool
    min: 5,           // Minimum connections in pool
    idle: 10000,      // Maximum time connection can be idle (ms)
    acquire: 60000,   // Maximum time to acquire connection (ms)
  },
  logging: false,     // Disable query logging in production
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});
```

---

## Firebase Integration

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project for development
3. Enable Authentication with Email/Password
4. Generate service account credentials

### 2. Service Account Configuration

```bash
# Download service account JSON from Firebase Console
# Extract required fields for .env.development:

# From the JSON file:
{
  "type": "service_account",
  "project_id": "ludora-dev",                    # → FIREBASE_PROJECT_ID
  "private_key_id": "abc123...",                 # → FIREBASE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----...", # → FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-...",       # → FIREBASE_CLIENT_EMAIL
  "client_id": "123456789...",                   # → FIREBASE_CLIENT_ID
}
```

### 3. Firebase Authentication Rules

```javascript
// Firebase Security Rules (development)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Development: More permissive rules for testing
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Test Firebase Connection

```bash
# Test Firebase initialization
npm run test:firebase

# Or manually test
node -e "
import('./config/firebase.js').then(() => {
  console.log('✅ Firebase connected successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Firebase connection failed:', err);
  process.exit(1);
});
"
```

---

## PayPlus Integration

### 1. PayPlus Account Setup

1. Create PayPlus staging account
2. Obtain staging API credentials
3. Configure webhook URLs

### 2. PayPlus Configuration

```bash
# .env.development PayPlus settings
PAYPLUS_API_KEY=your_staging_api_key
PAYPLUS_SECRET_KEY=your_staging_secret_key
PAYPLUS_MODE=staging
PAYPLUS_WEBHOOK_URL=http://localhost:3003/api/webhooks/payplus

# For webhook testing with local development
# Use ngrok or similar tunneling service
npm install -g ngrok
ngrok http 3003

# Then update webhook URL to ngrok URL
PAYPLUS_WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/payplus
```

### 3. Test PayPlus Connection

```bash
# Test PayPlus API connection
npm run test:payplus

# Create test payment page
curl -X POST http://localhost:3003/api/payments/createPayplusPaymentPage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -d '{
    "items": [
      {
        "purchasable_type": "game",
        "purchasable_id": "test_game_id",
        "price": 9.99
      }
    ]
  }'
```

---

## Development Commands

### Available Scripts

```bash
# Development server with hot reload
npm run dev              # Full stack development
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only (if applicable)

# Database operations
npm run db:setup         # Complete database setup
npm run db:migrate:dev   # Run migrations
npm run db:seed:dev      # Seed test data
npm run db:reset:dev     # Reset and reseed database
npm run db:gui:dev       # Open database GUI

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests

# Code quality
npm run lint             # Check code style
npm run lint:fix         # Fix auto-fixable issues
npm run format           # Format code with Prettier
npm run type-check       # TypeScript type checking

# Production builds
npm run build            # Build for production
npm run start            # Start production server
npm run preview          # Preview production build

# Utilities
npm run logs:dev         # View development logs
npm run jobs:dev         # Manage background jobs
npm run backup:dev       # Backup development database
npm run restore:dev      # Restore from backup
```

### Development Server

```bash
# Start full development environment
npm run dev

# Server will start with:
# - Hot reload on file changes
# - Detailed error logging
# - Interactive OpenAPI docs at http://localhost:3003/api-docs
# - Database connection validation
# - Redis connection (if available)
# - WebSocket support for real-time features

# Check server status
curl http://localhost:3003/health
```

---

## Testing Setup

### 1. Test Database

```bash
# Create separate test database
createdb ludora_test

# Set test environment
export NODE_ENV=test
export DB_NAME=ludora_test

# Run test migrations
npm run db:migrate:test
```

### 2. Test Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/migrations/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 3. Test Utilities

```javascript
// tests/setup.js - Test environment setup
import models from '../models/index.js';

beforeEach(async () => {
  // Clean database between tests
  await models.sequelize.sync({ force: true });
});

afterAll(async () => {
  // Close database connection
  await models.sequelize.close();
});

// Test helpers
export const createTestUser = async (overrides = {}) => {
  return await models.User.create({
    email: 'test@example.com',
    role: 'teacher',
    ...overrides
  });
};

export const createTestGame = async (creatorId, overrides = {}) => {
  return await EntityService.create('game', {
    title: 'Test Game',
    description: 'A test game',
    price: 9.99,
    ...overrides
  }, creatorId);
};
```

### 4. Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/entities.test.js

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run only changed tests
npm test -- --onlyChanged
```

---

## IDE Configuration

### VS Code Setup

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["ludora-api"],
  "javascript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

```json
// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VS Code Tasks

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Development Server",
      "type": "shell",
      "command": "npm run dev",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "npm test",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always"
      }
    }
  ]
}
```

### Debugging Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/index.js",
      "env": {
        "NODE_ENV": "development",
        "ENVIRONMENT": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--inspect"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "env": {
        "NODE_ENV": "test"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Error: "relation does not exist"
# Solution: Run migrations
npm run db:migrate:dev

# Error: "password authentication failed"
# Solution: Check PostgreSQL user permissions
sudo -u postgres psql
CREATE USER ludora_user WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE ludora_development TO ludora_user;

# Error: "database does not exist"
# Solution: Create database
createdb ludora_development
```

#### 2. Firebase Authentication Errors

```bash
# Error: "Invalid private key"
# Solution: Check .env file private key formatting
# Ensure newlines are properly escaped: \n

# Error: "Firebase project not found"
# Solution: Verify FIREBASE_PROJECT_ID matches your Firebase project

# Test Firebase config:
node -e "console.log(JSON.stringify(process.env.FIREBASE_PRIVATE_KEY, null, 2))"
```

#### 3. Port Already in Use

```bash
# Error: "EADDRINUSE: address already in use :::3003"
# Solution: Kill process using port
lsof -ti:3003 | xargs kill -9

# Or use different port
export PORT=3004
npm run dev
```

#### 4. Module Import Errors

```bash
# Error: "Cannot find module"
# Solution: Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Error: "ESM import/export syntax error"
# Solution: Ensure package.json has "type": "module"
```

#### 5. Redis Connection Issues

```bash
# Error: "Redis connection failed"
# Solution: Start Redis (optional for development)
brew services start redis

# Or disable Redis features in development
export REDIS_URL=
```

### Performance Issues

#### Slow Database Queries

```bash
# Enable query logging in development
export DB_LOGGING=true
npm run dev

# Analyze slow queries
export LOG_LEVEL=debug
npm run dev | grep "Executed"
```

#### Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev

# Monitor memory usage
npm install -g clinic
clinic doctor -- npm run dev
```

### Development Tips

#### Hot Reload Setup

```bash
# Install nodemon globally for hot reload
npm install -g nodemon

# Create nodemon.json for custom configuration
{
  "watch": ["src/", "index.js"],
  "ext": "js,json",
  "ignore": ["tests/", "node_modules/"],
  "exec": "node index.js"
}
```

#### API Testing Workflow

```bash
# Use httpie for quick API testing
pip install httpie

# Test endpoints
http GET localhost:3003/api/entities/game Authorization:"Bearer $TOKEN"
http POST localhost:3003/api/entities/game title="Test Game" price:=9.99 Authorization:"Bearer $TOKEN"

# Or use curl
curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:3003/api/entities/game
```

#### Database Inspection

```bash
# Connect to development database
psql postgresql://ludora_user:dev_password@localhost:5432/ludora_development

# Useful queries
\dt                           # List all tables
\d+ products                  # Describe products table
SELECT * FROM products LIMIT 5;
```

---

## Next Steps

After completing the development setup:

1. **Explore the API**: Visit http://localhost:3003/api-docs for interactive documentation
2. **Run the test suite**: `npm test` to ensure everything works
3. **Read the guides**: Check out the [API Integration Guide](./API_INTEGRATION_GUIDE.md) and [Authentication Reference](./AUTHENTICATION_REFERENCE.md)
4. **Join the team**: Follow the coding patterns in [CLAUDE.md](../CLAUDE.md)

For production deployment, see the deployment guides in the `/docs` directory.

---

## Support

If you encounter issues during setup:

1. Check this troubleshooting section
2. Review the error logs: `npm run logs:dev`
3. Consult the [Error Handling Reference](./ERROR_HANDLING_REFERENCE.md)
4. Ask for help in the team chat with specific error messages