#!/usr/bin/env node

/**
 * Add Missing Settings Script
 * Adds missing settings records to the database based on frontend settingsKeys.js constants
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

// Set up path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add project root to module path for imports
process.chdir(join(__dirname, '..'));

// Import models and utilities
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { luderror } from '../lib/ludlog.js';

// Define all expected settings with their default values and types
// Based on frontend /src/constants/settingsKeys.js
const EXPECTED_SETTINGS = [
  // ACCESS CONTROL SETTINGS
  { key: 'students_access', value: 'all', value_type: 'string', description: 'Student portal access mode (all, authed_only, invite_only)' },
  { key: 'student_invitation_expiry_days', value: 7, value_type: 'number', description: 'Number of days before student invitation expires' },
  { key: 'parent_consent_required', value: false, value_type: 'boolean', description: 'Whether parent consent is required for student registration' },

  // CONTACT & SITE INFORMATION SETTINGS
  { key: 'contact_email', value: null, value_type: 'string', description: 'Contact email address' },
  { key: 'contact_phone', value: null, value_type: 'string', description: 'Contact phone number' },
  { key: 'site_name', value: 'Ludora', value_type: 'string', description: 'Site name for branding' },
  { key: 'site_description', value: 'Educational platform for interactive learning', value_type: 'string', description: 'Site description for SEO and branding' },
  { key: 'copyright_text', value: '© Ludora. All rights reserved.', value_type: 'string', description: 'Copyright text displayed in footer' },

  // BRANDING SETTINGS
  { key: 'has_logo', value: false, value_type: 'boolean', description: 'Whether a custom logo is configured' },
  { key: 'logo_filename', value: null, value_type: 'string', description: 'Filename of the logo asset' },
  { key: 'logo_url', value: null, value_type: 'string', description: 'Legacy logo URL (deprecated, use logo_filename)' },

  // SYSTEM SETTINGS
  { key: 'maintenance_mode', value: false, value_type: 'boolean', description: 'System maintenance mode flag' },
  { key: 'subscription_system_enabled', value: true, value_type: 'boolean', description: 'Legacy - Whether subscription system is enabled' },
  { key: 'teacher_onboarding_enabled', value: true, value_type: 'boolean', description: 'Whether teacher onboarding flow is enabled' },
  { key: 'student_onboarding_enabled', value: false, value_type: 'boolean', description: 'Whether student onboarding flow is enabled (does nothing for now)' },

  // NAVIGATION CONFIGURATION SETTINGS - Curriculum
  { key: 'nav_curriculum_enabled', value: true, value_type: 'boolean', description: 'Enable curriculum navigation item' },
  { key: 'nav_curriculum_text', value: 'Curriculum', value_type: 'string', description: 'Text for curriculum navigation item' },
  { key: 'nav_curriculum_icon', value: 'book', value_type: 'string', description: 'Icon for curriculum navigation item' },
  { key: 'nav_curriculum_visibility', value: 'logged_in_users', value_type: 'string', description: 'Visibility setting for curriculum navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Files
  { key: 'nav_files_enabled', value: true, value_type: 'boolean', description: 'Enable files navigation item' },
  { key: 'nav_files_text', value: 'Files', value_type: 'string', description: 'Text for files navigation item' },
  { key: 'nav_files_icon', value: 'file', value_type: 'string', description: 'Icon for files navigation item' },
  { key: 'nav_files_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for files navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Games
  { key: 'nav_games_enabled', value: true, value_type: 'boolean', description: 'Enable games navigation item' },
  { key: 'nav_games_text', value: 'Games', value_type: 'string', description: 'Text for games navigation item' },
  { key: 'nav_games_icon', value: 'gamepad', value_type: 'string', description: 'Icon for games navigation item' },
  { key: 'nav_games_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for games navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Workshops
  { key: 'nav_workshops_enabled', value: true, value_type: 'boolean', description: 'Enable workshops navigation item' },
  { key: 'nav_workshops_text', value: 'Workshops', value_type: 'string', description: 'Text for workshops navigation item' },
  { key: 'nav_workshops_icon', value: 'video', value_type: 'string', description: 'Icon for workshops navigation item' },
  { key: 'nav_workshops_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for workshops navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Courses
  { key: 'nav_courses_enabled', value: true, value_type: 'boolean', description: 'Enable courses navigation item' },
  { key: 'nav_courses_text', value: 'Courses', value_type: 'string', description: 'Text for courses navigation item' },
  { key: 'nav_courses_icon', value: 'graduation-cap', value_type: 'string', description: 'Icon for courses navigation item' },
  { key: 'nav_courses_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for courses navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Classrooms
  { key: 'nav_classrooms_enabled', value: true, value_type: 'boolean', description: 'Enable classrooms navigation item' },
  { key: 'nav_classrooms_text', value: 'Classrooms', value_type: 'string', description: 'Text for classrooms navigation item' },
  { key: 'nav_classrooms_icon', value: 'users', value_type: 'string', description: 'Icon for classrooms navigation item' },
  { key: 'nav_classrooms_visibility', value: 'logged_in_users', value_type: 'string', description: 'Visibility setting for classrooms navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Lesson Plans
  { key: 'nav_lesson_plans_enabled', value: true, value_type: 'boolean', description: 'Enable lesson plans navigation item' },
  { key: 'nav_lesson_plans_text', value: 'Lesson Plans', value_type: 'string', description: 'Text for lesson plans navigation item' },
  { key: 'nav_lesson_plans_icon', value: 'clipboard', value_type: 'string', description: 'Icon for lesson plans navigation item' },
  { key: 'nav_lesson_plans_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for lesson plans navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Tools
  { key: 'nav_tools_enabled', value: true, value_type: 'boolean', description: 'Enable tools navigation item' },
  { key: 'nav_tools_text', value: 'Tools', value_type: 'string', description: 'Text for tools navigation item' },
  { key: 'nav_tools_icon', value: 'wrench', value_type: 'string', description: 'Icon for tools navigation item' },
  { key: 'nav_tools_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for tools navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Account
  { key: 'nav_account_enabled', value: true, value_type: 'boolean', description: 'Enable account navigation item' },
  { key: 'nav_account_text', value: 'Account', value_type: 'string', description: 'Text for account navigation item' },
  { key: 'nav_account_icon', value: 'user', value_type: 'string', description: 'Icon for account navigation item' },
  { key: 'nav_account_visibility', value: 'logged_in_users', value_type: 'string', description: 'Visibility setting for account navigation' },

  // NAVIGATION CONFIGURATION SETTINGS - Content Creators
  { key: 'nav_content_creators_enabled', value: true, value_type: 'boolean', description: 'Enable content creators navigation item' },
  { key: 'nav_content_creators_text', value: 'Content Creators', value_type: 'string', description: 'Text for content creators navigation item' },
  { key: 'nav_content_creators_icon', value: 'star', value_type: 'string', description: 'Icon for content creators navigation item' },
  { key: 'nav_content_creators_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for content creators navigation' },

  // Navigation order
  { key: 'nav_order', value: ['curriculum', 'files', 'games', 'workshops', 'courses', 'classrooms', 'lesson_plans', 'tools', 'account', 'content_creators'], value_type: 'array', description: 'Order of navigation items' },

  // CONTENT CREATOR PERMISSIONS SETTINGS
  { key: 'allow_content_creator_workshops', value: true, value_type: 'boolean', description: 'Allow content creators to create workshops' },
  { key: 'allow_content_creator_courses', value: true, value_type: 'boolean', description: 'Allow content creators to create courses' },
  { key: 'allow_content_creator_files', value: true, value_type: 'boolean', description: 'Allow content creators to upload files' },
  { key: 'allow_content_creator_tools', value: true, value_type: 'boolean', description: 'Allow content creators to create tools' },
  { key: 'allow_content_creator_games', value: true, value_type: 'boolean', description: 'Allow content creators to create games' },
  { key: 'allow_content_creator_lesson_plans', value: true, value_type: 'boolean', description: 'Allow content creators to create lesson plans' },

  // ACCESS DURATION SETTINGS - Courses
  { key: 'default_course_access_days', value: 365, value_type: 'number', description: 'Default number of days for course access' },
  { key: 'course_lifetime_access', value: true, value_type: 'boolean', description: 'Whether courses have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Files
  { key: 'default_file_access_days', value: 365, value_type: 'number', description: 'Default number of days for file access' },
  { key: 'file_lifetime_access', value: true, value_type: 'boolean', description: 'Whether files have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Games
  { key: 'default_game_access_days', value: 365, value_type: 'number', description: 'Default number of days for game access' },
  { key: 'game_lifetime_access', value: true, value_type: 'boolean', description: 'Whether games have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Workshops
  { key: 'default_workshop_access_days', value: 365, value_type: 'number', description: 'Default number of days for workshop access' },
  { key: 'workshop_lifetime_access', value: true, value_type: 'boolean', description: 'Whether workshops have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Lesson Plans
  { key: 'default_lesson_plan_access_days', value: 365, value_type: 'number', description: 'Default number of days for lesson plan access' },
  { key: 'lesson_plan_lifetime_access', value: true, value_type: 'boolean', description: 'Whether lesson plans have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Tools
  { key: 'default_tool_access_days', value: 365, value_type: 'number', description: 'Default number of days for tool access' },
  { key: 'tool_lifetime_access', value: true, value_type: 'boolean', description: 'Whether tools have lifetime access by default' },

  // ACCESS DURATION SETTINGS - Recordings
  { key: 'default_recording_access_days', value: 30, value_type: 'number', description: 'Default number of days for recording access' },
  { key: 'recording_lifetime_access', value: false, value_type: 'boolean', description: 'Whether recordings have lifetime access by default' },

  // ADVANCED FEATURES SETTINGS
  { key: 'available_dashboard_widgets', value: ['recent_activity', 'quick_actions', 'stats', 'announcements'], value_type: 'array', description: 'List of available dashboard widgets' },
  { key: 'available_specializations', value: ['math', 'science', 'language', 'arts', 'music', 'physical_education', 'special_education'], value_type: 'array', description: 'List of available teacher specializations' },
  { key: 'available_grade_levels', value: ['preschool', 'elementary', 'middle_school', 'high_school', 'higher_education'], value_type: 'array', description: 'List of available grade levels' }
];

/**
 * Main function to add missing settings
 */
async function addMissingSettings() {

  try {
    // Get existing settings from database
    const existingSettings = await models.Settings.findAll();
    const existingKeys = new Set(existingSettings.map(s => s.key));

    // Find missing settings
    const missingSettings = EXPECTED_SETTINGS.filter(s => !existingKeys.has(s.key));

    if (missingSettings.length === 0) {

      return;
    }

    missingSettings.forEach(s => {
    });

    // Validate and prepare records to insert
    const recordsToInsert = missingSettings.map(setting => {
      // Input validation for security
      if (!setting.key || typeof setting.key !== 'string' || setting.key.length > 255) {
        throw new Error(`Invalid setting key: ${setting.key}`);
      }

      if (!setting.value_type || !['string', 'number', 'boolean', 'array'].includes(setting.value_type)) {
        throw new Error(`Invalid value type: ${setting.value_type}`);
      }

      if (setting.description && (typeof setting.description !== 'string' || setting.description.length > 1000)) {
        throw new Error(`Invalid description for key: ${setting.key}`);
      }

      // Validate value matches declared type
      const valueType = setting.value_type;
      const value = setting.value;

      if (valueType === 'string' && value !== null && typeof value !== 'string') {
        throw new Error(`Value for ${setting.key} should be string but got ${typeof value}`);
      }
      if (valueType === 'number' && value !== null && typeof value !== 'number') {
        throw new Error(`Value for ${setting.key} should be number but got ${typeof value}`);
      }
      if (valueType === 'boolean' && value !== null && typeof value !== 'boolean') {
        throw new Error(`Value for ${setting.key} should be boolean but got ${typeof value}`);
      }
      if (valueType === 'array' && value !== null && !Array.isArray(value)) {
        throw new Error(`Value for ${setting.key} should be array but got ${typeof value}`);
      }

      return {
        id: generateId(),
        key: setting.key,
        value: setting.value,
        value_type: setting.value_type,
        description: setting.description,
        created_at: new Date(),
        updated_at: new Date()
      };
    });

    // Insert missing settings in a transaction
    const transaction = await models.sequelize.transaction();

    try {
      await models.Settings.bulkCreate(recordsToInsert, { transaction });
      await transaction.commit();

      // Verify final count
      const finalCount = await models.Settings.count();

      if (finalCount >= EXPECTED_SETTINGS.length) {

      } else {
        luderror.api(`⚠️  Warning: Final count (${finalCount}) is less than expected (${EXPECTED_SETTINGS.length})`);
      }

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    luderror.api('❌ Error adding missing settings:', error.message);
    luderror.api(error.stack);
    process.exit(1);
  }
}

/**
 * List all settings currently in database
 */
async function listCurrentSettings() {
  const settings = await models.Settings.findAll({
    order: [['key', 'ASC']]
  });

  settings.forEach(s => {
    const value = typeof s.value === 'object' ? JSON.stringify(s.value) : s.value;
    const displayValue = value === null ? 'null' : (String(value).length > 40 ? String(value).substring(0, 40) + '...' : value);
  });

}

// Main execution
async function main() {
  try {
    // Run the add missing settings function
    await addMissingSettings();

    // Optionally list all settings after
    if (process.argv.includes('--list')) {
      await listCurrentSettings();
    }

    process.exit(0);

  } catch (error) {
    luderror.api('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
