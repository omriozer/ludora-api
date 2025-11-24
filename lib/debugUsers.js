/**
 * Debug User Management
 *
 * Determines which users should see debug logs in production.
 * This module helps with troubleshooting user-specific issues
 * without exposing logs to all users.
 */

// Debug users can be set via environment variable
const DEBUG_USERS = process.env.DEBUG_USER_IDS ?
  process.env.DEBUG_USER_IDS.split(',').map(id => id.trim()) :
  [];

// Store current user ID (set by authentication middleware)
let currentUserId = null;

/**
 * Check if the current user is a debug user
 * @returns {boolean} True if current user should see debug logs
 */
export function isDebugUser() {
  if (!currentUserId) return false;
  return DEBUG_USERS.includes(String(currentUserId));
}

/**
 * Set the current user ID (typically called by auth middleware)
 * @param {string|number} userId - The authenticated user's ID
 */
export function setCurrentUser(userId) {
  currentUserId = userId ? String(userId) : null;
}

/**
 * Clear the current user (typically on logout or session end)
 */
export function clearCurrentUser() {
  currentUserId = null;
}

/**
 * Get list of debug user IDs
 * @returns {string[]} Array of user IDs that are debug users
 */
export function getDebugUsers() {
  return [...DEBUG_USERS];
}

/**
 * Add a user to debug users list (runtime only, not persisted)
 * @param {string|number} userId - User ID to add
 */
export function addDebugUser(userId) {
  const id = String(userId);
  if (!DEBUG_USERS.includes(id)) {
    DEBUG_USERS.push(id);
  }
}

/**
 * Remove a user from debug users list (runtime only)
 * @param {string|number} userId - User ID to remove
 */
export function removeDebugUser(userId) {
  const id = String(userId);
  const index = DEBUG_USERS.indexOf(id);
  if (index > -1) {
    DEBUG_USERS.splice(index, 1);
  }
}