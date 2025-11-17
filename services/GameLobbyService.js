// services/GameLobbyService.js
// Service for managing GameLobby lifecycle and operations

import models from '../models/index.js';
import { nanoid } from 'nanoid';
import { Op } from 'sequelize';
import { clog, cerror } from '../lib/utils.js';
import { generateId } from '../models/baseModel.js';

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
      clog(`🏠 Creating lobby for game ${gameId} by user ${userId}`);

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
        invitation_type: 'lobby_only', // 'lobby_only', 'session_only', 'both'
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

      clog(`🔧 Lobby creation data:`, {
        id: lobbyCreateData.id,
        game_id: lobbyCreateData.game_id,
        owner_user_id: lobbyCreateData.owner_user_id,
        host_user_id: lobbyCreateData.host_user_id,
        lobby_code: lobbyCreateData.lobby_code,
        userId_input: userId,
        expires_at: lobbyCreateData.expires_at
      });

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

      clog(`✅ Created lobby ${lobby.id} with code ${lobbyCode}, status: ${enhancedLobby.computed_status}`);
      return enhancedLobby;

    } catch (error) {
      cerror('❌ Failed to create lobby:', error);
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
      clog(`🔄 Activating lobby ${lobbyId} with enhanced settings by user ${userId}`);
      clog(`🔧 Activation data:`, activationData);

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

      // Check permissions (owner, host, or admin)
      if (lobby.owner_user_id !== userId && lobby.host_user_id !== userId) {
        // Admin bypass handled by route middleware
        throw new Error('Access denied: Only lobby owner or host can activate lobby');
      }

      // Import game type configuration
      const { getGameTypeConfig, getLobbyDefaults, getSessionDefaults, calculateSessionDistribution } =
        await import('../config/gameTypeDefaults.js');

      const gameType = lobby.game.game_type;
      const gameConfig = getGameTypeConfig(gameType);
      const lobbyDefaults = getLobbyDefaults(gameType);
      const sessionDefaults = getSessionDefaults(gameType);

      clog(`🎮 Game type: ${gameType}, defaults:`, { lobbyDefaults, sessionDefaults });

      // Calculate expiration time
      let expires_at;
      if (activationData.expires_at) {
        expires_at = new Date(activationData.expires_at);
      } else if (activationData.duration === 'indefinite') {
        // Set to 100 years from now for indefinite
        expires_at = new Date();
        expires_at.setFullYear(expires_at.getFullYear() + 100);
      } else if (activationData.duration) {
        // Set specific duration
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + activationData.duration);
      } else {
        // Use default duration
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + lobbyDefaults.session_duration_minutes);
      }

      // Determine max players (use provided value or default)
      const maxPlayers = activationData.max_players || lobbyDefaults.max_players;

      // Validate max players against game type limits
      if (maxPlayers > gameConfig.lobby.max_players_max) {
        throw new Error(`Max players (${maxPlayers}) exceeds limit for ${gameType} (${gameConfig.lobby.max_players_max})`);
      }

      // Update lobby settings with new max_players and expiration
      const updatedSettings = {
        ...lobby.settings,
        max_players: maxPlayers
      };

      await lobby.update({
        expires_at,
        settings: updatedSettings,
        closed_at: null // Clear manual closure when reactivating
      }, { transaction });

      // Handle session creation if configured
      const sessionConfig = activationData.session_config || {};
      const autoCreateSessions = sessionConfig.auto_create_sessions !== false; // Default true

      let createdSessions = [];
      if (autoCreateSessions) {
        createdSessions = await this.createInitialSessions(
          lobbyId,
          gameType,
          sessionConfig,
          maxPlayers,
          userId,
          transaction
        );
      }

      // Return updated lobby with details and sessions
      const updatedLobby = await this.getLobbyDetails(lobbyId, transaction);

      clog(`✅ Activated lobby ${lobbyId} with expiration ${expires_at}, max players: ${maxPlayers}, sessions: ${createdSessions.length}`);
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
      cerror('❌ Failed to activate lobby:', error);
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
      clog(`🔄 Closing lobby ${lobbyId} by user ${userId}`);

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

      // Also close all active sessions by setting their expires_at to current time
      await models.GameSession.update(
        {
          finished_at: now,
          expires_at: now
        },
        {
          where: {
            lobby_id: lobbyId,
            finished_at: null
          },
          transaction
        }
      );

      // Return updated lobby with details
      const updatedLobby = await this.getLobbyDetails(lobbyId, transaction);

      clog(`✅ Closed lobby ${lobbyId} and all its sessions with expiration set to ${now}`);
      return updatedLobby;

    } catch (error) {
      cerror('❌ Failed to close lobby:', error);
      throw error;
    }
  }

  /**
   * Create initial sessions for a lobby based on configuration
   * @param {string} lobbyId - Lobby ID
   * @param {string} gameType - Game type for defaults
   * @param {Object} sessionConfig - Session configuration
   * @param {number} maxPlayers - Maximum players in lobby
   * @param {string} userId - User creating sessions
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Array>} Created sessions
   */
  static async createInitialSessions(lobbyId, gameType, sessionConfig, maxPlayers, userId, transaction = null) {
    try {
      clog(`🎮 Creating initial sessions for lobby ${lobbyId}, game type: ${gameType}`);

      // Import session utilities
      const { getSessionDefaults, calculateSessionDistribution } = await import('../config/gameTypeDefaults.js');

      const sessionDefaults = getSessionDefaults(gameType);

      // Determine session count and player distribution
      let sessionCount, playersPerSession;

      if (sessionConfig.session_count && sessionConfig.players_per_session) {
        // Explicit configuration provided
        sessionCount = sessionConfig.session_count;
        playersPerSession = sessionConfig.players_per_session;

        // Validate total capacity
        if (sessionCount * playersPerSession < maxPlayers) {
          clog(`⚠️ Warning: Total session capacity (${sessionCount * playersPerSession}) less than max players (${maxPlayers})`);
        }
      } else {
        // Calculate optimal distribution
        const distribution = calculateSessionDistribution(maxPlayers, gameType);
        sessionCount = distribution.recommended_sessions;
        playersPerSession = distribution.players_per_session;

        clog(`📊 Calculated distribution:`, distribution);
      }

      // Create sessions
      const createdSessions = [];
      const sessionNames = sessionConfig.session_names || [];

      for (let i = 1; i <= sessionCount; i++) {
        const sessionName = sessionNames[i - 1] || `${sessionDefaults.session_name} ${i}`;

        const sessionCreateData = {
          lobby_id: lobbyId,
          session_number: i,
          participants: [], // Empty initially
          current_state: null, // No state until started
          expires_at: null, // Will inherit from lobby when activated
          finished_at: null,
          // Session metadata in data field
          data: {
            session_name: sessionName,
            max_players: playersPerSession,
            game_type: gameType,
            created_automatically: true,
            created_by: userId,
            creation_timestamp: new Date().toISOString()
          }
        };

        const session = await models.GameSession.create(sessionCreateData, { transaction });
        createdSessions.push({
          id: session.id,
          session_number: session.session_number,
          session_name: sessionName,
          max_players: playersPerSession
        });

        clog(`✅ Created session ${session.id}: "${sessionName}" (${playersPerSession} players max)`);
      }

      clog(`✅ Created ${createdSessions.length} initial sessions for lobby ${lobbyId}`);
      return createdSessions;

    } catch (error) {
      cerror('❌ Failed to create initial sessions:', error);
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
      clog(`🔄 Setting lobby ${lobbyId} expiration to ${expires_at} by user ${userId}`);

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

      // Return updated lobby with details
      const updatedLobby = await this.getLobbyDetails(lobbyId, transaction);

      clog(`✅ Set lobby ${lobbyId} expiration to ${processed_expires_at}`);
      return updatedLobby;

    } catch (error) {
      cerror('❌ Failed to set lobby expiration:', error);
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
            where: {
              [Op.or]: [
                { expires_at: null }, // pending sessions
                {
                  expires_at: { [Op.gt]: new Date() }, // not expired
                  finished_at: null // not finished
                }
              ]
            },
            required: false,
            attributes: ['id', 'session_number', 'expires_at', 'participants', 'started_at', 'finished_at']
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

      // Format response
      const formattedLobby = {
        ...enhancedLobby,
        game: lobby.game,
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
      cerror('❌ Failed to get lobby details:', error);
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

      return this.enhanceLobbyWithStatus(lobby);

    } catch (error) {
      cerror('❌ Failed to find lobby by code:', error);
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

      // Enhance each lobby with computed status
      const enhancedLobbies = lobbies.map(lobby => this.enhanceLobbyWithStatus(lobby));

      return enhancedLobbies;

    } catch (error) {
      cerror('❌ Failed to get lobbies:', error);
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