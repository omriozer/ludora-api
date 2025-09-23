# Database Setup Scripts

This directory contains scripts to set up the Ludora database for different environments using the **actual Base44 schema export**.

## ✅ Updated with Real Schema

The database scripts now use the actual schema from your Base44 export (`database-schema-2025-09-09-final.json`) instead of assumptions. This ensures compatibility with your existing data and workflows.

## Quick Start

1. **Install PostgreSQL** (if not already installed)
   ```bash
   # macOS with Homebrew
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   
   # Docker (alternative)
   docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Setup database**
   ```bash
   # Development
   npm run db:setup
   
   # Staging
   npm run db:setup:staging
   
   # Production
   npm run db:setup:prod
   ```

## Scripts Overview

### `setup-db.sh`
Main shell script that handles database creation and setup.

**Usage:**
```bash
./setup-db.sh [environment] [action]
```

**Environments:**
- `development` (default)
- `staging`
- `production`

**Actions:**
- `setup` (default) - Creates database, user, and tables
- `create` - Only creates database and user
- `drop` - Drops the database (with confirmation)
- `test` - Tests database connection

**Examples:**
```bash
./setup-db.sh development setup    # Full setup for development
./setup-db.sh staging create       # Only create staging database
./setup-db.sh production test      # Test production connection
./setup-db.sh development drop     # Drop development database
```

### `setup-db.js`
Node.js script that creates all database tables and indexes.

**Usage:**
```bash
node setup-db.js [environment]
```

## Database Schema (Based on Base44 Export)

The scripts create **33 tables** matching your exact Base44 schema:

### 🧑‍💻 User Management
- **`user`** - User accounts with roles, verification, app integration
- **`registration`** - Registration tracking (minimal fields)
- **`settings`** - Comprehensive system settings and navigation config

### 📧 Communication System  
- **`emailtemplate`** - Email templates with triggers and targeting
- **`emaillog`** - Email delivery tracking and status
- **`supportmessage`** - Customer support tickets
- **`notification`** - User notifications (empty schema - ready for expansion)

### 🛒 E-commerce & Products
- **`product`** - Rich product catalog (courses, workshops, files) with YouTube integration
- **`purchase`** - Detailed purchase tracking with payment, access, and subscription data
- **`coupon`** - Advanced coupon system with stacking and targeting
- **`category`** - Product categorization

### 📚 Educational Content
- **`word`** - Vocalized Hebrew words with difficulty and approval workflow
- **`worden`** - English words with approval system
- **`qa`** - Questions and answers with correct/incorrect options
- **`grammar`** - Grammar rules and examples
- **`image`** - Image content with approval workflow
- **`audiofile`** - Audio files with metadata
- **`contentlist`** - Content collections
- **`contentrelationship`** - Complex content relationships and difficulty mapping

### 🎮 Gaming System
- **`game`** - Game definitions (empty schema - extensible)
- **`gamesession`** - Detailed game session tracking with scores and analytics
- **`gametemplate`** - Game templates with usage tracking
- **`gameaudiosettings`** - Audio configuration per game type
- **`gamecontenttag`** - Game content tagging
- **`contenttag`** - Content tagging junction table

### 🏫 Educational Workflow
- **`school`** - School entities (empty schema - extensible)
- **`classroom`** - Classroom management with teacher assignment
- **`studentinvitation`** - Complete invitation workflow with parent consent
- **`parentconsent`** - Detailed parental consent tracking with digital signatures
- **`classroommembership`** - Student-classroom relationships

### 💳 Subscription Management
- **`subscriptionplan`** - Subscription plans with billing and benefits
- **`subscriptionhistory`** - Subscription lifecycle tracking
- **`pendingsubscription`** - Pending subscription processing (empty schema)

### 🔧 System & Metadata
- **`sitetext`** - Site content management
- **`attribute`** - Dynamic attributes with approval workflow
- **`webhooklog`** - Webhook logging (empty schema - extensible)

## Key Schema Features

### ✅ Base44 Compatibility
- Uses exact field names and types from your export
- All **arrays stored as JSONB** (tags, course_modules, benefits, etc.)
- **VARCHAR for all relationships** (no strict foreign keys - matches Base44)
- Includes **builtin fields**: `id`, `created_at`, `updated_at`, `created_by`, `created_by_id`

### 📝 Content Approval Workflow
Many content entities include approval fields:
- `added_by` - Who added the content
- `approved_by` - Who approved it  
- `is_approved` - Approval status
- `source` - Content source tracking

### 🎯 Rich Metadata
- **Products**: YouTube integration, course modules, access control
- **Purchases**: Detailed payment tracking, subscription cycles, access management  
- **Educational**: Complete invitation workflow with parental consent
- **Gaming**: Session analytics, template usage tracking

## Environment Configuration

Each environment has its own `.env` file:

- `development.env` - Local development
- `staging.env` - Staging server
- `.env` - Production (create from `.env.example`)

### Required Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ludora_development
DB_USER=ludora_user
DB_PASSWORD=secure_password

# PostgreSQL Admin (for database creation)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password
```

## Production Deployment

For production deployment:

1. **Copy and configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Update database credentials:**
   - Set secure passwords
   - Update host/port for your database server
   - Ensure PostgreSQL admin credentials are correct

3. **Run setup:**
   ```bash
   ./setup-db.sh production setup
   ```

## Troubleshooting

### PostgreSQL not running
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432 -U postgres

# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux
```

### Permission errors
```bash
# Ensure script is executable
chmod +x scripts/setup-db.sh

# Check PostgreSQL user permissions
psql -h localhost -U postgres -c "\\du"
```

### Connection errors
- Verify database credentials in environment file
- Check PostgreSQL is accepting connections
- Ensure firewall allows database port (5432)

### Table creation errors
- Check PostgreSQL version compatibility
- Verify user has CREATE privileges
- Review Node.js dependencies are installed

## 🔄 Migration from Base44 to PostgreSQL

### What Changed
The database scripts have been **completely rewritten** to match your actual Base44 schema export instead of my initial assumptions.

### Migration Strategy

#### 1. **Schema Migration** ✅ 
- **Before**: Generic assumptions about entities
- **After**: Exact Base44 field mappings with proper types
- **Impact**: Database structure now matches your real data

#### 2. **Data Migration**  
Use your Base44 export data:

```bash
# 1. Setup the new PostgreSQL database
npm run db:setup

# 2. Import your Base44 data
# Convert Base44 JSON export to PostgreSQL INSERT statements
# Field mapping is now exact - no transformation needed

# 3. Update API routes to use PostgreSQL instead of in-memory Maps
```

#### 3. **Key Changes Made**
- **Added `user` entity** (your primary user table)  
- **Enhanced `product`** with YouTube, course modules, access control
- **Detailed `purchase`** with subscription cycles and access tracking
- **Complete `studentinvitation`** workflow with parent consent
- **Rich `coupon`** system with stacking and targeting
- **Comprehensive `settings`** with navigation configuration

#### 4. **Backwards Compatibility**
- **Entity names preserved** from your routes/entities.js
- **API endpoints unchanged** - existing frontend code will work
- **Same in-memory Map structure** until you're ready to switch to PostgreSQL

### Next Steps

1. **Test the schema**: `npm run db:setup`
2. **Export Base44 data** in JSON format
3. **Convert to SQL inserts** matching the new schema
4. **Update API routes** to use PostgreSQL client instead of Maps
5. **Migrate gradually** - entity by entity for safe transition

## Support

For issues with database setup:
1. Check the logs for specific error messages
2. Verify all environment variables are set
3. Test database connection manually with `psql`
4. Ensure PostgreSQL service is running and accessible