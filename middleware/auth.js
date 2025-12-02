import AuthService from '../services/AuthService.js';
import PlayerService from '../services/PlayerService.js';
import models from '../models/index.js';
import {
  logCookieConfig,
  detectPortal,
  getPortalCookieNames,
  createPortalAccessTokenConfig,
  createAccessTokenConfig,
  createClearCookieConfig
} from '../utils/cookieConfig.js';
import {
  PLAYER_AUTH_ERRORS,
  createPlayerAuthError,
  getPlayerAuthErrorCode
} from '../utils/playerAuthErrors.js';

const authService = new AuthService();
const playerService = new PlayerService();

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
        req.user = tokenData;

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
      req.user = newTokenData;
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
        req.user = tokenData;

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
      req.userRecord = user; // Attach full user record
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

      req.userRecord = user; // Attach full user record
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
// UNIFIED AUTHENTICATION MIDDLEWARE (USERS & PLAYERS)
// =============================================

// Unified middleware to authenticate both users and players
// This middleware tries user authentication first, then player authentication
// Sets req.entity (unified) and req.entityType ('user' | 'player')
export async function authenticateUserOrPlayer(req, res, next) {
  try {
    // Detect portal and get appropriate cookie names
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    // Try user authentication first
    const userToken = req.cookies[cookieNames.accessToken];
    const userRefreshToken = req.cookies[cookieNames.refreshToken];

    if (userToken) {
      try {
        const tokenData = await authService.verifyToken(userToken);

        // Check if this is actually a player token
        if (tokenData.type === 'player') {
          // This is a player token, skip to player auth section
        } else {
          // This is a user token
          req.user = tokenData;
          req.entity = tokenData;
          req.entityType = 'user';

          // ✅ FIX: Extend UserSession on successful unified authentication
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
        }
      } catch (tokenError) {
        // User token invalid, fall through to player auth
      }
    }

    // Try user refresh if we have refresh token but access failed
    if (!req.user && userRefreshToken) {
      try {
        const refreshResult = await authService.refreshAccessToken(userRefreshToken);
        const accessConfig = createPortalAccessTokenConfig(portal);
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

        const newTokenData = await authService.verifyToken(refreshResult.accessToken);
        req.user = newTokenData;
        req.entity = newTokenData;
        req.entityType = 'user';
        return next();
      } catch (refreshError) {
        // User refresh failed, continue to player auth
      }
    }

    // Try player authentication
    const playerAccessToken = req.cookies.student_access_token;
    const playerRefreshToken = req.cookies.student_refresh_token;

    if (playerAccessToken) {
      try {
        const tokenData = await authService.verifyToken(playerAccessToken);
        if (tokenData.type === 'player') {
          const player = await playerService.getPlayer(tokenData.id, true);
          if (player) {
            req.player = {
              id: player.id,
              privacy_code: player.privacy_code,
              display_name: player.display_name,
              teacher_id: player.teacher_id,
              teacher: player.teacher,
              achievements: player.achievements,
              preferences: player.preferences,
              is_online: player.is_online,
              sessionType: 'player'
            };
            req.entity = req.player;
            req.entityType = 'player';

            // ✅ FIX: Extend PlayerSession on successful unified player authentication
            try {
              const activeSessions = await models.UserSession.findPlayerActiveSessionsByPortal(player.id, 'student');
              if (activeSessions.length > 0) {
                await activeSessions[0].updateLastAccessed();
              }
            } catch (sessionError) {
              // Continue anyway - token validation succeeded
            }

            return next();
          }
        }
      } catch (tokenError) {
        // Player token invalid, try refresh
      }
    }

    // Try player refresh if we have refresh token but access failed
    if (!req.player && playerRefreshToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const refreshPayload = jwt.default.verify(playerRefreshToken, process.env.JWT_SECRET);

        if (refreshPayload.type === 'player') {
          const player = await playerService.getPlayer(refreshPayload.id, true);
          if (player) {
            const playerTokenData = {
              id: player.id,
              privacy_code: player.privacy_code,
              display_name: player.display_name,
              type: 'player'
            };
            const newAccessToken = authService.createAccessToken(playerTokenData);

            const playerAccessConfig = createAccessTokenConfig();
            res.cookie('student_access_token', newAccessToken, playerAccessConfig);

            // ✅ FIX: Extend PlayerSession after successful token refresh
            try {
              const activeSessions = await models.UserSession.findPlayerActiveSessionsByPortal(player.id, 'student');
              if (activeSessions.length > 0) {
                // Extend the most recently accessed session
                await activeSessions[0].updateLastAccessed();
              }
            } catch (sessionError) {
              // Continue anyway - token refresh succeeded, session extension is non-critical
            }

            req.player = {
              id: player.id,
              privacy_code: player.privacy_code,
              display_name: player.display_name,
              teacher_id: player.teacher_id,
              teacher: player.teacher,
              achievements: player.achievements,
              preferences: player.preferences,
              is_online: player.is_online,
              sessionType: 'player'
            };
            req.entity = req.player;
            req.entityType = 'player';
            return next();
          }
        }
      } catch (refreshError) {
        // Both user and player auth failed
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
    // Try the unified authentication, but don't fail if no auth found
    await authenticateUserOrPlayer(req, res, () => {
      // Success - authenticated as user or player
      next();
    });
  } catch (error) {
    // No authentication or failed - continue without auth
    req.entity = null;
    req.entityType = null;
    next();
  }
}

// Middleware to authenticate players using dual token system with automatic refresh
// COOKIE PERSISTENCE FIX: Enhanced with specific error types for better debugging
export async function authenticatePlayer(req, res, next) {
  try {
    // Get player-specific tokens
    const accessToken = req.cookies.student_access_token;
    const refreshToken = req.cookies.student_refresh_token;

    // Try to authenticate with access token first (if present)
    if (accessToken) {
      try {
        const tokenData = await authService.verifyToken(accessToken);

        // Verify this is a player token
        if (tokenData.type !== 'player') {
          const error = createPlayerAuthError.tokenInvalid('Not a player token');
          return res.status(error.statusCode).json(error.toJSON());
        }

        // Get full player data
        const player = await playerService.getPlayer(tokenData.id, true);
        if (!player) {
          const error = createPlayerAuthError.playerNotFound(tokenData.id);
          return res.status(error.statusCode).json(error.toJSON());
        }

        // Check if player is active
        if (player.is_active === false) {
          const error = createPlayerAuthError.playerInactive();
          return res.status(error.statusCode).json(error.toJSON());
        }

        // Set player data on request object
        req.player = {
          id: player.id,
          privacy_code: player.privacy_code,
          display_name: player.display_name,
          teacher_id: player.teacher_id,
          teacher: player.teacher,
          achievements: player.achievements,
          preferences: player.preferences,
          is_online: player.is_online,
          sessionType: 'player'
        };

        // Also set as unified entity
        req.entity = req.player;
        req.entityType = 'player';

        // ✅ FIX: Extend PlayerSession on successful token validation
        try {
          const activeSessions = await models.UserSession.findPlayerActiveSessionsByPortal(player.id, 'student');
          if (activeSessions.length > 0) {
            await activeSessions[0].updateLastAccessed();
          }
        } catch (sessionError) {
          // Continue anyway - token validation succeeded
        }

        return next();
      } catch (tokenError) {
        // Access token is invalid/expired, fall through to refresh token logic below
        // Debug logging removed for production security
      }
    }

    // If access token is missing or invalid, try to refresh using refresh token
    if (!refreshToken) {
      const error = createPlayerAuthError.tokenMissing();
      return res.status(error.statusCode).json(error.toJSON());
    }

    try {
      // Verify player refresh token (using custom player token format)
      const jwt = await import('jsonwebtoken');
      let refreshPayload;
      try {
        refreshPayload = jwt.default.verify(refreshToken, process.env.JWT_SECRET);
      } catch (tokenError) {
        const errorCode = getPlayerAuthErrorCode(tokenError);
        const error = errorCode === PLAYER_AUTH_ERRORS.TOKEN_EXPIRED
          ? createPlayerAuthError.tokenExpired()
          : createPlayerAuthError.tokenInvalid('Invalid refresh token');
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Verify this is a player token
      if (refreshPayload.type !== 'player') {
        const error = createPlayerAuthError.tokenInvalid('Refresh token is not a player token');
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Get player data to ensure player still exists and is active
      const player = await playerService.getPlayer(refreshPayload.id, true);
      if (!player) {
        const error = createPlayerAuthError.playerNotFound(refreshPayload.id);
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Check if player is active
      if (player.is_active === false) {
        const error = createPlayerAuthError.playerInactive();
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Generate new access token
      const playerTokenData = {
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        type: 'player'
      };
      const newAccessToken = authService.createAccessToken(playerTokenData);

      // Set new player access token cookie
      const playerAccessConfig = createAccessTokenConfig();
      logCookieConfig('Player Auth Middleware - Refresh', playerAccessConfig);
      res.cookie('student_access_token', newAccessToken, playerAccessConfig);

      // ✅ FIX: Extend PlayerSession after successful token refresh
      try {
        const activeSessions = await models.UserSession.findPlayerActiveSessionsByPortal(player.id, 'student');
        if (activeSessions.length > 0) {
          // Extend the most recently accessed session
          await activeSessions[0].updateLastAccessed();
        }
      } catch (sessionError) {
        // Continue anyway - token refresh succeeded, session extension is non-critical
      }

      // Set player data on request object
      req.player = {
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        teacher_id: player.teacher_id,
        teacher: player.teacher,
        achievements: player.achievements,
        preferences: player.preferences,
        is_online: player.is_online,
        sessionType: 'player'
      };

      // Also set as unified entity
      req.entity = req.player;
      req.entityType = 'player';

      next();
    } catch (refreshError) {
      const error = createPlayerAuthError.refreshFailed(refreshError.message);
      return res.status(error.statusCode).json(error.toJSON());
    }
  } catch (error) {
    const playerError = createPlayerAuthError.serverError(error.message);
    res.status(playerError.statusCode).json(playerError.toJSON());
  }
}
