// Socket.IO Authentication Middleware
// Integrates with existing Ludora authentication system

import AuthService from '../services/AuthService.js';
import PlayerService from '../services/PlayerService.js';
import {
  detectPortalFromOrigin,
  getPortalCookieNames
} from '../utils/cookieConfig.js';
import { luderror } from '../lib/ludlog.js';

const authService = new AuthService();
const playerService = new PlayerService();

/**
 * Parse cookies from Socket.IO handshake headers
 * @param {Object} handshake - Socket.IO handshake object
 * @returns {Object} - Parsed cookies
 */
function parseCookies(handshake) {
  const cookies = {};
  const cookieHeader = handshake.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name && rest.length > 0) {
        cookies[name] = decodeURIComponent(rest.join('='));
      }
    });
  }

  return cookies;
}

/**
 * Socket.IO authentication middleware for user accounts
 * Supports both teacher and student portals with automatic portal detection
 */
export function authenticateSocketUser(socket, next) {
  try {
    const cookies = parseCookies(socket.handshake);
    const origin = socket.handshake.headers.origin;

    // Detect portal from origin
    const portal = detectPortalFromOrigin(origin);
    const cookieNames = getPortalCookieNames(portal);

    // Get portal-specific tokens
    const accessToken = cookies[cookieNames.accessToken];
    const refreshToken = cookies[cookieNames.refreshToken];

    // If no tokens present, continue as unauthenticated (guest)
    if (!accessToken && !refreshToken) {
      socket.authenticated = false;
      socket.authType = 'guest';
      socket.portal = portal;
      return next();
    }

    // Try to authenticate with access token
    if (accessToken) {
      authService.verifyToken(accessToken)
        .then(tokenData => {
          socket.authenticated = true;
          socket.authType = 'user';
          socket.user = tokenData;
          socket.portal = portal;
          next();
        })
        .catch(tokenError => {
          // Access token invalid, try refresh token
          if (refreshToken) {
            authService.refreshAccessToken(refreshToken)
              .then(refreshResult => {
                return authService.verifyToken(refreshResult.accessToken);
              })
              .then(newTokenData => {
                socket.authenticated = true;
                socket.authType = 'user';
                socket.user = newTokenData;
                socket.portal = portal;
                next();
              })
              .catch(refreshError => {
                // Both tokens failed, continue as guest
                socket.authenticated = false;
                socket.authType = 'guest';
                socket.portal = portal;
                next();
              });
          } else {
            // No refresh token, continue as guest
            socket.authenticated = false;
            socket.authType = 'guest';
            socket.portal = portal;
            next();
          }
        });
    } else if (refreshToken) {
      // Only refresh token available
      authService.refreshAccessToken(refreshToken)
        .then(refreshResult => {
          return authService.verifyToken(refreshResult.accessToken);
        })
        .then(tokenData => {
          socket.authenticated = true;
          socket.authType = 'user';
          socket.user = tokenData;
          socket.portal = portal;
          next();
        })
        .catch(error => {
          socket.authenticated = false;
          socket.authType = 'guest';
          socket.portal = portal;
          next();
        });
    }
  } catch (error) {
    luderror.auth('❌ Socket authentication error:', error);
    socket.authenticated = false;
    socket.authType = 'error';
    socket.authError = error.message;
    next(); // Continue anyway to avoid blocking connections
  }
}

/**
 * Socket.IO authentication middleware for player accounts
 * Used for student game sessions
 */
export function authenticateSocketPlayer(socket, next) {
  try {
    const cookies = parseCookies(socket.handshake);
    const playerSession = cookies.student_access_token;

    if (!playerSession) {
      // No player session, continue as unauthenticated
      socket.playerAuthenticated = false;
      socket.authType = 'guest';
      return next();
    }

    // Validate player session
    playerService.validateSession(playerSession)
      .then(sessionData => {
        if (!sessionData) {
          socket.playerAuthenticated = false;
          socket.authType = 'guest';
          return next();
        }

        // Get full player data
        return playerService.getPlayer(sessionData.playerId, true);
      })
      .then(player => {
        if (!player) {
          socket.playerAuthenticated = false;
          socket.authType = 'guest';
          return next();
        }

        socket.playerAuthenticated = true;
        socket.authType = 'player';
        socket.player = {
          id: player.id,
          privacy_code: player.privacy_code,
          display_name: player.display_name,
          teacher_id: player.teacher_id,
          teacher: player.teacher,
          achievements: player.achievements,
          preferences: player.preferences,
          is_online: player.is_online
        };

        next();
      })
      .catch(error => {
        luderror.auth('❌ Socket player authentication error:', error);
        socket.playerAuthenticated = false;
        socket.authType = 'guest';
        next();
      });
  } catch (error) {
    luderror.auth('❌ Socket player authentication error:', error);
    socket.playerAuthenticated = false;
    socket.authType = 'error';
    socket.authError = error.message;
    next(); // Continue anyway to avoid blocking connections
  }
}

/**
 * Combined Socket.IO authentication middleware
 * Tries user authentication first, then player authentication
 * Allows guests if both fail
 */
export function authenticateSocket(socket, next) {
  // First try user authentication
  authenticateSocketUser(socket, (userAuthError) => {
    if (userAuthError) {
      return next(userAuthError);
    }

    // If not authenticated as user, try player authentication
    if (!socket.authenticated) {
      authenticateSocketPlayer(socket, (playerAuthError) => {
        if (playerAuthError) {
          return next(playerAuthError);
        }

        // Set final auth state
        socket.isAuthenticated = socket.authenticated || socket.playerAuthenticated;
        socket.entity = socket.user || socket.player || null;
        socket.entityType = socket.authType;

        next();
      });
    } else {
      // Already authenticated as user
      socket.isAuthenticated = true;
      socket.entity = socket.user;
      socket.entityType = socket.authType;

      next();
    }
  });
}

/**
 * Socket.IO middleware to require authentication
 * Use this for events that require a logged-in user
 */
export function requireSocketAuth(socket, next) {
  if (!socket.isAuthenticated) {
    const error = new Error('Authentication required');
    error.data = { type: 'auth_required' };
    return next(error);
  }
  next();
}

/**
 * Socket.IO middleware to require user authentication (not player)
 * Use this for teacher/admin only features
 */
export function requireSocketUserAuth(socket, next) {
  if (!socket.authenticated || socket.authType !== 'user') {
    const error = new Error('User authentication required');
    error.data = { type: 'user_auth_required' };
    return next(error);
  }
  next();
}

/**
 * Socket.IO middleware to require player authentication
 * Use this for student-only features
 */
export function requireSocketPlayerAuth(socket, next) {
  if (!socket.playerAuthenticated || socket.authType !== 'player') {
    const error = new Error('Player authentication required');
    error.data = { type: 'player_auth_required' };
    return next(error);
  }
  next();
}