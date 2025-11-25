// Centralized Settings keys definitions
// This is the single source of truth for all Settings keys in the system
// To add/remove settings keys, only modify this file and update SettingsService usage

/**
 * ACCESS CONTROL SETTINGS
 * Control student access modes and invitation system
 */
export const ACCESS_CONTROL_KEYS = {
  STUDENTS_ACCESS: 'students_access',
  STUDENT_INVITATION_EXPIRY_DAYS: 'student_invitation_expiry_days',
  PARENT_CONSENT_REQUIRED: 'parent_consent_required'
};

/**
 * CONTACT & SITE INFORMATION SETTINGS
 * Basic site information and contact details
 */
export const CONTACT_INFO_KEYS = {
  CONTACT_EMAIL: 'contact_email',
  CONTACT_PHONE: 'contact_phone',
  SITE_NAME: 'site_name',
  SITE_DESCRIPTION: 'site_description',
  COPYRIGHT_TEXT: 'copyright_text'
};

/**
 * BRANDING SETTINGS
 * Logo and visual branding configuration
 */
export const BRANDING_KEYS = {
  HAS_LOGO: 'has_logo',
  LOGO_FILENAME: 'logo_filename',
  LOGO_URL: 'logo_url'  // Legacy - kept for backward compatibility
};

/**
 * SYSTEM SETTINGS
 * Core system behavior and feature toggles
 */
export const SYSTEM_KEYS = {
  MAINTENANCE_MODE: 'maintenance_mode',
  SUBSCRIPTION_SYSTEM_ENABLED: 'subscription_system_enabled',  // Legacy
  TEACHER_ONBOARDING_ENABLED: 'teacher_onboarding_enabled',
};

/**
 * NAVIGATION CONFIGURATION SETTINGS
 * Control navigation menu items visibility and content
 */
export const NAVIGATION_KEYS = {
  // Curriculum navigation
  NAV_CURRICULUM_ENABLED: 'nav_curriculum_enabled',
  NAV_CURRICULUM_TEXT: 'nav_curriculum_text',
  NAV_CURRICULUM_ICON: 'nav_curriculum_icon',
  NAV_CURRICULUM_VISIBILITY: 'nav_curriculum_visibility',

  // Files navigation
  NAV_FILES_ENABLED: 'nav_files_enabled',
  NAV_FILES_TEXT: 'nav_files_text',
  NAV_FILES_ICON: 'nav_files_icon',
  NAV_FILES_VISIBILITY: 'nav_files_visibility',

  // Games navigation
  NAV_GAMES_ENABLED: 'nav_games_enabled',
  NAV_GAMES_TEXT: 'nav_games_text',
  NAV_GAMES_ICON: 'nav_games_icon',
  NAV_GAMES_VISIBILITY: 'nav_games_visibility',

  // Workshops navigation
  NAV_WORKSHOPS_ENABLED: 'nav_workshops_enabled',
  NAV_WORKSHOPS_TEXT: 'nav_workshops_text',
  NAV_WORKSHOPS_ICON: 'nav_workshops_icon',
  NAV_WORKSHOPS_VISIBILITY: 'nav_workshops_visibility',

  // Courses navigation
  NAV_COURSES_ENABLED: 'nav_courses_enabled',
  NAV_COURSES_TEXT: 'nav_courses_text',
  NAV_COURSES_ICON: 'nav_courses_icon',
  NAV_COURSES_VISIBILITY: 'nav_courses_visibility',

  // Classrooms navigation
  NAV_CLASSROOMS_ENABLED: 'nav_classrooms_enabled',
  NAV_CLASSROOMS_TEXT: 'nav_classrooms_text',
  NAV_CLASSROOMS_ICON: 'nav_classrooms_icon',
  NAV_CLASSROOMS_VISIBILITY: 'nav_classrooms_visibility',

  // Lesson plans navigation
  NAV_LESSON_PLANS_ENABLED: 'nav_lesson_plans_enabled',
  NAV_LESSON_PLANS_TEXT: 'nav_lesson_plans_text',
  NAV_LESSON_PLANS_ICON: 'nav_lesson_plans_icon',
  NAV_LESSON_PLANS_VISIBILITY: 'nav_lesson_plans_visibility',

  // Tools navigation
  NAV_TOOLS_ENABLED: 'nav_tools_enabled',
  NAV_TOOLS_TEXT: 'nav_tools_text',
  NAV_TOOLS_ICON: 'nav_tools_icon',
  NAV_TOOLS_VISIBILITY: 'nav_tools_visibility',

  // Account navigation
  NAV_ACCOUNT_ENABLED: 'nav_account_enabled',
  NAV_ACCOUNT_TEXT: 'nav_account_text',
  NAV_ACCOUNT_ICON: 'nav_account_icon',
  NAV_ACCOUNT_VISIBILITY: 'nav_account_visibility',

  // Content creators navigation
  NAV_CONTENT_CREATORS_ENABLED: 'nav_content_creators_enabled',
  NAV_CONTENT_CREATORS_TEXT: 'nav_content_creators_text',
  NAV_CONTENT_CREATORS_ICON: 'nav_content_creators_icon',
  NAV_CONTENT_CREATORS_VISIBILITY: 'nav_content_creators_visibility',

  // Navigation order
  NAV_ORDER: 'nav_order'
};

/**
 * CONTENT CREATOR PERMISSIONS SETTINGS
 * Control what content types creators can create
 */
export const CONTENT_CREATOR_KEYS = {
  ALLOW_CONTENT_CREATOR_WORKSHOPS: 'allow_content_creator_workshops',
  ALLOW_CONTENT_CREATOR_COURSES: 'allow_content_creator_courses',
  ALLOW_CONTENT_CREATOR_FILES: 'allow_content_creator_files',
  ALLOW_CONTENT_CREATOR_TOOLS: 'allow_content_creator_tools',
  ALLOW_CONTENT_CREATOR_GAMES: 'allow_content_creator_games',
  ALLOW_CONTENT_CREATOR_LESSON_PLANS: 'allow_content_creator_lesson_plans'
};

/**
 * ACCESS DURATION SETTINGS
 * Default access periods and lifetime access flags
 */
export const ACCESS_DURATION_KEYS = {
  // Course access settings
  DEFAULT_COURSE_ACCESS_DAYS: 'default_course_access_days',
  COURSE_LIFETIME_ACCESS: 'course_lifetime_access',

  // File access settings
  DEFAULT_FILE_ACCESS_DAYS: 'default_file_access_days',
  FILE_LIFETIME_ACCESS: 'file_lifetime_access',

  // Game access settings
  DEFAULT_GAME_ACCESS_DAYS: 'default_game_access_days',
  GAME_LIFETIME_ACCESS: 'game_lifetime_access',

  // Workshop access settings
  DEFAULT_WORKSHOP_ACCESS_DAYS: 'default_workshop_access_days',
  WORKSHOP_LIFETIME_ACCESS: 'workshop_lifetime_access',

  // Lesson plan access settings
  DEFAULT_LESSON_PLAN_ACCESS_DAYS: 'default_lesson_plan_access_days',
  LESSON_PLAN_LIFETIME_ACCESS: 'lesson_plan_lifetime_access',

  // Tool access settings
  DEFAULT_TOOL_ACCESS_DAYS: 'default_tool_access_days',
  TOOL_LIFETIME_ACCESS: 'tool_lifetime_access',

  // Recording access settings
  DEFAULT_RECORDING_ACCESS_DAYS: 'default_recording_access_days',
  RECORDING_LIFETIME_ACCESS: 'recording_lifetime_access'
};

/**
 * ADVANCED FEATURES SETTINGS
 * Complex configuration objects for advanced features
 */
export const ADVANCED_FEATURES_KEYS = {
  AVAILABLE_DASHBOARD_WIDGETS: 'available_dashboard_widgets',
  AVAILABLE_SPECIALIZATIONS: 'available_specializations',
  AVAILABLE_GRADE_LEVELS: 'available_grade_levels',
  // Legacy keys with typos (kept for backwards compatibility)
  AUDIANCE_TARGETS: 'audiance_targets',  // TODO: Fix typo to 'audience_targets'
  LANGUADE_OPTIONS: 'languade_options',  // TODO: Fix typo to 'language_options'
  // Additional legacy configuration keys
  SCHOOL_GRADES: 'school_grades',
  STUDY_SUBJECTS: 'study_subjects',
  // Product type configuration
  FILE_TYPES_CONFIG: 'file_types_config',
  GAME_TYPES: 'game_types'
};

/**
 * STUDENTS ACCESS MODES ENUM
 * Valid values for students_access setting
 */
export const STUDENTS_ACCESS_MODES = {
  INVITE_ONLY: 'invite_only',      // Requires lobby_code, session_id, or teacher_invitation_code
  AUTHED_ONLY: 'authed_only',      // Requires authentication
  ALL: 'all'                        // Both authenticated and anonymous allowed (default)
};

/**
 * NAVIGATION VISIBILITY OPTIONS ENUM
 * Valid values for navigation visibility settings
 */
export const NAV_VISIBILITY_OPTIONS = {
  PUBLIC: 'public',
  LOGGED_IN_USERS: 'logged_in_users',
  ADMINS_AND_CREATORS: 'admins_and_creators',
  ADMIN_ONLY: 'admin_only',
  HIDDEN: 'hidden'  // Completely hidden from all users
};

/**
 * COMPLETE SETTINGS KEYS COLLECTION
 * All setting keys organized by category
 */
export const ALL_SETTINGS_KEYS = {
  ...ACCESS_CONTROL_KEYS,
  ...CONTACT_INFO_KEYS,
  ...BRANDING_KEYS,
  ...SYSTEM_KEYS,
  ...NAVIGATION_KEYS,
  ...CONTENT_CREATOR_KEYS,
  ...ACCESS_DURATION_KEYS,
  ...ADVANCED_FEATURES_KEYS
};

/**
 * SETTINGS CATEGORIES
 * For organizing settings in UI or management interfaces
 */
export const SETTINGS_CATEGORIES = {
  ACCESS_CONTROL: 'access_control',
  CONTACT_INFO: 'contact_info',
  BRANDING: 'branding',
  SYSTEM: 'system',
  NAVIGATION: 'navigation',
  CONTENT_CREATOR: 'content_creator',
  ACCESS_DURATION: 'access_duration',
  ADVANCED_FEATURES: 'advanced_features'
};

/**
 * CATEGORY TO KEYS MAPPING
 * Maps each category to its associated setting keys
 */
export const CATEGORY_KEYS_MAP = {
  [SETTINGS_CATEGORIES.ACCESS_CONTROL]: Object.values(ACCESS_CONTROL_KEYS),
  [SETTINGS_CATEGORIES.CONTACT_INFO]: Object.values(CONTACT_INFO_KEYS),
  [SETTINGS_CATEGORIES.BRANDING]: Object.values(BRANDING_KEYS),
  [SETTINGS_CATEGORIES.SYSTEM]: Object.values(SYSTEM_KEYS),
  [SETTINGS_CATEGORIES.NAVIGATION]: Object.values(NAVIGATION_KEYS),
  [SETTINGS_CATEGORIES.CONTENT_CREATOR]: Object.values(CONTENT_CREATOR_KEYS),
  [SETTINGS_CATEGORIES.ACCESS_DURATION]: Object.values(ACCESS_DURATION_KEYS),
  [SETTINGS_CATEGORIES.ADVANCED_FEATURES]: Object.values(ADVANCED_FEATURES_KEYS)
};

/**
 * ALL SETTINGS KEYS AS ARRAY
 * For iteration, validation, and batch operations
 */
export const ALL_SETTINGS_KEYS_ARRAY = Object.values(ALL_SETTINGS_KEYS);

/**
 * Helper function to get all keys for a specific category
 * @param {string} category - Settings category name
 * @returns {string[]} Array of setting keys for the category
 */
export const getKeysForCategory = (category) => {
  return CATEGORY_KEYS_MAP[category] || [];
};

/**
 * Helper function to get category for a specific setting key
 * @param {string} key - Setting key name
 * @returns {string|null} Category name or null if key not found
 */
export const getCategoryForKey = (key) => {
  for (const [category, keys] of Object.entries(CATEGORY_KEYS_MAP)) {
    if (keys.includes(key)) {
      return category;
    }
  }
  return null;
};

/**
 * Helper function to validate if a key exists
 * @param {string} key - Setting key to validate
 * @returns {boolean} True if key exists in system
 */
export const isValidSettingKey = (key) => {
  return ALL_SETTINGS_KEYS_ARRAY.includes(key);
};

/**
 * Helper function to get all navigation keys
 * @returns {string[]} All navigation-related setting keys
 */
export const getAllNavigationKeys = () => {
  return Object.values(NAVIGATION_KEYS);
};

/**
 * Helper function to get all content creator permission keys
 * @returns {string[]} All content creator permission setting keys
 */
export const getAllContentCreatorKeys = () => {
  return Object.values(CONTENT_CREATOR_KEYS);
};

/**
 * Helper function to validate students access mode
 * @param {string} mode - Access mode to validate
 * @returns {boolean} True if mode is valid
 */
export const isValidAccessMode = (mode) => {
  return Object.values(STUDENTS_ACCESS_MODES).includes(mode);
};

/**
 * Helper function to validate navigation visibility option
 * @param {string} visibility - Visibility option to validate
 * @returns {boolean} True if visibility option is valid
 */
export const isValidNavVisibility = (visibility) => {
  return Object.values(NAV_VISIBILITY_OPTIONS).includes(visibility);
};