import express from 'express';
import { ludlog } from '../lib/ludlog.js';
import StudentAccessValidationService from '../services/StudentAccessValidationService.js';

const router = express.Router();

/**
 * POST /api/student-portal/settings/validate-access
 * Validates student portal access based on system settings
 *
 * Request body:
 * {
 *   student_access_mode: 'invite_only' | 'authed_only' | 'all',  // Optional override
 *   access_context: {
 *     has_invitation_code: boolean,
 *     has_lobby_code: boolean,
 *     is_authenticated: boolean,
 *     user_role: string
 *   }
 * }
 *
 * Response:
 * {
 *   access_allowed: boolean,
 *   access_mode: string,
 *   requirements: {
 *     authentication_required: boolean,
 *     invitation_code_required: boolean,
 *     parent_consent_required: boolean
 *   },
 *   student_onboarding_enabled: boolean,
 *   teacher_onboarding_enabled: boolean
 * }
 */
router.post('/validate-access', async (req, res, next) => {
  try {
    const { student_access_mode, access_context } = req.body;

    ludlog.api('Student portal access validation request:', {
      student_access_mode,
      access_context
    });

    // Validate access using service
    const validationResult = await StudentAccessValidationService.validateAccess({
      student_access_mode,
      access_context
    });

    res.json(validationResult);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/student-portal/settings/access-requirements
 * Get access requirements without validation (for UI configuration)
 *
 * Response:
 * {
 *   access_mode: string,
 *   requirements: {
 *     authentication_required: boolean,
 *     invitation_code_required: boolean,
 *     parent_consent_required: boolean
 *   },
 *   student_onboarding_enabled: boolean,
 *   teacher_onboarding_enabled: boolean
 * }
 */
router.get('/access-requirements', async (req, res, next) => {
  try {
    ludlog.api('Student portal access requirements request');

    const requirements = await StudentAccessValidationService.getAccessRequirements();

    res.json(requirements);
  } catch (error) {
    next(error);
  }
});

export default router;
