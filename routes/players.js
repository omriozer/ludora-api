import express from 'express';
import { authenticateToken, requireTeacher, authenticatePlayer, authenticateUserOrPlayer } from '../middleware/auth.js';
import { validateBody, rateLimiters, studentsAccessMiddleware } from '../middleware/validation.js';
import AuthService from '../services/AuthService.js';
import PlayerService from '../services/PlayerService.js';
import { generateId } from '../models/baseModel.js';
import Joi from 'joi';
import {
  createAccessTokenConfig,
  createRefreshTokenConfig,
  createClearCookieConfig,
  logCookieConfig
} from '../utils/cookieConfig.js';
import { clog, cerror } from '../lib/utils.js';

const authService = new AuthService();
const playerService = new PlayerService();

const router = express.Router();

// Validation schemas for player routes
const schemas = {
  playerLogin: Joi.object({
    privacy_code: Joi.string().min(3).max(20).trim().required()
      .messages({
        'string.min': 'Privacy code must be at least 3 characters',
        'string.max': 'Privacy code must be at most 20 characters',
        'any.required': 'Privacy code is required'
      })
  }),
  createPlayer: Joi.object({
    display_name: Joi.string().min(1).max(100).trim().required()
      .messages({
        'string.min': 'Display name must not be empty',
        'string.max': 'Display name must be at most 100 characters',
        'any.required': 'Display name is required'
      }),
    metadata: Joi.object().optional()
  }),
  createAnonymousPlayer: Joi.object({
    display_name: Joi.string().min(1).max(100).trim().required()
      .messages({
        'string.min': 'Display name must not be empty',
        'string.max': 'Display name must be at most 100 characters',
        'any.required': 'Display name is required'
      }),
    metadata: Joi.object().optional()
  }),
  updatePlayer: Joi.object({
    display_name: Joi.string().min(1).max(100).trim().optional(),
    preferences: Joi.object().optional(),
    achievements: Joi.array().optional()
  }).min(1),
  assignTeacher: Joi.object({
    teacher_id: Joi.string().required()
      .messages({
        'any.required': 'Teacher ID is required'
      })
  })
};

// =============================================
// PLAYER AUTHENTICATION ROUTES
// =============================================

// Player login with privacy code
router.post('/login', studentsAccessMiddleware, rateLimiters.auth, validateBody(schemas.playerLogin), async (req, res) => {
  try {
    const { privacy_code } = req.body;

    // Collect session metadata
    const sessionMetadata = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      timestamp: new Date(),
      loginMethod: 'privacy_code'
    };

    // Authenticate player using PlayerService
    const result = await playerService.authenticatePlayer(privacy_code, sessionMetadata);

    if (!result.success) {
      return res.status(401).json({ error: 'Invalid privacy code' });
    }

    // Generate player access and refresh tokens like teacher authentication
    const playerTokenData = {
      id: result.player.id,
      privacy_code: result.player.privacy_code,
      display_name: result.player.display_name,
      type: 'player' // Distinguish from user tokens
    };

    // Generate player access token
    const accessToken = authService.createAccessToken(playerTokenData);

    // Create player-specific refresh token (don't use user-focused AuthService)
    const jwt = await import('jsonwebtoken');
    const refreshTokenId = generateId(); // Use same ID generation as other parts
    const refreshPayload = {
      id: result.player.id,
      type: 'player',
      tokenId: refreshTokenId,
      entityType: 'player'
    };
    const refreshToken = jwt.default.sign(refreshPayload, process.env.JWT_SECRET, {
      expiresIn: '7d',
      issuer: 'ludora-api',
      audience: 'ludora-student-portal'
    });

    // Set player access token as httpOnly cookie (15 minutes)
    const playerAccessConfig = createAccessTokenConfig();
    logCookieConfig('Player Login - Access Token', playerAccessConfig);
    res.cookie('student_access_token', accessToken, playerAccessConfig);

    // Set player refresh token as httpOnly cookie (7 days)
    const playerRefreshConfig = createRefreshTokenConfig();
    logCookieConfig('Player Login - Refresh Token', playerRefreshConfig);
    res.cookie('student_refresh_token', refreshToken, playerRefreshConfig);

    // Keep existing session for compatibility but will be phased out
    const playerSessionConfig = createAccessTokenConfig();
    playerSessionConfig.maxAge = 24 * 60 * 60 * 1000; // 24 hours for legacy compatibility
    res.cookie('student_session', result.sessionId, playerSessionConfig);

    // Return success and player data (without sensitive info)
    res.status(200).json({
      success: true,
      player: {
        id: result.player.id,
        display_name: result.player.display_name,
        teacher: result.player.teacher,
        achievements: result.player.achievements,
        preferences: result.player.preferences,
        is_online: result.player.is_online
        // Note: privacy_code is not returned for security
      }
    });

    clog(`🎮 Player logged in with dual tokens: ${result.player.display_name} (${privacy_code})`);
  } catch (error) {
    cerror('Player login error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

// Player refresh token endpoint
router.post('/refresh', studentsAccessMiddleware, async (req, res) => {
  try {
    const refreshToken = req.cookies.student_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Player refresh token required' });
    }

    // Verify player refresh token (using custom player token format)
    const jwt = await import('jsonwebtoken');
    let payload;
    try {
      payload = jwt.default.verify(refreshToken, process.env.JWT_SECRET);
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Verify this is a player token
    if (payload.type !== 'player') {
      return res.status(401).json({ error: 'Invalid player token type' });
    }

    // Get player data to ensure player still exists and is active
    const player = await playerService.getPlayer(payload.id, true);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Generate new access token
    const playerTokenData = {
      id: player.id,
      privacy_code: player.privacy_code,
      display_name: player.display_name,
      type: 'player'
    };
    const newAccessToken = authService.createAccessToken(playerTokenData);

    // Set new player access token as httpOnly cookie (15 minutes)
    const playerAccessConfig = createAccessTokenConfig();
    logCookieConfig('Player Refresh - Access Token', playerAccessConfig);
    res.cookie('student_access_token', newAccessToken, playerAccessConfig);

    // Return success and player data
    res.json({
      success: true,
      player: {
        id: player.id,
        display_name: player.display_name,
        teacher: player.teacher,
        achievements: player.achievements,
        preferences: player.preferences,
        is_online: player.is_online
      }
    });

    clog(`🔄 Player token refreshed: ${player.display_name} (${player.privacy_code})`);
  } catch (error) {
    cerror('Player token refresh error:', error);
    res.status(401).json({ error: error.message || 'Token refresh failed' });
  }
});

// Player logout
router.post('/logout', studentsAccessMiddleware, authenticateUserOrPlayer, async (req, res) => {
  try {
    let playerId = null;

    // Use unified authentication middleware to get player ID
    if (req.entityType === 'player' && req.player) {
      playerId = req.player.id;
    } else if (req.entityType === 'user' && req.user) {
      // Allow admin users to logout (clears their cookies)
      clog('[Logout] Admin user logging out from student portal');
    }

    // For player tokens, we don't need to revoke from database
    // since they're self-contained JWT tokens (not stored in refresh_token table)
    // The act of clearing the cookies is sufficient for player logout

    // Logout player and invalidate sessions
    if (playerId) {
      await playerService.logoutPlayer(playerId);
      clog(`🚪 Player logged out: ${playerId}`);
    }

    // Clear all player cookies
    const clearConfig = createClearCookieConfig();
    logCookieConfig('Player Logout - Clear Cookies', clearConfig);
    res.clearCookie('student_access_token', clearConfig);
    res.clearCookie('student_refresh_token', clearConfig);
    res.clearCookie('student_session', clearConfig); // Legacy cookie (for cleanup)

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    cerror('Player logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current player info (unified with /auth/me - supports both users and players)
router.get('/me', studentsAccessMiddleware, authenticateUserOrPlayer, async (req, res) => {
  try {
    // TODO remove debug - fix player authentication persistence
    clog('[DEBUG] /players/me called - checking auth state:', {
      hasEntityType: !!req.entityType,
      entityType: req.entityType,
      hasUser: !!req.user,
      hasPlayer: !!req.player,
      cookies: Object.keys(req.cookies || {}),
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });

    // Check if authenticated as user or player using unified middleware
    if (req.entityType === 'user' && req.user) {
      // TODO remove debug - fix player authentication persistence
      clog('[DEBUG] /players/me - returning USER data:', {
        userId: req.user.id,
        email: req.user.email
      });

      // Return user data (teachers can access student portal)
      return res.json({
        entityType: 'user',
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name,
        role: req.user.role,
        user_type: req.user.user_type,
        is_verified: req.user.is_verified,
        is_active: req.user.is_active
      });
    } else if (req.entityType === 'player' && req.player) {
      // TODO remove debug - fix player authentication persistence
      clog('[DEBUG] /players/me - returning PLAYER data:', {
        playerId: req.player.id,
        displayName: req.player.display_name
      });

      // Return player data (excluding privacy_code for security)
      return res.json({
        entityType: 'player',
        id: req.player.id,
        display_name: req.player.display_name,
        teacher: req.player.teacher,
        achievements: req.player.achievements,
        preferences: req.player.preferences,
        is_online: req.player.is_online,
        last_seen: req.player.last_seen,
        sessionType: req.player.sessionType
      });
    } else {
      // TODO remove debug - fix player authentication persistence
      cerror('[DEBUG] /players/me - NO VALID AUTH:', {
        entityType: req.entityType,
        hasUser: !!req.user,
        hasPlayer: !!req.player
      });

      throw new Error('No valid authentication found');
    }
  } catch (error) {
    cerror('Get player/user info error:', error);
    res.status(500).json({ error: 'Failed to fetch authentication information' });
  }
});

// Create anonymous player (no teacher required)
router.post('/create-anonymous', studentsAccessMiddleware, rateLimiters.auth, validateBody(schemas.createAnonymousPlayer), async (req, res) => {
  try {
    const { display_name, metadata = {} } = req.body;

    // Collect session metadata
    const sessionMetadata = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      timestamp: new Date(),
      creation_context: 'anonymous_student_registration'
    };

    // Create anonymous player using PlayerService
    const player = await playerService.createAnonymousPlayer({
      displayName: display_name,
      metadata: {
        ...metadata,
        session: sessionMetadata
      }
    });

    res.status(201).json({
      success: true,
      player: {
        id: player.id,
        privacy_code: player.privacy_code, // Include privacy code for anonymous player
        display_name: player.display_name,
        teacher_id: player.teacher_id, // Will be null
        is_online: player.is_online,
        created_at: player.created_at
      }
    });

    clog(`🎮 Anonymous player created: ${player.display_name} (${player.privacy_code})`);
  } catch (error) {
    cerror('Create anonymous player error:', error);
    res.status(400).json({ error: error.message || 'Failed to create anonymous player' });
  }
});

// Update current player profile
router.put('/update-profile', studentsAccessMiddleware, authenticateUserOrPlayer, validateBody(schemas.updatePlayer), async (req, res) => {
  try {
    // Check if authenticated as player (unified middleware handles this)
    if (req.entityType !== 'player' || !req.player) {
      return res.status(401).json({ error: 'Player authentication required' });
    }

    // Update player using PlayerService
    const updatedPlayer = await playerService.updatePlayer(req.player.id, req.body);

    // Return updated player data (excluding privacy_code)
    res.json({
      id: updatedPlayer.id,
      display_name: updatedPlayer.display_name,
      achievements: updatedPlayer.achievements,
      preferences: updatedPlayer.preferences,
      is_online: updatedPlayer.is_online,
      last_seen: updatedPlayer.last_seen,
      updated_at: updatedPlayer.updated_at
    });

    clog(`👤 Player profile updated: ${updatedPlayer.id} (${updatedPlayer.display_name})`);
  } catch (error) {
    cerror('Player profile update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update player profile' });
  }
});

// Assign teacher to current player (for anonymous players entering teacher catalogs)
router.post('/assign-teacher', studentsAccessMiddleware, authenticateUserOrPlayer, validateBody(schemas.assignTeacher), async (req, res) => {
  try {
    const { teacher_id } = req.body;

    // Check if authenticated as player (unified middleware handles this)
    if (req.entityType !== 'player' || !req.player) {
      return res.status(401).json({ error: 'Player authentication required' });
    }

    // Assign teacher to player using PlayerService
    const result = await playerService.assignTeacherToPlayer(req.player.id, teacher_id);

    res.json({
      success: result.success,
      message: result.message,
      teacher: result.teacher
    });

    clog(`👥 Teacher ${teacher_id} assigned to player: ${req.player.id}`);
  } catch (error) {
    cerror('Assign teacher error:', error);
    res.status(400).json({ error: error.message || 'Failed to assign teacher' });
  }
});

// =============================================
// TEACHER PLAYER MANAGEMENT ROUTES
// =============================================

// Create a new player (teacher only)
router.post('/create', authenticateToken, requireTeacher, validateBody(schemas.createPlayer), async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { display_name, metadata = {} } = req.body;

    // Create player using PlayerService
    const player = await playerService.createPlayer({
      displayName: display_name,
      teacherId: teacherId,
      metadata: {
        ...metadata,
        created_by: teacherId,
        creation_context: 'teacher_dashboard'
      }
    });

    res.status(201).json({
      success: true,
      player: {
        id: player.id,
        privacy_code: player.privacy_code, // Include privacy code for teacher
        display_name: player.display_name,
        teacher_id: player.teacher_id,
        is_online: player.is_online,
        created_at: player.created_at
      }
    });

    clog(`👤 Teacher ${teacherId} created player: ${player.display_name} (${player.privacy_code})`);
  } catch (error) {
    cerror('Create player error:', error);
    res.status(400).json({ error: error.message || 'Failed to create player' });
  }
});

// Get all players for current teacher
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const {
      online_only = false,
      limit = 50,
      offset = 0
    } = req.query;

    const players = await playerService.getTeacherPlayers(teacherId, {
      onlineOnly: online_only === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      players,
      count: players.length,
      teacher_id: teacherId
    });
  } catch (error) {
    cerror('Get teacher players error:', error);
    res.status(500).json({ error: 'Failed to retrieve players' });
  }
});

// Get specific player by ID (teacher only)
router.get('/:playerId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    const player = await playerService.getPlayer(playerId, true);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Verify teacher ownership
    if (player.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Access denied: You do not own this player' });
    }

    // Include privacy code for teacher
    res.json({
      id: player.id,
      privacy_code: player.privacy_code,
      display_name: player.display_name,
      teacher_id: player.teacher_id,
      teacher: player.teacher,
      achievements: player.achievements,
      preferences: player.preferences,
      is_online: player.is_online,
      last_seen: player.last_seen,
      created_at: player.created_at,
      updated_at: player.updated_at
    });
  } catch (error) {
    cerror('Get player error:', error);
    res.status(500).json({ error: 'Failed to retrieve player' });
  }
});

// Update player (teacher only)
router.put('/:playerId', authenticateToken, requireTeacher, validateBody(schemas.updatePlayer), async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    const updatedPlayer = await playerService.updatePlayer(playerId, req.body, teacherId);

    // Include privacy code for teacher
    res.json({
      id: updatedPlayer.id,
      privacy_code: updatedPlayer.privacy_code,
      display_name: updatedPlayer.display_name,
      teacher_id: updatedPlayer.teacher_id,
      achievements: updatedPlayer.achievements,
      preferences: updatedPlayer.preferences,
      is_online: updatedPlayer.is_online,
      last_seen: updatedPlayer.last_seen,
      updated_at: updatedPlayer.updated_at
    });

    clog(`👤 Teacher ${teacherId} updated player: ${playerId}`);
  } catch (error) {
    cerror('Update player error:', error);
    res.status(400).json({ error: error.message || 'Failed to update player' });
  }
});

// Regenerate privacy code for player (teacher only)
router.post('/:playerId/regenerate-code', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    const result = await playerService.regeneratePrivacyCode(playerId, teacherId);

    res.json({
      success: true,
      player_id: result.player_id,
      new_privacy_code: result.privacy_code
    });

    clog(`🔄 Teacher ${teacherId} regenerated privacy code for player: ${playerId}`);
  } catch (error) {
    cerror('Regenerate privacy code error:', error);
    res.status(400).json({ error: error.message || 'Failed to regenerate privacy code' });
  }
});

// Deactivate player (teacher only)
router.delete('/:playerId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    const result = await playerService.deactivatePlayer(playerId, teacherId);

    res.json(result);
    clog(`👤 Teacher ${teacherId} deactivated player: ${playerId}`);
  } catch (error) {
    cerror('Deactivate player error:', error);
    res.status(400).json({ error: error.message || 'Failed to deactivate player' });
  }
});

// Get online players for teacher
router.get('/online/list', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;

    const onlinePlayers = await playerService.getOnlinePlayersForTeacher(teacherId);

    res.json({
      online_players: onlinePlayers,
      count: onlinePlayers.length,
      teacher_id: teacherId,
      timestamp: new Date()
    });
  } catch (error) {
    cerror('Get online players error:', error);
    res.status(500).json({ error: 'Failed to retrieve online players' });
  }
});

// Get player statistics for teacher
router.get('/stats/overview', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await playerService.getPlayerStats(teacherId);

    res.json({
      message: 'Player statistics retrieved successfully',
      teacher_id: teacherId,
      stats
    });
  } catch (error) {
    cerror('Get player stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve player statistics' });
  }
});

// =============================================
// PLAYER SESSION MANAGEMENT (TEACHER ADMIN)
// =============================================

// Get player sessions (teacher only)
router.get('/:playerId/sessions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    // Verify player ownership
    const player = await playerService.getPlayer(playerId, false);
    if (!player || player.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Access denied: You do not own this player' });
    }

    const sessions = await playerService.getPlayerSessions(playerId);

    res.json({
      message: `Sessions for player ${playerId} retrieved successfully`,
      player_id: playerId,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    cerror('Get player sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve player sessions' });
  }
});

// Invalidate player sessions (teacher only)
router.post('/:playerId/logout', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { playerId } = req.params;

    // Verify player ownership
    const player = await playerService.getPlayer(playerId, false);
    if (!player || player.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Access denied: You do not own this player' });
    }

    const result = await playerService.logoutPlayer(playerId);

    res.json({
      success: true,
      message: `Player ${playerId} logged out successfully`,
      player_id: playerId
    });

    clog(`👤 Teacher ${teacherId} logged out player: ${playerId}`);
  } catch (error) {
    cerror('Logout player error:', error);
    res.status(500).json({ error: 'Failed to logout player' });
  }
});

export default router;