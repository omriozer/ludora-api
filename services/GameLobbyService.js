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
        invitation_type: 'manual_selection', // 'manual_selection', 'teacher_assignment', 'random', 'order'
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
      clog(`👤 User ID type and value:`, { userId, typeof: typeof userId });

      // Step 1: Lookup lobby
      clog(`📍 Step 1: Looking up lobby ${lobbyId}...`);
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
        cerror(`❌ Lobby not found: ${lobbyId}`);
        throw new Error('Lobby not found');
      }

      clog(`✅ Lobby found:`, {
        id: lobby.id,
        owner_user_id: lobby.owner_user_id,
        host_user_id: lobby.host_user_id,
        owner_type: typeof lobby.owner_user_id,
        host_type: typeof lobby.host_user_id,
        game_type: lobby.game?.game_type,
        expires_at: lobby.expires_at,
        closed_at: lobby.closed_at
      });

      // Step 2: Check permissions with detailed logging
      clog(`📍 Step 2: Checking permissions...`);
      clog(`👤 Permission check details:`, {
        userId: userId,
        userId_type: typeof userId,
        owner_user_id: lobby.owner_user_id,
        owner_user_id_type: typeof lobby.owner_user_id,
        host_user_id: lobby.host_user_id,
        host_user_id_type: typeof lobby.host_user_id,
        owner_match: lobby.owner_user_id === userId,
        host_match: lobby.host_user_id === userId,
        owner_match_string: String(lobby.owner_user_id) === String(userId),
        host_match_string: String(lobby.host_user_id) === String(userId)
      });

      // Enhanced permission validation with comprehensive type checking
      const ownerUserId = lobby.owner_user_id;
      const hostUserId = lobby.host_user_id;

      // Validate that required fields exist (they should per model constraint)
      if (!ownerUserId || !hostUserId) {
        cerror(`❌ Data integrity issue: lobby ${lobbyId} missing required user IDs`, {
          owner_user_id: ownerUserId,
          host_user_id: hostUserId,
          owner_type: typeof ownerUserId,
          host_type: typeof hostUserId
        });
        throw new Error('Lobby data integrity error: missing owner or host user ID');
      }

      // Use string comparison for safety and handle different data types
      const userIdStr = String(userId);
      const ownerIdStr = String(ownerUserId);
      const hostIdStr = String(hostUserId);

      const isOwner = ownerIdStr === userIdStr;
      const isHost = hostIdStr === userIdStr;

      clog(`🔍 String comparison results:`, {
        userId: userIdStr,
        ownerId: ownerIdStr,
        hostId: hostIdStr,
        isOwner,
        isHost
      });

      if (!isOwner && !isHost) {
        cerror(`❌ Access denied: user ${userIdStr} is not owner (${ownerIdStr}) or host (${hostIdStr})`);
        throw new Error('Access denied: Only lobby owner or host can activate lobby');
      }

      clog(`✅ Permission check passed: isOwner=${isOwner}, isHost=${isHost}`);

      // Step 3: Import game type configuration
      clog(`📍 Step 3: Importing game type configuration...`);
      let getGameTypeConfig, getLobbyDefaults, getSessionDefaults, calculateSessionDistribution;
      try {
        const configModule = await import('../config/gameTypeDefaults.js');
        ({ getGameTypeConfig, getLobbyDefaults, getSessionDefaults, calculateSessionDistribution } = configModule);
        clog(`✅ Config module imported successfully`);
      } catch (configError) {
        cerror(`❌ Failed to import game type config:`, configError);
        throw new Error(`Configuration import failed: ${configError.message}`);
      }

      // Step 4: Get game type and configuration
      clog(`📍 Step 4: Getting game type configuration...`);
      const gameType = lobby.game?.game_type;
      if (!gameType) {
        cerror(`❌ No game type found for lobby ${lobbyId}, game:`, lobby.game);
        throw new Error('Game type not found in lobby');
      }

      clog(`🎮 Game type: ${gameType}`);

      let gameConfig, lobbyDefaults, sessionDefaults;
      try {
        gameConfig = getGameTypeConfig(gameType);
        lobbyDefaults = getLobbyDefaults(gameType);
        sessionDefaults = getSessionDefaults(gameType);
        clog(`✅ Game config loaded:`, { gameConfig, lobbyDefaults, sessionDefaults });
      } catch (gameConfigError) {
        cerror(`❌ Failed to get game type config for ${gameType}:`, gameConfigError);
        throw new Error(`Game configuration failed for ${gameType}: ${gameConfigError.message}`);
      }

      // Step 5: Calculate expiration time
      clog(`📍 Step 5: Calculating expiration time...`);
      let expires_at;
      if (activationData.expires_at) {
        expires_at = new Date(activationData.expires_at);
        clog(`⏰ Using provided expires_at: ${expires_at}`);
      } else if (activationData.duration === 'indefinite') {
        // Set to 100 years from now for indefinite
        expires_at = new Date();
        expires_at.setFullYear(expires_at.getFullYear() + 100);
        clog(`♾️ Set indefinite expiration: ${expires_at}`);
      } else if (activationData.duration) {
        // Set specific duration
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + activationData.duration);
        clog(`⏱️ Set duration ${activationData.duration} minutes, expires at: ${expires_at}`);
      } else {
        // Use default duration
        expires_at = new Date();
        expires_at.setMinutes(expires_at.getMinutes() + lobbyDefaults.session_duration_minutes);
        clog(`🔧 Using default duration ${lobbyDefaults.session_duration_minutes} minutes, expires at: ${expires_at}`);
      }

      // Step 6: Determine max players
      clog(`📍 Step 6: Determining max players...`);
      const maxPlayers = activationData.max_players || lobbyDefaults.max_players;
      clog(`👥 Max players: ${maxPlayers} (provided: ${activationData.max_players}, default: ${lobbyDefaults.max_players})`);

      // Validate max players against game type limits
      if (maxPlayers > gameConfig.lobby.max_players_max) {
        cerror(`❌ Max players validation failed: ${maxPlayers} > ${gameConfig.lobby.max_players_max} for ${gameType}`);
        throw new Error(`Max players (${maxPlayers}) exceeds limit for ${gameType} (${gameConfig.lobby.max_players_max})`);
      }

      // Step 7: Update lobby settings
      clog(`📍 Step 7: Updating lobby settings...`);
      const updatedSettings = {
        ...lobby.settings,
        max_players: maxPlayers
      };

      clog(`💾 Updating lobby with:`, { expires_at, updatedSettings, closed_at: null });

      try {
        await lobby.update({
          expires_at,
          settings: updatedSettings,
          closed_at: null // Clear manual closure when reactivating
        }, { transaction });
        clog(`✅ Lobby update completed`);
      } catch (updateError) {
        cerror(`❌ Failed to update lobby:`, updateError);
        throw new Error(`Lobby update failed: ${updateError.message}`);
      }

      // Handle session creation based on invitation_type
      const sessionConfig = activationData.session_config || {};
      const invitationType = updatedSettings.invitation_type || 'manual_selection'; // Default to manual_selection
      const autoCreateSessions = invitationType === 'teacher_assignment'; // Sessions are only pre-created for teacher assignment

      let createdSessions = [];

      // Only pre-create sessions for teacher_assignment type
      if (invitationType === 'teacher_assignment') {
        clog(`📍 Pre-creating sessions for teacher_assignment invitation type...`);
        createdSessions = await this.createInitialSessions(
          lobbyId,
          gameType,
          sessionConfig,
          maxPlayers,
          userId,
          transaction
        );
      } else {
        clog(`📍 Skipping session pre-creation for invitation_type: ${invitationType} (sessions will be created on-demand when students join)`);
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
      cerror('❌ Failed to activate lobby:', {
        lobbyId,
        userId,
        activationData,
        error: error.message,
        stack: error.stack,
        errorName: error.name
      });

      // Re-throw with more context if it's a generic error
      if (error.message === 'Validation error' || error.message.includes('Validation')) {
        throw new Error(`Lobby activation validation failed for lobby ${lobbyId}: ${error.message}`);
      }

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

      clog(`✅ Closed lobby ${lobbyId} and all its sessions with expiration set to ${now}`);
      return updatedLobby;

    } catch (error) {
      cerror('❌ Failed to close lobby:', error);
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
      clog(`🎮 Creating/managing sessions for lobby ${lobbyId}, game type: ${gameType}`);

      // Step 1: Get all existing sessions for this lobby
      clog(`📍 Step 1: Getting existing sessions for lobby ${lobbyId}...`);
      const existingSessions = await models.GameSession.findAll({
        where: { lobby_id: lobbyId },
        order: [['session_number', 'ASC']],
        transaction
      });

      clog(`📋 Found ${existingSessions.length} existing sessions:`, existingSessions.map(s => ({
        session_number: s.session_number,
        participants_count: s.participants ? s.participants.length : 0,
        finished_at: s.finished_at
      })));

      // Import session utilities
      const { getSessionDefaults, calculateSessionDistribution } = await import('../config/gameTypeDefaults.js');
      const sessionDefaults = getSessionDefaults(gameType);

      // Step 2: Determine how many sessions we need
      let requiredSessionCount, playersPerSession;

      if (sessionConfig.session_count && sessionConfig.players_per_session) {
        // Explicit configuration provided
        requiredSessionCount = sessionConfig.session_count;
        playersPerSession = sessionConfig.players_per_session;

        if (requiredSessionCount * playersPerSession < maxPlayers) {
          clog(`⚠️ Warning: Total session capacity (${requiredSessionCount * playersPerSession}) less than max players (${maxPlayers})`);
        }
      } else {
        // Calculate optimal distribution
        const distribution = calculateSessionDistribution(maxPlayers, gameType);
        requiredSessionCount = distribution.recommended_sessions;
        playersPerSession = distribution.players_per_session;

        clog(`📊 Calculated distribution:`, distribution);
      }

      clog(`🎯 Target: ${requiredSessionCount} sessions with ${playersPerSession} players each`);

      // Step 3: Reuse existing empty sessions and create new ones as needed
      const reusedSessions = [];
      const createdSessions = [];
      const sessionNames = sessionConfig.session_names || [];

      // Find empty sessions that can be reused
      const emptySessions = existingSessions.filter(session =>
        !session.participants || session.participants.length === 0
      );

      clog(`♻️ Found ${emptySessions.length} empty sessions that can be reused`);

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

        clog(`♻️ Reused session ${session.session_number}: "${sessionName}"`);
      }

      // Step 4: Create additional sessions if needed
      const sessionsNeeded = requiredSessionCount - reusedSessions.length;
      if (sessionsNeeded > 0) {
        clog(`➕ Creating ${sessionsNeeded} additional sessions...`);

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

          clog(`✅ Created new session ${session.session_number}: "${sessionName}"`);
        }
      }

      const allManagedSessions = [...reusedSessions, ...createdSessions];

      clog(`✅ Session management complete for lobby ${lobbyId}:`, {
        reused: reusedSessions.length,
        created: createdSessions.length,
        total: allManagedSessions.length,
        required: requiredSessionCount
      });

      return allManagedSessions;

    } catch (error) {
      cerror('❌ Failed to create/manage sessions:', error);
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
   * Debug method to inspect lobby data
   * @param {string} lobbyId - Lobby ID
   * @param {Object|null} transaction - Optional database transaction
   * @returns {Promise<Object>} Detailed lobby information for debugging
   */
  static async debugLobby(lobbyId, transaction = null) {
    try {
      clog(`🔍 [DEBUG] Inspecting lobby ${lobbyId}...`);

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
          }
        ],
        transaction
      });

      if (!lobby) {
        cerror(`❌ [DEBUG] Lobby ${lobbyId} not found`);
        return null;
      }

      const debugInfo = {
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
        types: {
          owner_user_id_type: typeof lobby.owner_user_id,
          host_user_id_type: typeof lobby.host_user_id,
          game_id_type: typeof lobby.game_id
        },
        associations: {
          game: lobby.game ? {
            id: lobby.game.id,
            game_type: lobby.game.game_type,
            digital: lobby.game.digital
          } : null,
          owner: lobby.owner ? {
            id: lobby.owner.id,
            full_name: lobby.owner.full_name
          } : null,
          host: lobby.host ? {
            id: lobby.host.id,
            full_name: lobby.host.full_name
          } : null
        },
        computed: {
          status: this.computeStatus(lobby),
          is_active: lobby.isActive ? lobby.isActive() : 'method_not_available'
        }
      };

      clog(`🔍 [DEBUG] Lobby ${lobbyId} details:`, debugInfo);
      return debugInfo;

    } catch (error) {
      cerror(`❌ [DEBUG] Failed to inspect lobby ${lobbyId}:`, error);
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