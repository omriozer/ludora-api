import { DataTypes } from 'sequelize';
import SettingsService from '../services/SettingsService.js';

// Simple admin access check function
function haveAdminAccess(role, action, req = null) {
  // Allow all actions for admin and sysadmin roles
  return role === 'admin' || role === 'sysadmin';
}

export default function(sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true, // Made unique for player email pattern
      validate: {
        isEmail: true,
      },
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'First name from Firebase (given_name)'
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Last name from Firebase (family_name)'
    },
    profile_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Google profile picture URL from Firebase authentication'
    },
    disabled: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    education_level: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['no_education_degree', 'bachelor_education', 'master_education', 'phd_education']]
      }
    },
    content_creator_agreement_sign_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
      validate: {
        isIn: [['user', 'admin', 'sysadmin']]
      }
    },
    user_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['teacher', 'student', 'parent', 'headmaster', 'player', null]]
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    dashboard_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'User dashboard configuration with widgets and their settings'
    },
    onboarding_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flag indicating whether user has completed the onboarding process'
    },
    birth_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'User birth date for age verification and onboarding'
    },
    specializations: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Teacher specializations and teaching subjects as JSON array'
    },
    school_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'school',
        key: 'id'
      },
      comment: 'School that this user belongs to (teachers, students, headmasters)'
    },
    invitation_code: {
      type: DataTypes.STRING(8),
      allowNull: true,
      unique: true,
      comment: 'Unique invitation code for teachers to share their catalog with students'
    },
    age_verified_by: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User ID of teacher who verified student is 18+ years old. NULL = not verified'
    },
    linked_teacher_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User ID of teacher this student is linked to for parent consent requirements. NULL = not linked to teacher'
    },
    user_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'User settings including privacy_code and achievements for player users'
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether user is currently connected (mainly for player users)'
    },
  }, {
    tableName: 'user', // Match Base44 table name
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['phone'],
      },
      {
        fields: ['content_creator_agreement_sign_date'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['user_type'],
      },
      {
        fields: ['role', 'user_type'],
      },
      {
        fields: ['onboarding_completed'],
      },
      {
        fields: ['birth_date'],
      },
      {
        fields: ['school_id'],
        name: 'idx_user_school_id'
      },
      {
        fields: ['school_id', 'user_type'],
        name: 'idx_user_school_type'
      },
      {
        fields: ['user_type'],
        name: 'idx_user_type'
      },
      {
        fields: ['invitation_code'],
        name: 'idx_user_invitation_code',
        unique: true
      },
      {
        fields: ['age_verified_by'],
        name: 'idx_user_age_verified_by'
      },
      {
        fields: ['linked_teacher_id'],
        name: 'idx_user_linked_teacher'
      },
      {
        fields: ['first_name'],
        name: 'idx_user_first_name'
      },
      {
        fields: ['last_name'],
        name: 'idx_user_last_name'
      },
      {
        fields: ['user_settings'],
        name: 'idx_user_settings_gin',
        using: 'gin'
      },
      {
        fields: ['is_online'],
        name: 'idx_user_online'
      },
      {
        fields: ['user_type', 'is_online'],
        name: 'idx_user_type_online'
      },
    ],
  });

  User.associate = function(models) {
    // Define associations here
    User.hasMany(models.Purchase, { foreignKey: 'buyer_user_id', as: 'purchases' });
    User.hasMany(models.Subscription, { foreignKey: 'user_id', as: 'subscriptions' });
    User.hasMany(models.Classroom, { foreignKey: 'teacher_id' });
    User.hasMany(models.StudentInvitation, { foreignKey: 'teacher_id' });
    User.hasMany(models.ClassroomMembership, { foreignKey: 'student_id' });
    User.hasMany(models.RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });

    // School associations
    User.belongsTo(models.School, {
      foreignKey: 'school_id',
      as: 'School',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // A user can be headmaster of a school (reverse relationship)
    User.hasOne(models.School, {
      foreignKey: 'school_headmaster_id',
      as: 'ManagedSchool',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Parent consent association (students can have one parent consent record)
    User.hasOne(models.ParentConsent, {
      foreignKey: 'student_id',
      as: 'ParentConsent',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Age verification associations (self-referential)
    User.belongsTo(models.User, {
      foreignKey: 'age_verified_by',
      as: 'AgeVerifiedByTeacher',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    User.hasMany(models.User, {
      foreignKey: 'age_verified_by',
      as: 'StudentsAgeVerified',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Linked teacher associations (for parent consent flow)
    User.belongsTo(models.User, {
      foreignKey: 'linked_teacher_id',
      as: 'LinkedTeacher',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    User.hasMany(models.User, {
      foreignKey: 'linked_teacher_id',
      as: 'LinkedStudents',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    return values;
  };

  // System role checking methods
  User.prototype.isUser = function() {
    return this.role === 'user';
  };

  // User type checking methods
  User.prototype.isTeacher = function() {
    return this.user_type === 'teacher';
  };

  User.prototype.isStudent = function() {
    return this.user_type === 'student';
  };

  User.prototype.isParent = function() {
    return this.user_type === 'parent';
  };

  User.prototype.isHeadmaster = function() {
    return this.user_type === 'headmaster';
  };

  User.prototype.isPlayer = function() {
    return this.user_type === 'player';
  };

  User.prototype.getPrivacyCode = function() {
    return this.user_settings?.privacy_code || null;
  };

  User.prototype.setPrivacyCode = function(code) {
    this.user_settings = { ...this.user_settings, privacy_code: code };
  };

  User.prototype.getAchievements = function() {
    return this.user_settings?.achievements || [];
  };

  User.prototype.setAchievements = function(achievements) {
    this.user_settings = { ...this.user_settings, achievements };
  };

  User.prototype.isOnline = function() {
    return this.is_online;
  };

  User.prototype.setOnline = async function(isOnline = true) {
    this.is_online = isOnline;
    this.last_login = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  User.prototype.updateLastSeen = async function() {
    this.last_login = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  User.prototype.deactivate = async function() {
    this.is_active = false;
    this.is_online = false;
    this.updated_at = new Date();
    return await this.save();
  };

  // New centralized admin access method
  User.prototype.haveAdminAccess = function(action, req = null) {
    return haveAdminAccess(this.role, action, req);
  };

  User.prototype.canAccess = function(requiredRole) {
    const roleHierarchy = {
      'user': 0,
      'admin': 1,
      'sysadmin': 2
    };
    return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
  };

  // Combined role and type checking
  User.prototype.hasRoleAndType = function(role, userType = null) {
    const hasRole = this.role === role;
    if (userType === null) return hasRole;
    return hasRole && this.user_type === userType;
  };

  /**
   * Compute onboarding completion status based on required fields and feature flag.
   * This is a computed value - the database column is kept for backwards compatibility
   * but should not be written to anymore.
   *
   * @param {Object} cachedSettings - Optional pre-fetched settings to avoid N+1 queries
   * @returns {Promise<boolean>} True if onboarding is complete
   */
  User.prototype.getOnboardingCompleted = async function(cachedSettings = null) {
    let isOnboardingEnabled;

    if (cachedSettings && cachedSettings.teacher_onboarding_enabled !== undefined) {
      // Use pre-fetched settings (fast path) - avoid N+1 query
      isOnboardingEnabled = cachedSettings.teacher_onboarding_enabled !== false;
    } else {
      // Fallback to service call for backwards compatibility
      isOnboardingEnabled = await SettingsService.isTeacherOnboardingEnabled();
    }

    if (!isOnboardingEnabled) {
      return true;
    }

    // Since this is teacher-only onboarding, users need to complete onboarding to become teachers
    // Required fields for completion: birth_date, education_level, user_type = 'teacher'
    const hasRequiredFields = !!(this.birth_date && this.education_level && this.user_type === 'teacher');

    return hasRequiredFields;
  };

  // Static methods for player functionality

  // Generate unique privacy code (8 characters, excluding confusing chars)
  User.generatePrivacyCode = function() {
    // Use chars excluding 0, O, I, 1 to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Find player user by privacy code
  User.findByPrivacyCode = async function(privacyCode, options = {}) {
    return await this.findOne({
      where: {
        user_type: 'player',
        is_active: true,
        user_settings: {
          privacy_code: privacyCode.toUpperCase()
        }
      },
      ...options
    });
  };

  // Find player users by teacher
  User.findPlayersByTeacher = async function(teacherId, options = {}) {
    return await this.findAll({
      where: {
        user_type: 'player',
        linked_teacher_id: teacherId,
        is_active: true
      },
      order: [['last_login', 'DESC']],
      ...options
    });
  };

  // Find online player users by teacher
  User.findOnlinePlayersByTeacher = async function(teacherId, options = {}) {
    return await this.findAll({
      where: {
        user_type: 'player',
        linked_teacher_id: teacherId,
        is_online: true,
        is_active: true
      },
      order: [['last_login', 'DESC']],
      ...options
    });
  };

  // Set all users offline (for server restart scenarios)
  User.setAllOffline = async function() {
    const [updatedCount] = await this.update(
      {
        is_online: false,
        updated_at: new Date()
      },
      {
        where: {
          is_online: true
        }
      }
    );

    return updatedCount;
  };

  return User;
}