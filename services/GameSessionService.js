// services/GameSessionService.js
// Service for managing GameSession operations and participant management

import models from '../models/index.js';
import { Op } from 'sequelize';
import { error as logger } from '../lib/errorLogger.js';
import LobbySocketService from './LobbySocketService.js';

/**
 * GameSessionService - Manages session creation, participant management, and game state
 * Follows existing ludora-api patterns with transaction support
 */
class GameSessionService {

  /**
   * Create a new game session within a lobby
   * @param {string} lobbyId - Lobby ID
   * @param {Object} sessionData - Session configuration
   * @param {Array} sessionData.participants - Initial participants
   * @param {string} userId - Creating user ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Created session with participants
   */
  static async createSession(lobbyId, sessionData, userId, transaction = null) {
    try {

      // Validate that lobby exists and is active
      const lobby = await models.GameLobby.findByPk(lobbyId, { transaction });
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      if (lobby.status !== 'open') {
        throw new Error('Cannot create session: Lobby is not open');
      }

      // Check permissions (owner, host, or admin)
      if (lobby.owner_user_id !== userId && lobby.host_user_id !== userId) {
        throw new Error('Access denied: Only lobby owner or host can create sessions');
      }

      // Get next session number for this lobby
      const nextSessionNumber = await this.getNextSessionNumber(lobbyId, transaction);

      // Validate and format participants
      const formattedParticipants = await this.validateAndFormatParticipants(
        sessionData.participants || [],
        lobby.settings
      );

      // Create the session
      const sessionCreateData = {
        lobby_id: lobbyId,
        session_number: nextSessionNumber,
        participants: formattedParticipants,
        current_state: {}, // Empty initial game state
        status: 'pending', // Start as pending until host starts
        started_at: null
      };

      const session = await models.GameSession.create(sessionCreateData, { transaction });

      // Return session with lobby details
      const sessionWithDetails = await this.getSessionDetails(session.id, transaction);

      // Broadcast session created event
      LobbySocketService.broadcastSessionCreated(sessionWithDetails);

      return sessionWithDetails;

    } catch (error) {
      logger.auth('❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Add participant to an existing session
   * @param {string} sessionId - Session ID
   * @param {Object} participantData - Participant information
   * @param {string} participantData.user_id - User ID (for authenticated users)
   * @param {string} participantData.player_id - Player ID (for authenticated players - NEW AUTH MODEL)
   * @param {string} participantData.teacher_id - Teacher ID reference (NEW AUTH MODEL)
   * @param {string} participantData.guest_token - Guest token (for guest users)
   * @param {string} participantData.display_name - Display name
   * @param {string} participantData.team_assignment - Team assignment (optional)
   * @param {string} userId - User/Player ID making the request
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated session
   */
  static async addParticipant(sessionId, participantData, userId, transaction = null) {
    try {

      const session = await models.GameSession.findByPk(sessionId, {
        include: [
          {
            model: models.GameLobby,
            as: 'lobby',
            include: [{ model: models.Game, as: 'game' }]
          }
        ],
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const lobby = session.lobby;

      // Check if session is joinable
      if (session.status === 'closed') {
        throw new Error('Cannot join: Session is closed');
      }

      // Check lobby settings
      // NEW AUTH MODEL: Players with player_id are considered authenticated (not guests)
      const isAuthenticatedPlayer = !!participantData.player_id;
      if (!lobby.settings.allow_guest_users && !participantData.user_id && !isAuthenticatedPlayer) {
        throw new Error('Guest users are not allowed in this lobby');
      }

      // Check max players limit
      const currentParticipants = session.participants || [];
      if (currentParticipants.length >= lobby.settings.max_players) {
        throw new Error('Session is full');
      }

      // Check if participant already exists
      // NEW AUTH MODEL: Check by player_id first, then user_id, then guest_token
      const existingParticipant = currentParticipants.find(p =>
        (participantData.player_id && p.player_id === participantData.player_id) ||
        (p.user_id && p.user_id === participantData.user_id) ||
        (p.guest_token && p.guest_token === participantData.guest_token)
      );

      if (existingParticipant) {
        throw new Error('Participant already in session');
      }

      // Format new participant
      // NEW AUTH MODEL: Include player_id and teacher_id
      const newParticipant = {
        id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        player_id: participantData.player_id || null, // NEW: Reference to Player entity
        user_id: participantData.user_id || null,
        teacher_id: participantData.teacher_id || null, // NEW: Teacher reference from player
        guest_token: participantData.guest_token || null,
        display_name: participantData.display_name,
        isAuthedUser: !!participantData.user_id,
        isAuthedPlayer: !!participantData.player_id, // NEW: Flag for authenticated players
        team_assignment: participantData.team_assignment || null,
        joined_at: new Date().toISOString(),
        is_online: true
      };

      // Add participant to session
      const updatedParticipants = [...currentParticipants, newParticipant];

      await session.update({
        participants: updatedParticipants
      }, { transaction });

      // Return updated session
      const updatedSession = await this.getSessionDetails(sessionId, transaction);

      // Broadcast participant joined event
      LobbySocketService.broadcastParticipantJoined(updatedSession);

      return updatedSession;

    } catch (error) {
      logger.auth('❌ Failed to add participant:', error);
      throw error;
    }
  }

  /**
   * Remove participant from session
   * @param {string} sessionId - Session ID
   * @param {string} participantId - Participant ID
   * @param {string} userId - User making the request
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated session
   */
  static async removeParticipant(sessionId, participantId, userId, transaction = null) {
    try {

      const session = await models.GameSession.findByPk(sessionId, {
        include: [{ model: models.GameLobby, as: 'lobby' }],
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const lobby = session.lobby;
      const currentParticipants = session.participants || [];

      // Find participant to remove
      const participantIndex = currentParticipants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        throw new Error('Participant not found');
      }

      const participant = currentParticipants[participantIndex];

      // Check permissions
      const canRemove =
        lobby.owner_user_id === userId || // Lobby owner
        lobby.host_user_id === userId ||  // Lobby host
        participant.user_id === userId;   // Self-removal

      if (!canRemove) {
        throw new Error('Access denied: Cannot remove participant');
      }

      // Remove participant from array
      const updatedParticipants = currentParticipants.filter(p => p.id !== participantId);

      await session.update({
        participants: updatedParticipants
      }, { transaction });

      // Return updated session
      const updatedSession = await this.getSessionDetails(sessionId, transaction);

      // Broadcast participant left event
      LobbySocketService.broadcastParticipantLeft(updatedSession);

      return updatedSession;

    } catch (error) {
      logger.auth('❌ Failed to remove participant:', error);
      throw error;
    }
  }

  /**
   * Update game state for active session
   * @param {string} sessionId - Session ID
   * @param {Object} newState - New game state
   * @param {string} userId - User making the update
   * @param {boolean} autoSave - Whether to auto-save to data field
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated session
   */
  static async updateGameState(sessionId, newState, userId, autoSave = true, transaction = null) {
    try {

      const session = await models.GameSession.findByPk(sessionId, {
        include: [{ model: models.GameLobby, as: 'lobby' }],
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Validate that session is active
      if (session.status !== 'open') {
        throw new Error('Cannot update state: Session is not active');
      }

      const lobby = session.lobby;

      // Check permissions (owner, host, or participant)
      const isParticipant = session.participants?.some(p => p.user_id === userId);
      const canUpdate =
        lobby.owner_user_id === userId ||
        lobby.host_user_id === userId ||
        isParticipant;

      if (!canUpdate) {
        throw new Error('Access denied: Not a session participant');
      }

      // Update current state
      const updateData = {
        current_state: {
          ...session.current_state,
          ...newState,
          last_updated: new Date().toISOString(),
          updated_by: userId
        }
      };

      // Auto-save to data field if specified
      if (autoSave) {
        updateData.data = {
          ...session.data,
          ...updateData.current_state
        };
      }

      await session.update(updateData, { transaction });

      // Return updated session
      const updatedSession = await this.getSessionDetails(sessionId, transaction);

      // Broadcast game state updated event
      LobbySocketService.broadcastGameStateUpdated(updatedSession);

      return updatedSession;

    } catch (error) {
      logger.auth('❌ Failed to update game state:', error);
      throw error;
    }
  }

  /**
   * Finish/close a game session
   * @param {string} sessionId - Session ID
   * @param {Object} finalData - Final game data/results
   * @param {string} userId - User finishing the session
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Finished session
   */
  static async finishSession(sessionId, finalData, userId, transaction = null) {
    try {

      const session = await models.GameSession.findByPk(sessionId, {
        include: [{ model: models.GameLobby, as: 'lobby' }],
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const lobby = session.lobby;

      // Check permissions
      const canFinish =
        lobby.owner_user_id === userId ||
        lobby.host_user_id === userId;

      if (!canFinish) {
        throw new Error('Access denied: Only lobby owner or host can finish sessions');
      }

      // Update session as finished
      const updateData = {
        status: 'closed',
        finished_at: new Date(),
        data: {
          ...session.data,
          ...finalData,
          finished_by: userId,
          final_state: session.current_state
        }
      };

      await session.update(updateData, { transaction });

      // Return finished session
      const finishedSession = await this.getSessionDetails(sessionId, transaction);

      // Broadcast session finished event
      LobbySocketService.broadcastSessionFinished(finishedSession);

      return finishedSession;

    } catch (error) {
      logger.auth('❌ Failed to finish session:', error);
      throw error;
    }
  }

  /**
   * Get detailed session information
   * @param {string} sessionId - Session ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Detailed session information
   */
  static async getSessionDetails(sessionId, transaction = null) {
    try {
      const session = await models.GameSession.findByPk(sessionId, {
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
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Calculate duration if started
      let durationMinutes = null;
      if (session.started_at) {
        const endTime = session.finished_at || new Date();
        const startTime = new Date(session.started_at);
        durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
      }

      // Format response
      const formattedSession = {
        id: session.id,
        lobby_id: session.lobby_id,
        session_number: session.session_number,
        status: session.status,
        participants: session.participants || [],
        current_state: session.current_state || {},
        data: session.data || {},
        lobby: {
          id: session.lobby.id,
          lobby_code: session.lobby.lobby_code,
          status: session.lobby.status,
          settings: session.lobby.settings,
          game: session.lobby.game
        },
        started_at: session.started_at,
        finished_at: session.finished_at,
        duration_minutes: durationMinutes,
        created_at: session.created_at
      };

      return formattedSession;

    } catch (error) {
      logger.auth('❌ Failed to get session details:', error);
      throw error;
    }
  }

  /**
   * List sessions for a specific lobby
   * @param {string} lobbyId - Lobby ID
   * @param {string|null} status - Filter by status (optional)
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Array>} List of sessions
   */
  static async getSessionsByLobby(lobbyId, status = null, transaction = null) {
    try {
      const whereClause = { lobby_id: lobbyId };
      if (status) {
        whereClause.status = status;
      }

      const sessions = await models.GameSession.findAll({
        where: whereClause,
        order: [['session_number', 'DESC']],
        transaction
      });

      return sessions.map(session => ({
        id: session.id,
        session_number: session.session_number,
        status: session.status,
        participants_count: session.participants ? session.participants.length : 0,
        started_at: session.started_at,
        finished_at: session.finished_at,
        created_at: session.created_at
      }));

    } catch (error) {
      logger.auth('❌ Failed to get sessions by lobby:', error);
      throw error;
    }
  }

  /**
   * Get next session number for a lobby
   * @param {string} lobbyId - Lobby ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<number>} Next session number
   */
  static async getNextSessionNumber(lobbyId, transaction = null) {
    try {
      const result = await models.GameSession.max('session_number', {
        where: { lobby_id: lobbyId },
        transaction
      });

      return (result || 0) + 1;

    } catch (error) {
      logger.auth('❌ Failed to get next session number:', error);
      return 1;
    }
  }

  /**
   * Validate and format participants array
   * @param {Array} participants - Raw participant data
   * @param {Object} lobbySettings - Lobby settings
   * @returns {Promise<Array>} Formatted participants
   */
  static async validateAndFormatParticipants(participants, lobbySettings) {
    const formattedParticipants = [];

    for (const participant of participants) {
      // Validate required fields
      if (!participant.display_name) {
        throw new Error('Participant display_name is required');
      }

      // Check if guest users are allowed
      // NEW AUTH MODEL: Players with player_id are considered authenticated (not guests)
      const isAuthenticatedPlayer = !!participant.player_id;
      if (!participant.user_id && !isAuthenticatedPlayer && !lobbySettings.allow_guest_users) {
        throw new Error('Guest users are not allowed in this lobby');
      }

      // Check max players
      if (formattedParticipants.length >= lobbySettings.max_players) {
        throw new Error(`Cannot exceed maximum of ${lobbySettings.max_players} players`);
      }

      // NEW AUTH MODEL: Include player_id and teacher_id in formatted participant
      const formattedParticipant = {
        id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        player_id: participant.player_id || null, // NEW: Reference to Player entity
        user_id: participant.user_id || null,
        teacher_id: participant.teacher_id || null, // NEW: Teacher reference from player
        guest_token: participant.guest_token || null,
        display_name: participant.display_name,
        isAuthedUser: !!participant.user_id,
        isAuthedPlayer: !!participant.player_id, // NEW: Flag for authenticated players
        team_assignment: participant.team_assignment || null,
        joined_at: new Date().toISOString(),
        is_online: true
      };

      formattedParticipants.push(formattedParticipant);
    }

    return formattedParticipants;
  }

  /**
   * Start a pending session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User starting the session
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Started session
   */
  static async startSession(sessionId, userId, transaction = null) {
    try {

      const session = await models.GameSession.findByPk(sessionId, {
        include: [{ model: models.GameLobby, as: 'lobby' }],
        transaction
      });

      if (!session) {
        throw new Error('Session not found');
      }

      if (session.status !== 'pending') {
        throw new Error('Cannot start: Session is not pending');
      }

      const lobby = session.lobby;

      // Check permissions
      const canStart =
        lobby.owner_user_id === userId ||
        lobby.host_user_id === userId;

      if (!canStart) {
        throw new Error('Access denied: Only lobby owner or host can start sessions');
      }

      // Update session as started
      await session.update({
        status: 'open',
        started_at: new Date()
      }, { transaction });

      const startedSession = await this.getSessionDetails(sessionId, transaction);

      // Broadcast session started event
      LobbySocketService.broadcastSessionStarted(startedSession);

      return startedSession;

    } catch (error) {
      logger.auth('❌ Failed to start session:', error);
      throw error;
    }
  }
}

export default GameSessionService;