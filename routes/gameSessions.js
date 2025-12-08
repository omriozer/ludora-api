// routes/gameSessions.js
// API routes for GameSession management

import express from 'express';
import rateLimit from 'express-rate-limit';
import models from '../models/index.js';
import GameSessionService from '../services/GameSessionService.js';
import {
  validateAddParticipant,
  validateRemoveParticipant,
  validateUpdateGameState,
  validateFinishSession,
  validateUpdateSession,
  validateSessionId,
  validateSessionListQuery
} from '../middleware/gameSessionValidation.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkStudentsLobbyAccess } from '../middleware/studentsAccessMiddleware.js';
import { luderror } from '../lib/ludlog.js';
import { requireStudentConsent } from '../middleware/consentEnforcement.js';

const router = express.Router();

// Rate limiting for session operations
const sessionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // 200 requests per window (higher for real-time updates)
  message: { error: 'Too many session requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Higher rate limit for game state updates (real-time gameplay)
const gameStateRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 updates per minute
  message: { error: 'Too many game state updates, please slow down' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Helper function to validate session access permissions
 */
async function validateSessionAccess(sessionId, userId, userRole, transaction = null) {
  const session = await models.GameSession.findByPk(sessionId, {
    include: [{ model: models.GameLobby, as: 'lobby' }],
    transaction
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const { lobby } = session;

  // Admin bypass
  if (userRole === 'admin' || userRole === 'sysadmin') {
    return { session, lobby, hasAccess: true };
  }

  // Check if user is lobby owner, host, or participant
  const isOwnerOrHost =
    lobby.owner_user_id === userId ||
    lobby.host_user_id === userId;

  const isParticipant = session.participants?.some(p => p.user_id === userId);

  const hasAccess = isOwnerOrHost || isParticipant;

  return { session, lobby, hasAccess };
}

// =============================================
// SESSION INFORMATION ROUTES
// =============================================

/**
 * GET /api/game-sessions/:sessionId
 * Get detailed session information (student-facing with access control)
 */
router.get('/game-sessions/:sessionId',
  checkStudentsLobbyAccess,
  requireStudentConsent,
  validateSessionId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { user } = req;

      // Validate access and get session
      const { hasAccess } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: You do not have permission to view this session'
        });
      }

      // Get detailed session information
      const sessionDetails = await GameSessionService.getSessionDetails(
        sessionId,
        transaction
      );

      await transaction.commit();
      res.status(200).json(sessionDetails);

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to get session details:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(500).json({
        error: 'Failed to fetch session details',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-sessions/:sessionId
 * Update session settings
 */
router.put('/game-sessions/:sessionId',
  authenticateToken,
  validateUpdateSession,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { session_settings } = req.validatedData;
      const { user } = req;

      // Validate access
      const { session, lobby, hasAccess } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      // Only owner or host can update session settings
      const canUpdate =
        lobby.owner_user_id === user.id ||
        lobby.host_user_id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin';

      if (!canUpdate) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: Only lobby owner or host can update session settings'
        });
      }

      // Update session settings in the data field
      const updatedData = {
        ...session.data,
        session_settings: {
          ...session.data?.session_settings,
          ...session_settings
        },
        last_updated: new Date().toISOString(),
        updated_by: user.id
      };

      await session.update({ data: updatedData }, { transaction });

      // Get updated session details
      const updatedSession = await GameSessionService.getSessionDetails(
        sessionId,
        transaction
      );

      await transaction.commit();
      res.status(200).json(updatedSession);

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to update session:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(500).json({
        error: 'Failed to update session',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/game-sessions/:sessionId
 * Close a session
 */
router.delete('/game-sessions/:sessionId',
  authenticateToken,
  validateSessionId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { user } = req;

      // Close the session
      const finishedSession = await GameSessionService.finishSession(
        sessionId,
        { reason: 'closed_by_user' },
        user.id,
        transaction
      );

      await transaction.commit();

      res.status(200).json({
        message: 'Session closed successfully',
        session: finishedSession
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to close session:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to close session',
        message: error.message
      });
    }
  }
);

// =============================================
// PARTICIPANT MANAGEMENT ROUTES
// =============================================

/**
 * GET /api/game-sessions/:sessionId/participants
 * List participants in a session
 */
router.get('/game-sessions/:sessionId/participants',
  authenticateToken,
  validateSessionId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { user } = req;

      // Validate access
      const { session, hasAccess } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: You do not have permission to view participants'
        });
      }

      await transaction.commit();

      res.status(200).json({
        session_id: sessionId,
        participants: session.participants || [],
        participants_count: session.participants?.length || 0
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to get participants:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(500).json({
        error: 'Failed to fetch participants',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/game-sessions/:sessionId/participants
 * Add a participant to a session (student-facing with access control)
 */
router.post('/game-sessions/:sessionId/participants',
  sessionRateLimit,
  checkStudentsLobbyAccess, // Student access control for joining sessions
  requireStudentConsent,
  validateAddParticipant,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const participantData = req.validatedData;
      const { user } = req; // May be null for guest users

      const userId = user?.id || 'guest';

      // For guest users, ensure they provide a guest_token
      if (!user && !participantData.guest_token) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Guest users must provide a guest_token'
        });
      }

      // For authenticated users, ensure user_id matches the token
      if (user && participantData.user_id && participantData.user_id !== user.id) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'User ID mismatch'
        });
      }

      // Add participant using service
      const updatedSession = await GameSessionService.addParticipant(
        sessionId,
        participantData,
        userId,
        transaction
      );

      await transaction.commit();
      res.status(200).json(updatedSession);

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to add participant:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Session is full')) {
        return res.status(400).json({ error: 'Session is full' });
      }
      if (error.message.includes('already in session')) {
        return res.status(409).json({ error: 'User already in session' });
      }
      if (error.message.includes('Guest users are not allowed')) {
        return res.status(403).json({ error: 'Guest users are not allowed in this session' });
      }

      res.status(500).json({
        error: 'Failed to add participant',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/game-sessions/:sessionId/participants/:participantId
 * Remove a participant from a session (student-facing with access control)
 */
router.delete('/game-sessions/:sessionId/participants/:participantId',
  checkStudentsLobbyAccess,
  requireStudentConsent,
  validateRemoveParticipant,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId, participantId } = req.validatedParams;
      const { user } = req;

      // Remove participant using service
      const updatedSession = await GameSessionService.removeParticipant(
        sessionId,
        participantId,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(200).json(updatedSession);

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to remove participant:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Participant not found')) {
        return res.status(404).json({ error: 'Participant not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to remove participant',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/game-sessions/:sessionId/participants/teacher-add
 * Add a participant to a session (teacher-facing with authentication)
 */
router.post('/game-sessions/:sessionId/participants/teacher-add',
  authenticateToken,
  validateAddParticipant,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const participantData = req.validatedData;
      const { user } = req;

      // Validate access - only lobby owner/host can add participants
      const { session, lobby, hasAccess } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      const canAddParticipants =
        lobby.owner_user_id === user.id ||
        lobby.host_user_id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin';

      if (!canAddParticipants) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: Only lobby owner or host can add participants'
        });
      }

      // Add participant using service
      const updatedSession = await GameSessionService.addParticipant(
        sessionId,
        participantData,
        user.id, // Use teacher's ID as the adding user
        transaction
      );

      await transaction.commit();
      res.status(200).json({
        message: 'Participant added successfully',
        session: updatedSession
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to add participant (teacher):', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Session is full')) {
        return res.status(400).json({ error: 'Session is full' });
      }
      if (error.message.includes('already in session')) {
        return res.status(409).json({ error: 'User already in session' });
      }
      if (error.message.includes('Guest users are not allowed')) {
        return res.status(403).json({ error: 'Guest users are not allowed in this session' });
      }

      res.status(500).json({
        error: 'Failed to add participant',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/game-sessions/:sessionId/participants/:participantId/teacher-remove
 * Remove a participant from a session (teacher-facing with authentication)
 */
router.delete('/game-sessions/:sessionId/participants/:participantId/teacher-remove',
  authenticateToken,
  validateRemoveParticipant,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId, participantId } = req.validatedParams;
      const { user } = req;

      // Validate access - only lobby owner/host can remove participants
      const { session, lobby } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      const canRemoveParticipants =
        lobby.owner_user_id === user.id ||
        lobby.host_user_id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin';

      if (!canRemoveParticipants) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: Only lobby owner or host can remove participants'
        });
      }

      // Remove participant using service
      const updatedSession = await GameSessionService.removeParticipant(
        sessionId,
        participantId,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(200).json({
        message: 'Participant removed successfully',
        session: updatedSession
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to remove participant (teacher):', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Participant not found')) {
        return res.status(404).json({ error: 'Participant not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to remove participant',
        message: error.message
      });
    }
  }
);

// =============================================
// GAME STATE MANAGEMENT ROUTES
// =============================================

/**
 * GET /api/game-sessions/:sessionId/state
 * Get current game state
 */
router.get('/game-sessions/:sessionId/state',
  authenticateToken,
  validateSessionId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { user } = req;

      // Validate access
      const { session, hasAccess } = await validateSessionAccess(
        sessionId,
        user.id,
        user.role,
        transaction
      );

      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: You are not a participant in this session'
        });
      }

      await transaction.commit();

      res.status(200).json({
        session_id: sessionId,
        current_state: session.current_state || {},
        last_updated: session.current_state?.last_updated || session.updated_at,
        status: session.status
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to get game state:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(500).json({
        error: 'Failed to fetch game state',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-sessions/:sessionId/state
 * Update game state (for real-time gameplay)
 */
router.put('/game-sessions/:sessionId/state',
  gameStateRateLimit,
  authenticateToken,
  validateUpdateGameState,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { current_state, auto_save, update_metadata } = req.validatedData;
      const { user } = req;

      // Update game state using service
      const updatedSession = await GameSessionService.updateGameState(
        sessionId,
        { ...current_state, ...update_metadata },
        user.id,
        auto_save,
        transaction
      );

      await transaction.commit();

      res.status(200).json({
        session_id: sessionId,
        current_state: updatedSession.current_state,
        last_updated: updatedSession.current_state?.last_updated,
        message: 'Game state updated successfully'
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to update game state:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('not active')) {
        return res.status(400).json({ error: 'Cannot update state: Session is not active' });
      }
      if (error.message.includes('Not a session participant')) {
        return res.status(403).json({ error: 'Access denied: You are not a participant in this session' });
      }

      res.status(500).json({
        error: 'Failed to update game state',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-sessions/:sessionId/finish
 * Finish/complete a game session
 */
router.put('/game-sessions/:sessionId/finish',
  authenticateToken,
  validateFinishSession,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { final_data, reason, save_results } = req.validatedData;
      const { user } = req;

      // Finish session using service
      const finishedSession = await GameSessionService.finishSession(
        sessionId,
        {
          ...final_data,
          reason,
          save_results,
          finished_by: user.id
        },
        user.id,
        transaction
      );

      await transaction.commit();

      res.status(200).json({
        message: 'Session finished successfully',
        session: finishedSession
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to finish session:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to finish session',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-sessions/:sessionId/start
 * Start a pending session
 */
router.put('/game-sessions/:sessionId/start',
  authenticateToken,
  validateSessionId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { sessionId } = req.validatedParams;
      const { user } = req;

      // Start session using service
      const startedSession = await GameSessionService.startSession(
        sessionId,
        user.id,
        transaction
      );

      await transaction.commit();

      res.status(200).json({
        message: 'Session started successfully',
        session: startedSession
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to start session:', error);

      if (error.message.includes('Session not found')) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (error.message.includes('not pending')) {
        return res.status(400).json({ error: 'Cannot start: Session is not pending' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to start session',
        message: error.message
      });
    }
  }
);

// =============================================
// UTILITY ROUTES
// =============================================

/**
 * GET /api/game-sessions/my-active
 * Get user's active sessions across all lobbies
 */
router.get('/game-sessions/my-active',
  authenticateToken,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { user } = req;

      // Find sessions where user is a participant and session is active
      const activeSessions = await models.GameSession.findAll({
        where: {
          status: 'open',
          participants: {
            [models.Sequelize.Op.contains]: [{ user_id: user.id }]
          }
        },
        include: [
          {
            model: models.GameLobby,
            as: 'lobby',
            include: [
              {
                model: models.Game,
                as: 'game',
                attributes: ['id', 'game_type']
              }
            ]
          }
        ],
        order: [['started_at', 'DESC']],
        transaction
      });

      const formattedSessions = activeSessions.map(session => ({
        id: session.id,
        session_number: session.session_number,
        status: session.status,
        started_at: session.started_at,
        participants_count: session.participants?.length || 0,
        lobby: {
          id: session.lobby.id,
          lobby_code: session.lobby.lobby_code,
          game: session.lobby.game
        }
      }));

      await transaction.commit();

      res.status(200).json({
        data: formattedSessions,
        total: formattedSessions.length
      });

    } catch (error) {
      await transaction.rollback();
      luderror.auth('❌ Failed to get user active sessions:', error);
      res.status(500).json({
        error: 'Failed to fetch active sessions',
        message: error.message
      });
    }
  }
);

export default router;