import SettingsService from './SettingsService.js';
import { ACCESS_CONTROL_KEYS, SYSTEM_KEYS, STUDENTS_ACCESS_MODES } from '../constants/settingsKeys.js';
import { haveAdminAccess } from '../constants/adminAccess.js';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * StudentAccessValidationService
 *
 * Handles student portal access validation based on system settings.
 * Integrates with Ludora's sophisticated settings system with data-driven caching.
 *
 * Access Modes:
 * - 'all': Allow anonymous + authenticated students
 * - 'invite_only': Require invitation code OR lobby code OR authenticated
 * - 'authed_only': Require authentication (Firebase user login)
 */
class StudentAccessValidationService {
  /**
   * Validate student portal access
   *
   * @param {Object} params - Validation parameters
   * @param {string} params.student_access_mode - Optional access mode override
   * @param {Object} params.access_context - Access context information
   * @param {boolean} params.access_context.has_invitation_code - Has valid invitation code
   * @param {boolean} params.access_context.has_lobby_code - Has valid lobby code
   * @param {boolean} params.access_context.is_authenticated - Is authenticated user
   * @param {string} params.access_context.user_role - User role (student, teacher, admin)
   * @returns {Promise<Object>} Validation result
   */
  async validateAccess({ student_access_mode, access_context }) {
    try {
      // Get current access mode from settings (or use override)
      const accessMode = student_access_mode || await SettingsService.get(ACCESS_CONTROL_KEYS.STUDENTS_ACCESS) || STUDENTS_ACCESS_MODES.ALL;

      // Get system settings for response
      const studentOnboardingEnabled = await SettingsService.get(SYSTEM_KEYS.STUDENT_ONBOARDING_ENABLED) || false;
      const teacherOnboardingEnabled = await SettingsService.get(SYSTEM_KEYS.TEACHER_ONBOARDING_ENABLED) || true;
      const parentConsentRequired = await SettingsService.get(ACCESS_CONTROL_KEYS.PARENT_CONSENT_REQUIRED) || false;

      // Determine requirements based on access mode
      const requirements = this._getRequirements(accessMode, parentConsentRequired);

      // Validate access based on mode
      const accessAllowed = this._validateAccessLogic(accessMode, access_context);

      ludlog.generic('Student access validation result:', {
        accessMode,
        accessAllowed,
        requirements,
        context: access_context
      });

      return {
        access_allowed: accessAllowed,
        access_mode: accessMode,
        requirements,
        student_onboarding_enabled: studentOnboardingEnabled,
        teacher_onboarding_enabled: teacherOnboardingEnabled
      };
    } catch (error) {
      luderror.generic('Student access validation error:', error);
      // Fail-open: Allow access if validation fails (graceful degradation)
      return {
        access_allowed: true,
        access_mode: STUDENTS_ACCESS_MODES.ALL,
        requirements: {
          authentication_required: false,
          invitation_code_required: false,
          parent_consent_required: false
        },
        student_onboarding_enabled: false,
        teacher_onboarding_enabled: true,
        error: 'Validation failed - allowing access by default'
      };
    }
  }

  /**
   * Get access requirements without validation
   *
   * @returns {Promise<Object>} Access requirements
   */
  async getAccessRequirements() {
    try {
      const accessMode = await SettingsService.get(ACCESS_CONTROL_KEYS.STUDENTS_ACCESS) || STUDENTS_ACCESS_MODES.ALL;
      const studentOnboardingEnabled = await SettingsService.get(SYSTEM_KEYS.STUDENT_ONBOARDING_ENABLED) || false;
      const teacherOnboardingEnabled = await SettingsService.get(SYSTEM_KEYS.TEACHER_ONBOARDING_ENABLED) || true;
      const parentConsentRequired = await SettingsService.get(ACCESS_CONTROL_KEYS.PARENT_CONSENT_REQUIRED) || false;

      const requirements = this._getRequirements(accessMode, parentConsentRequired);

      return {
        access_mode: accessMode,
        requirements,
        student_onboarding_enabled: studentOnboardingEnabled,
        teacher_onboarding_enabled: teacherOnboardingEnabled
      };
    } catch (error) {
      luderror.generic('Get access requirements error:', error);
      // Fail-open: Return default requirements
      return {
        access_mode: STUDENTS_ACCESS_MODES.ALL,
        requirements: {
          authentication_required: false,
          invitation_code_required: false,
          parent_consent_required: false
        },
        student_onboarding_enabled: false,
        teacher_onboarding_enabled: true
      };
    }
  }

  /**
   * Get requirements based on access mode
   * @private
   */
  _getRequirements(accessMode, parentConsentRequired) {
    switch (accessMode) {
      case STUDENTS_ACCESS_MODES.INVITE_ONLY:
        return {
          authentication_required: false,  // Can use invitation code instead
          invitation_code_required: true,
          parent_consent_required: parentConsentRequired
        };

      case STUDENTS_ACCESS_MODES.AUTHED_ONLY:
        return {
          authentication_required: true,
          invitation_code_required: false,
          parent_consent_required: parentConsentRequired
        };

      case STUDENTS_ACCESS_MODES.ALL:
      default:
        return {
          authentication_required: false,
          invitation_code_required: false,
          parent_consent_required: parentConsentRequired
        };
    }
  }

  /**
   * Validate access logic based on mode and context
   * @private
   */
  _validateAccessLogic(accessMode, context) {
    const {
      has_invitation_code = false,
      has_lobby_code = false,
      is_authenticated = false,
      user_role = 'guest'
    } = context || {};

    // Admin/teacher always have access
    if (haveAdminAccess(user_role, 'student_portal_access') || user_role === 'teacher') {
      return true;
    }

    switch (accessMode) {
      case STUDENTS_ACCESS_MODES.INVITE_ONLY:
        // Require invitation code, lobby code, OR authentication
        return has_invitation_code || has_lobby_code || is_authenticated;

      case STUDENTS_ACCESS_MODES.AUTHED_ONLY:
        // Require authentication only
        return is_authenticated;

      case STUDENTS_ACCESS_MODES.ALL:
      default:
        // Allow all access
        return true;
    }
  }
}

export default new StudentAccessValidationService();
