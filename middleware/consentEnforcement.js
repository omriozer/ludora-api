import models from '../models/index.js';
import { luderror, ludlog } from '../lib/ludlog.js';
import SettingsService from '../services/SettingsService.js';

/**
 * Middleware to enforce parent consent requirements for students.
 * Blocks API access for students who haven't completed the consent flow.
 */
export const requireStudentConsent = async (req, res, next) => {
  const startTime = Date.now();
  const requestContext = {
    userId: req.user?.id,
    userType: req.user?.user_type,
    endpoint: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 100) // Truncate for logging
  };

  try {
    const { user } = req;

    // Skip enforcement for non-students or non-users
    if (!user || user.user_type !== 'student') {
      ludlog.auth('Consent enforcement skipped (non-student)', {
        ...requestContext,
        reason: user ? 'non_student' : 'no_user'
      });
      return next();
    }

    // Skip enforcement if parent consent is not required (admin setting)
    let isConsentRequired;
    try {
      isConsentRequired = await SettingsService.get('parent_consent_required', false);
    } catch (settingsError) {
      luderror.auth('Failed to check parent_consent_required setting:', {
        ...requestContext,
        error: settingsError.message
      });
      // Fail secure: require consent if setting can't be determined
      isConsentRequired = true;
    }

    if (!isConsentRequired) {
      ludlog.auth('Consent enforcement skipped (disabled)', requestContext);
      return next();
    }

    // Check if student has linked teacher
    if (!user.linked_teacher_id) {
      luderror.auth('Student blocked: no linked teacher', requestContext);
      return res.status(403).json({
        error: 'Student consent required',
        code: 'NEEDS_TEACHER_LINK',
        message: 'You must be linked to a teacher before accessing this feature. Please use your teacher\'s invitation code.',
        action_required: 'link_teacher'
      });
    }

    // Check if student has parent consent
    let parentConsent;
    try {
      parentConsent = await models.ParentConsent.findOne({
        where: { student_id: user.id }
      });
    } catch (dbError) {
      luderror.auth('Database error checking parent consent:', {
        ...requestContext,
        error: dbError.message,
        query: 'ParentConsent.findOne'
      });
      // Return generic error to user, don't expose database details
      return res.status(500).json({
        error: 'Failed to check consent status',
        message: 'An internal error occurred while checking consent requirements'
      });
    }

    if (!parentConsent) {
      luderror.auth('Student blocked: no parent consent', {
        ...requestContext,
        linkedTeacherId: user.linked_teacher_id
      });
      return res.status(403).json({
        error: 'Parent consent required',
        code: 'NEEDS_PARENT_CONSENT',
        message: 'Parent consent is required to access this feature. A consent form has been sent to your parent/guardian.',
        action_required: 'wait_for_consent'
      });
    }

    // CRITICAL: Check if consent has been revoked
    if (!parentConsent.isActive()) {
      const revocationInfo = parentConsent.getRevocationInfo();
      luderror.auth('Student blocked: parent consent revoked', {
        ...requestContext,
        linkedTeacherId: user.linked_teacher_id,
        parentConsentId: parentConsent.id,
        revokedAt: revocationInfo.revoked_at,
        revokedBy: revocationInfo.revoked_by,
        revocationReason: revocationInfo.revocation_reason
      });
      return res.status(403).json({
        error: 'Parent consent has been revoked',
        code: 'CONSENT_REVOKED',
        message: 'Your parent consent has been revoked. Please contact your teacher or admin for assistance.',
        action_required: 'contact_teacher',
        revocation_info: {
          revoked_at: revocationInfo.revoked_at,
          revocation_reason: revocationInfo.revocation_reason
        }
      });
    }

    // All consent requirements met - proceed
    const processingTime = Date.now() - startTime;
    ludlog.auth('Consent enforcement passed', {
      ...requestContext,
      linkedTeacherId: user.linked_teacher_id,
      parentConsentId: parentConsent.id,
      processingTimeMs: processingTime
    });
    next();

  } catch (error) {
    const processingTime = Date.now() - startTime;
    luderror.auth('Consent enforcement middleware error:', {
      ...requestContext,
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime
    });
    res.status(500).json({
      error: 'Failed to check consent status',
      message: 'An internal error occurred while checking consent requirements'
    });
  }
};

/**
 * Middleware specifically for age verification enforcement.
 * Blocks access for students under 18 without teacher age verification.
 */
export const requireAgeVerification = async (req, res, next) => {
  const startTime = Date.now();
  const requestContext = {
    userId: req.user?.id,
    userType: req.user?.user_type,
    endpoint: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 100)
  };

  try {
    const { user } = req;

    // Skip enforcement for non-students
    if (!user || user.user_type !== 'student') {
      ludlog.auth('Age verification skipped (non-student)', {
        ...requestContext,
        reason: user ? 'non_student' : 'no_user'
      });
      return next();
    }

    // Calculate age if birth_date is available
    if (user.birth_date) {
      const today = new Date();
      const birthDate = new Date(user.birth_date);

      // Fix age calculation bug: declare age properly
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--; // ✅ Fixed: this is now reachable
      }

      ludlog.auth('Age verification: calculated age', {
        ...requestContext,
        age: age,
        birthDate: user.birth_date,
        ageVerifiedBy: user.age_verified_by
      });

      // If 18 or older, no verification needed
      if (age >= 18) {
        const processingTime = Date.now() - startTime;
        ludlog.auth('Age verification passed (18+)', {
          ...requestContext,
          age: age,
          processingTimeMs: processingTime
        });
        return next();
      }

      // Under 18 - check for teacher age verification
      if (!user.age_verified_by) {
        luderror.auth('Student blocked: under 18 without teacher verification', {
          ...requestContext,
          age: age,
          linkedTeacherId: user.linked_teacher_id
        });
        return res.status(403).json({
          error: 'Age verification required',
          code: 'NEEDS_AGE_VERIFICATION',
          message: 'Your teacher must verify that you are 18 years old or have parent consent to access this feature.',
          action_required: 'teacher_age_verification'
        });
      }

      const processingTime = Date.now() - startTime;
      ludlog.auth('Age verification passed (teacher verified)', {
        ...requestContext,
        age: age,
        verifiedBy: user.age_verified_by,
        processingTimeMs: processingTime
      });
    } else {
      // No birth date - log this case
      ludlog.auth('Age verification skipped (no birth_date)', requestContext);
    }

    // Age verification requirements met or not applicable
    next();

  } catch (error) {
    const processingTime = Date.now() - startTime;
    luderror.auth('Age verification middleware error:', {
      ...requestContext,
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime
    });
    res.status(500).json({
      error: 'Failed to check age verification',
      message: 'An internal error occurred while checking age verification'
    });
  }
};

/**
 * Combined middleware that enforces both consent and age verification.
 * Use this for sensitive API endpoints that require full compliance.
 */
export const requireFullStudentCompliance = async (req, res, next) => {
  const requestContext = {
    userId: req.user?.id,
    userType: req.user?.user_type,
    endpoint: `${req.method} ${req.originalUrl}`,
    ip: req.ip
  };

  ludlog.auth('Full compliance check started', requestContext);

  // Run consent enforcement first
  requireStudentConsent(req, res, (consentError) => {
    if (consentError) {
      luderror.auth('Full compliance failed at consent stage', {
        ...requestContext,
        error: consentError.message
      });
      return; // Error already handled by requireStudentConsent
    }

    // If consent passes, run age verification
    requireAgeVerification(req, res, (ageError) => {
      if (ageError) {
        luderror.auth('Full compliance failed at age verification stage', {
          ...requestContext,
          error: ageError.message
        });
        return; // Error already handled by requireAgeVerification
      }

      // Both checks passed
      ludlog.auth('Full compliance check passed', requestContext);
      next();
    });
  });
};