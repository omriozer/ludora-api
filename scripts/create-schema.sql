-- Database Schema Creation Script for Ludora API
-- Generated from migrations analysis
-- PostgreSQL compatible schema

BEGIN;

-- Create ENUM types first
CREATE TYPE "enum_game_content_rule_instance_rule_type" AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);

CREATE TYPE "enum_game_content_rule_rule_type" AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);

CREATE TYPE "enum_memory_pairing_rules_rule_type" AS ENUM (
    'manual_pairs',
    'attribute_match',
    'content_type_match',
    'semantic_match'
);

-- Create basic tables without foreign key dependencies first

-- Users table (base table)
CREATE TABLE "user" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "email" VARCHAR(255),
    "full_name" VARCHAR(255),
    "disabled" VARCHAR(255),
    "is_verified" BOOLEAN,
    "_app_role" VARCHAR(255),
    "role" VARCHAR(255) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "is_active" BOOLEAN DEFAULT true,
    "last_login" TIMESTAMP WITH TIME ZONE,
    "phone" VARCHAR(255),
    "education_level" VARCHAR(255),
    "content_creator_agreement_sign_date" TIMESTAMP WITH TIME ZONE,
    "user_type" VARCHAR(255)
);

-- Settings table
CREATE TABLE "settings" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "subscription_system_enabled" BOOLEAN,
    "default_recording_access_days" DECIMAL,
    "recording_lifetime_access" BOOLEAN,
    "default_course_access_days" DECIMAL,
    "course_lifetime_access" BOOLEAN,
    "default_file_access_days" DECIMAL,
    "file_lifetime_access" BOOLEAN,
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(255),
    "site_description" TEXT,
    "logo_url" VARCHAR(255),
    "site_name" VARCHAR(255),
    "maintenance_mode" BOOLEAN,
    "student_invitation_expiry_days" DECIMAL,
    "parent_consent_required" BOOLEAN,
    "nav_order" JSONB,
    "nav_files_text" VARCHAR(255),
    "nav_files_icon" VARCHAR(255),
    "nav_files_visibility" VARCHAR(255),
    "nav_files_enabled" BOOLEAN,
    "nav_games_text" VARCHAR(255),
    "nav_games_icon" VARCHAR(255),
    "nav_games_visibility" VARCHAR(255),
    "nav_games_enabled" BOOLEAN,
    "nav_workshops_text" VARCHAR(255),
    "nav_workshops_icon" VARCHAR(255),
    "nav_workshops_visibility" VARCHAR(255),
    "nav_workshops_enabled" BOOLEAN,
    "nav_courses_text" VARCHAR(255),
    "nav_courses_icon" VARCHAR(255),
    "nav_courses_visibility" VARCHAR(255),
    "nav_courses_enabled" BOOLEAN,
    "nav_classrooms_text" VARCHAR(255),
    "nav_classrooms_icon" VARCHAR(255),
    "nav_classrooms_visibility" VARCHAR(255),
    "nav_classrooms_enabled" BOOLEAN,
    "nav_account_text" VARCHAR(255),
    "nav_account_icon" VARCHAR(255),
    "nav_account_visibility" VARCHAR(255),
    "nav_account_enabled" BOOLEAN,
    "nav_content_creators_text" VARCHAR(255),
    "nav_content_creators_icon" VARCHAR(255),
    "nav_content_creators_visibility" VARCHAR(255),
    "nav_content_creators_enabled" BOOLEAN,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255),
    "allow_content_creator_workshops" BOOLEAN DEFAULT true,
    "allow_content_creator_courses" BOOLEAN DEFAULT true,
    "allow_content_creator_files" BOOLEAN DEFAULT true,
    "allow_content_creator_tools" BOOLEAN DEFAULT true,
    "allow_content_creator_games" BOOLEAN DEFAULT true
);

-- Attributes table
CREATE TABLE "attribute" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "type" VARCHAR(255),
    "value" VARCHAR(255),
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Audio files table
CREATE TABLE "audiofile" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "name" VARCHAR(255),
    "file_url" VARCHAR(255),
    "duration" DECIMAL,
    "volume" DECIMAL,
    "file_size" DECIMAL,
    "file_type" VARCHAR(255),
    "is_default_for" JSONB,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Categories table
CREATE TABLE "category" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "name" VARCHAR(255),
    "is_default" BOOLEAN,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Schools table
CREATE TABLE "school" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Classrooms table
CREATE TABLE "classroom" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "name" VARCHAR(255),
    "grade_level" VARCHAR(255),
    "year" VARCHAR(255),
    "teacher_id" VARCHAR(255),
    "description" VARCHAR(255),
    "is_active" BOOLEAN,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Classroom membership table
CREATE TABLE "classroommembership" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "classroom_id" VARCHAR(255),
    "student_user_id" VARCHAR(255),
    "teacher_id" VARCHAR(255),
    "joined_at" VARCHAR(255),
    "status" VARCHAR(255),
    "notes" VARCHAR(255),
    "student_display_name" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Content lists table
CREATE TABLE "contentlist" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "name" VARCHAR(255),
    "description" VARCHAR(255),
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Content relationships table
CREATE TABLE "contentrelationship" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "source_id" VARCHAR(255),
    "source_type" VARCHAR(255),
    "target_id" VARCHAR(255),
    "target_type" VARCHAR(255),
    "relationship_types" JSONB,
    "difficulty" VARCHAR(255),
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "context_data" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Content tags table
CREATE TABLE "contenttag" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "content_id" VARCHAR(255),
    "content_type" VARCHAR(255),
    "tag_id" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Coupons table
CREATE TABLE "coupon" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "code" VARCHAR(255),
    "name" VARCHAR(255),
    "description" VARCHAR(255),
    "discount_type" VARCHAR(255),
    "discount_value" DECIMAL,
    "minimum_amount" DECIMAL,
    "usage_limit" VARCHAR(255),
    "usage_count" DECIMAL,
    "valid_until" VARCHAR(255),
    "is_visible" BOOLEAN,
    "is_admin_only" BOOLEAN,
    "allow_stacking" BOOLEAN,
    "stackable_with" JSONB,
    "applicable_categories" JSONB,
    "applicable_workshops" JSONB,
    "workshop_types" JSONB,
    "is_active" BOOLEAN,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Courses table
CREATE TABLE "course" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "category" VARCHAR(255),
    "price" DECIMAL NOT NULL DEFAULT '0',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "image_url" VARCHAR(255),
    "image_is_private" BOOLEAN DEFAULT false,
    "tags" JSONB,
    "target_audience" VARCHAR(255),
    "difficulty_level" VARCHAR(255),
    "access_days" INTEGER,
    "is_lifetime_access" BOOLEAN DEFAULT false,
    "course_modules" JSONB DEFAULT '[]',
    "total_duration_minutes" INTEGER,
    "creator_user_id" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Files table
CREATE TABLE "file" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "category" VARCHAR(255),
    "price" DECIMAL NOT NULL DEFAULT '0',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "image_url" VARCHAR(255),
    "image_is_private" BOOLEAN DEFAULT false,
    "tags" JSONB,
    "target_audience" VARCHAR(255),
    "difficulty_level" VARCHAR(255),
    "access_days" INTEGER,
    "is_lifetime_access" BOOLEAN DEFAULT false,
    "file_url" VARCHAR(255) NOT NULL,
    "file_is_private" BOOLEAN DEFAULT true,
    "preview_file_url" VARCHAR(255),
    "preview_file_is_private" BOOLEAN DEFAULT false,
    "file_type" VARCHAR(255),
    "downloads_count" INTEGER DEFAULT '0',
    "creator_user_id" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Games table
CREATE TABLE "game" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255),
    "title" VARCHAR(255),
    "description" TEXT,
    "short_description" TEXT,
    "game_type" VARCHAR(255),
    "price" DECIMAL NOT NULL DEFAULT '0',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "image_url" VARCHAR(255),
    "image_is_private" BOOLEAN DEFAULT false,
    "subject" VARCHAR(255),
    "skills" JSONB DEFAULT '[]',
    "age_range" VARCHAR(255),
    "grade_range" VARCHAR(255),
    "device_compatibility" VARCHAR(255) NOT NULL DEFAULT 'both',
    "game_settings" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB DEFAULT '[]',
    "difficulty_level" VARCHAR(255),
    "estimated_duration" INTEGER,
    "content_creator_id" VARCHAR(255)
);

-- Game content rules table
CREATE TABLE "game_content_rule" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "template_id" VARCHAR(255) NOT NULL,
    "rule_type" "enum_game_content_rule_rule_type" NOT NULL,
    "rule_config" JSON NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT '0',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Game content rule instances table
CREATE TABLE "game_content_rule_instance" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "game_usage_id" VARCHAR(255) NOT NULL,
    "rule_type" "enum_game_content_rule_instance_rule_type" NOT NULL,
    "rule_config" JSON NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT '0',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Game sessions table
CREATE TABLE "gamesession" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "user_id" VARCHAR(255),
    "guest_ip" VARCHAR(255),
    "game_id" VARCHAR(255),
    "game_type" VARCHAR(255),
    "session_start_time" VARCHAR(255),
    "session_end_time" VARCHAR(255),
    "duration_seconds" VARCHAR(255),
    "session_data" VARCHAR(255),
    "completed" BOOLEAN,
    "score" VARCHAR(255),
    "exit_reason" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Images table
CREATE TABLE "image" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "file_url" VARCHAR(255),
    "description" VARCHAR(255),
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Logs table
CREATE TABLE "logs" (
    "id" SERIAL PRIMARY KEY,
    "source_type" VARCHAR(10) NOT NULL,
    "log_type" VARCHAR(20) NOT NULL DEFAULT 'log',
    "message" TEXT NOT NULL,
    "user_id" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manual memory pairs table
CREATE TABLE "manual_memory_pairs" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "pairing_rule_id" VARCHAR(255) NOT NULL,
    "content_a_id" VARCHAR(255) NOT NULL,
    "content_a_type" VARCHAR(50) NOT NULL,
    "content_b_id" VARCHAR(255) NOT NULL,
    "content_b_type" VARCHAR(50) NOT NULL,
    "pair_metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Memory pairing rules table
CREATE TABLE "memory_pairing_rules" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "game_id" VARCHAR(255) NOT NULL,
    "rule_type" "enum_memory_pairing_rules_rule_type" NOT NULL,
    "content_type_a" VARCHAR(50),
    "content_type_b" VARCHAR(50),
    "attribute_name" VARCHAR(100),
    "pair_config" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT '0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Products table
CREATE TABLE "product" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "category" VARCHAR(255),
    "product_type" VARCHAR(255),
    "price" DECIMAL,
    "is_published" BOOLEAN,
    "image_url" VARCHAR(255),
    "youtube_video_id" VARCHAR(255),
    "youtube_video_title" VARCHAR(255),
    "file_url" VARCHAR(255),
    "preview_file_url" VARCHAR(255),
    "file_type" VARCHAR(255),
    "downloads_count" DECIMAL,
    "tags" JSONB,
    "target_audience" VARCHAR(255),
    "difficulty_level" VARCHAR(255),
    "access_days" DECIMAL,
    "is_lifetime_access" BOOLEAN,
    "workshop_id" VARCHAR(255),
    "course_modules" JSONB,
    "total_duration_minutes" DECIMAL,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "creator_user_id" VARCHAR(255),
    "workshop_type" VARCHAR(255),
    "video_file_url" VARCHAR(255),
    "scheduled_date" TIMESTAMP WITH TIME ZONE,
    "meeting_link" VARCHAR(255),
    "meeting_password" VARCHAR(255),
    "meeting_platform" VARCHAR(255),
    "max_participants" INTEGER,
    "duration_minutes" INTEGER
);

-- Purchases table
CREATE TABLE "purchase" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "order_number" VARCHAR(255),
    "product_id" VARCHAR(255),
    "workshop_id" VARCHAR(255),
    "buyer_name" VARCHAR(255),
    "buyer_email" VARCHAR(255),
    "buyer_phone" VARCHAR(255),
    "payment_status" VARCHAR(255),
    "payment_amount" DECIMAL,
    "original_price" DECIMAL,
    "discount_amount" DECIMAL,
    "coupon_code" VARCHAR(255),
    "access_until" VARCHAR(255),
    "purchased_access_days" DECIMAL,
    "purchased_lifetime_access" BOOLEAN,
    "download_count" DECIMAL,
    "first_accessed" VARCHAR(255),
    "last_accessed" VARCHAR(255),
    "environment" VARCHAR(255),
    "is_recording_only" BOOLEAN,
    "is_subscription_renewal" BOOLEAN,
    "subscription_plan_id" VARCHAR(255),
    "is_subscription_upgrade" BOOLEAN,
    "upgrade_proration_amount" VARCHAR(255),
    "subscription_cycle_start" VARCHAR(255),
    "subscription_cycle_end" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255),
    "purchasable_type" VARCHAR(255),
    "purchasable_id" VARCHAR(255),
    "access_expires_at" TIMESTAMP WITH TIME ZONE
);

-- Site text table
CREATE TABLE "sitetext" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "key" VARCHAR(255),
    "text" TEXT,
    "category" VARCHAR(255),
    "description" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Subscription plans table
CREATE TABLE "subscriptionplan" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "name" VARCHAR(255),
    "description" VARCHAR(255),
    "price" DECIMAL,
    "billing_period" VARCHAR(255),
    "has_discount" BOOLEAN,
    "discount_type" VARCHAR(255),
    "discount_value" DECIMAL,
    "discount_valid_until" VARCHAR(255),
    "is_active" BOOLEAN,
    "is_default" BOOLEAN,
    "plan_type" VARCHAR(255),
    "benefits" JSONB,
    "sort_order" DECIMAL,
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Tools table
CREATE TABLE "tool" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "category" VARCHAR(255),
    "price" DECIMAL NOT NULL DEFAULT '0',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "image_url" VARCHAR(255),
    "image_is_private" BOOLEAN DEFAULT false,
    "tags" JSONB,
    "target_audience" VARCHAR(255),
    "difficulty_level" VARCHAR(255),
    "access_days" INTEGER,
    "is_lifetime_access" BOOLEAN DEFAULT false,
    "tool_url" VARCHAR(255),
    "tool_config" JSONB DEFAULT '{}',
    "access_type" VARCHAR(255) DEFAULT 'direct',
    "creator_user_id" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Webhook logs table
CREATE TABLE "webhooklog" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Words table
CREATE TABLE "word" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "vocalized" VARCHAR(255),
    "word" VARCHAR(255),
    "root" VARCHAR(255),
    "context" VARCHAR(255),
    "difficulty" DECIMAL,
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Worden table
CREATE TABLE "worden" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "word" VARCHAR(255),
    "difficulty" DECIMAL,
    "added_by" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "is_approved" BOOLEAN,
    "source" VARCHAR(255),
    "is_sample" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Workshops table
CREATE TABLE "workshop" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "category" VARCHAR(255),
    "price" DECIMAL NOT NULL DEFAULT '0',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "image_url" VARCHAR(255),
    "image_is_private" BOOLEAN DEFAULT false,
    "tags" JSONB,
    "target_audience" VARCHAR(255),
    "difficulty_level" VARCHAR(255),
    "access_days" INTEGER,
    "is_lifetime_access" BOOLEAN DEFAULT false,
    "workshop_type" VARCHAR(255) NOT NULL DEFAULT 'recorded',
    "video_file_url" VARCHAR(255),
    "scheduled_date" TIMESTAMP WITH TIME ZONE,
    "meeting_link" VARCHAR(255),
    "meeting_password" VARCHAR(255),
    "meeting_platform" VARCHAR(255),
    "max_participants" INTEGER,
    "duration_minutes" INTEGER,
    "creator_user_id" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_by" VARCHAR(255),
    "created_by_id" VARCHAR(255)
);

-- Add indexes for better performance
CREATE INDEX idx_user_email ON "user"("email");
CREATE INDEX idx_user_role ON "user"("role");
CREATE INDEX idx_user_is_active ON "user"("is_active");

CREATE INDEX idx_course_is_published ON "course"("is_published");
CREATE INDEX idx_course_creator ON "course"("creator_user_id");
CREATE INDEX idx_course_category ON "course"("category");

CREATE INDEX idx_file_is_published ON "file"("is_published");
CREATE INDEX idx_file_creator ON "file"("creator_user_id");
CREATE INDEX idx_file_category ON "file"("category");

CREATE INDEX idx_game_is_published ON "game"("is_published");
CREATE INDEX idx_game_creator ON "game"("content_creator_id");
CREATE INDEX idx_game_type ON "game"("game_type");

CREATE INDEX idx_tool_is_published ON "tool"("is_published");
CREATE INDEX idx_tool_creator ON "tool"("creator_user_id");
CREATE INDEX idx_tool_category ON "tool"("category");

CREATE INDEX idx_workshop_is_published ON "workshop"("is_published");
CREATE INDEX idx_workshop_creator ON "workshop"("creator_user_id");
CREATE INDEX idx_workshop_category ON "workshop"("category");
CREATE INDEX idx_workshop_type ON "workshop"("workshop_type");

CREATE INDEX idx_purchase_buyer_email ON "purchase"("buyer_email");
CREATE INDEX idx_purchase_product_id ON "purchase"("product_id");
CREATE INDEX idx_purchase_workshop_id ON "purchase"("workshop_id");
CREATE INDEX idx_purchase_payment_status ON "purchase"("payment_status");

CREATE INDEX idx_gamesession_user_id ON "gamesession"("user_id");
CREATE INDEX idx_gamesession_game_id ON "gamesession"("game_id");

CREATE INDEX idx_classroom_teacher_id ON "classroom"("teacher_id");
CREATE INDEX idx_classroommembership_classroom_id ON "classroommembership"("classroom_id");
CREATE INDEX idx_classroommembership_student_user_id ON "classroommembership"("student_user_id");

CREATE INDEX idx_logs_user_id ON "logs"("user_id");
CREATE INDEX idx_logs_source_type ON "logs"("source_type");
CREATE INDEX idx_logs_log_type ON "logs"("log_type");
CREATE INDEX idx_logs_created_at ON "logs"("created_at");

CREATE INDEX idx_memory_pairing_rules_game_id ON "memory_pairing_rules"("game_id");
CREATE INDEX idx_manual_memory_pairs_pairing_rule_id ON "manual_memory_pairs"("pairing_rule_id");

CREATE INDEX idx_game_content_rule_template_id ON "game_content_rule"("template_id");
CREATE INDEX idx_game_content_rule_instance_game_usage_id ON "game_content_rule_instance"("game_usage_id");

-- Add comments for documentation
COMMENT ON TABLE "user" IS 'User accounts and authentication information';
COMMENT ON TABLE "course" IS 'Educational courses available in the platform';
COMMENT ON TABLE "file" IS 'Downloadable files and resources';
COMMENT ON TABLE "game" IS 'Educational games and interactive content';
COMMENT ON TABLE "tool" IS 'Educational tools and utilities';
COMMENT ON TABLE "workshop" IS 'Workshop content (recorded and live)';
COMMENT ON TABLE "purchase" IS 'Purchase records and access tracking';
COMMENT ON TABLE "settings" IS 'Application configuration and settings';
COMMENT ON TABLE "sitetext" IS 'Configurable text content for the site';
COMMENT ON TABLE "logs" IS 'Application logging and audit trail';

COMMIT;