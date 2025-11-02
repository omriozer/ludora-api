/**
 * File Operation Logger Utility
 *
 * Provides standardized logging for all file operations with enhanced context and debugging information.
 * Includes request tracking, user context, operation timing, and detailed error information.
 */

import crypto from 'crypto';

/**
 * Generates a unique request ID for tracking file operations
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * File Operation Logger Class
 */
class FileOperationLogger {
  constructor(operation, user, metadata = {}) {
    this.requestId = generateRequestId();
    this.operation = operation;
    this.user = user;
    this.metadata = metadata;
    this.startTime = Date.now();
    this.events = [];
  }

  /**
   * Add an event to the operation log
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  addEvent(event, data = {}) {
    this.events.push({
      timestamp: Date.now(),
      event,
      elapsed: Date.now() - this.startTime,
      data
    });
  }

  /**
   * Log operation start
   * @param {Object} details - Operation details
   */
  start(details = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      user: {
        id: this.user?.id,
        email: this.user?.email,
        role: this.user?.role
      },
      metadata: this.metadata,
      details,
      timestamp: new Date().toISOString()
    };

    console.log(`🚀 ${this.operation} started:`, logData);
    this.addEvent('operation_started', details);
  }

  /**
   * Log successful operation completion
   * @param {Object} result - Operation result
   */
  success(result = {}) {
    const elapsed = Date.now() - this.startTime;
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      result,
      elapsed: `${elapsed}ms`,
      events: this.events,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ ${this.operation} completed successfully:`, logData);
    this.addEvent('operation_completed', { result, elapsed });
  }

  /**
   * Log operation failure with detailed error information
   * @param {Error} error - Error object
   * @param {Object} context - Additional error context
   */
  error(error, context = {}) {
    const elapsed = Date.now() - this.startTime;
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details || {}
      },
      context,
      user: {
        id: this.user?.id,
        email: this.user?.email,
        role: this.user?.role
      },
      metadata: this.metadata,
      elapsed: `${elapsed}ms`,
      events: this.events,
      timestamp: new Date().toISOString()
    };

    console.error(`❌ ${this.operation} failed:`, logData);
    this.addEvent('operation_failed', { error: error.message, context, elapsed });
  }

  /**
   * Log warning during operation
   * @param {string} message - Warning message
   * @param {Object} data - Warning data
   */
  warn(message, data = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      warning: message,
      data,
      timestamp: new Date().toISOString()
    };

    console.warn(`⚠️ ${this.operation} warning: ${message}`, logData);
    this.addEvent('warning', { message, data });
  }

  /**
   * Log info during operation
   * @param {string} message - Info message
   * @param {Object} data - Info data
   */
  info(message, data = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      info: message,
      data,
      timestamp: new Date().toISOString()
    };

    console.log(`ℹ️ ${this.operation}: ${message}`, logData);
    this.addEvent('info', { message, data });
  }

  /**
   * Log transaction events
   * @param {string} action - Transaction action (start, commit, rollback)
   * @param {Object} data - Transaction data
   */
  transaction(action, data = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      transaction: action,
      data,
      timestamp: new Date().toISOString()
    };

    const emoji = action === 'commit' ? '✅' : action === 'rollback' ? '🔄' : '🏁';
    console.log(`${emoji} ${this.operation} transaction ${action}:`, logData);
    this.addEvent(`transaction_${action}`, data);
  }

  /**
   * Log S3 operations
   * @param {string} action - S3 action (upload, download, delete, check)
   * @param {string} s3Key - S3 key
   * @param {Object} result - Operation result
   */
  s3Operation(action, s3Key, result = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      s3Action: action,
      s3Key,
      result,
      timestamp: new Date().toISOString()
    };

    const emoji = result.success ? '✅' : '❌';
    console.log(`${emoji} ${this.operation} S3 ${action}:`, logData);
    this.addEvent(`s3_${action}`, { s3Key, result });
  }

  /**
   * Log database operations
   * @param {string} action - DB action (create, update, delete, find)
   * @param {string} model - Model name
   * @param {string} id - Record ID
   * @param {Object} data - Operation data
   */
  dbOperation(action, model, id, data = {}) {
    const logData = {
      requestId: this.requestId,
      operation: this.operation,
      dbAction: action,
      model,
      recordId: id,
      data,
      timestamp: new Date().toISOString()
    };

    console.log(`🗄️ ${this.operation} DB ${action} ${model}:`, logData);
    this.addEvent(`db_${action}`, { model, recordId: id, data });
  }

  /**
   * Get current operation summary
   * @returns {Object} Operation summary
   */
  getSummary() {
    return {
      requestId: this.requestId,
      operation: this.operation,
      user: this.user?.id,
      metadata: this.metadata,
      elapsed: `${Date.now() - this.startTime}ms`,
      events: this.events.length,
      started: new Date(this.startTime).toISOString()
    };
  }
}

/**
 * Factory function to create file operation loggers
 * @param {string} operation - Operation name
 * @param {Object} user - User object
 * @param {Object} metadata - Operation metadata
 * @returns {FileOperationLogger} Logger instance
 */
export function createFileLogger(operation, user, metadata = {}) {
  return new FileOperationLogger(operation, user, metadata);
}

/**
 * Helper to create error response with consistent format
 * @param {string} error - Error type
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @param {string} requestId - Request ID for tracking
 * @returns {Object} Formatted error response
 */
export function createErrorResponse(error, message, details = {}, requestId = null) {
  return {
    error,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...details
  };
}

/**
 * Helper to create success response with consistent format
 * @param {Object} data - Response data
 * @param {string} requestId - Request ID for tracking
 * @returns {Object} Formatted success response
 */
export function createSuccessResponse(data, requestId = null) {
  return {
    success: true,
    requestId,
    timestamp: new Date().toISOString(),
    ...data
  };
}

export default FileOperationLogger;