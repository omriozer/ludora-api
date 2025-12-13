import { DataTypes, Op } from 'sequelize';

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
      allowNull: false, // Required for unified User system
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'ID of the user this session belongs to (unified system for all user types)'
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
    portal: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'teacher',
      comment: 'Portal context where this session was created (teacher or student)'
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
      },
      {
        fields: ['portal'],
        name: 'idx_user_session_portal'
      },
      {
        fields: ['portal', 'user_id'],
        name: 'idx_user_session_portal_user'
      },
      {
        fields: ['portal', 'is_active'],
        name: 'idx_user_session_portal_active'
      }
    ],
  });

  UserSession.associate = function(models) {
    // Each session belongs to a user (required for unified system)
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // A user can have multiple sessions
    models.User.hasMany(UserSession, {
      foreignKey: 'user_id',
      as: 'UserSessions'
    });
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

  // Get the user ID (unified system)
  UserSession.prototype.getUserId = function() {
    return this.user_id;
  };

  // Get session entity (always a User in unified system)
  UserSession.prototype.getUser = async function() {
    return await this.User || await this.constructor.sequelize.models.User.findByPk(this.user_id);
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
  UserSession.findActiveSessions = async function(userId) {
    const now = new Date();
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: { [Op.gt]: now },
        invalidated_at: null
      },
      order: [['last_accessed_at', 'DESC']]
    });
  };

  // Backward compatibility alias
  UserSession.findUserActiveSessions = UserSession.findActiveSessions;

  // Cleanup expired sessions with grace period for recently accessed sessions
  UserSession.cleanupExpired = async function() {
    const now = new Date();
    // ✅ FIX: Extended grace period to 7 days to match JWT refresh token lifetime
    // This prevents aggressive cleanup of sessions that might still have valid JWT tokens
    const gracePeriodAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const deletedCount = await this.destroy({
      where: {
        [Op.and]: [
          { expires_at: { [Op.lt]: now } },
          { last_accessed_at: { [Op.lt]: gracePeriodAgo } }
        ]
      }
    });

    return deletedCount;
  };

  // Invalidate all sessions for a user
  UserSession.invalidateSessions = async function(userId, exceptSessionId = null) {
    const where = {
      user_id: userId,
      is_active: true,
      invalidated_at: null
    };

    if (exceptSessionId) {
      where.id = { [Op.ne]: exceptSessionId };
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

  // Backward compatibility alias
  UserSession.invalidateUserSessions = UserSession.invalidateSessions;


  // Create session (unified for all user types)
  UserSession.createSession = async function(sessionId, userId, expiresAt, metadata = {}, portal = 'teacher') {
    return await this.create({
      id: sessionId,
      user_id: userId,
      portal: portal,
      expires_at: expiresAt,
      metadata: metadata,
      is_active: true,
      last_accessed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  };

  // Backward compatibility alias
  UserSession.createUserSession = UserSession.createSession;


  // Deployment-safe session extension - called during server startup
  // ✅ FIX: Extended ALL active sessions to prevent deployment logouts
  UserSession.extendRecentlyActiveSessions = async function() {
    const now = new Date();

    // ✅ MUCH MORE INCLUSIVE: Find ALL active sessions, regardless of last_accessed_at
    // The goal is to prevent deployment-induced logouts, so we should be generous
    const sessionsToExtend = await this.findAll({
      where: {
        is_active: true,
        invalidated_at: null,
        // Remove time restrictions - extend ALL active sessions
        // If a session is active and not manually invalidated, keep it alive
      }
    });

    const [extendedCount] = await this.update(
      {
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Extend to 24 hours from now
        last_accessed_at: now, // Mark as recently accessed to prevent cleanup
        updated_at: now
      },
      {
        where: {
          id: { [Op.in]: sessionsToExtend.map(s => s.id) }
        }
      }
    );

    return extendedCount[0];
  };

  // Portal-aware session management methods

  // Find active sessions for a user in a specific portal
  UserSession.findUserActiveSessionsByPortal = async function(userId, portal) {
    const now = new Date();
    return await this.findAll({
      where: {
        user_id: userId,
        portal: portal,
        is_active: true,
        expires_at: { [Op.gt]: now },
        invalidated_at: null
      },
      order: [['last_accessed_at', 'DESC']]
    });
  };

  // REMOVED: findPlayerActiveSessionsByPortal - use findUserActiveSessionsByPortal instead
  // Players are now users with user_type: 'player'

  // Invalidate all sessions for a user in a specific portal
  UserSession.invalidateUserSessionsByPortal = async function(userId, portal, exceptSessionId = null) {
    const where = {
      user_id: userId,
      portal: portal,
      is_active: true,
      invalidated_at: null
    };

    if (exceptSessionId) {
      where.id = { [Op.ne]: exceptSessionId };
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

  // Check if user has active sessions in a specific portal
  UserSession.hasActivePortalSession = async function(userId, portal) {
    const count = await this.count({
      where: {
        user_id: userId,
        portal: portal,
        is_active: true,
        expires_at: { [Op.gt]: new Date() },
        invalidated_at: null
      }
    });
    return count > 0;
  };

  // Get portal from session
  UserSession.prototype.getPortal = function() {
    return this.portal || 'teacher'; // Fallback to teacher for existing sessions
  };

  // Check if session belongs to a specific portal
  UserSession.prototype.isPortalSession = function(portal) {
    return this.getPortal() === portal;
  };

  // Find session with user included (unified system)
  UserSession.findSessionWithEntity = async function(sessionId) {
    return await this.findByPk(sessionId, {
      include: [
        { model: sequelize.models.User, as: 'User' }
      ]
    });
  };

  // Find active sessions for entity (unified User system)
  UserSession.findEntityActiveSessions = async function(entityType, entityId) {
    if (entityType === 'user' || entityType === 'player') {
      return await this.findActiveSessions(entityId);
    }
    return [];
  };

  // Invalidate all sessions for entity (unified User system)
  UserSession.invalidateEntitySessions = async function(entityType, entityId, exceptSessionId = null) {
    if (entityType === 'user' || entityType === 'player') {
      return await this.invalidateSessions(entityId, exceptSessionId);
    }
    return 0;
  };

  return UserSession;
}