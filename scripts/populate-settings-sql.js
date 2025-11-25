#!/usr/bin/env node

/**
 * Generate SQL to populate staging and production with core settings
 */

import crypto from 'crypto';

function generateId() {
  return crypto.randomBytes(16).toString('hex').substring(0, 22);
}

// Core settings from add-missing-settings.js (without computed settings)
const CORE_SETTINGS = [
  // ACCESS CONTROL SETTINGS
  { key: 'students_access', value: 'all', value_type: 'string', description: 'Student portal access mode (all, authed_only, invite_only)' },
  { key: 'student_invitation_expiry_days', value: 7, value_type: 'number', description: 'Number of days before student invitation expires' },
  { key: 'parent_consent_required', value: false, value_type: 'boolean', description: 'Whether parent consent is required for student registration' },

  // CONTACT & SITE INFORMATION SETTINGS
  { key: 'contact_email', value: 'support@ludora.com', value_type: 'string', description: 'Contact email address' },
  { key: 'contact_phone', value: '0529593382', value_type: 'string', description: 'Contact phone number' },
  { key: 'site_name', value: 'לודורה', value_type: 'string', description: 'Site name for branding' },
  { key: 'site_description', value: null, value_type: 'string', description: 'Site description for SEO and branding' },
  { key: 'copyright_text', value: 'כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.', value_type: 'string', description: 'Copyright text displayed in footer' },

  // BRANDING SETTINGS
  { key: 'has_logo', value: false, value_type: 'boolean', description: 'Whether a custom logo is configured' },
  { key: 'logo_filename', value: null, value_type: 'string', description: 'Filename of the logo asset' },
  { key: 'logo_url', value: null, value_type: 'string', description: 'Legacy logo URL (deprecated, use logo_filename)' },

  // SYSTEM SETTINGS
  { key: 'maintenance_mode', value: true, value_type: 'boolean', description: 'System maintenance mode flag (forced true for staging/production)' },
  { key: 'subscription_system_enabled', value: false, value_type: 'boolean', description: 'Legacy - Whether subscription system is enabled' },
  { key: 'teacher_onboarding_enabled', value: false, value_type: 'boolean', description: 'Whether teacher onboarding flow is enabled' },

  // NAVIGATION CONFIGURATION SETTINGS - copying from development actual values
  { key: 'nav_curriculum_enabled', value: true, value_type: 'boolean', description: 'Enable curriculum navigation item' },
  { key: 'nav_curriculum_text', value: 'תכניות לימודים', value_type: 'string', description: 'Text for curriculum navigation item' },
  { key: 'nav_curriculum_icon', value: 'BookOpen', value_type: 'string', description: 'Icon for curriculum navigation item' },
  { key: 'nav_curriculum_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for curriculum navigation' },

  { key: 'nav_files_enabled', value: true, value_type: 'boolean', description: 'Enable files navigation item' },
  { key: 'nav_files_text', value: 'Files', value_type: 'string', description: 'Text for files navigation item' },
  { key: 'nav_files_icon', value: 'FileText', value_type: 'string', description: 'Icon for files navigation item' },
  { key: 'nav_files_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for files navigation' },

  { key: 'nav_games_enabled', value: true, value_type: 'boolean', description: 'Enable games navigation item' },
  { key: 'nav_games_text', value: 'Games', value_type: 'string', description: 'Text for games navigation item' },
  { key: 'nav_games_icon', value: 'Gamepad', value_type: 'string', description: 'Icon for games navigation item' },
  { key: 'nav_games_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for games navigation' },

  { key: 'nav_workshops_enabled', value: false, value_type: 'boolean', description: 'Enable workshops navigation item' },
  { key: 'nav_workshops_text', value: 'Workshops', value_type: 'string', description: 'Text for workshops navigation item' },
  { key: 'nav_workshops_icon', value: 'Calendar', value_type: 'string', description: 'Icon for workshops navigation item' },
  { key: 'nav_workshops_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for workshops navigation' },

  { key: 'nav_courses_enabled', value: false, value_type: 'boolean', description: 'Enable courses navigation item' },
  { key: 'nav_courses_text', value: 'Courses', value_type: 'string', description: 'Text for courses navigation item' },
  { key: 'nav_courses_icon', value: 'Video', value_type: 'string', description: 'Icon for courses navigation item' },
  { key: 'nav_courses_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for courses navigation' },

  { key: 'nav_classrooms_enabled', value: false, value_type: 'boolean', description: 'Enable classrooms navigation item' },
  { key: 'nav_classrooms_text', value: 'Classrooms', value_type: 'string', description: 'Text for classrooms navigation item' },
  { key: 'nav_classrooms_icon', value: 'GraduationCap', value_type: 'string', description: 'Icon for classrooms navigation item' },
  { key: 'nav_classrooms_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for classrooms navigation' },

  { key: 'nav_lesson_plans_enabled', value: true, value_type: 'boolean', description: 'Enable lesson plans navigation item' },
  { key: 'nav_lesson_plans_text', value: 'מערכי שיעור', value_type: 'string', description: 'Text for lesson plans navigation item' },
  { key: 'nav_lesson_plans_icon', value: 'Folder', value_type: 'string', description: 'Icon for lesson plans navigation item' },
  { key: 'nav_lesson_plans_visibility', value: 'public', value_type: 'string', description: 'Visibility setting for lesson plans navigation' },

  { key: 'nav_tools_enabled', value: false, value_type: 'boolean', description: 'Enable tools navigation item' },
  { key: 'nav_tools_text', value: 'Tools', value_type: 'string', description: 'Text for tools navigation item' },
  { key: 'nav_tools_icon', value: 'Wrench', value_type: 'string', description: 'Icon for tools navigation item' },
  { key: 'nav_tools_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for tools navigation' },

  { key: 'nav_account_enabled', value: true, value_type: 'boolean', description: 'Enable account navigation item' },
  { key: 'nav_account_text', value: 'Account', value_type: 'string', description: 'Text for account navigation item' },
  { key: 'nav_account_icon', value: 'UserCircle', value_type: 'string', description: 'Icon for account navigation item' },
  { key: 'nav_account_visibility', value: 'logged_in_users', value_type: 'string', description: 'Visibility setting for account navigation' },

  { key: 'nav_content_creators_enabled', value: false, value_type: 'boolean', description: 'Enable content creators navigation item' },
  { key: 'nav_content_creators_text', value: 'Content Creators', value_type: 'string', description: 'Text for content creators navigation item' },
  { key: 'nav_content_creators_icon', value: 'Crown', value_type: 'string', description: 'Icon for content creators navigation item' },
  { key: 'nav_content_creators_visibility', value: 'hidden', value_type: 'string', description: 'Visibility setting for content creators navigation' },

  // Navigation order
  { key: 'nav_order', value: ["curriculum","lesson_plans","files","games","workshops","courses","classrooms","tools","account","content_creators"], value_type: 'array', description: 'Order of navigation items' },

  // CONTENT CREATOR PERMISSIONS SETTINGS
  { key: 'allow_content_creator_workshops', value: false, value_type: 'boolean', description: 'Allow content creators to create workshops' },
  { key: 'allow_content_creator_courses', value: false, value_type: 'boolean', description: 'Allow content creators to create courses' },
  { key: 'allow_content_creator_files', value: false, value_type: 'boolean', description: 'Allow content creators to upload files' },
  { key: 'allow_content_creator_tools', value: false, value_type: 'boolean', description: 'Allow content creators to create tools' },
  { key: 'allow_content_creator_games', value: false, value_type: 'boolean', description: 'Allow content creators to create games' },
  { key: 'allow_content_creator_lesson_plans', value: false, value_type: 'boolean', description: 'Allow content creators to create lesson plans' },

  // ACCESS DURATION SETTINGS
  { key: 'default_course_access_days', value: 365, value_type: 'number', description: 'Default number of days for course access' },
  { key: 'course_lifetime_access', value: true, value_type: 'boolean', description: 'Whether courses have lifetime access by default' },

  { key: 'default_file_access_days', value: 365, value_type: 'number', description: 'Default number of days for file access' },
  { key: 'file_lifetime_access', value: true, value_type: 'boolean', description: 'Whether files have lifetime access by default' },

  { key: 'default_game_access_days', value: 365, value_type: 'number', description: 'Default number of days for game access' },
  { key: 'game_lifetime_access', value: true, value_type: 'boolean', description: 'Whether games have lifetime access by default' },

  { key: 'default_workshop_access_days', value: 365, value_type: 'number', description: 'Default number of days for workshop access' },
  { key: 'workshop_lifetime_access', value: true, value_type: 'boolean', description: 'Whether workshops have lifetime access by default' },

  { key: 'default_lesson_plan_access_days', value: 365, value_type: 'number', description: 'Default number of days for lesson plan access' },
  { key: 'lesson_plan_lifetime_access', value: true, value_type: 'boolean', description: 'Whether lesson plans have lifetime access by default' },

  { key: 'default_tool_access_days', value: 365, value_type: 'number', description: 'Default number of days for tool access' },
  { key: 'tool_lifetime_access', value: true, value_type: 'boolean', description: 'Whether tools have lifetime access by default' },

  { key: 'default_recording_access_days', value: 30, value_type: 'number', description: 'Default number of days for recording access' },
  { key: 'recording_lifetime_access', value: false, value_type: 'boolean', description: 'Whether recordings have lifetime access by default' },

  // ADVANCED FEATURES SETTINGS - using development actual values
  { key: 'available_dashboard_widgets', value: {"color-wheel":{"id":"color-wheel","name":"גלגל צבעים","description":"כלי לבחירת צבעים"},"my-products":{"id":"my-products","name":"המוצרים שלי"},"purchase-history":{"id":"purchase-history","name":"היסטוריית רכישות"}}, value_type: 'object', description: 'Available widgets for user dashboards' },
  { key: 'available_specializations', value: [{"key":"civics","name":"אזרחות","emoji":"🏛️","enabled":true},{"key":"art","name":"אמנות","emoji":"🎨","enabled":true},{"key":"english","name":"אנגלית","emoji":"🇺🇸","enabled":true},{"key":"biology","name":"ביולוגיה","emoji":"🧬","enabled":true},{"key":"geography","name":"גיאוגרפיה","emoji":"🌍","enabled":true},{"key":"history","name":"היסטוריה","emoji":"📚","enabled":true},{"key":"physical_education","name":"חינוך גופני","emoji":"⚽","enabled":true},{"key":"calculation","name":"חשבון","emoji":"🔢","enabled":true},{"key":"chemistry","name":"כימיה","emoji":"⚗️","enabled":true},{"key":"hebrew_language","name":"לשון והבעה","emoji":"📖","enabled":true},{"key":"legacy","name":"מורשת","emoji":"🏛️","enabled":true},{"key":"religion","name":"מחשבת ישראל","emoji":"📜","enabled":true},{"key":"computers","name":"מחשבים","emoji":"💻","enabled":true},{"key":"music","name":"מוזיקה","emoji":"🎵","enabled":true},{"key":"math","name":"מתמטיקה","emoji":"🔢","enabled":true},{"key":"spanish","name":"ספרדית","emoji":"🇪🇸","enabled":true},{"key":"literature","name":"ספרות","emoji":"📖","enabled":true},{"key":"arabic","name":"ערבית","emoji":"🇸🇦","enabled":true},{"key":"physics","name":"פיזיקה","emoji":"⚛️","enabled":true},{"key":"french","name":"צרפתית","emoji":"🇫🇷","enabled":true},{"key":"bible_studies","name":"תנ\"ך","emoji":"📜","enabled":true}], value_type: 'array', description: 'List of available teacher specializations' },
  { key: 'available_grade_levels', value: [{"label":"🧸 גן חובה","value":"kindergarten","enabled":true},{"label":"1️⃣ כיתה א'","value":"grade_1","enabled":true},{"label":"2️⃣ כיתה ב'","value":"grade_2","enabled":true},{"label":"3️⃣ כיתה ג'","value":"grade_3","enabled":true},{"label":"4️⃣ כיתה ד'","value":"grade_4","enabled":true},{"label":"5️⃣ כיתה ה'","value":"grade_5","enabled":true},{"label":"6️⃣ כיתה ו'","value":"grade_6","enabled":true},{"label":"7️⃣ כיתה ז'","value":"grade_7","enabled":true},{"label":"8️⃣ כיתה ח'","value":"grade_8","enabled":true},{"label":"9️⃣ כיתה ט'","value":"grade_9","enabled":true},{"label":"🔟 כיתה י'","value":"grade_10","enabled":true},{"label":"🎯 כיתה יא'","value":"grade_11","enabled":true},{"label":"🎓 כיתה יב'","value":"grade_12","enabled":true}], value_type: 'array', description: 'List of available grade levels' }
];

console.log('-- Clear existing settings');
console.log('DELETE FROM settings;');
console.log('');

console.log('-- Insert core settings');
CORE_SETTINGS.forEach(setting => {
  const id = generateId();
  const valueJson = JSON.stringify(setting.value).replace(/'/g, "''");
  const escapedDescription = setting.description.replace(/'/g, "''");

  console.log(`INSERT INTO settings (id, key, value, value_type, description, created_at, updated_at)`);
  console.log(`VALUES ('${id}', '${setting.key}', '${valueJson}', '${setting.value_type}', '${escapedDescription}', NOW(), NOW());`);
});

console.log('');
console.log('-- Verify settings count');
console.log('SELECT COUNT(*) as total_settings FROM settings;');