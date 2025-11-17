import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameLobby = sequelize.define('GameLobby', {
    ...baseFields,
    game_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'game',
        key: 'id'
      },
      comment: 'Reference to the game being played in this lobby'
    },
    owner_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'User who bought/has access to the game'
    },
    host_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'User who opened this specific lobby session'
    },
    lobby_code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true,
      comment: 'Short unique code for joining lobby (e.g., ABC123)'
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        isValidSettings(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('settings must be a valid JSON object');
          }
          // Validate invitation_type if present
          if (value.invitation_type && !['lobby_only', 'session_only', 'both'].includes(value.invitation_type)) {
            throw new Error('invitation_type must be lobby_only, session_only, or both');
          }
        }
      },
      comment: 'Lobby settings including max_players, invitation_type, game rules, etc.'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this lobby will automatically close (null = pending activation)'
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the lobby was manually closed (if applicable)'
    }
  }, {
    ...baseOptions,
    tableName: 'gamelobby',
    indexes: [
      {
        fields: ['game_id']
      },
      {
        fields: ['owner_user_id']
      },
      {
        fields: ['host_user_id']
      },
      {
        fields: ['lobby_code'],
        unique: true
      },
      {
        fields: ['expires_at']
      }
    ]
  });

  // Instance methods
  GameLobby.prototype.getSettings = function() {
    return typeof this.settings === 'string'
      ? JSON.parse(this.settings)
      : this.settings;
  };

  GameLobby.prototype.updateSettings = function(newSettings) {
    this.settings = {
      ...this.getSettings(),
      ...newSettings
    };
    return this.save();
  };

  GameLobby.prototype.computeStatus = function() {
    // Manual close takes precedence
    if (this.closed_at) return 'closed';

    // No expiration = pending activation
    if (!this.expires_at) return 'pending';

    const now = new Date();
    const expiration = new Date(this.expires_at);
    const fiftyYearsFromNow = new Date(now.getFullYear() + 50, now.getMonth(), now.getDate());

    // Past expiration = closed
    if (expiration <= now) return 'closed';

    // ~50+ years = indefinite
    if (expiration >= fiftyYearsFromNow) return 'open_indefinitely';

    // Normal future date = open
    return 'open';
  };

  GameLobby.prototype.isExpired = function() {
    if (!this.expires_at) return false; // Pending lobbies are not expired
    return new Date() > this.expires_at;
  };

  GameLobby.prototype.isActive = function() {
    const status = this.computeStatus();
    return status === 'open' || status === 'open_indefinitely';
  };

  GameLobby.prototype.canJoin = function() {
    const status = this.computeStatus();
    return status === 'open' || status === 'open_indefinitely';
  };

  GameLobby.prototype.close = function() {
    this.closed_at = new Date();
    return this.save();
  };

  GameLobby.prototype.activate = function(duration_minutes = null) {
    if (duration_minutes === 'indefinite' || duration_minutes === null) {
      // Set to 100 years from now for indefinite (will be detected as open_indefinitely)
      const indefiniteDate = new Date();
      indefiniteDate.setFullYear(indefiniteDate.getFullYear() + 100);
      this.expires_at = indefiniteDate;
    } else {
      // Set specific duration
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + duration_minutes);
      this.expires_at = expirationDate;
    }
    return this.save();
  };

  GameLobby.prototype.extend = function(duration_minutes) {
    if (!this.expires_at) {
      // If no current expiration, treat as activation
      return this.activate(duration_minutes);
    }

    const newExpiration = new Date(this.expires_at);
    newExpiration.setMinutes(newExpiration.getMinutes() + duration_minutes);
    this.expires_at = newExpiration;
    return this.save();
  };

  // Class methods
  GameLobby.findByLobbyCode = function(lobbyCode, options = {}) {
    return this.findOne({
      where: {
        lobby_code: lobbyCode,
        ...options.where
      },
      ...options
    });
  };

  GameLobby.findActiveLobbies = function(options = {}) {
    return this.findAll({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.gt]: new Date()
        },
        closed_at: null, // Not manually closed
        ...options.where
      },
      ...options
    });
  };

  GameLobby.findByGameId = function(gameId, options = {}) {
    return this.findAll({
      where: {
        game_id: gameId,
        ...options.where
      },
      ...options
    });
  };

  GameLobby.findByOwner = function(ownerId, options = {}) {
    return this.findAll({
      where: {
        owner_user_id: ownerId,
        ...options.where
      },
      ...options
    });
  };

  GameLobby.findByHost = function(hostId, options = {}) {
    return this.findAll({
      where: {
        host_user_id: hostId,
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  GameLobby.associate = function(models) {
    // Belongs to Game
    GameLobby.belongsTo(models.Game, {
      foreignKey: 'game_id',
      as: 'game',
      onDelete: 'CASCADE'
    });

    // Belongs to User (owner)
    GameLobby.belongsTo(models.User, {
      foreignKey: 'owner_user_id',
      as: 'owner',
      onDelete: 'CASCADE'
    });

    // Belongs to User (host)
    GameLobby.belongsTo(models.User, {
      foreignKey: 'host_user_id',
      as: 'host',
      onDelete: 'CASCADE'
    });

    // Has many GameSessions
    GameLobby.hasMany(models.GameSession, {
      foreignKey: 'lobby_id',
      as: 'sessions',
      onDelete: 'CASCADE'
    });
  };

  return GameLobby;
}