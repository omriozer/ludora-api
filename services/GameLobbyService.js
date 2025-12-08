// services/GameLobbyService.js
// Service for managing GameLobby lifecycle and operations

import models from '../models/index.js';
import { nanoid } from 'nanoid';
import { Op } from 'sequelize';
import { luderror } from '../lib/ludlog.js';
import { generateId } from '../models/baseModel.js';
import LobbySocketService from './LobbySocketService.js';

/**
 * GameLobbyService - Manages lobby creation, expiration, and participant management
 * Follows existing ludora-api patterns with transaction support and proper error handling
 * Uses expiration-based status computation instead of stored status fields
 */
class GameLobbyService {

  /**
   * Compute lobby status based on expiration and manual closure
   * @param {Object} lobby - Lobby object with expires_at and closed_at fields
   * @returns {string} Computed status: 'pending', 'open', 'open_indefinitely', 'closed'
   */
  static computeStatus(lobby) {
    // Manual close takes precedence
    if (lobby.closed_at) return 'closed';

    // No expiration = pending activation
    if (!lobby.expires_at) return 'pending';

    const now = new Date();
    const expiration = new Date(lobby.expires_at);
    const hundredYearsFromNow = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());

    // Past expiration = closed
    if (expiration <= now) return 'closed';

    // ~100 years = indefinite
    if (expiration >= hundredYearsFromNow) return 'open_indefinitely';

    // Normal future date = open
    return 'open';
  }

  /**
   * Add computed status and metadata to lobby object
   * @param {Object} lobby - Lobby object
   * @returns {Object} Enhanced lobby with computed status fields
   */
  static enhanceLobbyWithStatus(lobby) {
    const computed_status = this.computeStatus(lobby);
    const now = new Date();
    let time_remaining_minutes = null;
    let is_indefinite = false;

    if (lobby.expires_at && computed_status !== 'closed') {
      const expiration = new Date(lobby.expires_at);
      const hundredYearsFromNow = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());

      if (expiration >= hundredYearsFromNow) {
        is_indefinite = true;
      } else {
        time_remaining_minutes = Math.max(0, Math.floor((expiration - now) / (1000 * 60)));
      }
    }

    return {
      ...lobby.toJSON ? lobby.toJSON() : lobby,
      computed_status,
      time_remaining_minutes,
      is_indefinite
    };
  }

  /**
   * Create a new game lobby for a specific game
   * @param {string} gameId - Game entity ID
   * @param {Object} lobbyData - Lobby configuration
   * @param {Object} lobbyData.settings - Lobby settings (max_players, etc.)
   * @param {string|null} lobbyData.expires_at - Optional expiration time
   * @param {string} userId - Creating user ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Created lobby with game details
   */
  static async createLobby(gameId, lobbyData, userId, transaction = null) {
    try {
      // Validate that the game exists
      const game = await models.Game.findByPk(gameId, { transaction });
      if (!game) {
        throw new Error('Game not found');
      }

      // Note: Ownership validation handled by route middleware

      // Generate unique lobby code
      let lobbyCode;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        lobbyCode = this.generateLobbyCode();
        const existing = await models.GameLobby.findOne({
          where: { lobby_code: lobbyCode },
          transaction
        });
        isUnique = !existing;
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique lobby code');
      }

      // Default lobby settings (using correct validation values)
      const defaultSettings = {
        max_players: 12,
        session_time_limit: 30, // minutes
        allow_guest_users: true,
        invitation_type: 'manual_selection', // 'manual_selection', 'order'
        auto_close_after: 60 // minutes of inactivity
      };

      const lobbySettings = { ...defaultSettings, ...lobbyData.settings };

      // Create the lobby
      const lobbyCreateData = {
        id: generateId(), // Generate proper UUID using baseModel
        game_id: gameId,
        owner_user_id: userId,
        host_user_id: userId, // Creator starts as host
        lobby_code: lobbyCode,
        settings: lobbySettings,
        expires_at: lobbyData.expires_at || null // null = pending, specific date = open/closed based on time
      };

      const lobby = await models.GameLobby.create(lobbyCreateData, { transaction });

      // Fetch lobby with game details for response
      const lobbyWithGame = await models.GameLobby.findByPk(lobby.id, {
        include: [
          {
            model: models.Game,
            as: 'game',
            attributes: ['id', 'game_type', 'digital']
          },
          {
            model: models.User,
            as: 'owner',
            attributes: ['id', 'full_name']
          },
          {
            model: models.User,
            as: 'host',
            attributes: ['id', 'full_name']
          }
        ],
        transaction
      });

      // Enhance lobby with computed status information
      const enhancedLobby = this.enhanceLobbyWithStatus(lobbyWithGame);

      // Broadcast lobby creation via Socket.IO
      try {
        LobbySocketService.broadcastLobbyCreated(enhancedLobby);
      } catch (socketError) {
        luderror.api('❌ Failed to broadcast lobby created via Socket.IO:', socketError);
        // Don't fail the entire operation for broadcast errors
      }

      return enhancedLobby;

    } catch (error) {
      luderror.api('❌ Failed to create lobby:', error);
      throw error;
    }
  }

  /**
   * Activate lobby with enhanced settings (expiration, max players, session management)
   * @param {string} lobbyId - Lobby ID
   * @param {Object} activationData - Activation configuration
   * @param {number|string|null} activationData.duration - Duration in minutes, 'indefinite', or null
   * @param {Date|null} activationData.expires_at - Specific expiration date
   * @param {number} activationData.max_players - Maximum players in lobby
   * @param {Object} activationData.session_config - Session configuration
   * @param {string} userId - User making the change
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated lobby with session details
   */
  static async activateLobby(lobbyId, activationData, userId, transaction = null) {
    try {
      const lobby = await models.GameLobby.findByPk(lobbyId, {
        include: [
          {
            model: models.Game,
            as: 'game',
            attributes: ['id', 'game_type', 'digital']
          }
        ],
        transaction
      });

      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Permission validation
      const ownerUserId = lobby.owner_user_id;
      const hostUserId = lobby.host_user_id;

      // Validate that required fields exist (they should per model constraint)
      if (!ownerUserId || !hostUserId) {
        luderror.api(`❌ Data integrity issue: lobby ${lobbyId} missing required user IDs`);
        throw new Error('Lobby data integrity error: missing owner or host user ID');
      }

      // Use string comparison for safety and handle different data types
      const userIdStr = String(userId);
      const ownerIdStr = String(ownerUserId);
      const hostIdStr = String(hostUserId);

      const isOwner = ownerIdStr === userIdStr;
      const isHost = hostIdStr === userIdStr;

      if (!isOwner && !isHost) {
        throw new Error('Access denied: Only lobby owner or host can activate lobby');
      }

      // Import game type configuration
      let getGameTypeConfig, getLobbyDefaults, getSessionDefaults, calculateSessionDistribution;
      try {
        const configModule = await import('../config/gameTypeDefaults.js');
        ({ getGameTypeConfig, getLobbyDefaults, getSessionDefaults, calculateSessionDistribution } = configModule);
      } catch (configError) {
        luderror.api(`❌ Failed to import game type config:`, configError);
        throw new Error(`Configuration import failed: ${configError.message}`);
      }

      // Get game type and configuration
      const gameType = lobby.game?.game_type;
      if (!gameType) {
        throw new Error('Game type not found in lobby');
      }

      let gameConfig, lobbyDefaults, sessionDefaults;
      try {
        gameConfig = getGameTypeConfig(gameType);
        lobbyDefaults = getLobbyDefaults(gameType);
        sessionDefaults = getSessionDefaults(gameType);
      } catch (gameConfigError) {
        luderror.api(`❌ Failed to get game type config for ${gameType}:`, gameConfigError);
        throw new Error(`Game configuration failed for ${gameType}: ${gameConfigError.message}`);
      }

      // Calculate expiration time
      let expires_at;
      if (activationData.expires_at) {
        expires_at = new Date(activationData.expires_at);
      } else if (activationData.duration === 'indefinite') {
        expires_at = new Date();
        expires_at.setFullYear(expires_at.getFullYear() + 100);
      } else if (activationData.duration) {
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + activationData.duration);
      } else {
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + lobbyDefaults.session_duration_minutes);
      }

      // Determine max players
      const maxPlayers = activationData.max_players || lobbyDefaults.max_players;

      // Validate max players against game type limits
      if (maxPlayers > gameConfig.lobby.max_players_max) {
        throw new Error(`Max players (${maxPlayers}) exceeds limit for ${gameType} (${gameConfig.lobby.max_players_max})`);
      }

      // Update lobby settings
      const updatedSettings = {
        ...lobby.settings,
        max_players: maxPlayers
      };

      try {
        await lobby.update({
          expires_at,
          settings: updatedSettings,
          closed_at: null // Clear manual closure when reactivating
        }, { transaction });
      } catch (updateError) {
        luderror.api(`❌ Failed to update lobby:`, updateError);
        throw new Error(`Lobby update failed: ${updateError.message}`);
      }

      // Handle session creation based on invitation_type
      const sessionConfig = activationData.session_config || {};
      const invitationType = updatedSettings.invitation_type || 'manual_selection'; // Default to manual_selection

      // For the supported invitation types, sessions are created on-demand when students join
      const createdSessions = [];
      const autoCreateSessions = lobbyDefaults.auto_create_sessions || false;

      // Return updated lobby with details and sessions
      const updatedLobby = await this.getLobbyDetails(lobbyId, transaction);

      // Broadcast lobby activation via Socket.IO
      try {
        LobbySocketService.broadcastLobbyActivated(updatedLobby);
      } catch (socketError) {
        luderror.api('❌ Failed to broadcast lobby activated via Socket.IO:', socketError);
        // Don't fail the entire operation for broadcast errors
      }

      return {
        ...updatedLobby,
        activation_summary: {
          expires_at,
          max_players: maxPlayers,
          sessions_created: createdSessions.length,
          game_type: gameType,
          auto_sessions: autoCreateSessions
        }
      };

    } catch (error) {
      luderror.api('❌ Failed to activate lobby:', error);
      throw error;
    }
  }

  /**
   * Close lobby manually
   * @param {string} lobbyId - Lobby ID
   * @param {string} userId - User making the change
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated lobby
   */
  static async closeLobby(lobbyId, userId, transaction = null) {
    try {

      const lobby = await models.GameLobby.findByPk(lobbyId, { transaction });
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Check permissions (owner, host, or admin)
      if (lobby.owner_user_id !== userId && lobby.host_user_id !== userId) {
        // Admin bypass handled by route middleware
        throw new Error('Access denied: Only lobby owner or host can close lobby');
      }

      const now = new Date();

      // Set both closed_at and expires_at to current time (makes lobby expired immediately)
      await lobby.update({
        closed_at: now,
        expires_at: now
      }, { transaction });

      // Close all sessions by setting their expires_at to current time (but keep finished_at null - only set when game actually ends)
      await models.GameSession.update(
        {
          expires_at: now
          // NOTE: finished_at should only be set when the game actually ends, not when lobby closes
        },
        {
          where: {
            lobby_id: lobbyId
            // Remove finished_at: null filter - update all sessions in this lobby
          },
          transaction
        }
      );

      // Return updated lobby with details
      const updatedLobby = await this.getLobbyDetails(lobbyId, transaction);

      // Broadcast lobby closure via Socket.IO
      try {
        LobbySocketService.broadcastLobbyClosed(updatedLobby);
      } catch (socketError) {
        luderror.api('❌ Failed to broadcast lobby closed via Socket.IO:', socketError);
        // Don't fail the entire operation for broadcast errors
      }

      return updatedLobby;

    } catch (error) {
      luderror.api('❌ Failed to close lobby:', error);
      throw error;
    }
  }

  /**
   * Create initial sessions for a lobby based on configuration
   * Reuses existing empty sessions and auto-increments session numbers
   * @param {string} lobbyId - Lobby ID
   * @param {string} gameType - Game type for defaults
   * @param {Object} sessionConfig - Session configuration
   * @param {number} maxPlayers - Maximum players in lobby
   * @param {string} userId - User creating sessions
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Array>} Created/reused sessions
   */
  static async createInitialSessions(lobbyId, gameType, sessionConfig, maxPlayers, userId, transaction = null) {
    try {
      // Get all existing sessions for this lobby
      const existingSessions = await models.GameSession.findAll({
        where: { lobby_id: lobbyId },
        order: [['session_number', 'ASC']],
        transaction
      });

      // Import session utilities
      const { getSessionDefaults, calculateSessionDistribution } = await import('../config/gameTypeDefaults.js');
      const sessionDefaults = getSessionDefaults(gameType);

      // Determine how many sessions we need
      let requiredSessionCount, playersPerSession;

      if (sessionConfig.session_count && sessionConfig.players_per_session) {
        requiredSessionCount = sessionConfig.session_count;
        playersPerSession = sessionConfig.players_per_session;
      } else {
        const distribution = calculateSessionDistribution(maxPlayers, gameType);
        requiredSessionCount = distribution.recommended_sessions;
        playersPerSession = distribution.players_per_session;
      }

      // Reuse existing empty sessions and create new ones as needed
      const reusedSessions = [];
      const createdSessions = [];
      const sessionNames = sessionConfig.session_names || [];

      // Find empty sessions that can be reused
      const emptySessions = existingSessions.filter(session =>
        !session.participants || session.participants.length === 0
      );

      // Reuse empty sessions first
      for (let i = 0; i < Math.min(requiredSessionCount, emptySessions.length); i++) {
        const session = emptySessions[i];
        const sessionName = sessionNames[i] || `${sessionDefaults.session_name} ${session.session_number}`;

        // Update the session with new configuration
        await session.update({
          expires_at: null, // Reset expiration
          finished_at: null, // Ensure it's not finished
          data: {
            session_name: sessionName,
            max_players: playersPerSession,
            game_type: gameType,
            created_automatically: true,
            created_by: userId,
            creation_timestamp: new Date().toISOString(),
            reused: true
          }
        }, { transaction });

        reusedSessions.push({
          id: session.id,
          session_number: session.session_number,
          session_name: sessionName,
          max_players: playersPerSession,
          reused: true
        });
      }

      // Create additional sessions if needed
      const sessionsNeeded = requiredSessionCount - reusedSessions.length;
      if (sessionsNeeded > 0) {

        // Find the highest session number to auto-increment from
        const maxSessionNumber = existingSessions.length > 0
          ? Math.max(...existingSessions.map(s => s.session_number))
          : 0;

        for (let i = 0; i < sessionsNeeded; i++) {
          const newSessionNumber = maxSessionNumber + 1 + i;
          const sessionNameIndex = reusedSessions.length + i;
          const sessionName = sessionNames[sessionNameIndex] || `${sessionDefaults.session_name} ${newSessionNumber}`;

          const sessionCreateData = {
            lobby_id: lobbyId,
            session_number: newSessionNumber,
            participants: [], // Empty initially
            current_state: null, // No state until started
            expires_at: null, // Will inherit from lobby when activated
            finished_at: null,
            data: {
              session_name: sessionName,
              max_players: playersPerSession,
              game_type: gameType,
              created_automatically: true,
              created_by: userId,
              creation_timestamp: new Date().toISOString(),
              new: true
            }
          };

          const session = await models.GameSession.create(sessionCreateData, { transaction });
          createdSessions.push({
            id: session.id,
            session_number: session.session_number,
            session_name: sessionName,
            max_players: playersPerSession,
            new: true
          });
        }
      }

      return [...reusedSessions, ...createdSessions];

    } catch (error) {
      luderror.auth('❌ Failed to create/manage sessions:', error);
      throw error;
    }
  }

  /**
   * Set or update lobby expiration time
   * @param {string} lobbyId - Lobby ID
   * @param {Date|string|null} expires_at - Expiration time, 'indefinite', or null for pending
   * @param {string} userId - User making the change
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Updated lobby
   */
  static async setLobbyExpiration(lobbyId, expires_at, userId, transaction = null) {
    try {

      const lobby = await models.GameLobby.findByPk(lobbyId, { transaction });
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Check permissions (owner, host, or admin)
      if (lobby.owner_user_id !== userId && lobby.host_user_id !== userId) {
        // Admin bypass handled by route middleware
        throw new Error('Access denied: Only lobby owner or host can set expiration');
      }

      // Process expiration value
      let processed_expires_at;
      if (expires_at === 'indefinite') {
        processed_expires_at = new Date();
        processed_expires_at.setFullYear(processed_expires_at.getFullYear() + 100);
      } else if (expires_at === null || expires_at === 'pending') {
        processed_expires_at = null;
      } else {
        processed_expires_at = new Date(expires_at);
      }

      await lobby.update({ expires_at: processed_expires_at }, { transaction });

      return await this.getLobbyDetails(lobbyId, transaction);

    } catch (error) {
      luderror.api('❌ Failed to set lobby expiration:', error);
      throw error;
    }
  }

  /**
   * Get detailed lobby information including active sessions and participant counts
   * @param {string} lobbyId - Lobby ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Detailed lobby information
   */
  static async getLobbyDetails(lobbyId, transaction = null) {
    try {
      const lobby = await models.GameLobby.findByPk(lobbyId, {
        include: [
          {
            model: models.Game,
            as: 'game',
            attributes: ['id', 'game_type', 'digital']
          },
          {
            model: models.User,
            as: 'owner',
            attributes: ['id', 'full_name']
          },
          {
            model: models.User,
            as: 'host',
            attributes: ['id', 'full_name']
          },
          {
            model: models.GameSession,
            as: 'sessions',
            // Get ALL sessions (no filter) - let frontend decide what to show
            required: false,
            attributes: ['id', 'session_number', 'expires_at', 'participants', 'started_at', 'finished_at'],
            order: [['session_number', 'ASC']]
          }
        ],
        transaction
      });

      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Calculate participant summary
      const participantsSummary = this.calculateParticipantsSummary(lobby.sessions);

      // Enhance lobby with computed status
      const enhancedLobby = this.enhanceLobbyWithStatus(lobby);

      // Fetch Product data for the game to get title information
      let gameWithProduct = lobby.game;
      if (lobby.game) {
        const product = await models.Product.findOne({
          where: {
            product_type: 'game',
            entity_id: lobby.game.id
          },
          attributes: ['title', 'description'],
          transaction
        });

        gameWithProduct = {
          ...lobby.game.toJSON ? lobby.game.toJSON() : lobby.game,
          title: product?.title,
          description: product?.description
        };
      }

      // Format response
      const formattedLobby = {
        ...enhancedLobby,
        game: gameWithProduct,
        owner: lobby.owner,
        host: lobby.host,
        active_sessions: lobby.sessions.map(session => {
          // Use hierarchical status computation (lobby expires_at overrides session expires_at)
          const sessionStatus = session.finished_at ? 'closed' :
            session.computeStatusWithLobby(lobby);

          return {
            id: session.id,
            session_number: session.session_number,
            participants_count: session.participants ? session.participants.length : 0,
            computed_status: sessionStatus,
            expires_at: session.expires_at,
            started_at: session.started_at,
            finished_at: session.finished_at,
            can_delete: session.canDelete() // Only true if no participants ever joined
          };
        }),
        participants_summary: participantsSummary
      };

      return formattedLobby;

    } catch (error) {
      luderror.api('❌ Failed to get lobby details:', error);
      throw error;
    }
  }

  /**
   * Find lobby by lobby code for joining
   * @param {string} lobbyCode - 6-character lobby code
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object|null>} Lobby details if found and joinable
   */
  static async findLobbyByCode(lobbyCode, transaction = null) {
    try {
      const lobby = await models.GameLobby.findOne({
        where: { lobby_code: lobbyCode.toUpperCase() },
        include: [
          {
            model: models.Game,
            as: 'game',
            attributes: ['id', 'game_type', 'digital']
          }
        ],
        transaction
      });

      if (!lobby) {
        return null;
      }

      // Check if lobby is joinable using computed status
      const computed_status = this.computeStatus(lobby);
      if (computed_status !== 'open' && computed_status !== 'open_indefinitely') {
        throw new Error(`Lobby is not open for joining (status: ${computed_status})`);
      }

      // Fetch Product data for the game to get title information
      if (lobby.game) {
        const product = await models.Product.findOne({
          where: {
            product_type: 'game',
            entity_id: lobby.game.id
          },
          attributes: ['title', 'description'],
          transaction
        });

        if (product) {
          lobby.game = {
            ...lobby.game.toJSON ? lobby.game.toJSON() : lobby.game,
            title: product.title,
            description: product.description
          };
        }
      }

      return this.enhanceLobbyWithStatus(lobby);

    } catch (error) {
      luderror.api('❌ Failed to find lobby by code:', error);
      throw error;
    }
  }

  /**
   * List all lobbies for a specific game (including closed ones)
   * @param {string} gameId - Game ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Array>} List of all lobbies with computed status
   */
  static async getLobbiesByGame(gameId, transaction = null) {
    try {
      const lobbies = await models.GameLobby.findAll({
        where: {
          game_id: gameId
          // Return ALL lobbies - let frontend handle display logic based on computed status
        },
        include: [
          {
            model: models.Game,
            as: 'game',
            attributes: ['id', 'game_type', 'digital']
          },
          {
            model: models.User,
            as: 'owner',
            attributes: ['id', 'full_name']
          },
          {
            model: models.User,
            as: 'host',
            attributes: ['id', 'full_name']
          }
        ],
        order: [['created_at', 'DESC']],
        transaction
      });

      // Fetch Product data for the game to get title information
      let gameWithProduct = null;
      if (gameId) {
        const product = await models.Product.findOne({
          where: {
            product_type: 'game',
            entity_id: gameId
          },
          attributes: ['title', 'description'],
          transaction
        });

        if (product) {
          gameWithProduct = {
            title: product.title,
            description: product.description
          };
        }
      }

      // Enhance each lobby with computed status and game title
      const enhancedLobbies = lobbies.map(lobby => {
        const enhanced = this.enhanceLobbyWithStatus(lobby);

        // Add game title information if we have it
        if (enhanced.game && gameWithProduct) {
          enhanced.game = {
            ...enhanced.game,
            ...gameWithProduct
          };
        }

        return enhanced;
      });

      return enhancedLobbies;

    } catch (error) {
      luderror.api('❌ Failed to get lobbies:', error);
      throw error;
    }
  }

  /**
   * List active lobbies for a specific game (backwards compatibility)
   * @param {string} gameId - Game ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Array>} List of active lobbies only
   */
  static async getActiveLobbiesByGame(gameId, transaction = null) {
    const allLobbies = await this.getLobbiesByGame(gameId, transaction);
    // Filter to only return active lobbies (open, open_indefinitely, or pending)
    return allLobbies.filter(lobby => {
      const status = lobby.computed_status;
      return status === 'open' || status === 'open_indefinitely' || status === 'pending';
    });
  }

  /**
   * Generate unique 6-character lobby code
   * @returns {string} Uppercase lobby code
   */
  static generateLobbyCode() {
    // Generate readable code avoiding confusing characters (0, O, I, 1)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Calculate participants summary across all active sessions
   * @param {Array} sessions - Array of GameSession objects
   * @returns {Object} Participants summary
   */
  static calculateParticipantsSummary(sessions = []) {
    let totalOnline = 0;
    let authenticatedUsers = 0;
    let guestUsers = 0;

    sessions.forEach(session => {
      if (session.participants && Array.isArray(session.participants)) {
        session.participants.forEach(participant => {
          totalOnline++;
          if (participant.isAuthedUser) {
            authenticatedUsers++;
          } else {
            guestUsers++;
          }
        });
      }
    });

    return {
      total_online: totalOnline,
      authenticated_users: authenticatedUsers,
      guest_users: guestUsers
    };
  }

  /**
   * Debug method to inspect lobby data (for admin/development use)
   * @param {string} lobbyId - Lobby ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Detailed lobby information for debugging
   */
  static async debugLobby(lobbyId, transaction = null) {
    try {
      const lobby = await models.GameLobby.findByPk(lobbyId, {
        include: [
          { model: models.Game, as: 'game', attributes: ['id', 'game_type', 'digital'] },
          { model: models.User, as: 'owner', attributes: ['id', 'full_name'] },
          { model: models.User, as: 'host', attributes: ['id', 'full_name'] }
        ],
        transaction
      });

      if (!lobby) {
        return null;
      }

      return {
        lobby: {
          id: lobby.id,
          game_id: lobby.game_id,
          owner_user_id: lobby.owner_user_id,
          host_user_id: lobby.host_user_id,
          lobby_code: lobby.lobby_code,
          settings: lobby.settings,
          expires_at: lobby.expires_at,
          closed_at: lobby.closed_at,
          created_at: lobby.created_at,
          updated_at: lobby.updated_at
        },
        associations: {
          game: lobby.game ? { id: lobby.game.id, game_type: lobby.game.game_type, digital: lobby.game.digital } : null,
          owner: lobby.owner ? { id: lobby.owner.id, full_name: lobby.owner.full_name } : null,
          host: lobby.host ? { id: lobby.host.id, full_name: lobby.host.full_name } : null
        },
        computed: {
          status: this.computeStatus(lobby),
          is_active: lobby.isActive ? lobby.isActive() : 'method_not_available'
        }
      };

    } catch (error) {
      luderror.api(`❌ Failed to inspect lobby ${lobbyId}:`, error);
      throw error;
    }
  }

  /**
   * Validate lobby access permissions
   * @param {Object} lobby - Lobby object
   * @param {string} userId - User ID
   * @param {string} userRole - User role
   * @returns {boolean} Whether user can access lobby
   */
  static validateLobbyAccess(lobby, userId, userRole) {
    // Admin/sysadmin bypass
    if (userRole === 'admin' || userRole === 'sysadmin') {
      return true;
    }

    // Owner or host access
    if (lobby.owner_user_id === userId || lobby.host_user_id === userId) {
      return true;
    }

    return false;
  }
}

export default GameLobbyService;