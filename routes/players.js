import express from 'express';
import { authenticateToken, requireTeacher } from '../middleware/auth.js';
import { validateBody, rateLimiters, studentsAccessMiddleware } from '../middleware/validation.js';
import AuthService from '../services/AuthService.js';
import PlayerService from '../services/PlayerService.js';
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
    privacy_code: Joi.string().length(8).uppercase().pattern(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/).required()
      .messages({
        'string.length': 'Privacy code must be exactly 8 characters',
        'string.pattern.base': 'Invalid privacy code format',
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
  updatePlayer: Joi.object({
    display_name: Joi.string().min(1).max(100).trim().optional(),
    preferences: Joi.object().optional(),
    achievements: Joi.array().optional()
  }).min(1)
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

    // Note: Players use sessions but not JWT tokens like users
    // The session ID will be used for authentication via cookies

    // Set session ID as httpOnly cookie for player authentication
    // Using a different cookie name to distinguish from user sessions
    const playerSessionConfig = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: process.env.NODE_ENV === 'production' ? '.ludora.app' : undefined
    };

    logCookieConfig('Player Login - Session', playerSessionConfig);
    res.cookie('player_session', result.sessionId, playerSessionConfig);

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

    clog(`🎮 Player logged in: ${result.player.display_name} (${privacy_code})`);
  } catch (error) {
    cerror('Player login error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

// Player logout
router.post('/logout', studentsAccessMiddleware, async (req, res) => {
  try {
    const playerSession = req.cookies.player_session;

    if (playerSession) {
      // Validate session to get player ID
      const sessionData = await playerService.validateSession(playerSession);
      if (sessionData) {
        // Logout player using PlayerService
        await playerService.logoutPlayer(sessionData.playerId, playerSession);
        clog(`🚪 Player logged out from session ${playerSession}`);
      }
    }

    // Clear player session cookie
    const clearConfig = createClearCookieConfig();
    logCookieConfig('Player Logout - Clear Cookie', clearConfig);
    res.clearCookie('player_session', clearConfig);

    res.json({ success: true, message: 'Player logged out successfully' });
  } catch (error) {
    cerror('Player logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current player info (equivalent to /auth/me for users)
router.get('/me', studentsAccessMiddleware, async (req, res) => {
  try {
    const playerSession = req.cookies.player_session;

    if (!playerSession) {
      return res.status(401).json({ error: 'Player session required' });
    }

    // Validate session and get player data
    const sessionData = await playerService.validateSession(playerSession);

    if (!sessionData) {
      // Clear invalid session cookie
      const clearConfig = createClearCookieConfig();
      res.clearCookie('player_session', clearConfig);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get full player data
    const player = await playerService.getPlayer(sessionData.playerId, true);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Return player data (excluding privacy_code for security)
    res.json({
      id: player.id,
      display_name: player.display_name,
      teacher: player.teacher,
      achievements: player.achievements,
      preferences: player.preferences,
      is_online: player.is_online,
      last_seen: player.last_seen,
      created_at: player.created_at
    });
  } catch (error) {
    cerror('Get player info error:', error);
    res.status(500).json({ error: 'Failed to fetch player information' });
  }
});

// Update current player profile
router.put('/update-profile', studentsAccessMiddleware, validateBody(schemas.updatePlayer), async (req, res) => {
  try {
    const playerSession = req.cookies.player_session;

    if (!playerSession) {
      return res.status(401).json({ error: 'Player session required' });
    }

    // Validate session
    const sessionData = await playerService.validateSession(playerSession);

    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Update player using PlayerService
    const updatedPlayer = await playerService.updatePlayer(sessionData.playerId, req.body);

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