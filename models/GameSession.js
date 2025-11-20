import { DataTypes } from 'sequelize';
import { baseOptions } from './baseModel.js';
import { nowInIsrael, isExpired } from '../utils/dateUtils.js';

export default function(sequelize) {
  const GameSession = sequelize.define('GameSession', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      comment: 'UUID primary key for game session'
    },
    lobby_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'gamelobby',
        key: 'id'
      },
      comment: 'Reference to the game lobby this session belongs to'
    },
    session_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      },
      comment: 'Sequential number of this session within the lobby (1, 2, 3...)'
    },
    participants: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidParticipants(value) {
          if (!Array.isArray(value)) {
            throw new Error('participants must be an array');
          }
          // Validate each participant object
          for (const participant of value) {
            if (typeof participant !== 'object' || participant === null) {
              throw new Error('Each participant must be an object');
            }
            if (!participant.id || !participant.display_name) {
              throw new Error('Each participant must have id and display_name');
            }
            if (typeof participant.isAuthedUser !== 'boolean') {
              throw new Error('Each participant must have isAuthedUser boolean');
            }
          }
        }
      },
      comment: 'Array of participant objects with id, isAuthedUser, display_name, user_id?, guest_token?, team_assignment?, joined_at'
    },
    current_state: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Current live game state while the game is active'
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Final results, scores, winners, and detailed game data when completed'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this session expires (inherits from lobby or independent)'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When this game session started'
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this game session finished (null if still active)'
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
    }
  }, {
    ...baseOptions,
    tableName: 'gamesession',
    indexes: [
      {
        fields: ['lobby_id']
      },
      {
        fields: ['lobby_id', 'session_number'],
        unique: true
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['started_at']
      },
      {
        fields: ['finished_at']
      }
    ]
  });

  // Instance methods
  GameSession.prototype.getParticipants = function() {
    return Array.isArray(this.participants) ? this.participants : [];
  };

  GameSession.prototype.addParticipant = function(participant) {
    const participants = this.getParticipants();
    // Check if participant already exists
    const existingIndex = participants.findIndex(p => p.id === participant.id);
    if (existingIndex >= 0) {
      // Update existing participant
      participants[existingIndex] = { ...participants[existingIndex], ...participant };
    } else {
      // Add new participant
      participants.push(participant);
    }
    this.participants = participants;
    return this.save();
  };

  GameSession.prototype.removeParticipant = function(participantId) {
    const participants = this.getParticipants();
    this.participants = participants.filter(p => p.id !== participantId);
    return this.save();
  };

  GameSession.prototype.updateGameState = function(newState) {
    this.current_state = {
      ...this.current_state,
      ...newState
    };
    return this.save();
  };

  GameSession.prototype.computeStatus = function() {
    // Manual finish takes precedence
    if (this.finished_at) return 'closed';

    // No expiration = pending activation
    if (!this.expires_at) return 'pending';

    const now = nowInIsrael();
    const expiration = new Date(this.expires_at);
    const fiftyYearsFromNow = new Date(now.getFullYear() + 50, now.getMonth(), now.getDate());

    // Past expiration = closed (using Israel timezone)
    if (expiration <= now) return 'closed';

    // ~50+ years = indefinite
    if (expiration >= fiftyYearsFromNow) return 'open_indefinitely';

    // Normal future date = open
    return 'open';
  };

  GameSession.prototype.finishGame = function(finalData) {
    this.finished_at = nowInIsrael();
    this.data = finalData;
    this.current_state = null; // Clear current state when finished
    return this.save();
  };

  GameSession.prototype.isActive = function() {
    const status = this.computeStatus();
    return (status === 'open' || status === 'open_indefinitely') && !this.finished_at;
  };

  GameSession.prototype.isExpired = function() {
    if (!this.expires_at) return false; // Pending sessions are not expired
    return isExpired(this.expires_at);
  };

  GameSession.prototype.inheritLobbyExpiration = async function(models) {
    const lobby = await models.GameLobby.findByPk(this.lobby_id);
    if (lobby && lobby.expires_at) {
      this.expires_at = lobby.expires_at;
      return this.save();
    }
    return this;
  };

  GameSession.prototype.activate = function(duration_minutes = null) {
    if (duration_minutes === 'indefinite' || duration_minutes === null) {
      // Set to 100 years from now for indefinite (will be detected as open_indefinitely)
      const indefiniteDate = nowInIsrael();
      indefiniteDate.setFullYear(indefiniteDate.getFullYear() + 100);
      this.expires_at = indefiniteDate;
    } else {
      // Set specific duration (using Israel timezone)
      const expirationDate = nowInIsrael();
      expirationDate.setMinutes(expirationDate.getMinutes() + duration_minutes);
      this.expires_at = expirationDate;
    }
    return this.save();
  };

  GameSession.prototype.getDuration = function() {
    const endTime = this.finished_at || nowInIsrael();
    return endTime - this.started_at;
  };

  GameSession.prototype.canDelete = function() {
    // Only allow deletion if session never had participants
    return !this.participants || this.participants.length === 0;
  };

  GameSession.prototype.computeStatusWithLobby = function(lobby) {
    // Hierarchical expiration: lobby expires_at overrides session expires_at
    //
    // Business Rule: lobby.expires_at is stronger than session.expires_at
    // - If lobby expired → session must be expired (regardless of session.expires_at)
    // - If lobby active → session follows its own expiration logic
    // - Lobby can stay active longer than session, but not the other way around

    // If lobby is manually closed, session is closed
    if (lobby.closed_at) return 'closed';

    // If lobby expired, session must be expired regardless of its own expiration
    if (lobby.expires_at && lobby.expires_at <= nowInIsrael()) {
      return 'closed';
    }

    // If lobby has no expiration (pending), session follows its own expiration logic
    if (!lobby.expires_at) {
      return this.computeStatus();
    }

    // Lobby is active, check session's own expiration
    return this.computeStatus();
  };

  // Class methods
  GameSession.findByLobby = function(lobbyId, options = {}) {
    return this.findAll({
      where: {
        lobby_id: lobbyId,
        ...options.where
      },
      order: [['session_number', 'ASC']],
      ...options
    });
  };

  GameSession.findActiveSessions = function(options = {}) {
    return this.findAll({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.gt]: nowInIsrael()
        },
        finished_at: null,
        ...options.where
      },
      include: [
        {
          model: sequelize.models.GameLobby,
          as: 'lobby',
          where: {
            // Include lobby expiration in the query
            [sequelize.Sequelize.Op.or]: [
              { expires_at: null }, // pending lobbies
              { expires_at: { [sequelize.Sequelize.Op.gt]: nowInIsrael() } }, // not expired lobbies (Israel timezone)
            ],
            closed_at: null // not manually closed
          }
        }
      ],
      ...options
    });
  };

  GameSession.findByParticipant = function(participantId, options = {}) {
    return this.findAll({
      where: {
        participants: {
          [sequelize.Sequelize.Op.contains]: [{ id: participantId }]
        },
        ...options.where
      },
      ...options
    });
  };

  GameSession.getNextSessionNumber = async function(lobbyId) {
    const lastSession = await this.findOne({
      where: { lobby_id: lobbyId },
      order: [['session_number', 'DESC']],
      attributes: ['session_number']
    });
    return (lastSession?.session_number || 0) + 1;
  };

  // Define associations
  GameSession.associate = function(models) {
    // Belongs to GameLobby
    GameSession.belongsTo(models.GameLobby, {
      foreignKey: 'lobby_id',
      as: 'lobby',
      onDelete: 'CASCADE'
    });
  };

  return GameSession;
}