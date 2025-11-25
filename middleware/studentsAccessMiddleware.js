import SettingsService from '../services/SettingsService.js';
import { authenticateToken, optionalAuth } from './auth.js';
import { STUDENTS_ACCESS_MODES, ACCESS_CONTROL_KEYS } from '../constants/settingsKeys.js';
import { error as logger } from '../lib/errorLogger.js';

/**
 * Main students access control middleware
 * Enforces access rules based on settings.students_access flag
 */
export async function checkStudentsAccess(req, res, next) {
  try {
    // Get current access mode from settings
    const accessMode = await SettingsService.getStudentsAccessMode();

    // Route to appropriate access validation based on settings
    switch (accessMode) {
      case STUDENTS_ACCESS_MODES.INVITE_ONLY:
        return await validateInviteOnlyAccess(req, res, next);
      case STUDENTS_ACCESS_MODES.AUTHED_ONLY:
        return await validateAuthedOnlyAccess(req, res, next);
      case STUDENTS_ACCESS_MODES.ALL:
        return await validateAllAccess(req, res, next);
      default:
        // Fallback to 'all' for any unrecognized mode

        return await validateAllAccess(req, res, next);
    }
  } catch (error) {
    logger.api('Error in checkStudentsAccess middleware:', error);
    // Fallback to allow access to maintain functionality
    return await validateAllAccess(req, res, next);
  }
}

/**
 * Invite-only access: Treat as public access - if you reached the page, you have access
 * The URL itself contains the invitation code, so no further validation needed
 */
async function validateInviteOnlyAccess(req, res, next) {
  try {
    // For invite-only mode, if someone reached the student portal page,
    // they already have the invitation code (it's in the URL)
    // So treat this like public access with optional auth
    return await optionalAuth(req, res, next);
  } catch (error) {
    logger.api('Error in validateInviteOnlyAccess:', error);
    // Fallback to allowing access to maintain functionality
    return next();
  }
}

/**
 * Authenticated-only access: Require valid user authentication
 */
async function validateAuthedOnlyAccess(req, res, next) {
  try {
    // Use standard authentication middleware
    return await authenticateToken(req, res, next);
  } catch (error) {
    logger.api('Error in validateAuthedOnlyAccess:', error);
    return res.status(401).json({
      error: 'Student portal requires authentication',
      message: 'Please log in to access the student portal',
      accessMode: 'authed_only'
    });
  }
}

/**
 * All access: Allow both authenticated and anonymous access (current behavior)
 */
async function validateAllAccess(req, res, next) {
  try {
    // Use optional auth - allows both authenticated and anonymous access
    return await optionalAuth(req, res, next);
  } catch (error) {
    logger.api('Error in validateAllAccess:', error);
    // Continue without auth if any error occurs
    return next();
  }
}

// Code validation functions removed - invite_only now works like public access
// If you reached the page with a code in the URL, you automatically have access

/**
 * Middleware specifically for lobby-related endpoints
 * More lenient validation focused on lobby access
 */
export async function checkStudentsLobbyAccess(req, res, next) {
  try {
    const accessMode = await SettingsService.getStudentsAccessMode();

    // For lobby access, we're more permissive as lobbies are teacher-controlled
    if (accessMode === STUDENTS_ACCESS_MODES.AUTHED_ONLY) {
      return await authenticateToken(req, res, next);
    }

    // For 'invite_only' and 'all', use optional auth
    return await optionalAuth(req, res, next);
  } catch (error) {
    logger.lobby('Error in checkStudentsLobbyAccess:', error);
    return await optionalAuth(req, res, next);
  }
}

/**
 * Convenience function to check current access mode
 * @returns {Promise<string>} Current access mode
 */
export async function getCurrentAccessMode() {
  try {
    return await SettingsService.getStudentsAccessMode();
  } catch (error) {
    logger.api('Error getting current access mode:', error);
    return STUDENTS_ACCESS_MODES.ALL; // Safe fallback
  }
}

/**
 * Middleware to add access mode info to response (for debugging)
 */
export async function addAccessModeHeader(req, res, next) {
  try {
    const accessMode = await SettingsService.getStudentsAccessMode();
    res.set('X-Students-Access-Mode', accessMode);
    next();
  } catch (error) {
    logger.api('Error setting access mode header:', error);
    next();
  }
}