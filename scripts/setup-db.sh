#!/bin/bash

# Ludora Database Setup Script
# Usage: ./setup-db.sh [environment] [action]
# Environment: development, staging, production
# Action: create, setup, drop

set -e  # Exit on any error

ENVIRONMENT=${1:-development}
ACTION=${2:-setup}

echo "🚀 Ludora Database Setup"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo

# Load environment variables
if [ "$ENVIRONMENT" = "production" ]; then
    ENV_FILE=".env"
else
    ENV_FILE="${ENVIRONMENT}.env"
fi

if [ -f "$ENV_FILE" ]; then
    echo "📁 Loading environment from: $ENV_FILE"
    export $(grep -v '^#' $ENV_FILE | xargs)
else
    echo "⚠️  Environment file $ENV_FILE not found, using defaults"
fi

# Set database defaults if not provided
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-"ludora_${ENVIRONMENT}"}
DB_USER=${DB_USER:-ludora_user}
DB_PASSWORD=${DB_PASSWORD:-ludora_pass}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

echo "🔌 Database Config:"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo

# Function to check if PostgreSQL is running
check_postgres() {
    if ! command -v psql &> /dev/null; then
        echo "❌ PostgreSQL client (psql) not found. Please install PostgreSQL."
        exit 1
    fi
    
    if ! pg_isready -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER &> /dev/null; then
        echo "❌ PostgreSQL server is not running or not accessible at $DB_HOST:$DB_PORT"
        echo "💡 For local development, you can start PostgreSQL with:"
        echo "   brew services start postgresql  (macOS with Homebrew)"
        echo "   sudo systemctl start postgresql  (Linux with systemd)"
        echo "   docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres  (Docker)"
        exit 1
    fi
    
    echo "✅ PostgreSQL server is running"
}

# Function to create database and user
create_database() {
    echo "🏗️  Creating database and user..."
    
    # Create user if not exists
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
                CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
            END IF;
        END
        \$\$;
    " 2>/dev/null || echo "   User creation skipped or failed (may already exist)"
    
    # Create database if not exists
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER -c "
        SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
        \gexec
    " 2>/dev/null || echo "   Database creation skipped or failed (may already exist)"
    
    # Grant privileges
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER -c "
        GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
    " 2>/dev/null || echo "   Privilege grant may have failed"
    
    echo "✅ Database and user setup completed"
}

# Function to drop database
drop_database() {
    echo "🗑️  Dropping database..."
    read -p "⚠️  Are you sure you want to drop database '$DB_NAME'? This cannot be undone! (yes/N): " confirm
    
    if [ "$confirm" = "yes" ]; then
        PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        echo "✅ Database dropped"
    else
        echo "❌ Operation cancelled"
        exit 1
    fi
}

# Function to setup tables using direct schema creation
setup_tables() {
    echo "📋 Setting up database tables with direct schema creation..."

    # Check if schema creation script exists
    if [ ! -f "scripts/create-schema.sql" ]; then
        echo "❌ scripts/create-schema.sql not found"
        exit 1
    fi

    # Create complete schema directly
    echo "🏗️  Creating database schema..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/create-schema.sql

    if [ $? -eq 0 ]; then
        echo "✅ Schema creation completed successfully"
    else
        echo "❌ Schema creation failed"
        exit 1
    fi

    # Run seeders if they exist
    if [ -d "seeders" ] && [ "$(ls -A seeders 2>/dev/null)" ]; then
        echo "🌱 Running database seeders..."
        if [ "$ENVIRONMENT" = "production" ]; then
            ENVIRONMENT=production npx sequelize-cli db:seed:all
        elif [ "$ENVIRONMENT" = "staging" ]; then
            ENVIRONMENT=staging npx sequelize-cli db:seed:all
        else
            npx sequelize-cli db:seed:all
        fi
    else
        echo "ℹ️  No seeders found, skipping seeding step"
    fi

    echo "✅ Tables setup completed"
}

# Function to test database connection
test_connection() {
    echo "🔍 Testing database connection..."
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT 
            'Database: ' || current_database() as info
        UNION ALL
        SELECT 
            'User: ' || current_user
        UNION ALL
        SELECT 
            'Version: ' || version()
        UNION ALL
        SELECT 
            'Tables: ' || count(*)::text || ' tables found'
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    "
    
    echo "✅ Database connection test successful"
}

# Main execution
case $ACTION in
    "create")
        check_postgres
        create_database
        ;;
    "setup")
        check_postgres
        create_database
        setup_tables
        test_connection
        ;;
    "drop")
        check_postgres
        drop_database
        ;;
    "test")
        check_postgres
        test_connection
        ;;
    *)
        echo "❌ Unknown action: $ACTION"
        echo "Available actions: create, setup, drop, test"
        exit 1
        ;;
esac

echo
echo "🎉 Database operation completed successfully!"
echo
echo "💡 Usage examples:"
echo "   ./setup-db.sh development setup    # Setup dev database"
echo "   ./setup-db.sh staging setup        # Setup staging database"
echo "   ./setup-db.sh production setup     # Setup production database"
echo "   ./setup-db.sh development test     # Test connection"
echo "   ./setup-db.sh development drop     # Drop database (careful!)"
echo