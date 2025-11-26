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
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Should we log? (Development or debug user)
 */
const shouldLog = () => isDevelopment || isDebugUser();

/**
 * Should we force log? (Production critical events)
 */
const shouldForceLog = () => true; // Always log .prod events

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
  // Check if we should log at all
  if (!forceProduction && !shouldLog()) return;
  if (forceProduction && !shouldForceLog()) return;

  const timestamp = new Date().toISOString();
  const color = colors[category] || colors.system;
  const prodMarker = forceProduction ? ' [PROD]' : '';

  if (isDevelopment && !forceProduction) {
    // Colorful output for development
    console.log(
      `[${timestamp}]${prodMarker} ${color}[${category.toUpperCase()}]${colors.reset} ${message}`
    );
    if (data && Object.keys(data).length > 0) {
      console.log('  └─', data);
    }
  } else {
    // Structured output for production (JSON format for log aggregators)
    const logEntry = {
      timestamp,
      level: forceProduction ? 'critical' : 'info',
      category,
      message,
      ...(data && { data }),
      ...(forceProduction && { production: true })
    };
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Format error output with stack traces
 * @private
 */
function formatError(category, message, error, context, forceProduction = false) {
  // Check if we should log at all
  if (!forceProduction && !shouldLog()) return;
  if (forceProduction && !shouldForceLog()) return;

  const timestamp = new Date().toISOString();
  const color = colors[category] || colors.system;
  const prodMarker = forceProduction ? ' [PROD]' : '';

  if (isDevelopment && !forceProduction) {
    // Detailed error output for development
    console.error(
      `${colors.error}[${timestamp}]${prodMarker} [ERROR]${colors.reset} ${color}[${category.toUpperCase()}]${colors.reset} ${message}`
    );
    if (context && Object.keys(context).length > 0) {
      console.error('  ├─ Context:', context);
    }
    if (error) {
      if (error.stack) {
        console.error('  ├─ Stack:', error.stack);
      } else {
        console.error('  ├─ Error:', error);
      }
    }
    console.error('  └─ ────────────────────────');
  } else {
    // Structured error output for production
    const errorEntry = {
      timestamp,
      level: 'error',
      category,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          message: error.message || String(error),
          stack: error.stack,
          name: error.name,
          code: error.code
        }
      }),
      ...(forceProduction && { production: true })
    };
    console.error(JSON.stringify(errorEntry));
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
const ludlog = {
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
  system: createLogMethod('system')
};

/**
 * Strategic error logging interface with semantic categories
 *
 * Usage:
 *   luderror.api('Request failed', err, { endpoint });           // Dev only
 *   luderror.api.prod('Critical API failure', err, { endpoint }); // Always logs
 */
const luderror = {
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
  system: createLogMethod('system', true)
};

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