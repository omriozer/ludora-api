/**
 * Professional Logging System for Ludora Backend
 *
 * This module provides structured logging with semantic categories
 * while maintaining 100% backward compatibility with existing clog/cerror
 *
 * @module logger
 */

// Import debug user management from existing module
import { isDebugUser } from './debugUsers.js';

// Determine if we should actually log
const isDevelopment = process.env.NODE_ENV === 'development';
const shouldLog = () => isDevelopment || isDebugUser();

/**
 * DEPRECATED: Legacy logging function - kept for backward compatibility
 * @deprecated Use log.category() methods instead
 * @returns {null} Always returns null
 */
function clog(...args) {
  return null; // No-op for backward compatibility
}

/**
 * DEPRECATED: Legacy error logging function - kept for backward compatibility
 * @deprecated Use error.category() methods instead
 * @returns {null} Always returns null
 */
function cerror(...args) {
  return null; // No-op for backward compatibility
}

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
  email: '\x1b[94m',      // Light Blue
  general: '\x1b[37m',    // White
  error: '\x1b[31m',      // Red
  reset: '\x1b[0m'
};

/**
 * Format log output with timestamp and category
 * @private
 */
function formatLog(category, message, data, level = 'info') {
  if (!shouldLog()) return;

  const timestamp = new Date().toISOString();
  const color = colors[category] || colors.general;
  const levelColor = level === 'error' ? colors.error : '';

  if (isDevelopment) {
    // Colorful output for development
    console.log(
      `${levelColor}[${timestamp}]${colors.reset} ${color}[${category.toUpperCase()}]${colors.reset} ${message}`
    );
    if (data && Object.keys(data).length > 0) {
      console.log('  └─', data);
    }
  } else {
    // Structured output for production (JSON format for log aggregators)
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      ...(data && { data })
    };
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Format error output with stack traces
 * @private
 */
function formatError(category, message, error, context) {
  if (!shouldLog()) return;

  const timestamp = new Date().toISOString();
  const color = colors[category] || colors.general;

  if (isDevelopment) {
    // Detailed error output for development
    console.error(
      `${colors.error}[${timestamp}] [ERROR]${colors.reset} ${color}[${category.toUpperCase()}]${colors.reset} ${message}`
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
      })
    };
    console.error(JSON.stringify(errorEntry));
  }
}

/**
 * Main logging interface with semantic categories
 */
const log = {
  // Authentication & Authorization
  auth: (message, data) => formatLog('auth', message, data),

  // Payment Processing
  payment: (message, data) => formatLog('payment', message, data),

  // API Requests & Responses
  api: (message, data) => formatLog('api', message, data),

  // Database Operations
  db: (message, data) => formatLog('db', message, data),

  // Cache Operations
  cache: (message, data) => formatLog('cache', message, data),

  // Webhook Events
  webhook: (message, data) => formatLog('webhook', message, data),

  // File Operations (S3, uploads)
  file: (message, data) => formatLog('file', message, data),

  // Email Operations
  email: (message, data) => formatLog('email', message, data),

  // General Purpose
  general: (message, data) => formatLog('general', message, data),

  // Performance Metrics
  perf: (operation, duration, metadata = {}) => {
    formatLog('api', `${operation} completed`, {
      duration_ms: duration,
      ...metadata
    });
  },

  // Custom category
  custom: (category, message, data) => formatLog(category, message, data)
};

/**
 * Error logging interface with semantic categories
 */
const error = {
  // Authentication & Authorization Errors
  auth: (message, err, context) => formatError('auth', message, err, context),

  // Payment Processing Errors
  payment: (message, err, context) => formatError('payment', message, err, context),

  // API Errors
  api: (message, err, context) => formatError('api', message, err, context),

  // Database Errors
  db: (message, err, context) => formatError('db', message, err, context),

  // Cache Errors
  cache: (message, err, context) => formatError('cache', message, err, context),

  // Webhook Errors
  webhook: (message, err, context) => formatError('webhook', message, err, context),

  // File Operation Errors
  file: (message, err, context) => formatError('file', message, err, context),

  // Email Errors
  email: (message, err, context) => formatError('email', message, err, context),

  // General Errors
  general: (message, err, context) => formatError('general', message, err, context),

  // Validation Errors
  validation: (message, err, context) => formatError('validation', message, err, context),

  // Custom category
  custom: (category, message, err, context) => formatError(category, message, err, context)
};

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  if (!shouldLog()) {
    return next();
  }

  const start = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    res.send = originalSend;
    const duration = Date.now() - start;

    log.api(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
      user_id: req.userId || null
    });

    return res.send(data);
  };

  next();
}

/**
 * Error logging middleware
 */
function errorLogger(err, req, res, next) {
  error.api('Request error', err, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user_id: req.userId || null
  });

  next(err);
}

// ES Module exports
export {
  // New API (recommended)
  log,
  error,

  // Middleware
  requestLogger,
  errorLogger,

  // Legacy API (deprecated, kept for backward compatibility)
  clog,
cerror,

  // Utility functions
  shouldLog
};