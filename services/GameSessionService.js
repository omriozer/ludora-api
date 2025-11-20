// services/GameSessionService.js
// Service for managing GameSession operations and participant management

import models from '../models/index.js';
import { Op } from 'sequelize';
import { clog, cerror } from '../lib/utils.js';
import { broadcastSessionEvent, SSE_EVENT_TYPES } from './SSEBroadcaster.js';

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
      clog(`🎮 Creating session for lobby ${lobbyId} by user ${userId}`);

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

      // Emit SSE event for session creation
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_CREATED, session.id, lobbyId, lobby.game_id, {
          session_number: nextSessionNumber,
          participants_count: formattedParticipants.length,
          status: 'pending',
          created_by: userId,
          lobby_code: lobby.lobby_code
        });
        clog(`📡 Broadcasted SESSION_CREATED event for session ${session.id}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast session created event:', sseError);
        // Don't fail the creation if SSE fails
      }

      clog(`✅ Created session ${session.id} (session #${nextSessionNumber}) in lobby ${lobbyId}`);
      return sessionWithDetails;

    } catch (error) {
      cerror('❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Add participant to an existing session
   * @param {string} sessionId - Session ID
   * @param {Object} participantData - Participant information
   * @param {string} participantData.user_id - User ID (for authenticated users)
   * @param {string} participantData.guest_token - Guest token (for guest users)
   * @param {string} participantData.display_name - Display name
   * @param {string} participantData.team_assignment - Team assignment (optional)
   * @param {string} userId - User making the request
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated session
   */
  static async addParticipant(sessionId, participantData, userId, transaction = null) {
    try {
      clog(`👤 Adding participant to session ${sessionId}`);

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
      if (!lobby.settings.allow_guest_users && !participantData.user_id) {
        throw new Error('Guest users are not allowed in this lobby');
      }

      // Check max players limit
      const currentParticipants = session.participants || [];
      if (currentParticipants.length >= lobby.settings.max_players) {
        throw new Error('Session is full');
      }

      // Check if participant already exists
      const existingParticipant = currentParticipants.find(p =>
        (p.user_id && p.user_id === participantData.user_id) ||
        (p.guest_token && p.guest_token === participantData.guest_token)
      );

      if (existingParticipant) {
        throw new Error('Participant already in session');
      }

      // Format new participant
      const newParticipant = {
        id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: participantData.user_id || null,
        guest_token: participantData.guest_token || null,
        display_name: participantData.display_name,
        isAuthedUser: !!participantData.user_id,
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

      // Emit SSE event for participant joined
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_PARTICIPANT_JOINED, sessionId, lobby.id, lobby.game.id, {
          participant: {
            id: newParticipant.id,
            display_name: newParticipant.display_name,
            isAuthedUser: newParticipant.isAuthedUser,
            team_assignment: newParticipant.team_assignment
          },
          participants_count: updatedParticipants.length,
          session_number: session.session_number,
          lobby_code: lobby.lobby_code
        });
        clog(`📡 Broadcasted SESSION_PARTICIPANT_JOINED event for session ${sessionId}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast participant joined event:', sseError);
        // Don't fail the operation if SSE fails
      }

      clog(`✅ Added participant ${newParticipant.display_name} to session ${sessionId}`);
      return updatedSession;

    } catch (error) {
      cerror('❌ Failed to add participant:', error);
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
      clog(`👤 Removing participant ${participantId} from session ${sessionId}`);

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

      // Emit SSE event for participant left
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_PARTICIPANT_LEFT, sessionId, lobby.id, lobby.game_id, {
          participant: {
            id: participant.id,
            display_name: participant.display_name,
            isAuthedUser: participant.isAuthedUser
          },
          participants_count: updatedParticipants.length,
          session_number: session.session_number,
          lobby_code: lobby.lobby_code,
          removed_by: userId
        });
        clog(`📡 Broadcasted SESSION_PARTICIPANT_LEFT event for session ${sessionId}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast participant left event:', sseError);
        // Don't fail the operation if SSE fails
      }

      clog(`✅ Removed participant ${participant.display_name} from session ${sessionId}`);
      return updatedSession;

    } catch (error) {
      cerror('❌ Failed to remove participant:', error);
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
      clog(`🎮 Updating game state for session ${sessionId}`);

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

      // Emit SSE event for game state update
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_STATE_UPDATED, sessionId, lobby.id, lobby.game_id, {
          updated_by: userId,
          session_number: session.session_number,
          participants_count: session.participants ? session.participants.length : 0,
          auto_saved: autoSave,
          state_keys: Object.keys(newState), // What parts of the state were updated
          last_updated: updateData.current_state.last_updated
        });
        clog(`📡 Broadcasted SESSION_STATE_UPDATED event for session ${sessionId}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast session state updated event:', sseError);
        // Don't fail the operation if SSE fails
      }

      clog(`✅ Updated game state for session ${sessionId}`);
      return updatedSession;

    } catch (error) {
      cerror('❌ Failed to update game state:', error);
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
      clog(`🏁 Finishing session ${sessionId}`);

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

      // Emit SSE event for session finished
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_FINISHED, sessionId, lobby.id, lobby.game_id, {
          session_number: session.session_number,
          participants_count: session.participants ? session.participants.length : 0,
          finished_by: userId,
          finished_at: updateData.finished_at,
          lobby_code: lobby.lobby_code,
          final_data_keys: Object.keys(finalData) // What final data was saved
        });
        clog(`📡 Broadcasted SESSION_FINISHED event for session ${sessionId}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast session finished event:', sseError);
        // Don't fail the operation if SSE fails
      }

      clog(`✅ Finished session ${sessionId}`);
      return finishedSession;

    } catch (error) {
      cerror('❌ Failed to finish session:', error);
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
      cerror('❌ Failed to get session details:', error);
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
      cerror('❌ Failed to get sessions by lobby:', error);
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
      cerror('❌ Failed to get next session number:', error);
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
      if (!participant.user_id && !lobbySettings.allow_guest_users) {
        throw new Error('Guest users are not allowed in this lobby');
      }

      // Check max players
      if (formattedParticipants.length >= lobbySettings.max_players) {
        throw new Error(`Cannot exceed maximum of ${lobbySettings.max_players} players`);
      }

      const formattedParticipant = {
        id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: participant.user_id || null,
        guest_token: participant.guest_token || null,
        display_name: participant.display_name,
        isAuthedUser: !!participant.user_id,
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
      clog(`▶️ Starting session ${sessionId}`);

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

      // Emit SSE event for session started
      try {
        broadcastSessionEvent(SSE_EVENT_TYPES.SESSION_STARTED, sessionId, lobby.id, lobby.game_id, {
          session_number: session.session_number,
          participants_count: session.participants ? session.participants.length : 0,
          started_by: userId,
          started_at: session.started_at,
          lobby_code: lobby.lobby_code
        });
        clog(`📡 Broadcasted SESSION_STARTED event for session ${sessionId}`);
      } catch (sseError) {
        cerror('❌ Failed to broadcast session started event:', sseError);
        // Don't fail the operation if SSE fails
      }

      clog(`✅ Started session ${sessionId}`);
      return startedSession;

    } catch (error) {
      cerror('❌ Failed to start session:', error);
      throw error;
    }
  }
}

export default GameSessionService;