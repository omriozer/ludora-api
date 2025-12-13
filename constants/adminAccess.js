/**
 * Admin Access Control Constants and Functions
 *
 * Centralizes admin/sysadmin access control logic for consistent use across the platform
 */

import jwt from 'jsonwebtoken';

/**
 * List of actions forbidden for sysadmin role
 * This list is exposed to frontend via enhancedSettings
 */
export const SYSADMIN_FORBIDDEN_ACTIONS = [];

/**
 * Check if request has valid anonymous admin token
 * @param {Object} req - Express request object
 * @returns {boolean} - True if valid anonymous admin token exists, false otherwise
 */
export function isAnonymousAdmin(req) {
  try {
    const token = req.cookies?.anonymous_admin_token;
    if (!token) {
      return false;
    }

    // Verify and decode token
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is expired
    const now = Date.now();
    if (payload.exp && payload.exp * 1000 < now) {
      return false;
    }

    // Check if it's the right type of token
    if (payload.type !== 'anonymous_admin') {
      return false;
    }

    // Check if it's for a valid portal
    const validAudiences = ['ludora-student-portal', 'ludora-teacher-portal'];
    if (!validAudiences.includes(payload.aud)) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a user has admin access for a specific action
 * @param {string} userRole - The user's role ('admin', 'sysadmin', etc.)
 * @param {string} action - The action to check access for
 * @param {Object} req - Express request object (optional, for anonymous admin check)
 * @returns {boolean} - True if user has access, false otherwise
 */
export function haveAdminAccess(userRole, action, req = null) {
  // Admin role has access to all actions
  if (userRole === 'admin' || (req && isAnonymousAdmin(req))) {
    return true;
  }

  // Sysadmin role has access unless action is forbidden
  if (userRole === 'sysadmin') {
    return !SYSADMIN_FORBIDDEN_ACTIONS.includes(action);
  }

  // All other users have no admin access
  return false;
}