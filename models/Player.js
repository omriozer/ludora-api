import { DataTypes, Op } from 'sequelize';
import { generateId } from './baseModel.js';

export default function(sequelize) {
  const Player = sequelize.define('Player', {
    id: {
      type: DataTypes.STRING(13), // player_ + 6 chars = 13 total
      primaryKey: true,
      allowNull: false,
      comment: 'Unique player identifier (format: player_XXXXXX)'
    },
    privacy_code: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      comment: 'Unique privacy code for anonymous player authentication (e.g. AB3X7KM9)'
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name shown in games and to teachers'
    },
    teacher_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'Teacher who owns/manages this player'
    },
    achievements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of player achievements and badges'
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Player preferences and settings'
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether player is currently connected via SSE'
    },
    last_seen: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Last time player was active or seen online'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether player account is active (soft delete)'
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
    tableName: 'player',
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['privacy_code'],
        unique: true,
        name: 'idx_player_privacy_code'
      },
      {
        fields: ['teacher_id'],
        name: 'idx_player_teacher_id'
      },
      {
        fields: ['teacher_id', 'is_active'],
        name: 'idx_player_teacher_active'
      },
      {
        fields: ['is_online'],
        name: 'idx_player_online'
      },
      {
        fields: ['last_seen'],
        name: 'idx_player_last_seen'
      },
      {
        fields: ['teacher_id', 'is_online'],
        name: 'idx_player_teacher_online'
      },
      {
        fields: ['display_name'],
        name: 'idx_player_display_name'
      }
    ],
  });

  Player.associate = function(models) {
    // Player belongs to a teacher (who manages them)
    Player.belongsTo(models.User, {
      foreignKey: 'teacher_id',
      as: 'teacher',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Player can have multiple sessions (unified student_id approach)
    // Note: Using student_id instead of player_id due to unified architecture
    Player.hasMany(models.UserSession, {
      foreignKey: 'student_id',
      sourceKey: 'id',
      as: 'sessions'
    });
  };

  // Instance methods

  // Check if player is currently online
  Player.prototype.isOnline = function() {
    return this.is_online;
  };

  // Set player online status
  Player.prototype.setOnline = async function(isOnline = true) {
    this.is_online = isOnline;
    this.last_seen = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  // Update last seen timestamp
  Player.prototype.updateLastSeen = async function() {
    this.last_seen = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  // Get player info for API responses
  Player.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Include computed stats if needed
    return values;
  };


  // Deactivate player (soft delete)
  Player.prototype.deactivate = async function() {
    this.is_active = false;
    this.is_online = false;
    this.updated_at = new Date();
    return await this.save();
  };

  // Class methods

  // Generate unique player ID (format: player_XXXXXX)
  Player.generatePlayerId = function() {
    // Use chars excluding 0, O, I, 1 to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'player_';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate unique privacy code (8 characters, excluding confusing chars)
  Player.generatePrivacyCode = function() {
    // Use chars excluding 0, O, I, 1 to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Find player by privacy code
  Player.findByPrivacyCode = async function(privacyCode, options = {}) {
    return await this.findOne({
      where: {
        privacy_code: privacyCode.toUpperCase(),
        is_active: true
      },
      ...options
    });
  };

  // Find players by teacher
  Player.findByTeacher = async function(teacherId, options = {}) {
    return await this.findAll({
      where: {
        teacher_id: teacherId,
        is_active: true
      },
      order: [['last_seen', 'DESC']],
      ...options
    });
  };

  // Find online players by teacher
  Player.findOnlineByTeacher = async function(teacherId, options = {}) {
    return await this.findAll({
      where: {
        teacher_id: teacherId,
        is_online: true,
        is_active: true
      },
      order: [['last_seen', 'DESC']],
      ...options
    });
  };

  // Create player with unique ID and privacy code
  Player.createWithUniqueCode = async function(playerData, options = {}) {
    let playerId;
    let privacyCode;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique player ID and privacy code
    while (attempts < maxAttempts) {
      playerId = this.generatePlayerId();
      privacyCode = this.generatePrivacyCode();

      const existingId = await this.findByPk(playerId);
      const existingCode = await this.findByPrivacyCode(privacyCode);

      if (!existingId && !existingCode) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique player ID and privacy code');
    }

    return await this.create({
      ...playerData,
      id: playerId,
      privacy_code: privacyCode
    }, options);
  };

  // Clean up inactive players (older than specified days)
  Player.cleanupInactive = async function(daysInactive = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const deletedCount = await this.destroy({
      where: {
        last_seen: { [Op.lt]: cutoffDate },
        is_active: false
      }
    });

    return deletedCount;
  };

  // Set all players offline (for server restart scenarios)
  Player.setAllOffline = async function() {
    const [updatedCount] = await this.update(
      {
        is_online: false,
        updated_at: new Date()
      },
      {
        where: {
          is_online: true
        }
      }
    );

    return updatedCount;
  };

  return Player;
}