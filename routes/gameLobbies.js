// routes/gameLobbies.js
// API routes for GameLobby management

import express from 'express';
import rateLimit from 'express-rate-limit';
import models from '../models/index.js';
import GameLobbyService from '../services/GameLobbyService.js';
import GameSessionService from '../services/GameSessionService.js';
import {
  validateCreateLobby,
  validateUpdateLobby,
  validateActivateLobby,
  validateCloseLobby,
  validateSetLobbyExpiration,
  validateJoinByCode,
  validateLobbyId,
  validateGameId,
  validateLobbyListQuery
} from '../middleware/gameLobbyValidation.js';
import {
  validateCreateSession,
  validateLobbyId as validateLobbyIdSession
} from '../middleware/gameSessionValidation.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkStudentsAccess, checkStudentsLobbyAccess } from '../middleware/studentsAccessMiddleware.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

// Rate limiting for lobby operations
const lobbyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many lobby requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Authentication helper for lobby ownership validation
 */
async function validateGameOwnership(gameId, userId, userRole = null) {
  clog(`🔍 Validating game ownership: gameId=${gameId}, userId=${userId}, userRole=${userRole}`);

  // Admin/sysadmin bypass - they can do anything an owner can
  if (userRole === 'admin' || userRole === 'sysadmin') {
    clog(`✅ Admin/sysadmin bypass for game ${gameId}`);
    return true;
  }

  // Find associated product (games are owned via Product table)
  const product = await models.Product.findOne({
    where: { product_type: 'game', entity_id: gameId }
  });

  clog(`📦 Product search result: gameId=${gameId}, found=${!!product}, creator_user_id=${product?.creator_user_id}`);

  // No product OR no creator_user_id = Ludora-owned (allow access)
  if (!product || !product.creator_user_id) {
    clog(`✅ Ludora-owned game (no product or no creator): gameId=${gameId}`);
    return true;
  }

  // Check ownership via Product.creator_user_id
  const isOwner = String(product.creator_user_id) === String(userId);
  clog(`👤 Ownership check: gameId=${gameId}, creator=${product.creator_user_id}, user=${userId}, isOwner=${isOwner}`);
  return isOwner;
}

// =============================================
// LOBBY MANAGEMENT ROUTES
// =============================================

/**
 * GET /api/games/:gameId/lobbies
 * List active lobbies for a specific game (student-facing with access control)
 */
router.get('/games/:gameId/lobbies',
  checkStudentsLobbyAccess,
  validateGameId,
  validateLobbyListQuery,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { gameId } = req.validatedParams;
      const { limit, offset, expired } = req.validatedQuery;
      const user = req.user; // May be null for anonymous users

      if (user) {
        clog(`📋 Listing lobbies for game ${gameId} by authenticated user ${user.id}`);
      } else {
        clog(`📋 Listing lobbies for game ${gameId} by anonymous user`);
      }

      // For authenticated users, validate access. For anonymous users, allow public access.
      if (user) {
        const hasAccess = await validateGameOwnership(gameId, user.id, user.role);
        if (!hasAccess) {
          await transaction.rollback();
          return res.status(403).json({
            error: 'Access denied: You do not own this game'
          });
        }
      } else {
        // For anonymous access, just verify the game exists
        const game = await models.Game.findByPk(gameId, { transaction });
        if (!game) {
          await transaction.rollback();
          return res.status(404).json({ error: 'Game not found' });
        }
      }

      // Get ALL lobbies with computed status (including closed ones)
      const lobbies = await GameLobbyService.getLobbiesByGame(gameId, transaction);

      // Apply expiration filter if specified
      const filteredLobbies = expired !== undefined
        ? lobbies.filter(lobby => {
            const isExpired = GameLobbyService.computeStatus(lobby) === 'closed';
            return expired ? isExpired : !isExpired;
          })
        : lobbies;

      // Apply pagination
      const paginatedLobbies = filteredLobbies.slice(offset, offset + limit);

      // For anonymous users, filter sensitive information
      const responseData = user ? paginatedLobbies : paginatedLobbies.map(lobby => ({
        id: lobby.id,
        lobby_code: lobby.lobby_code,
        game_id: lobby.game_id,
        status: GameLobbyService.computeStatus(lobby),
        created_at: lobby.created_at,
        expires_at: lobby.expires_at,
        settings: {
          // Only expose safe settings for anonymous access
          allow_guest_users: lobby.settings?.allow_guest_users,
          max_players_per_session: lobby.settings?.max_players_per_session,
          invitation_type: lobby.settings?.invitation_type
        }
      }));

      await transaction.commit();

      res.status(200).json({
        data: responseData,
        pagination: {
          total: filteredLobbies.length,
          limit: limit,
          offset: offset,
          has_more: offset + limit < filteredLobbies.length
        }
      });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to list lobbies:', error);
      res.status(500).json({
        error: 'Failed to fetch lobbies',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/games/:gameId/lobbies
 * Create a new lobby for a game
 */
router.post('/games/:gameId/lobbies',
  authenticateToken,
  lobbyRateLimit,
  validateCreateLobby,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { gameId } = req.validatedParams;
      const lobbyData = req.validatedData;
      const user = req.user;

      clog(`🏠 Creating lobby for game ${gameId} by user ${user.id}`);
      clog(`👤 User object:`, {
        id: user.id,
        role: user.role,
        userId_type: typeof user.id,
        full_user: user
      });

      // Validate user can create lobbies for this game
      const hasAccess = await validateGameOwnership(gameId, user.id, user.role);
      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: You do not own this game'
        });
      }

      // Create the lobby
      const lobby = await GameLobbyService.createLobby(
        gameId,
        lobbyData,
        user.id,
        transaction
      );

      await transaction.commit();

      res.status(201).json(lobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to create lobby:', error);

      // Handle specific error cases
      if (error.message.includes('Game not found')) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes('unique lobby code')) {
        return res.status(500).json({
          error: 'Unable to generate unique lobby code, please try again'
        });
      }

      res.status(500).json({
        error: 'Failed to create lobby',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/game-lobbies/:lobbyId
 * Get detailed lobby information
 */
router.get('/game-lobbies/:lobbyId',
  authenticateToken,
  validateLobbyId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const user = req.user;

      clog(`🔍 Getting lobby details for ${lobbyId} by user ${user.id}`);

      // Get lobby details
      const lobby = await GameLobbyService.getLobbyDetails(lobbyId, transaction);

      // Check access permissions
      const hasAccess =
        lobby.owner.id === user.id ||
        lobby.host.id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin' ||
        await validateGameOwnership(lobby.game_id, user.id, user.role);

      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: You do not have permission to view this lobby'
        });
      }

      await transaction.commit();
      res.status(200).json(lobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to get lobby details:', error);

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      res.status(500).json({
        error: 'Failed to fetch lobby details',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-lobbies/:lobbyId
 * Update lobby settings
 */
router.put('/game-lobbies/:lobbyId',
  authenticateToken,
  validateUpdateLobby,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const updateData = req.validatedData;
      const user = req.user;

      clog(`✏️ Updating lobby ${lobbyId} by user ${user.id}`);

      // Get current lobby to check permissions
      const currentLobby = await models.GameLobby.findByPk(lobbyId, { transaction });
      if (!currentLobby) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Check permissions
      const canUpdate =
        currentLobby.owner_user_id === user.id ||
        currentLobby.host_user_id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin';

      if (!canUpdate) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: Only lobby owner or host can update settings'
        });
      }

      // Update lobby settings
      if (updateData.settings) {
        const newSettings = { ...currentLobby.settings, ...updateData.settings };
        await currentLobby.update({ settings: newSettings }, { transaction });
      }

      // Get updated lobby details
      const updatedLobby = await GameLobbyService.getLobbyDetails(lobbyId, transaction);

      await transaction.commit();
      res.status(200).json(updatedLobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to update lobby:', error);
      res.status(500).json({
        error: 'Failed to update lobby',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-lobbies/:lobbyId/activate
 * Activate lobby with enhanced settings (expiration, max players, session management)
 */
router.put('/game-lobbies/:lobbyId/activate',
  authenticateToken,
  validateActivateLobby,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const activationData = req.validatedData;
      const user = req.user;

      clog(`🔄 [ROUTE] Activating lobby ${lobbyId} with enhanced settings by user ${user.id}`);
      clog(`🔧 [ROUTE] Activation data:`, activationData);
      clog(`👤 [ROUTE] User context:`, {
        uid: user.id,
        role: user.role,
        uidType: typeof user.id,
        fullUser: user
      });
      clog(`📋 [ROUTE] Validated params:`, req.validatedParams);
      clog(`📋 [ROUTE] Validated data:`, req.validatedData);

      // Activate the lobby with enhanced configuration
      const updatedLobby = await GameLobbyService.activateLobby(
        lobbyId,
        activationData,
        user.id,
        transaction
      );

      await transaction.commit();
      clog(`✅ [ROUTE] Lobby activation successful for ${lobbyId}`);
      res.status(200).json(updatedLobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ [ROUTE] Failed to activate lobby in route handler:', {
        lobbyId: req.validatedParams?.lobbyId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes('exceeds limit')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to activate lobby',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-lobbies/:lobbyId/close
 * Close lobby manually
 */
router.put('/game-lobbies/:lobbyId/close',
  authenticateToken,
  validateCloseLobby,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const user = req.user;

      clog(`🔄 Closing lobby ${lobbyId} by user ${user.id}`);

      // Close the lobby
      const updatedLobby = await GameLobbyService.closeLobby(
        lobbyId,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(200).json(updatedLobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to close lobby:', error);

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to close lobby',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/game-lobbies/:lobbyId/expiration
 * Set or update lobby expiration time
 */
router.put('/game-lobbies/:lobbyId/expiration',
  authenticateToken,
  validateSetLobbyExpiration,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const { expires_at } = req.validatedData; // Date, 'indefinite', or null
      const user = req.user;

      clog(`🔄 Setting lobby ${lobbyId} expiration to ${expires_at} by user ${user.id}`);

      // Set lobby expiration
      const updatedLobby = await GameLobbyService.setLobbyExpiration(
        lobbyId,
        expires_at,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(200).json(updatedLobby);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to set lobby expiration:', error);

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to set lobby expiration',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/game-lobbies/:lobbyId
 * Close/delete a lobby
 */
router.delete('/game-lobbies/:lobbyId',
  authenticateToken,
  validateLobbyId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const user = req.user;

      clog(`🗑️ Closing lobby ${lobbyId} by user ${user.id}`);

      // Close the lobby
      const closedLobby = await GameLobbyService.closeLobby(
        lobbyId,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(200).json({
        message: 'Lobby closed successfully',
        lobby: closedLobby
      });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to close lobby:', error);

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to close lobby',
        message: error.message
      });
    }
  }
);


// =============================================
// LOBBY JOINING & DISCOVERY ROUTES
// =============================================

/**
 * POST /api/game-lobbies/join-by-code
 * Join a lobby using lobby code (student-facing with access control)
 */
router.post('/game-lobbies/join-by-code',
  checkStudentsAccess, // Student access control with rate limiting
  validateJoinByCode,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobby_code, participant } = req.validatedData;

      clog(`🚪 Attempting to join lobby ${lobby_code} as ${participant.display_name}`);

      // Find lobby by code
      const lobby = await GameLobbyService.findLobbyByCode(lobby_code, transaction);
      if (!lobby) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Lobby not found or not available for joining'
        });
      }

      // Check if lobby allows the type of user trying to join
      if (!participant.user_id && !lobby.settings.allow_guest_users) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Guest users are not allowed in this lobby'
        });
      }

      // Get detailed lobby info including sessions for manual_selection
      let lobbyResponse;
      if (lobby.settings.invitation_type === 'manual_selection') {
        // For manual selection, include session data so students can choose
        lobbyResponse = await GameLobbyService.getLobbyDetails(lobby.id, transaction);
      } else {
        // For other types, return basic info
        lobbyResponse = {
          id: lobby.id,
          lobby_code: lobby.lobby_code,
          game: lobby.game,
          status: GameLobbyService.computeStatus(lobby),
          settings: lobby.settings,
          can_join: true
        };
      }

      await transaction.commit();

      res.status(200).json({
        message: 'Lobby found and available for joining',
        lobby: lobbyResponse
      });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to join lobby by code:', error);

      if (error.message.includes('not open for joining')) {
        return res.status(403).json({ error: 'Lobby is not open for joining' });
      }
      if (error.message.includes('expired')) {
        return res.status(403).json({ error: 'Lobby has expired' });
      }

      res.status(500).json({
        error: 'Failed to join lobby',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/game-lobbies/:lobbyId/join
 * Join a lobby with on-demand session creation based on invitation_type (student-facing with access control)
 */
router.post('/game-lobbies/:lobbyId/join',
  checkStudentsAccess, // Student access control with rate limiting
  validateJoinByCode, // Reuse validation for participant data
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.params;
      const { participant, session_id } = req.validatedData; // session_id optional for manual_selection

      clog(`🚪 Joining lobby ${lobbyId} as ${participant.display_name} with invitation logic`);

      // Get lobby details with current sessions
      const lobby = await GameLobbyService.getLobbyDetails(lobbyId, transaction);
      if (!lobby) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Check if lobby is joinable
      if (!lobby.canJoin || !lobby.canJoin()) {
        const status = GameLobbyService.computeStatus(lobby);
        await transaction.rollback();
        return res.status(403).json({
          error: `Lobby is not open for joining (status: ${status})`
        });
      }

      // Check guest user restrictions
      if (!participant.user_id && !lobby.settings.allow_guest_users) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Guest users are not allowed in this lobby'
        });
      }

      const invitationType = lobby.settings.invitation_type || 'manual_selection';
      clog(`📍 Processing join request with invitation_type: ${invitationType}`);

      let joinedSession;

      // Handle different invitation types
      switch (invitationType) {
        case 'manual_selection':
          if (!session_id) {
            await transaction.rollback();
            return res.status(400).json({
              error: 'Session ID required for manual selection invitation type'
            });
          }
          // Find the specified session
          const targetSession = lobby.active_sessions?.find(s => s.id === session_id);
          if (!targetSession) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Specified session not found' });
          }

          // Add participant to the specified session
          const updatedManualSession = await GameSessionService.addParticipant(
            session_id,
            participant,
            participant.user_id || 'anonymous', // Use user_id or 'anonymous' for guest
            transaction
          );

          joinedSession = {
            id: updatedManualSession.id,
            session_number: updatedManualSession.session_number,
            participants_count: updatedManualSession.participants.length
          };
          clog(`📋 Added participant to manually selected session ${targetSession.session_number}`);
          break;

        case 'order':
          // Find first session with available space (sequential assignment)
          const availableSessionsOrder = lobby.active_sessions?.filter(session => {
            const maxPlayers = session.data?.max_players || 4; // Default from game config
            return session.participants_count < maxPlayers;
          }).sort((a, b) => a.session_number - b.session_number) || [];

          if (availableSessionsOrder.length > 0) {
            // Take the first (lowest numbered) available session and add participant
            const firstSession = availableSessionsOrder[0];
            const updatedSession = await GameSessionService.addParticipant(
              firstSession.id,
              participant,
              participant.user_id || 'anonymous', // Use user_id or 'anonymous' for guest
              transaction
            );
            joinedSession = {
              id: updatedSession.id,
              session_number: updatedSession.session_number,
              participants_count: updatedSession.participants.length
            };
            clog(`📋 Added participant to existing session ${firstSession.session_number} in order`);
          } else {
            // Create new session for sequential assignment
            const newSession = await createSessionForJoining(lobbyId, lobby, transaction);

            // Add participant to the newly created session
            const updatedSession = await GameSessionService.addParticipant(
              newSession.id,
              participant,
              participant.user_id || 'anonymous', // Use user_id or 'anonymous' for guest
              transaction
            );

            joinedSession = {
              id: updatedSession.id,
              session_number: updatedSession.session_number,
              participants_count: updatedSession.participants.length,
              created: true
            };
            clog(`📋 Created new session ${newSession.session_number} and added participant in order`);
          }
          break;

        default:
          await transaction.rollback();
          return res.status(400).json({
            error: `Unsupported invitation type: ${invitationType}`
          });
      }

      await transaction.commit();

      // Get the actual participant data from the session (includes generated participant.id)
      const sessionDetails = await GameSessionService.getSessionDetails(joinedSession.id);
      const addedParticipant = sessionDetails.participants.find(p =>
        (participant.user_id && p.user_id === participant.user_id) ||
        (participant.guest_token && p.guest_token === participant.guest_token) ||
        (!participant.user_id && !participant.guest_token && p.display_name === participant.display_name)
      );

      res.status(200).json({
        message: 'Successfully joined lobby',
        lobby: {
          id: lobby.id,
          lobby_code: lobby.lobby_code,
          invitation_type: invitationType,
          game: lobby.game
        },
        session: {
          id: joinedSession.id,
          session_number: joinedSession.session_number,
          participants_count: joinedSession.participants_count
        },
        participant: {
          id: addedParticipant?.id,
          display_name: addedParticipant?.display_name,
          isAuthedUser: addedParticipant?.isAuthedUser,
          team_assignment: addedParticipant?.team_assignment
        }
      });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to join lobby:', error);

      if (error.message.includes('not open for joining')) {
        return res.status(403).json({ error: 'Lobby is not open for joining' });
      }

      res.status(500).json({
        error: 'Failed to join lobby',
        message: error.message
      });
    }
  }
);

// Helper method for creating sessions during joining
async function createSessionForJoining(lobbyId, lobby, transaction) {
  // Import session utilities
  const { getSessionDefaults } = await import('../config/gameTypeDefaults.js');
  const gameType = lobby.game?.game_type;
  const sessionDefaults = getSessionDefaults(gameType);

  // Find highest session number to auto-increment
  const existingSessionNumbers = lobby.active_sessions?.map(s => s.session_number) || [];
  const nextSessionNumber = existingSessionNumbers.length > 0
    ? Math.max(...existingSessionNumbers) + 1
    : 1;

  // Create new session
  const sessionCreateData = {
    lobby_id: lobbyId,
    session_number: nextSessionNumber,
    participants: [], // Will add participant next
    current_state: null,
    expires_at: null, // Inherit from lobby
    finished_at: null,
    data: {
      session_name: `${sessionDefaults.session_name} ${nextSessionNumber}`,
      max_players: sessionDefaults.max_players || 4,
      game_type: gameType,
      created_automatically: true,
      created_during_join: true,
      creation_timestamp: new Date().toISOString()
    }
  };

  const session = await models.GameSession.create(sessionCreateData, { transaction });

  return {
    id: session.id,
    session_number: session.session_number,
    created: true
  };
}

// =============================================
// SESSION MANAGEMENT WITHIN LOBBIES
// =============================================

/**
 * GET /api/game-lobbies/:lobbyId/sessions
 * List sessions in a lobby
 */
router.get('/game-lobbies/:lobbyId/sessions',
  authenticateToken,
  validateLobbyIdSession,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const user = req.user;

      clog(`📋 Listing sessions for lobby ${lobbyId} by user ${user.id}`);

      // Verify lobby exists and user has access
      const lobby = await models.GameLobby.findByPk(lobbyId, { transaction });
      if (!lobby) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Check access permissions
      const hasAccess =
        lobby.owner_user_id === user.id ||
        lobby.host_user_id === user.id ||
        user.role === 'admin' ||
        user.role === 'sysadmin';

      if (!hasAccess) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access denied: Only lobby owner or host can view sessions'
        });
      }

      // Get sessions
      const sessions = await GameSessionService.getSessionsByLobby(
        lobbyId,
        transaction
      );

      await transaction.commit();
      res.status(200).json({ data: sessions });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to list sessions:', error);
      res.status(500).json({
        error: 'Failed to fetch sessions',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/game-lobbies/:lobbyId/sessions
 * Create a new session in a lobby (teacher-facing with authentication)
 */
router.post('/game-lobbies/:lobbyId/sessions',
  authenticateToken,
  validateCreateSession,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const sessionData = req.validatedData;
      const user = req.user;

      clog(`🎮 Creating session in lobby ${lobbyId} by user ${user.id}`);

      // Create session using service
      const session = await GameSessionService.createSession(
        lobbyId,
        sessionData,
        user.id,
        transaction
      );

      await transaction.commit();
      res.status(201).json(session);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to create session:', error);

      if (error.message.includes('Lobby not found')) {
        return res.status(404).json({ error: 'Lobby not found' });
      }
      if (error.message.includes('not open')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to create session',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/game-lobbies/:lobbyId/sessions/create-student
 * Create a new session in a lobby (student-facing with conditional access control)
 */
router.post('/game-lobbies/:lobbyId/sessions/create-student',
  checkStudentsAccess, // Student conditional authentication middleware
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.params;
      const { participant } = req.body; // Extract participant data from request
      const user = req.user; // May be null for anonymous users

      clog(`🎮 Student creating session in lobby ${lobbyId}${user ? ` by user ${user.id}` : ' by anonymous user'}`);
      clog(`👤 Participant data:`, participant);

      // Validate participant data
      if (!participant || !participant.display_name?.trim()) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Participant display name is required'
        });
      }

      // Get lobby details to validate it exists and is manual_selection
      const lobby = await GameLobbyService.getLobbyDetails(lobbyId, transaction);
      if (!lobby) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Check if lobby is joinable
      const status = lobby.computed_status;
      if (status !== 'open' && status !== 'open_indefinitely') {
        await transaction.rollback();
        return res.status(400).json({
          error: `Lobby is not open for session creation (status: ${status})`
        });
      }

      // Only allow session creation for manual_selection lobbies
      if (lobby.settings.invitation_type !== 'manual_selection') {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Session creation is only allowed for manual selection lobbies'
        });
      }

      // Check guest user restrictions
      if (!participant.user_id && !lobby.settings.allow_guest_users) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Guest users are not allowed in this lobby'
        });
      }

      // Check if we're at max sessions limit
      const currentSessionCount = lobby.active_sessions.length;
      const maxSessions = lobby.settings.max_sessions || 10; // Default max sessions
      if (currentSessionCount >= maxSessions) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Maximum number of sessions (${maxSessions}) reached for this lobby`
        });
      }

      // Generate session number (next available)
      const existingSessionNumbers = lobby.active_sessions.map(s => s.session_number);
      const nextSessionNumber = existingSessionNumbers.length > 0
        ? Math.max(...existingSessionNumbers) + 1
        : 1;

      // Get game type defaults for session settings
      const { getSessionDefaults } = await import('../config/gameTypeDefaults.js');
      const gameType = lobby.game?.game_type;
      const sessionDefaults = getSessionDefaults(gameType);

      // Create session data
      const sessionCreateData = {
        lobby_id: lobbyId,
        session_number: nextSessionNumber,
        participants: [], // Empty initially, will add participant next
        current_state: null,
        expires_at: null, // Inherit from lobby
        finished_at: null,
        data: {
          session_name: `${sessionDefaults.session_name} ${nextSessionNumber}`,
          max_players: sessionDefaults.players_per_session,
          game_type: gameType,
          created_automatically: false,
          created_by_student: true,
          created_by: user?.id || 'anonymous',
          creation_timestamp: new Date().toISOString()
        }
      };

      const session = await models.GameSession.create(sessionCreateData, { transaction });

      clog(`✅ Student created session ${session.session_number} in lobby ${lobbyId}`);

      // Add the creator as a participant to the session
      const updatedSession = await GameSessionService.addParticipant(
        session.id,
        participant,
        participant.user_id || 'anonymous',
        transaction
      );

      await transaction.commit();

      // Get the actual participant data from the session (includes generated participant.id)
      const sessionDetails = await GameSessionService.getSessionDetails(updatedSession.id);
      const addedParticipant = sessionDetails.participants.find(p =>
        (participant.user_id && p.user_id === participant.user_id) ||
        (participant.guest_token && p.guest_token === participant.guest_token) ||
        (!participant.user_id && !participant.guest_token && p.display_name === participant.display_name)
      );

      clog(`👤 Added creator as participant:`, addedParticipant);

      // Return response in the format expected by frontend
      res.status(201).json({
        session: {
          id: session.id,
          session_number: session.session_number,
          participants_count: updatedSession.participants.length
        },
        lobby: {
          id: lobby.id,
          lobby_code: lobby.lobby_code,
          game: lobby.game
        },
        participant: {
          id: addedParticipant?.id,
          display_name: addedParticipant?.display_name,
          isAuthedUser: addedParticipant?.isAuthedUser,
          team_assignment: addedParticipant?.team_assignment
        }
      });

    } catch (error) {
      await transaction.rollback();
      cerror('❌ Failed to create student session:', error);

      res.status(500).json({
        error: 'Failed to create session',
        message: error.message
      });
    }
  }
);

// =============================================
// ADMIN/UTILITY ROUTES
// =============================================

/**
 * GET /api/game-lobbies/:lobbyId/debug
 * Debug lobby data for troubleshooting (requires authentication)
 */
router.get('/game-lobbies/:lobbyId/debug',
  authenticateToken,
  validateLobbyId,
  async (req, res) => {
    const transaction = await models.sequelize.transaction();
    try {
      const { lobbyId } = req.validatedParams;
      const user = req.user;

      clog(`🔍 [ROUTE] Debug request for lobby ${lobbyId} by user ${user.id}`);

      // Get debug information
      const debugInfo = await GameLobbyService.debugLobby(lobbyId, transaction);

      if (!debugInfo) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Lobby not found' });
      }

      await transaction.commit();
      res.status(200).json(debugInfo);

    } catch (error) {
      await transaction.rollback();
      cerror('❌ [ROUTE] Failed to debug lobby:', error);
      res.status(500).json({
        error: 'Failed to debug lobby',
        message: error.message
      });
    }
  }
);

export default router;