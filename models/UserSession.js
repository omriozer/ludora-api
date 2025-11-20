import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const UserSession = sequelize.define('UserSession', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique session identifier'
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: true, // Now nullable to support player sessions
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'ID of the user this session belongs to (null for player sessions)'
    },
    player_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'player',
        key: 'id'
      },
      comment: 'ID of the player this session belongs to (null for user sessions)'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When this session expires'
    },
    last_accessed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When this session was last accessed'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this session is active'
    },
    invalidated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this session was manually invalidated'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Session metadata like user agent, IP, login method'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'user_session',
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_user_session_user_id'
      },
      {
        fields: ['expires_at'],
        name: 'idx_user_session_expires_at'
      },
      {
        fields: ['is_active'],
        name: 'idx_user_session_is_active'
      },
      {
        fields: ['last_accessed_at'],
        name: 'idx_user_session_last_accessed'
      },
      {
        fields: ['user_id', 'is_active'],
        name: 'idx_user_session_user_active'
      },
      {
        fields: ['user_id', 'expires_at'],
        name: 'idx_user_session_user_expires'
      }
    ],
  });

  UserSession.associate = function(models) {
    // Each session can belong to a user (nullable)
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Each session can belong to a player (nullable)
    UserSession.belongsTo(models.Player, {
      foreignKey: 'player_id',
      as: 'player',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // A user can have multiple sessions
    models.User.hasMany(UserSession, {
      foreignKey: 'user_id',
      as: 'sessions'
    });

    // A player can have multiple sessions (defined in Player model)
  };

  // Instance methods

  // Check if session is expired
  UserSession.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  // Check if session is manually invalidated
  UserSession.prototype.isInvalidated = function() {
    return this.invalidated_at !== null;
  };

  // Check if session is active (not expired, not invalidated, and is_active flag is true)
  UserSession.prototype.isActive = function() {
    return this.is_active && !this.isExpired() && !this.isInvalidated();
  };

  // Invalidate this session (soft delete)
  UserSession.prototype.invalidate = async function() {
    this.is_active = false;
    this.invalidated_at = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  // Update last accessed timestamp and extend session if needed
  UserSession.prototype.updateLastAccessed = async function() {
    this.last_accessed_at = new Date();
    this.updated_at = new Date();

    // ✅ FIXED: Auto-extend if session expires within 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (this.expires_at < twoHoursFromNow) {
      this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
      console.log(`[UserSession] Auto-extended session ${this.id} for ${this.getSessionType()} ${this.getEntityId()}`);
    }

    return await this.save();
  };

  // Extend session expiration (for remember me functionality)
  UserSession.prototype.extendExpiration = async function(additionalHours = 24) {
    const now = new Date();
    this.expires_at = new Date(now.getTime() + (additionalHours * 60 * 60 * 1000));
    this.updated_at = now;
    return await this.save();
  };

  // Get session info without sensitive data
  UserSession.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Remove or mask sensitive metadata if needed
    return values;
  };

  // Check if this is a user session
  UserSession.prototype.isUserSession = function() {
    return this.user_id !== null && this.player_id === null;
  };

  // Check if this is a player session
  UserSession.prototype.isPlayerSession = function() {
    return this.player_id !== null && this.user_id === null;
  };

  // Get session type
  UserSession.prototype.getSessionType = function() {
    if (this.isUserSession()) return 'user';
    if (this.isPlayerSession()) return 'player';
    return 'unknown';
  };

  // Get the entity ID (user_id or player_id)
  UserSession.prototype.getEntityId = function() {
    return this.user_id || this.player_id;
  };

  // Get session entity with associations
  UserSession.prototype.getEntity = async function() {
    if (this.isUserSession()) {
      return await this.getUser();
    } else if (this.isPlayerSession()) {
      return await this.getPlayer();
    }
    return null;
  };

  // Class methods

  // Find active session by ID
  UserSession.findActiveSession = async function(sessionId) {
    const session = await this.findByPk(sessionId);
    if (!session || !session.isActive()) {
      return null;
    }
    return session;
  };

  // Find all active sessions for a user
  UserSession.findUserActiveSessions = async function(userId) {
    const now = new Date();
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: { [sequelize.Sequelize.Op.gt]: now },
        invalidated_at: null
      },
      order: [['last_accessed_at', 'DESC']]
    });
  };

  // Cleanup expired sessions with grace period for recently accessed sessions
  UserSession.cleanupExpired = async function() {
    const now = new Date();
    // ✅ FIXED: Add 2-hour grace period - only delete sessions inactive for 2+ hours
    const gracePeriodAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const deletedCount = await this.destroy({
      where: {
        [sequelize.Sequelize.Op.and]: [
          { expires_at: { [sequelize.Sequelize.Op.lt]: now } },
          { last_accessed_at: { [sequelize.Sequelize.Op.lt]: gracePeriodAgo } }
        ]
      }
    });

    console.log(`[UserSession] Cleanup: Deleted ${deletedCount} expired sessions (with 2-hour grace period)`);
    return deletedCount;
  };

  // Invalidate all sessions for a user
  UserSession.invalidateUserSessions = async function(userId, exceptSessionId = null) {
    const where = {
      user_id: userId,
      is_active: true,
      invalidated_at: null
    };

    if (exceptSessionId) {
      where.id = { [sequelize.Sequelize.Op.ne]: exceptSessionId };
    }

    const [updatedCount] = await this.update(
      {
        is_active: false,
        invalidated_at: new Date(),
        updated_at: new Date()
      },
      { where }
    );

    return updatedCount;
  };

  // Find all active sessions for a player
  UserSession.findPlayerActiveSessions = async function(playerId) {
    const now = new Date();
    return await this.findAll({
      where: {
        player_id: playerId,
        is_active: true,
        expires_at: { [sequelize.Sequelize.Op.gt]: now },
        invalidated_at: null
      },
      order: [['last_accessed_at', 'DESC']]
    });
  };

  // Invalidate all sessions for a player
  UserSession.invalidatePlayerSessions = async function(playerId, exceptSessionId = null) {
    const where = {
      player_id: playerId,
      is_active: true,
      invalidated_at: null
    };

    if (exceptSessionId) {
      where.id = { [sequelize.Sequelize.Op.ne]: exceptSessionId };
    }

    const [updatedCount] = await this.update(
      {
        is_active: false,
        invalidated_at: new Date(),
        updated_at: new Date()
      },
      { where }
    );

    return updatedCount;
  };

  // Create user session
  UserSession.createUserSession = async function(sessionId, userId, expiresAt, metadata = {}) {
    return await this.create({
      id: sessionId,
      user_id: userId,
      player_id: null,
      expires_at: expiresAt,
      metadata: metadata,
      is_active: true,
      last_accessed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  };

  // Create player session
  UserSession.createPlayerSession = async function(sessionId, playerId, expiresAt, metadata = {}) {
    return await this.create({
      id: sessionId,
      user_id: null,
      player_id: playerId,
      expires_at: expiresAt,
      metadata: metadata,
      is_active: true,
      last_accessed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  };

  // Find session with entity (user or player) included
  UserSession.findSessionWithEntity = async function(sessionId) {
    return await this.findByPk(sessionId, {
      include: [
        { model: sequelize.models.User, as: 'user' },
        { model: sequelize.models.Player, as: 'player' }
      ]
    });
  };

  // Find active sessions for entity (user or player)
  UserSession.findEntityActiveSessions = async function(entityType, entityId) {
    if (entityType === 'user') {
      return await this.findUserActiveSessions(entityId);
    } else if (entityType === 'player') {
      return await this.findPlayerActiveSessions(entityId);
    }
    return [];
  };

  // Invalidate all sessions for entity (user or player)
  UserSession.invalidateEntitySessions = async function(entityType, entityId, exceptSessionId = null) {
    if (entityType === 'user') {
      return await this.invalidateUserSessions(entityId, exceptSessionId);
    } else if (entityType === 'player') {
      return await this.invalidatePlayerSessions(entityId, exceptSessionId);
    }
    return 0;
  };

  return UserSession;
}