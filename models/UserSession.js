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
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'ID of the user this session belongs to'
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
    // Each session belongs to a user
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // A user can have multiple sessions
    models.User.hasMany(UserSession, {
      foreignKey: 'user_id',
      as: 'Sessions'
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

  // Cleanup expired sessions
  UserSession.cleanupExpired = async function() {
    const now = new Date();
    const deletedCount = await this.destroy({
      where: {
        expires_at: { [sequelize.Sequelize.Op.lt]: now }
      }
    });
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

  return UserSession;
}