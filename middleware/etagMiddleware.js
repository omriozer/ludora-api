/**
 * ETag Middleware for HTTP Conditional Requests
 *
 * This middleware implements selective ETag support for specific endpoints
 * to enable efficient browser caching without time-based expiration.
 *
 * Strategy: Use MAX(updated_at) timestamps for performance-efficient ETag generation
 *
 * @module etagMiddleware
 */

import models from '../models/index.js';
import { luderror } from '../lib/ludlog.js';


/**
 * Generate ETag for Settings endpoint
 * Uses MAX(updated_at) from Settings table
 * @returns {Promise<string>} ETag value
 */
async function generateSettingsETag() {
  try {
    // Get the most recent update timestamp from Settings table
    const result = await models.Settings.findOne({
      attributes: [[models.sequelize.fn('MAX', models.sequelize.col('updated_at')), 'maxUpdatedAt']],
      raw: true
    });

    const maxUpdatedAt = result?.maxUpdatedAt || new Date(0);
    const timestamp = new Date(maxUpdatedAt).getTime();

    // Generate ETag in format: "settings-{timestamp}"
    const etag = `"settings-${timestamp}"`;

    return etag;
  } catch (error) {
    luderror.api('[ETag] Error generating Settings ETag:', error);
    // Return a fallback ETag that changes on error
    return `"settings-error-${Date.now()}"`;
  }
}

/**
 * Generate ETag for User endpoint
 * Uses user's updated_at timestamp
 * @param {string} userId - User ID
 * @returns {Promise<string>} ETag value
 */
async function generateUserETag(userId) {
  try {
    const user = await models.User.findByPk(userId, {
      attributes: ['updated_at'],
      raw: true
    });

    if (!user) {
      return null; // No ETag if user not found
    }

    const timestamp = new Date(user.updated_at).getTime();

    // Generate ETag in format: "user-{userId}-{timestamp}"
    const etag = `"user-${userId}-${timestamp}"`;

    return etag;
  } catch (error) {
    luderror.api('[ETag] Error generating User ETag:', error);
    return `"user-error-${Date.now()}"`;
  }
}

/**
 * Generate ETag for /auth/me endpoint
 * Uses authenticated user's updated_at timestamp
 * @param {object} req - Express request object (must have req.user)
 * @returns {Promise<string>} ETag value
 */
async function generateAuthMeETag(req) {
  try {
    // For /auth/me, we need the authenticated user's ID
    if (!req.user || !req.user.id) {
      return null; // No ETag if not authenticated
    }

    return generateUserETag(req.user.id);
  } catch (error) {
    luderror.api('[ETag] Error generating auth/me ETag:', error);
    return `"auth-me-error-${Date.now()}"`;
  }
}

/**
 * Middleware factory for adding ETag support to routes
 *
 * @param {string} recordType - Type of record ('settings', 'user', 'auth-me')
 * @returns {Function} Express middleware function
 *
 * @example
 * // For settings endpoint
 * router.get('/settings', addETagSupport('settings'), getSettings);
 *
 * // For user endpoints
 * router.get('/auth/me', addETagSupport('auth-me'), getCurrentUser);
 * router.get('/users/:id', addETagSupport('user'), getUser);
 */
export function addETagSupport(recordType) {
  return async function etagMiddleware(req, res, next) {
    try {
      // Store the original json method
      const originalJson = res.json.bind(res);

      // Override res.json to add ETag after response data is ready
      res.json = async function(data) {
        try {
          // Generate ETag based on record type
          let etag = null;

          switch (recordType) {
            case 'settings':
              etag = await generateSettingsETag();
              break;

            case 'user':
              // For /entities/user/:id or similar patterns
              const userId = req.params.id || req.params.userId;
              if (userId) {
                etag = await generateUserETag(userId);
              }
              break;

            case 'auth-me':
              etag = await generateAuthMeETag(req);
              break;

            default:
              luderror.api('[ETag] Unknown record type:', recordType);
          }

          // Check if client sent If-None-Match header
          const clientETag = req.get('If-None-Match');

          if (etag && clientETag && clientETag === etag) {
            // Client has current version - return 304 Not Modified

            return res.status(304).end();
          }

          // Set ETag header if we generated one
          if (etag) {
            res.set('ETag', etag);

          }

          // Call original json method with data
          return originalJson(data);

        } catch (error) {
          luderror.api('[ETag] Error in response handler:', error);
          // On error, just send response without ETag
          return originalJson(data);
        }
      };

      // Continue to the actual route handler
      next();

    } catch (error) {
      luderror.api('[ETag] Middleware error:', error);
      // On error, continue without ETag support
      next();
    }
  };
}

/**
 * Utility function to manually invalidate ETags when data changes
 * This is useful for operations that modify data outside of normal update flows
 *
 * @param {string} recordType - Type of record to invalidate
 * @param {string} [recordId] - Optional record ID for user-specific invalidation
 */
export async function invalidateETag(recordType, recordId = null) {
  try {
    switch (recordType) {
      case 'settings':
        // Touch the Settings updated_at to invalidate all settings ETags
        await models.Settings.update(
          { updated_at: new Date() },
          { where: {}, silent: true }
        );

        break;

      case 'user':
        if (recordId) {
          // Touch specific user's updated_at
          await models.User.update(
            { updated_at: new Date() },
            { where: { id: recordId }, silent: true }
          );

        }
        break;

      default:
        luderror.api('[ETag] Cannot invalidate unknown type:', recordType);
    }
  } catch (error) {
    luderror.api('[ETag] Error invalidating ETag:', error);
  }
}

/**
 * Express middleware to parse and validate ETag headers
 * This can be used globally or on specific routes that need ETag validation
 */
export function parseETagHeaders(req, res, next) {
  // Parse If-None-Match header (can contain multiple ETags)
  const ifNoneMatch = req.get('If-None-Match');
  if (ifNoneMatch) {
    // Store parsed ETags for route handlers to use
    req.clientETags = ifNoneMatch
      .split(',')
      .map(etag => etag.trim())
      .filter(Boolean);
  } else {
    req.clientETags = [];
  }

  next();
}

// Export all functions for flexibility
export default {
  addETagSupport,
  invalidateETag,
  parseETagHeaders,
  // Export generators for testing
  generateSettingsETag,
  generateUserETag,
  generateAuthMeETag
};