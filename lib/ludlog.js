/**
 * Strategic Logging System for Ludora Backend
 *
 * This module provides minimal, strategic logging for critical system events.
 * Only use where truly necessary - most debug logging should be removed.
 *
 * @module ludlog
 */

// Import debug user management from existing module
import { isDebugUser } from './debugUsers.js';

// Determine if we should actually log
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Should we log? (Development or debug user)
 */
const shouldLog = () => isDevelopment || isDebugUser();

/**
 * Colors for different log categories in development
 */
const colors = {
  auth: '\x1b[36m',       // Cyan
  payment: '\x1b[33m',    // Yellow
  api: '\x1b[35m',        // Magenta
  db: '\x1b[34m',         // Blue
  cache: '\x1b[32m',      // Green
  webhook: '\x1b[95m',    // Light Magenta
  file: '\x1b[93m',       // Light Yellow
  system: '\x1b[91m',     // Light Red (for critical system events)
  error: '\x1b[31m',      // Red
  reset: '\x1b[0m'
};

/**
 * Format log output with timestamp and category
 * @private
 */
function formatLog(category, message, data, forceProduction = false) {
  try {
    // Check if we should log at all
    if (!forceProduction && !shouldLog()) return;
    if (forceProduction) return;

    // Defensive parameter sanitization
    const safeCategory = (typeof category === 'string' ? category : 'system').toLowerCase();
    const safeMessage = typeof message === 'string' ? message : String(message || 'Unknown log message');
    const timestamp = new Date().toISOString();
    const color = colors[safeCategory] || colors.system || colors.reset;
    const prodMarker = forceProduction ? ' [PROD]' : '';

    if (isDevelopment && !forceProduction) {
      // Colorful output for development
      console.log(
        `[${timestamp}]${prodMarker} ${color}[${safeCategory.toUpperCase()}]${colors.reset} ${safeMessage}`
      );
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        console.log('  └─', data);
      }
    } else {
      // Structured output for production (JSON format for log aggregators)
      const logEntry = {
        timestamp,
        level: forceProduction ? 'critical' : 'info',
        category: safeCategory,
        message: safeMessage,
        ...(data && typeof data === 'object' && { data }),
        ...(forceProduction && { production: true })
      };
      console.log(JSON.stringify(logEntry));
    }
  } catch (error) {
    // Logging system should never crash the app - fail silently with fallback
    try {
      console.error('[LUDLOG ERROR] Logging system failed:', error.message);
    } catch (fallbackError) {
      // Even the fallback error logging failed - this should never happen
      // but we handle it to ensure absolute safety
    }
  }
}

/**
 * Format error output with stack traces
 * @private
 */
function formatError(category, message, error, context, forceProduction = false) {
  try {
    // Check if we should log at all
    if (!forceProduction && !shouldLog()) return;
    if (forceProduction) return;

    // Defensive parameter sanitization
    const safeCategory = (typeof category === 'string' ? category : 'system').toLowerCase();
    const safeMessage = typeof message === 'string' ? message : String(message || 'Unknown error message');
    const timestamp = new Date().toISOString();
    const color = colors[safeCategory] || colors.system || colors.reset;
    const prodMarker = forceProduction ? ' [PROD]' : '';

    if (isDevelopment && !forceProduction) {
      // Detailed error output for development
      console.error(
        `${colors.error}[${timestamp}]${prodMarker} [ERROR]${colors.reset} ${color}[${safeCategory.toUpperCase()}]${colors.reset} ${safeMessage}`
      );
      if (context && typeof context === 'object' && Object.keys(context).length > 0) {
        console.error('  ├─ Context:', context);
      }
      if (error) {
        if (error && typeof error === 'object' && error.stack) {
          console.error('  ├─ Stack:', error.stack);
        } else {
          console.error('  ├─ Error:', String(error || 'Unknown error'));
        }
      }
      console.error('  └─ ────────────────────────');
    } else {
      // Structured error output for production
      const errorEntry = {
        timestamp,
        level: 'error',
        category: safeCategory,
        message: safeMessage,
        ...(context && typeof context === 'object' && { context }),
        ...(error && {
          error: {
            message: (error && error.message) ? String(error.message) : String(error || 'Unknown error'),
            stack: (error && error.stack) ? error.stack : null,
            name: (error && error.name) ? error.name : null,
            code: (error && error.code) ? error.code : null
          }
        }),
        ...(forceProduction && { production: true })
      };
      console.error(JSON.stringify(errorEntry));
    }
  } catch (loggingError) {
    // Logging system should never crash the app - fail silently with fallback
    try {
      console.error('[LUDERROR ERROR] Error logging system failed:', loggingError.message);
    } catch (fallbackError) {
      // Even the fallback error logging failed - this should never happen
      // but we handle it to ensure absolute safety
    }
  }
}

/**
 * Create a logging function with .prod chaining
 * @private
 */
function createLogMethod(category, isError = false) {
  const logFn = isError
    ? (message, error, context) => formatError(category, message, error, context, false)
    : (message, data) => formatLog(category, message, data, false);

  // Add .prod property for forced production logging
  logFn.prod = isError
    ? (message, error, context) => formatError(category, message, error, context, true)
    : (message, data) => formatLog(category, message, data, true);

  return logFn;
}

/**
 * Strategic logging interface with semantic categories
 *
 * Usage:
 *   ludlog.auth('Login attempt', { userId });           // Dev only
 *   ludlog.auth.prod('Critical auth failure', { ip });  // Always logs
 */
const ludlogBase = {
  // Authentication & Authorization (critical security events)
  auth: createLogMethod('auth'),

  // Payment Processing (always critical in production)
  payment: createLogMethod('payment'),

  // API Critical Events (major failures, not routine requests)
  api: createLogMethod('api'),

  // Database Critical Events (connection loss, not routine queries)
  db: createLogMethod('db'),

  // Cache Operations (only if debugging cache issues)
  cache: createLogMethod('cache'),

  // Webhook Events (payment webhooks, critical integrations)
  webhook: createLogMethod('webhook'),

  // File Operations (S3 failures, not routine uploads)
  file: createLogMethod('file'),

  // System Events (startup, shutdown, critical state changes)
  system: createLogMethod('system'),

  // General Purpose (fallback for unknown categories)
  generic: createLogMethod('generic')
};

// Create a Proxy to handle unknown categories gracefully
const ludlog = new Proxy(ludlogBase, {
  get(target, property) {
    // Return known categories directly
    if (target[property]) {
      return target[property];
    }

    // For unknown categories, return a generic logger with the requested category name
    if (typeof property === 'string') {
      return createLogMethod(property);
    }

    // For symbols and other property types, return undefined
    return undefined;
  }
});

/**
 * Strategic error logging interface with semantic categories
 *
 * Usage:
 *   luderror.api('Request failed', err, { endpoint });           // Dev only
 *   luderror.api.prod('Critical API failure', err, { endpoint }); // Always logs
 */
const luderrorBase = {
  // Authentication & Authorization Errors (security breaches)
  auth: createLogMethod('auth', true),

  // Payment Processing Errors (always critical)
  payment: createLogMethod('payment', true),

  // API Critical Errors (not routine 4xx responses)
  api: createLogMethod('api', true),

  // Database Errors (connection failures, not constraint violations)
  db: createLogMethod('db', true),

  // Cache Errors (corruption, not misses)
  cache: createLogMethod('cache', true),

  // Webhook Errors (integration failures)
  webhook: createLogMethod('webhook', true),

  // File Operation Errors (S3 unavailable, not file not found)
  file: createLogMethod('file', true),

  // System Errors (critical failures, inconsistencies)
  system: createLogMethod('system', true),

  // General Purpose Errors (fallback for unknown categories)
  generic: createLogMethod('generic', true)
};

// Create a Proxy to handle unknown categories gracefully
const luderror = new Proxy(luderrorBase, {
  get(target, property) {
    // Return known categories directly
    if (target[property]) {
      return target[property];
    }

    // For unknown categories, return a generic error logger with the requested category name
    if (typeof property === 'string') {
      return createLogMethod(property, true);
    }

    // For symbols and other property types, return undefined
    return undefined;
  }
});

// ES Module exports
export {
  ludlog,
  luderror
};

// Default export for convenience
export default {
  ludlog,
  luderror
};