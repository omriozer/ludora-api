import { ValidationError, DatabaseError, ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';

// Custom error classes
export class APIError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Mark as operational error (not a programming error)
  }
}

export class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends APIError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends APIError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends APIError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(message = 'Service temporarily unavailable', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

// Error logging utility
export class ErrorLogger {
  static log(error, req = null, level = 'error') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      statusCode: error.statusCode,
      code: error.code,
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'development'
    };

    if (req) {
      errorInfo.request = {
        method: req.method,
        url: req.originalUrl,
        headers: this.sanitizeHeaders(req.headers),
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.uid
      };
    }

    // Log based on level
    switch (level) {
      case 'error':
        console.error('🔴 Error:', JSON.stringify(errorInfo, null, 2));
        break;
      case 'warn':
        console.warn('🟡 Warning:', JSON.stringify(errorInfo, null, 2));
        break;
      case 'info':
        console.info('🔵 Info:', JSON.stringify(errorInfo, null, 2));
        break;
      default:
        console.log('⚫ Log:', JSON.stringify(errorInfo, null, 2));
    }

    // In production, you might want to send to external logging service
    if (process.env.ENVIRONMENT === 'production') {
      // TODO: Send to logging service like Winston, DataDog, Sentry, etc.
    }
  }

  static sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }
}

// Main error handling middleware
export function globalErrorHandler(error, req, res, next) {
  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details = null;

  // Handle different error types
  if (error instanceof APIError) {
    // Custom API errors
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof ValidationError) {
    // Sequelize validation errors
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = error.errors?.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  } else if (error instanceof UniqueConstraintError) {
    // Sequelize unique constraint errors
    statusCode = 409;
    message = 'Resource already exists';
    code = 'UNIQUE_CONSTRAINT_ERROR';
    details = error.errors?.map(err => ({
      field: err.path,
      message: err.message
    }));
  } else if (error instanceof ForeignKeyConstraintError) {
    // Sequelize foreign key constraint errors
    statusCode = 400;
    message = 'Invalid reference to related resource';
    code = 'FOREIGN_KEY_CONSTRAINT_ERROR';
    details = {
      table: error.table,
      field: error.fields?.[0]
    };
  } else if (error instanceof DatabaseError) {
    // Other Sequelize database errors
    statusCode = 500;
    message = 'Database error';
    code = 'DATABASE_ERROR';
    
    // Don't expose database details in production
    if (process.env.ENVIRONMENT !== 'production') {
      details = { originalError: error.message };
    }
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    // JWT expired errors
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (error.name === 'MulterError') {
    // File upload errors
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = 'File upload error';
    }
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    // Network/connection errors
    statusCode = 503;
    message = 'External service unavailable';
    code = 'SERVICE_UNAVAILABLE';
  } else if (error.message && error.message.includes('rate limit')) {
    // Rate limiting errors
    statusCode = 429;
    message = 'Too many requests';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Log the error
  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  ErrorLogger.log(error, req, logLevel);

  // Prepare error response
  const errorResponse = {
    error: {
      message,
      code,
      statusCode
    }
  };

  // Add details for client errors (4xx) or in development for server errors
  if (details && (statusCode < 500 || process.env.ENVIRONMENT === 'development')) {
    errorResponse.error.details = details;
  }

  // Add stack trace ONLY in development AND only for debugging
  if (process.env.ENVIRONMENT === 'development' && process.env.DEBUG_ERRORS === 'true') {
    errorResponse.error.stack = error.stack;
  }

  // Never expose internal server errors details in production
  if (process.env.ENVIRONMENT === 'production' && statusCode >= 500) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  // Add request ID if available
  if (req.requestId) {
    errorResponse.error.requestId = req.requestId;
  }

  res.status(statusCode).json(errorResponse);
}

// 404 handler for undefined routes
export function notFoundHandler(req, res) {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);

  // Log the 404 for monitoring purposes
  ErrorLogger.log(error, req, 'warn');

  // Never expose available routes - this is a security vulnerability
  res.status(404).json({
    error: {
      message: error.message,
      code: error.code,
      statusCode: 404
    }
  });
}

// Async error wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Health check error handler
export async function healthCheckErrorHandler(req, res) {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.ENVIRONMENT || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    // Only expose detailed service status in development
    if (process.env.ENVIRONMENT === 'development') {
      health.services = {
        database: 'checking...',
        email: process.env.EMAIL_HOST ? 'configured' : 'not_configured',
        storage: 's3'
      };
    } else {
      // In production, only expose minimal service status
      health.services = {
        database: 'checking...'
      };
    }

    // Check database connection
    try {
      // Import here to avoid circular dependency
      const { sequelize } = await import('../models/index.js');
      await sequelize.authenticate();
      health.services.database = 'connected';
    } catch (dbError) {
      health.services.database = 'disconnected';
      health.status = 'degraded';
      health.issues = health.issues || [];
      health.issues.push('Database connection failed');
    }

    // Set overall status
    const overallStatus = health.services.database === 'disconnected' ? 'unhealthy' : 'healthy';
    health.status = overallStatus;

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    ErrorLogger.log(error, req, 'error');
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

// Request ID middleware
export function requestIdMiddleware(req, res, next) {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.set('X-Request-ID', req.requestId);
  next();
}

// Request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.uid,
      requestId: req.requestId
    };

    // Request logging removed for cleaner output
  });

  next();
}