import AuthService from '../services/AuthService.js';
import SettingsService from '../services/SettingsService.js';
import models from '../models/index.js';
import {
  logCookieConfig,
  detectPortal,
  getPortalCookieNames,
  createPortalAccessTokenConfig,
  createAccessTokenConfig
} from '../utils/cookieConfig.js';

const authService = AuthService; // Use singleton instance

// Middleware to verify tokens
export async function authenticateToken(req, res, next) {
  try {
    // Detect portal and get appropriate cookie names
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    // Get portal-specific token
    const token = req.cookies[cookieNames.accessToken];
    const refreshToken = req.cookies[cookieNames.refreshToken];

    // Try to authenticate with access token first (if present)
    if (token) {
      try {
        const tokenData = await authService.verifyToken(token);
        Object.assign(req, { user: tokenData });

        // ✅ FIX: Extend UserSession on every successful authentication, not just token refresh
        try {
          if (tokenData.id) {
            const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(tokenData.id, portal);
            if (activeSessions.length > 0) {
              // Extend the most recently accessed session
              await activeSessions[0].updateLastAccessed();
            }
          }
        } catch (sessionError) {
          // Continue anyway - token validation succeeded, session extension is non-critical
        }

        return next();
      } catch (tokenError) {
        // Access token is invalid/expired, fall through to refresh token logic below
      }
    }

    // If access token is missing or invalid, try to refresh using refresh token
    if (!refreshToken) {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }

    try {
      // Attempt to refresh the access token
      const refreshResult = await authService.refreshAccessToken(refreshToken);

      // Set new access token cookie with portal-specific name
      const accessConfig = createPortalAccessTokenConfig(portal);
      logCookieConfig(`Auth Middleware ${portal} - Refresh`, accessConfig);
      res.cookie(cookieNames.accessToken, refreshResult.accessToken, accessConfig);

      // ✅ FIX: Extend UserSession after successful token refresh
      try {
        const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(refreshResult.user.id, portal);
        if (activeSessions.length > 0) {
          // Extend the most recently accessed session
          await activeSessions[0].updateLastAccessed();
        }
      } catch (sessionError) {
        // Continue anyway - token refresh succeeded, session extension is non-critical
      }

      // Verify the new token and continue
      const newTokenData = await authService.verifyToken(refreshResult.accessToken);
      Object.assign(req, { user: newTokenData });
      next();
    } catch (refreshError) {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }
  } catch (error) {
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
}

// Optional auth middleware - continues if no token provided
export async function optionalAuth(req, res, next) {
  try {
    // Detect portal and get appropriate cookie names
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    // Get portal-specific token
    const token = req.cookies[cookieNames.accessToken];

    if (token) {
      try {
        const tokenData = await authService.verifyToken(token);
        Object.assign(req, { user: tokenData });

        // ✅ FIX: Extend UserSession on successful optional authentication
        try {
          if (tokenData.id) {
            const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(tokenData.id, portal);
            if (activeSessions.length > 0) {
              await activeSessions[0].updateLastAccessed();
            }
          }
        } catch (sessionError) {
          // Continue anyway - this is optional auth
        }
      } catch (error) {
        // Continue without authentication if token is invalid
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if any error occurs
    next();
  }
}

// Role-based access control
export function requireRole(requiredRole = 'user') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from database for fresh role information
      const portal = detectPortal(req);
      const cookieNames = getPortalCookieNames(portal);
      const accessToken = req.cookies[cookieNames.accessToken];
      const user = req.user || await authService.getUserByToken(accessToken);

      authService.validatePermissions(user, requiredRole);
      Object.assign(req, { userRecord: user }); // Attach full user record
      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Admin role check middleware
export const requireAdmin = requireRole('admin');

// Sysadmin role check middleware
export const requireSysadmin = requireRole('sysadmin');

// User type check middleware (for teacher, student, parent, headmaster)
export function requireUserType(requiredUserType) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from database for fresh user_type information
      const portal = detectPortal(req);
      const cookieNames = getPortalCookieNames(portal);
      const accessToken = req.cookies[cookieNames.accessToken];
      const user = req.user || await authService.getUserByToken(accessToken);

      if (!user.user_type || user.user_type !== requiredUserType) {
        return res.status(403).json({ error: `${requiredUserType} user type required` });
      }

      Object.assign(req, { userRecord: user }); // Attach full user record
      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Specific user type middleware
export const requireTeacher = requireUserType('teacher');
export const requireStudent = requireUserType('student');
export const requireParent = requireUserType('parent');
export const requireHeadmaster = requireUserType('headmaster');

// Middleware to check if user owns the resource
export function requireOwnership(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceOwnerId = await getResourceOwnerId(req);

      // Admin and sysadmin can access any resource
      if (req.user.role === 'admin' || req.user.role === 'sysadmin') {
        return next();
      }

      // Check if user owns the resource
      if (req.user.id !== resourceOwnerId) {
        return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
      }

      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Video streaming authentication middleware - supports both header and query parameter
export async function authenticateTokenForVideo(req, res, next) {
  try {
    // Try header first (standard authentication)
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }

    // If no header token, try query parameter (for video streaming)
    if (!token && req.query.authToken) {
      token = req.query.authToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = await authService.verifyToken(token);
    req.user = tokenData;
    next();
  } catch (error) {
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
}

// Middleware to validate API key (for external integrations)
export function validateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      // If no API key is configured, skip validation
      return next();
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    if (apiKey !== validApiKey) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
}

// =============================================
// UNIFIED AUTHENTICATION MIDDLEWARE (UNIFIED USER SYSTEM)
// =============================================

// Unified middleware to authenticate all users (including students with user_type='player')
// All authentication goes through the standard User model and portal-specific tokens
// Sets req.user (always User entity) and req.entity for backward compatibility
export async function authenticateUserOrPlayer(req, res, next) {
  try {
    // Detect portal and get appropriate cookie names
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    // Use standard user authentication (works for all user types)
    const userToken = req.cookies[cookieNames.accessToken];
    const userRefreshToken = req.cookies[cookieNames.refreshToken];

    if (userToken) {
      try {
        const tokenData = await authService.verifyToken(userToken);

        // All authenticated entities are Users in the unified system
        Object.assign(req, {
          user: tokenData,
          entity: tokenData,
          entityType: 'user' // Unified: all authenticated users are 'user' type
        });

        // Extend UserSession on successful unified authentication
        try {
          if (tokenData.id) {
            const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(tokenData.id, portal);
            if (activeSessions.length > 0) {
              await activeSessions[0].updateLastAccessed();
            }
          }
        } catch (sessionError) {
          // Continue anyway - token validation succeeded
        }

        return next();
      } catch (tokenError) {
        // Access token invalid, fall through to refresh token logic
      }
    }

    // Try user refresh if we have refresh token but access failed
    if (!req.user && userRefreshToken) {
      try {
        const refreshResult = await authService.refreshAccessToken(userRefreshToken);
        const accessConfig = createPortalAccessTokenConfig(portal);
        res.cookie(cookieNames.accessToken, refreshResult.accessToken, accessConfig);

        // Extend UserSession after successful token refresh
        try {
          const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(refreshResult.user.id, portal);
          if (activeSessions.length > 0) {
            // Extend the most recently accessed session
            await activeSessions[0].updateLastAccessed();
          }
        } catch (sessionError) {
          // Continue anyway - token refresh succeeded, session extension is non-critical
        }

        const newTokenData = await authService.verifyToken(refreshResult.accessToken);
        Object.assign(req, {
          user: newTokenData,
          entity: newTokenData,
          entityType: 'user' // Unified: all authenticated users are 'user' type
        });
        return next();
      } catch (refreshError) {
        // Refresh failed - no valid authentication
      }
    }

    // No valid authentication found
    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Authentication failed' });
  }
}

// Optional unified authentication - continues if no auth provided
export async function optionalUserOrPlayer(req, res, next) {
  try {
    // Detect portal and get appropriate cookie names
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    // Get portal-specific token
    const token = req.cookies[cookieNames.accessToken];

    if (token) {
      try {
        const tokenData = await authService.verifyToken(token);
        Object.assign(req, {
          user: tokenData,
          entity: tokenData,
          entityType: 'user' // Unified: all authenticated users are 'user' type
        });

        // Extend UserSession on successful optional authentication
        try {
          if (tokenData.id) {
            const activeSessions = await models.UserSession.findUserActiveSessionsByPortal(tokenData.id, portal);
            if (activeSessions.length > 0) {
              await activeSessions[0].updateLastAccessed();
            }
          }
        } catch (sessionError) {
          // Continue anyway - this is optional auth
        }
      } catch (error) {
        // Continue without authentication if token is invalid
        req.entity = null;
        req.entityType = null;
      }
    } else {
      // No token provided - continue without auth
      req.entity = null;
      req.entityType = null;
    }

    next();
  } catch (error) {
    // Continue without authentication if any error occurs
    req.entity = null;
    req.entityType = null;
    next();
  }
}

// Legacy compatibility function - redirects to unified authentication
// Students now authenticate as regular users through the unified system
export async function authenticatePlayer(req, res, next) {
  // Redirect to unified authentication - all students are users with user_type='player'
  return await authenticateToken(req, res, next);
}

// =============================================
// SETTINGS-BASED ACCESS CONTROL MIDDLEWARE
// =============================================

/**
 * Middleware to enforce settings-based student access control
 * Validates student access based on Settings.students_access mode:
 * - 'all': All authenticated users allowed (includes students with user_type='player')
 * - 'invite_only': Only admins allowed (privacy code authentication disabled)
 * - 'auth_only': Only authenticated users allowed (same as 'all' in unified system)
 */
export async function validateStudentAccess(req, res, next) {
  try {
    // Get portal and determine if this is a student operation
    const portal = detectPortal(req);

    // Only apply to student portal operations
    if (portal !== 'student') {
      return next();
    }

    // Get current students access setting
    const studentsAccess = await SettingsService.get('students_access');

    switch (studentsAccess) {
      case 'all':
      case 'auth_only':
        // All authenticated users allowed (unified system)
        return next();

      case 'invite_only':
        // Only admin users allowed (privacy code authentication disabled)
        if (!req.user || req.user.role !== 'admin') {
          return res.status(403).json({
            error: 'Student access restricted',
            message: 'Student portal is in invitation-only mode. Only administrators can access.',
            mode: 'invite_only',
            help: 'Contact your administrator for access.'
          });
        }
        return next();

      default:
        // Unknown mode - fail safe to most restrictive
        return res.status(500).json({
          error: 'Invalid access mode configuration',
          message: 'Student portal access mode is not properly configured.',
          configured_mode: studentsAccess
        });
    }
  } catch (error) {
    // If settings check fails, fail safe to blocking access
    return res.status(500).json({
      error: 'Access control check failed',
      message: 'Unable to verify student access permissions.',
      details: error.message
    });
  }
}

/**
 * Middleware specifically for student privacy code authentication
 * Controls when students can authenticate using privacy codes
 */
export async function validateStudentPrivacyCodeAccess(req, res, next) {
  try {
    const studentsAccess = await SettingsService.get('students_access');

    if (studentsAccess === 'invite_only') {
      return res.status(403).json({
        error: 'Privacy code authentication disabled',
        message: 'Student privacy code authentication is disabled. Only administrators can access the student portal.',
        mode: 'invite_only',
        help: 'Contact your administrator for access.'
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      error: 'Student access check failed',
      details: error.message
    });
  }
}

/**
 * Middleware specifically for User registration operations
 * Controls when new users can register in the system
 */
export async function validateUserRegistration(req, res, next) {
  try {
    const studentsAccess = await SettingsService.get('students_access');

    if (studentsAccess === 'invite_only') {
      return res.status(403).json({
        error: 'User registration disabled',
        message: 'New user registration is disabled. Only existing users can access the system.',
        mode: 'invite_only',
        help: 'Contact your administrator for access.'
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      error: 'User registration check failed',
      details: error.message
    });
  }
}
