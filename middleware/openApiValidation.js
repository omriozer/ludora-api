/**
 * OpenAPI Validation Middleware for Ludora API
 *
 * Provides automatic request/response validation against OpenAPI schemas.
 * Validates all API calls to ensure they match the documented contract.
 *
 * @module middleware/openApiValidation
 */

import OpenApiValidator from 'express-openapi-validator';
import { ludlog, luderror } from '../lib/ludlog.js';
import { specs } from '../src/openapi/index.js';

/**
 * OpenAPI validation middleware configuration
 *
 * Validates:
 * - Request parameters (path, query, body)
 * - Request headers
 * - Response bodies
 * - Content types
 */
export const openApiValidationMiddleware = OpenApiValidator.middleware({
  apiSpec: specs,
  validateRequests: {
    allowUnknownQueryParameters: false,  // Strict query param validation
    removeAdditional: false,             // Don't silently remove extra fields
    coerceTypes: true                    // Convert strings to numbers where applicable
  },
  validateResponses: {
    removeAdditional: false              // Don't silently remove extra fields from responses
  },
  ignorePaths: /.*\/api-docs.*/,        // Don't validate Swagger UI endpoints
  operationHandlers: false,              // We use our own route handlers

  // Schema dereferencing configuration
  $refParser: {
    mode: 'dereference'
  }
});

/**
 * Custom error handler for OpenAPI validation failures
 *
 * Transforms OpenAPI validation errors into consistent Ludora error format.
 * Logs validation failures for debugging and monitoring.
 *
 * @param {Error} err - The validation error
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const openApiErrorHandler = (err, req, res, next) => {
  // Only handle OpenAPI validation errors
  if (err.status === 400 && err.errors) {
    ludlog.api('OpenAPI validation error', {
      path: req.path,
      method: req.method,
      errors: err.errors,
      body: req.body
    });

    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors.map(error => ({
        path: error.path,
        message: error.message,
        errorCode: error.errorCode
      }))
    });
  }

  // Handle response validation errors (should only happen in development)
  if (err.status === 500 && err.message?.includes('response')) {
    luderror.api('OpenAPI response validation error', err, {
      path: req.path,
      method: req.method
    });

    // In production, log but don't expose schema violations to clients
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    }

    // In development, show detailed response validation errors
    return res.status(500).json({
      error: 'RESPONSE_VALIDATION_ERROR',
      message: 'Response does not match OpenAPI schema',
      details: err.errors || [err.message]
    });
  }

  // Pass non-validation errors to next error handler
  next(err);
};

/**
 * Optional middleware to log successful validations (development only)
 * Useful for debugging schema coverage and validation behavior.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const openApiValidationLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      ludlog.api('OpenAPI validation passed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });

      return originalJson(body);
    };
  }

  next();
};

export default {
  openApiValidationMiddleware,
  openApiErrorHandler,
  openApiValidationLogger
};
