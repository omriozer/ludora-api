import crypto from 'crypto';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { luderror } from '../lib/ludlog.js';

class PlayerService {
  constructor() {
    // Initialize player cleanup jobs using job scheduler (not setInterval)
    // Primary cleanup happens lazily on access, this is only a safety net
    this.initializePlayerCleanupJobs();
  }

  /**
   * Initialize player cleanup jobs using the job scheduler
   * Replaces the old setInterval approach with persistent Redis-backed jobs
   */
  async initializePlayerCleanupJobs() {
    try {
      // Wait for job scheduler to be initialized (non-blocking)
      setTimeout(async () => {
        try {
          const jobScheduler = (await import('./JobScheduler.js')).default;

          if (jobScheduler.isInitialized) {
            // Schedule player safety net cleanup every 12 hours
            await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
              {
                type: 'player_safety_net',
                batchSize: 1000,
                playerCleanup: true
              },
              '0 */12 * * *', // Every 12 hours
              { priority: 50 }
            );

            console.log('PlayerService: Cleanup jobs scheduled successfully');
          }
        } catch (error) {
          console.warn('PlayerService: Failed to schedule cleanup jobs:', error.message);
          // Don't fail service startup if job scheduling fails
        }
      }, 15000); // Wait 15 seconds for job scheduler initialization
    } catch (error) {
      // Don't fail service startup if job scheduling fails
      console.warn('PlayerService: Cleanup job initialization failed:', error.message);
    }
  }

  // Player Creation and Management

  // Create a new player with unique privacy code (teacher-assigned)
  async createPlayer({ displayName, teacherId, metadata = {} }) {
    try {
      // Validate input
      if (!displayName || !displayName.trim()) {
        throw new Error('Display name is required');
      }

      if (!teacherId) {
        throw new Error('Teacher ID is required');
      }

      // Verify teacher exists and is active
      const teacher = await models.User.findByPk(teacherId);
      // Note: user_type indicates the type of user (teacher, student, parent, headmaster)
      // role indicates permission level (user, admin, sysadmin) - not the same thing!
      if (!teacher || !teacher.is_active || teacher.user_type !== 'teacher') {
        throw new Error('Invalid or inactive teacher');
      }

      // Create player with unique privacy code
      const player = await models.Player.createWithUniqueCode({
        display_name: displayName.trim(),
        teacher_id: teacherId,
        preferences: {
          created_via: 'teacher_invitation',
          ...metadata.preferences || {}
        },
        is_online: false,
        last_seen: new Date(),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        teacher_id: player.teacher_id,
        is_online: player.is_online,
        created_at: player.created_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Create an anonymous player without teacher assignment
  async createAnonymousPlayer({ displayName, metadata = {} }) {
    try {
      // Validate input
      if (!displayName || !displayName.trim()) {
        throw new Error('Display name is required');
      }

      // Create player with unique privacy code but no teacher
      const player = await models.Player.createWithUniqueCode({
        display_name: displayName.trim(),
        teacher_id: null, // Anonymous player - no teacher initially
        preferences: {
          created_via: 'anonymous_student',
          ...metadata.preferences || {}
        },
        is_online: false,
        last_seen: new Date(),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        teacher_id: player.teacher_id, // Will be null
        is_online: player.is_online,
        created_at: player.created_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Authenticate player using privacy code
  async authenticatePlayer(privacyCode, sessionMetadata = {}) {
    try {
      if (!privacyCode || typeof privacyCode !== 'string') {
        throw new Error('Privacy code is required');
      }

      // Find active player by privacy code
      const player = await models.Player.findByPrivacyCode(privacyCode.toUpperCase(), {
        include: [
          {
            model: models.User,
            as: 'teacher',
            attributes: ['id', 'full_name', 'email', 'role', 'is_active', 'invitation_code']
          }
        ]
      });

      if (!player) {
        throw new Error('Invalid privacy code or player not found');
      }

      // Verify teacher is still active (if player has a teacher)
      if (player.teacher_id && (!player.teacher || !player.teacher.is_active)) {
        throw new Error('Player\'s teacher is no longer active');
      }

      // Update player status
      await player.setOnline(true);

      // Create player session
      const sessionId = await this.createSession(player.id, {
        ...sessionMetadata,
        loginMethod: 'privacy_code'
      });

      return {
        success: true,
        sessionId,
        player: {
          id: player.id,
          privacy_code: player.privacy_code,
          display_name: player.display_name,
          teacher_id: player.teacher_id,
          teacher: player.teacher ? {
            id: player.teacher.id,
            full_name: player.teacher.full_name,
            invitation_code: player.teacher.invitation_code
          } : null,
          achievements: player.achievements,
          preferences: player.preferences,
          is_online: player.is_online,
          last_seen: player.last_seen
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get player by ID with full details
  async getPlayer(playerId, includeTeacher = true) {
    try {
      const includeOptions = [];

      if (includeTeacher) {
        includeOptions.push({
          model: models.User,
          as: 'teacher',
          attributes: ['id', 'full_name', 'email', 'role', 'invitation_code']
        });
      }

      const player = await models.Player.findByPk(playerId, {
        include: includeOptions
      });

      if (!player || !player.is_active) {
        return null;
      }

      return {
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        teacher_id: player.teacher_id,
        teacher: includeTeacher ? player.teacher : undefined,
        achievements: player.achievements,
        preferences: player.preferences,
        is_online: player.is_online,
        last_seen: player.last_seen,
        created_at: player.created_at,
        updated_at: player.updated_at
      };
    } catch (error) {

      return null;
    }
  }

  // Update player information
  async updatePlayer(playerId, updates, teacherId = null) {
    try {
      const player = await models.Player.findByPk(playerId);

      if (!player || !player.is_active) {
        throw new Error('Player not found');
      }

      // If teacherId is provided, verify ownership
      if (teacherId && player.teacher_id !== teacherId) {
        throw new Error('Access denied: You do not own this player');
      }

      // Allowed fields for update
      const allowedFields = ['display_name', 'preferences', 'achievements'];
      const updateData = {};

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updateData[key] = value;
        }
      }

      updateData.updated_at = new Date();

      await player.update(updateData);

      return await this.getPlayer(playerId);
    } catch (error) {
      throw error;
    }
  }

  // Deactivate player (soft delete)
  async deactivatePlayer(playerId, teacherId) {
    try {
      const player = await models.Player.findByPk(playerId);

      if (!player || !player.is_active) {
        throw new Error('Player not found');
      }

      // Verify teacher ownership
      if (player.teacher_id !== teacherId) {
        throw new Error('Access denied: You do not own this player');
      }

      // Invalidate all player sessions
      await this.invalidatePlayerSessions(playerId);

      // Deactivate player
      await player.deactivate();

      return {
        success: true,
        message: 'Player deactivated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get players for a teacher
  async getTeacherPlayers(teacherId, options = {}) {
    try {
      const {
        includeOffline = true,
        onlineOnly = false,
        limit = 50,
        offset = 0
      } = options;

      const where = {
        teacher_id: teacherId,
        is_active: true
      };

      if (onlineOnly) {
        where.is_online = true;
      }

      const players = await models.Player.findAll({
        where,
        limit: Math.min(limit, 1000), // Max 1000 players
        offset,
        order: [['last_seen', 'DESC'], ['created_at', 'DESC']],
        attributes: [
          'id', 'privacy_code', 'display_name', 'is_online',
          'last_seen', 'created_at', 'achievements'
        ]
      });

      return players.map(player => ({
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        is_online: player.is_online,
        last_seen: player.last_seen,
        created_at: player.created_at,
        achievements_count: player.achievements ? player.achievements.length : 0
      }));
    } catch (error) {

      return [];
    }
  }

  // Session Management

  // Create a new player session
  async createSession(playerId, metadata = {}) {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    await models.UserSession.createPlayerSession(sessionId, playerId, expiresAt, {
      userAgent: metadata.userAgent || 'Unknown',
      ipAddress: metadata.ipAddress || 'Unknown',
      loginMethod: metadata.loginMethod || 'privacy_code',
      ...metadata
    });

    return sessionId;
  }

  // Validate and refresh a player session
  async validateSession(sessionId) {
    try {
      const session = await models.UserSession.findByPk(sessionId, {
        include: [
          {
            model: models.Player,
            as: 'player',
            attributes: ['id', 'privacy_code', 'display_name', 'teacher_id', 'is_active']
          }
        ]
      });

      if (!session || !session.isPlayerSession()) {
        return null;
      }

      // Lazy cleanup: Clean expired sessions for this player only (with performance limit)
      // 10% probability to reduce overhead
      if (Math.random() < 0.1 && session.player_id) {
        await models.UserSession.destroy({
          where: {
            player_id: session.player_id,
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: 100 // Performance limit
        });
      }

      // Check if session is active
      if (!session.isActive()) {
        await session.destroy();
        return null;
      }

      // Check if player is still active
      if (!session.player || !session.player.is_active) {
        await session.invalidate();
        return null;
      }

      // Update last accessed time
      await session.updateLastAccessed();

      // Update player last seen
      await session.player.updateLastSeen();

      return {
        sessionId: session.id,
        playerId: session.player_id,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
        expiresAt: session.expires_at,
        isActive: session.is_active,
        metadata: session.metadata,
        player: {
          id: session.player.id,
          privacy_code: session.player.privacy_code,
          display_name: session.player.display_name,
          teacher_id: session.player.teacher_id
        }
      };
    } catch (error) {

      return null;
    }
  }

  // Invalidate a specific player session
  async invalidateSession(sessionId) {
    try {
      const session = await models.UserSession.findByPk(sessionId);
      if (session && session.isPlayerSession()) {
        await session.invalidate();
      }
    } catch (error) {

    }
  }

  // Invalidate all sessions for a player
  async invalidatePlayerSessions(playerId) {
    try {
      return await models.UserSession.invalidatePlayerSessions(playerId);
    } catch (error) {

      return 0;
    }
  }

  // Get active sessions for a player
  async getPlayerSessions(playerId) {
    try {
      const sessions = await models.UserSession.findPlayerActiveSessions(playerId);
      return sessions.map(session => ({
        sessionId: session.id,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
        expiresAt: session.expires_at,
        metadata: session.metadata
      }));
    } catch (error) {

      return [];
    }
  }

  // Player Status Management

  // Set player online status
  async setPlayerOnlineStatus(playerId, isOnline = true) {
    try {
      const player = await models.Player.findByPk(playerId);
      if (player && player.is_active) {
        await player.setOnline(isOnline);
        return true;
      }
      return false;
    } catch (error) {

      return false;
    }
  }

  // Get online players for a teacher
  async getOnlinePlayersForTeacher(teacherId) {
    try {
      const players = await models.Player.findOnlineByTeacher(teacherId, {
        attributes: ['id', 'privacy_code', 'display_name', 'last_seen']
      });

      return players.map(player => ({
        id: player.id,
        privacy_code: player.privacy_code,
        display_name: player.display_name,
        last_seen: player.last_seen
      }));
    } catch (error) {

      return [];
    }
  }

  // Logout player and invalidate session
  async logoutPlayer(playerId, sessionId = null) {
    try {
      // Set player offline
      await this.setPlayerOnlineStatus(playerId, false);

      if (sessionId) {
        // Invalidate specific session
        await this.invalidateSession(sessionId);
      } else {
        // Invalidate all player sessions
        await this.invalidatePlayerSessions(playerId);
      }

      return {
        success: true,
        message: 'Player logged out successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Utility Methods

  // Generate new privacy code for existing player
  async regeneratePrivacyCode(playerId, teacherId) {
    try {
      const player = await models.Player.findByPk(playerId);

      if (!player || !player.is_active) {
        throw new Error('Player not found');
      }

      // Verify teacher ownership
      if (player.teacher_id !== teacherId) {
        throw new Error('Access denied: You do not own this player');
      }

      // Generate new unique privacy code
      let newPrivacyCode;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        newPrivacyCode = models.Player.generatePrivacyCode();
        const existing = await models.Player.findByPrivacyCode(newPrivacyCode);
        if (!existing) break;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique privacy code');
      }

      // Update player with new privacy code
      await player.update({
        privacy_code: newPrivacyCode,
        updated_at: new Date()
      });

      return {
        success: true,
        privacy_code: newPrivacyCode,
        player_id: playerId
      };
    } catch (error) {
      throw error;
    }
  }

  // Cleanup Methods

  // Cleanup expired player sessions
  async cleanupExpiredSessions() {
    try {
      await models.UserSession.cleanupExpired();
    } catch (error) {
      // Silent cleanup failure
    }
  }

  // Cleanup inactive players (called periodically)
  async cleanupInactivePlayers(daysInactive = 365) {
    try {
      return await models.Player.cleanupInactive(daysInactive);
    } catch (error) {
      return 0;
    }
  }

  // Set all players offline (for server restart scenarios)
  async setAllPlayersOffline() {
    try {
      return await models.Player.setAllOffline();
    } catch (error) {
      return 0;
    }
  }

  // Statistics and Analytics

  // Get player statistics for a teacher
  async getPlayerStats(teacherId) {
    try {
      const now = new Date();

      const [totalPlayers, activePlayers, onlinePlayers, sessionsCount] = await Promise.all([
        models.Player.count({
          where: { teacher_id: teacherId, is_active: true }
        }),
        models.Player.count({
          where: {
            teacher_id: teacherId,
            is_active: true,
            last_seen: { [models.Sequelize.Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } // Active in last 30 days
          }
        }),
        models.Player.count({
          where: { teacher_id: teacherId, is_online: true, is_active: true }
        }),
        models.UserSession.count({
          include: [{
            model: models.Player,
            as: 'player',
            where: { teacher_id: teacherId }
          }],
          where: {
            is_active: true,
            expires_at: { [models.Sequelize.Op.gt]: now }
          }
        })
      ]);

      return {
        totalPlayers,
        activePlayers,
        onlinePlayers,
        activeSessionsCount: sessionsCount,
        averageSessionsPerPlayer: activePlayers > 0 ? sessionsCount / activePlayers : 0,
        timestamp: now
      };
    } catch (error) {

      return {
        totalPlayers: 0,
        activePlayers: 0,
        onlinePlayers: 0,
        activeSessionsCount: 0,
        averageSessionsPerPlayer: 0,
        timestamp: new Date()
      };
    }
  }

  // Assign teacher to an anonymous player (when they enter teacher catalog)
  async assignTeacherToPlayer(playerId, teacherId) {
    try {
      const player = await models.Player.findByPk(playerId, {
        include: [
          {
            model: models.User,
            as: 'teacher',
            attributes: ['id', 'full_name', 'email', 'role', 'invitation_code']
          }
        ]
      });

      if (!player || !player.is_active) {
        throw new Error('Player not found');
      }

      // Check if player already has a teacher
      if (player.teacher_id) {
        throw new Error('Player already assigned to a teacher');
      }

      // Verify new teacher exists and is active
      const teacher = await models.User.findByPk(teacherId);
      // Note: user_type indicates the type of user (teacher, student, parent, headmaster)
      // role indicates permission level (user, admin, sysadmin) - not the same thing!
      if (!teacher || !teacher.is_active || teacher.user_type !== 'teacher') {
        throw new Error('Invalid or inactive teacher');
      }

      // Assign teacher to player
      await player.update({
        teacher_id: teacherId,
        updated_at: new Date(),
        preferences: {
          ...player.preferences,
          teacher_assigned_at: new Date(),
          created_via: 'anonymous_then_assigned'
        }
      });

      return {
        success: true,
        message: 'Teacher assigned to player successfully',
        player_id: playerId,
        teacher_id: teacherId,
        teacher: {
          id: teacher.id,
          full_name: teacher.full_name
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Associate player with user account (for future migration)
  async associateWithUser(playerId, userId, teacherId) {
    try {
      const player = await models.Player.findByPk(playerId);

      if (!player || !player.is_active) {
        throw new Error('Player not found');
      }

      // Verify teacher ownership
      if (player.teacher_id !== teacherId) {
        throw new Error('Access denied: You do not own this player');
      }

      // Verify user exists and is active
      const user = await models.User.findByPk(userId);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Associate player with user
      await player.associateWithUser(userId);

      return {
        success: true,
        message: 'Player associated with user successfully',
        player_id: playerId,
        user_id: userId
      };
    } catch (error) {
      throw error;
    }
  }

  // 12-hour safety net cleanup (not a frequent cleanup)
  // This only runs as a safety net - primary cleanup is lazy on access
  async safetyNetCleanup() {
    try {
      // Clean expired player sessions with batch limit
      const deletedSessions = await models.UserSession.destroy({
        where: {
          player_id: { [models.Sequelize.Op.ne]: null }, // Only player sessions
          expires_at: { [models.Sequelize.Op.lt]: new Date() }
        },
        limit: 1000 // Batch limit to prevent blocking
      });

      // Clean inactive players (365 days) with batch limit
      const inactiveCutoff = new Date();
      inactiveCutoff.setDate(inactiveCutoff.getDate() - 365);

      const deletedPlayers = await models.Player.destroy({
        where: {
          last_seen: { [models.Sequelize.Op.lt]: inactiveCutoff },
          is_active: false
        },
        limit: 100 // Lower limit for player cleanup
      });

      if (deletedSessions > 0 || deletedPlayers > 0) {

      }
    } catch (error) {
      // Silent failure for safety net cleanup

    }
  }
}

export default PlayerService;