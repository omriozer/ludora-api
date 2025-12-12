import express from 'express';
import { authenticateToken, requireTeacher } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import PlayerService from '../services/PlayerService.js';
import models from '../models/index.js';
import Joi from 'joi';
import { luderror, ludlog } from '../lib/ludlog.js';

const router = express.Router();
const playerService = new PlayerService();

// Validation schemas for teacher player management routes
const schemas = {
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
  }).min(1),
};

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

  } catch (error) {
    luderror.api('Create player error:', error);
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
    luderror.api('Get teacher players error:', error);
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
    luderror.api('Get player error:', error);
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

  } catch (error) {
    luderror.api('Update player error:', error);
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

  } catch (error) {
    luderror.api('Regenerate privacy code error:', error);
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

  } catch (error) {
    luderror.api('Deactivate player error:', error);
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
    luderror.api('Get online players error:', error);
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
    luderror.api('Get player stats error:', error);
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
    luderror.auth('Get player sessions error:', error);
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

  } catch (error) {
    luderror.auth('Logout player error:', error);
    res.status(500).json({ error: 'Failed to logout player' });
  }
});

export default router;