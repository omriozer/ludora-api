import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

export default function(sequelize) {
  const Settings = sequelize.define('Settings', {
    ...baseFields,
    subscription_system_enabled: { type: DataTypes.BOOLEAN, allowNull: true },
    default_course_access_days: { type: DataTypes.DECIMAL, allowNull: true },
    course_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true },
    default_file_access_days: { type: DataTypes.DECIMAL, allowNull: true },
    file_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true },
    default_game_access_days: { type: DataTypes.DECIMAL, allowNull: true, defaultValue: 365 },
    game_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    default_workshop_access_days: { type: DataTypes.DECIMAL, allowNull: true },
    workshop_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true },
    default_lesson_plan_access_days: { type: DataTypes.DECIMAL, allowNull: true },
    lesson_plan_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true },
    default_tool_access_days: { type: DataTypes.DECIMAL, allowNull: true },
    tool_lifetime_access: { type: DataTypes.BOOLEAN, allowNull: true },
    contact_email: { type: DataTypes.STRING, allowNull: true },
    contact_phone: { type: DataTypes.STRING, allowNull: true },
    site_description: { type: DataTypes.TEXT, allowNull: true },
    logo_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.'
    },
    has_logo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Clear boolean indicator for system logo existence'
    },
    logo_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Standardized system logo filename storage (replaces logo_url)'
    },
    site_name: { type: DataTypes.STRING, allowNull: true },
    maintenance_mode: { type: DataTypes.BOOLEAN, allowNull: true },
    student_invitation_expiry_days: { type: DataTypes.DECIMAL, allowNull: true },
    parent_consent_required: { type: DataTypes.BOOLEAN, allowNull: true },
    nav_order: { type: DataTypes.JSONB, allowNull: true },
    nav_files_text: { type: DataTypes.STRING, allowNull: true },
    nav_files_icon: { type: DataTypes.STRING, allowNull: true },
    nav_files_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_files_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    nav_games_text: { type: DataTypes.STRING, allowNull: true },
    nav_games_icon: { type: DataTypes.STRING, allowNull: true },
    nav_games_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'public' },
    nav_games_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_workshops_text: { type: DataTypes.STRING, allowNull: true },
    nav_workshops_icon: { type: DataTypes.STRING, allowNull: true },
    nav_workshops_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_workshops_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_courses_text: { type: DataTypes.STRING, allowNull: true },
    nav_courses_icon: { type: DataTypes.STRING, allowNull: true },
    nav_courses_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_courses_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_classrooms_text: { type: DataTypes.STRING, allowNull: true },
    nav_classrooms_icon: { type: DataTypes.STRING, allowNull: true },
    nav_classrooms_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_classrooms_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_account_text: { type: DataTypes.STRING, allowNull: true },
    nav_account_icon: { type: DataTypes.STRING, allowNull: true },
    nav_account_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_account_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    nav_content_creators_text: { type: DataTypes.STRING, allowNull: true },
    nav_content_creators_icon: { type: DataTypes.STRING, allowNull: true },
    nav_content_creators_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'admins_and_creators' },
    nav_content_creators_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_tools_text: { type: DataTypes.STRING, allowNull: true },
    nav_tools_icon: { type: DataTypes.STRING, allowNull: true },
    nav_tools_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'admin_only' },
    nav_tools_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    nav_curriculum_text: { type: DataTypes.STRING, allowNull: true },
    nav_curriculum_icon: { type: DataTypes.STRING, allowNull: true },
    nav_curriculum_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_curriculum_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    nav_lesson_plans_text: { type: DataTypes.STRING, allowNull: true },
    nav_lesson_plans_icon: { type: DataTypes.STRING, allowNull: true },
    nav_lesson_plans_visibility: { type: DataTypes.STRING, allowNull: true, defaultValue: 'logged_in_users' },
    nav_lesson_plans_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    allow_content_creator_workshops: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_content_creator_courses: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_content_creator_files: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_content_creator_tools: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_content_creator_games: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_content_creator_lesson_plans: { type: DataTypes.BOOLEAN, allowNull: true },
    copyright_footer_text: { type: DataTypes.TEXT, allowNull: true },
    footer_settings: { type: DataTypes.JSONB, allowNull: true },
    available_dashboard_widgets: { type: DataTypes.JSONB, allowNull: true, comment: 'Available widgets for user dashboards' },
    available_specializations: { type: DataTypes.JSONB, allowNull: true, comment: 'Available specializations for teacher onboarding' },
    available_grade_levels: { type: DataTypes.JSONB, allowNull: true, comment: 'Available grade levels for classroom creation' },
  }, {
    ...baseOptions,
    tableName: 'settings',
    indexes: [
      {
        fields: ['has_logo'],
        name: 'idx_settings_has_logo'
      },
      {
        fields: ['logo_filename'],
        name: 'idx_settings_logo_filename'
      },
      {
        fields: ['maintenance_mode'],
        name: 'idx_settings_maintenance_mode'
      },
      {
        fields: ['created_at'],
        name: 'idx_settings_created_at'
      }
    ]
  });

  // Logo reference standardization methods
  Settings.prototype.hasLogoAsset = function() {
    // Use standardized field if available, fallback to legacy pattern
    if (this.has_logo !== undefined) {
      return this.has_logo;
    }
    // Legacy fallback
    return !!(this.logo_url && this.logo_url !== '');
  };

  Settings.prototype.getLogoFilename = function() {
    // Use standardized field if available
    if (this.logo_filename) {
      return this.logo_filename;
    }
    // Legacy fallback - extract filename from URL
    if (this.logo_url && this.logo_url.includes('/')) {
      DeprecationWarnings.warnDirectUrlStorage('settings', 'logo_url', {
        settingsId: this.id,
        logoUrl: this.logo_url,
        location: 'Settings.getLogoFilename'
      });
      const parts = this.logo_url.split('/');
      return parts[parts.length - 1] || 'logo.png';
    }
    return null;
  };

  Settings.prototype.getLogoUrl = function() {
    // For backward compatibility during transition period
    if (this.hasLogoAsset()) {
      const filename = this.getLogoFilename();
      if (filename) {
        // Return the standardized path structure
        return `/api/assets/image/settings/${this.id}/${filename}`;
      }
    }
    return null;
  };

  // Legacy compatibility method with deprecation warning
  Settings.prototype.getLegacyLogoUrl = function() {
    if (this.logo_url) {
      DeprecationWarnings.warnDirectUrlStorage('settings', 'logo_url', {
        settingsId: this.id,
        logoUrl: this.logo_url,
        location: 'Settings.getLegacyLogoUrl'
      });
    }
    return this.getLogoUrl();
  };

  // Settings-specific utility methods
  Settings.prototype.isMaintenanceMode = function() {
    return !!this.maintenance_mode;
  };

  Settings.prototype.getContactInfo = function() {
    return {
      email: this.contact_email,
      phone: this.contact_phone,
      siteName: this.site_name,
      description: this.site_description
    };
  };

  return Settings;
}