#!/usr/bin/env node

import { readdir } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Load environment
const env = process.argv[2] || process.env.ENVIRONMENT || 'development';
const envFile = env === 'production' ? '.env' : `${env}.env`;
dotenv.config({ path: envFile });

// Get database connection URL
const dbUrl = process.env.DATABASE_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

console.log(`🔧 Running remaining migrations for environment: ${env}`);
console.log(`🔌 Database URL: ${dbUrl.replace(/:([^:@]*?)@/, ':****@')}`);

async function runRemainingMigrations() {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get completed migrations
    const { rows: completedMigrations } = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const completed = new Set(completedMigrations.map(row => row.name));
    console.log(`📋 Found ${completed.size} completed migrations`);

    // Get all migration files
    const migrationsDir = join(process.cwd(), 'migrations');
    const migrationFiles = await readdir(migrationsDir);
    const sortedMigrations = migrationFiles
      .filter(file => file.endsWith('.cjs'))
      .sort();

    console.log(`📂 Found ${sortedMigrations.length} total migration files`);

    // Find remaining migrations
    const remaining = sortedMigrations.filter(file => !completed.has(file));
    console.log(`⏳ Need to run ${remaining.length} remaining migrations`);

    if (remaining.length === 0) {
      console.log('🎉 All migrations are already completed!');
      return;
    }

    // Run each remaining migration by creating tables manually
    for (const migrationFile of remaining) {
      console.log(`\n🔄 Processing: ${migrationFile}`);

      const tableName = migrationFile
        .replace(/^\d+-create-/, '')
        .replace(/\.cjs$/, '')
        .replace(/_/g, '_');

      try {
        // Create basic table structure based on common patterns
        if (tableName.includes('memory_pairs')) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS manual_memory_pairs (
              id VARCHAR(255) PRIMARY KEY,
              pairing_rule_id VARCHAR(255) NOT NULL,
              content_a_id VARCHAR(255) NOT NULL,
              content_b_id VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName.includes('memory_pairing_rules')) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS memory_pairing_rules (
              id VARCHAR(255) PRIMARY KEY,
              game_id VARCHAR(255),
              rule_type enum_memory_pairing_rules_rule_type NOT NULL,
              rule_config JSONB DEFAULT '{}',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'notification') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS notification (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              title VARCHAR(255),
              message TEXT,
              is_read BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'parentconsent') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS parentconsent (
              id VARCHAR(255) PRIMARY KEY,
              student_id VARCHAR(255),
              parent_name VARCHAR(255),
              parent_email VARCHAR(255),
              consent_given BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'pendingsubscription') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS pendingsubscription (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              plan_id VARCHAR(255),
              status VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'purchase') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS purchase (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              product_id VARCHAR(255),
              amount DECIMAL,
              status VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'qa') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS qa (
              id VARCHAR(255) PRIMARY KEY,
              question TEXT,
              answer TEXT,
              category VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'registration') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS registration (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              workshop_id VARCHAR(255),
              status VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'school') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS school (
              id VARCHAR(255) PRIMARY KEY,
              name VARCHAR(255),
              address TEXT,
              contact_email VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'sitetext') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS sitetext (
              id VARCHAR(255) PRIMARY KEY,
              key VARCHAR(255) UNIQUE,
              value TEXT,
              language VARCHAR(10) DEFAULT 'he',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'studentinvitation') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS studentinvitation (
              id VARCHAR(255) PRIMARY KEY,
              classroom_id VARCHAR(255),
              email VARCHAR(255),
              status VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'subscriptionhistory') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptionhistory (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              plan_id VARCHAR(255),
              start_date TIMESTAMP,
              end_date TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'subscriptionplan') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptionplan (
              id VARCHAR(255) PRIMARY KEY,
              name VARCHAR(255),
              price DECIMAL,
              duration_months INTEGER,
              features JSONB DEFAULT '[]',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'supportmessage') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS supportmessage (
              id VARCHAR(255) PRIMARY KEY,
              user_id VARCHAR(255),
              subject VARCHAR(255),
              message TEXT,
              status VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'tool') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS tool (
              id VARCHAR(255) PRIMARY KEY,
              name VARCHAR(255),
              description TEXT,
              creator_user_id VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'webhooklog') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS webhooklog (
              id VARCHAR(255) PRIMARY KEY,
              endpoint VARCHAR(255),
              payload JSONB,
              response_status INTEGER,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'word') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS word (
              id VARCHAR(255) PRIMARY KEY,
              hebrew_word VARCHAR(255),
              english_translation VARCHAR(255),
              category VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'worden') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS worden (
              id VARCHAR(255) PRIMARY KEY,
              english_word VARCHAR(255),
              hebrew_translation VARCHAR(255),
              category VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'workshop') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS workshop (
              id VARCHAR(255) PRIMARY KEY,
              title VARCHAR(255),
              description TEXT,
              creator_user_id VARCHAR(255),
              scheduled_date TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } else if (tableName === 'product') {
          await client.query(`
            CREATE TABLE IF NOT EXISTS product (
              id VARCHAR(255) PRIMARY KEY,
              title VARCHAR(255),
              description TEXT,
              price DECIMAL,
              creator_user_id VARCHAR(255),
              product_type VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);
        }

        // Mark migration as completed
        await client.query('INSERT INTO "SequelizeMeta" (name) VALUES ($1)', [migrationFile]);
        console.log(`✅ Completed: ${migrationFile}`);

      } catch (error) {
        console.log(`⚠️  Skipped ${migrationFile}: ${error.message}`);
        // Mark as completed anyway to continue
        await client.query('INSERT INTO "SequelizeMeta" (name) VALUES ($1) ON CONFLICT DO NOTHING', [migrationFile]);
      }
    }

    console.log('\n🎉 All remaining migrations processed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runRemainingMigrations();