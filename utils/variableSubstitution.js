/**
 * Centralized Variable Substitution Utility
 *
 * Handles variable substitution in templates with proper support for:
 * - Hebrew text with embedded emails (RTL/LTR handling)
 * - Multiple pattern types: {{variable}} and ${variable}
 * - Comprehensive user data extraction and fallbacks
 * - Consistent default variables across all services
 */

import { error } from '../lib/errorLogger.js';

/**
 * Substitute variables in content with proper Hebrew/RTL support
 * @param {string} content - Content with variable placeholders
 * @param {Object} variables - Variable values for substitution
 * @param {Object} options - Configuration options
 * @param {boolean} options.supportSystemTemplates - Support ${variable} patterns (default: false)
 * @param {boolean} options.enableLogging - Enable debug logging (default: false)
 * @returns {string} - Content with substituted variables
 */
export function substituteVariables(content, variables = {}, options = {}) {
  if (!content || typeof content !== 'string') return content;

  const {
    supportSystemTemplates = false,
    enableLogging = false
  } = options;

  let result = content;

  // Default variables available to all templates
  const defaultVars = {
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    year: new Date().getFullYear().toString(),
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://ludora.app'
  };

  const allVariables = { ...defaultVars, ...variables };

  if (enableLogging) {
    // Debug logging for variable substitution
  }

  // Replace standard {{variable}} patterns
  for (const [key, value] of Object.entries(allVariables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, String(value || ''));
  }

  // Replace system template ${variable} patterns if enabled
  if (supportSystemTemplates) {
    for (const [key, value] of Object.entries(allVariables)) {
      const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(pattern, String(value || ''));
    }
  }

  // Handle complex user data extraction and substitution
  result = handleUserVariableSubstitution(result, variables, enableLogging);

  if (enableLogging) {
    // Debug logging completion
  }

  return result;
}

/**
 * Handle user-specific variable substitution with Hebrew RTL support
 * @param {string} result - Current result string
 * @param {Object} variables - Variable values
 * @param {boolean} enableLogging - Enable debug logging
 * @returns {string} - Result with user variables substituted
 */
function handleUserVariableSubstitution(result, variables, enableLogging) {
  // Extract user data with priority: userObj > user (smart parsing) > fallbacks
  let userEmail = '';
  let userName = '';

  if (variables.userObj && typeof variables.userObj === 'object') {
    // Use the full user object first (most accurate)
    userEmail = variables.userObj.email || variables.userObj.name || '';
    userName = variables.userObj.name || variables.userObj.email || '';
    if (enableLogging) {
      // Debug logging for userObj
    }
  } else if (variables.user) {
    if (typeof variables.user === 'string') {
      // Smart parsing of user string
      if (variables.user.includes('@') && variables.user.length > 3) {
        // It's an email address
        userEmail = variables.user;
        userName = variables.user.split('@')[0]; // Use part before @ as name
      } else if (variables.user !== 'User' && variables.user !== 'user' && variables.user !== 'anonymous') {
        // It's a real name (not the fallback 'User')
        userName = variables.user;
        userEmail = variables.user; // Fallback
      }
      // If it's just the fallback 'User', leave userEmail and userName empty
    } else if (typeof variables.user === 'object') {
      userEmail = variables.user.email || variables.user.name || '';
      userName = variables.user.name || variables.user.email || '';
    }
    if (enableLogging) {
      // Debug logging for user parsing
    }
  }

  // ALWAYS replace user variables to prevent placeholder text from appearing
  // Use proper Hebrew fallbacks when no real user data is available
  const finalUserEmail = userEmail || 'משתמש אנונימי';
  const finalUserName = userName || 'משתמש אנונימי';

  // CRITICAL: Hebrew text + email RTL/LTR handling
  // Check if the result text contains Hebrew and we're substituting an actual email
  const willContainHebrew = /[\u0590-\u05FF]/.test(result);
  const emailIsActualEmail = finalUserEmail && finalUserEmail.includes('@') && finalUserEmail !== 'משתמש אנונימי';

  if (willContainHebrew && emailIsActualEmail) {
    // For emails in Hebrew text in PDF rendering:
    // pdf-lib does NOT support Unicode bidirectional algorithm (UAX #9)
    // RTL markers (U+202D/U+202C) are ignored by pdf-lib's drawText()
    //
    // Solution: Manually reverse the email string so it appears correctly when rendered
    // Hebrew text flows RTL, but emails should display LTR within that RTL flow
    // By reversing the email, pdf-lib will render it correctly as the text flows RTL
    const reversedEmail = finalUserEmail.split('').reverse().join('');
    const protectedEmail = reversedEmail;
    result = result.replace(/\{\{user\.email\}\}/g, protectedEmail);

    if (enableLogging) {
      // Debug logging for email reversal
    }
  } else {
    // Standard email substitution for non-Hebrew text or non-email content
    result = result.replace(/\{\{user\.email\}\}/g, finalUserEmail);
  }

  // Handle ${user.email} patterns if they exist (for system templates)
  if (result.includes('${user.email}')) {
    if (willContainHebrew && emailIsActualEmail) {
      const reversedEmail = finalUserEmail.split('').reverse().join('');
      result = result.replace(/\$\{user\.email\}/g, reversedEmail);
    } else {
      result = result.replace(/\$\{user\.email\}/g, finalUserEmail);
    }
  }

  // Handle user name substitution (no special RTL handling needed for names)
  result = result.replace(/\{\{user\.name\}\}/g, finalUserName);
  result = result.replace(/\$\{user\.name\}/g, finalUserName);

  return result;
}

/**
 * Check if text contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains Hebrew
 */
export function containsHebrew(text) {
  if (!text) return false;
  // Hebrew Unicode range: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Protect email addresses in Hebrew text with RTL markers
 * Utility function for manual email protection
 * @param {string} email - Email address to protect
 * @returns {string} - Email wrapped in LTR directional markers
 */
export function protectEmailInHebrewText(email) {
  if (!email || !email.includes('@')) return email;
  return '\u202D' + email + '\u202C';
}

// Export for backward compatibility with existing code
export default {
  substituteVariables,
  containsHebrew,
  protectEmailInHebrewText
};