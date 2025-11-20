import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique identifier for the refresh token'
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'ID of the user this refresh token belongs to'
    },
    token_hash: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'SHA256 hash of the refresh token for security'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When this refresh token expires'
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this token was manually revoked (soft delete)'
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this token was last used to refresh access token'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional metadata like user agent, IP, device info'
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
    tableName: 'refresh_token',
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_refresh_token_user_id'
      },
      {
        fields: ['expires_at'],
        name: 'idx_refresh_token_expires_at'
      },
      {
        fields: ['token_hash'],
        name: 'idx_refresh_token_hash',
        unique: true
      },
      {
        fields: ['revoked_at'],
        name: 'idx_refresh_token_revoked_at'
      },
      {
        fields: ['user_id', 'revoked_at'],
        name: 'idx_refresh_token_user_active'
      }
    ],
  });

  RefreshToken.associate = function(models) {
    // Each refresh token belongs to a user
    RefreshToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  RefreshToken.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Remove sensitive token hash from JSON output for security
    delete values.token_hash;
    return values;
  };

  // Check if token is expired
  RefreshToken.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  // Check if token is revoked
  RefreshToken.prototype.isRevoked = function() {
    return this.revoked_at !== null;
  };

  // Check if token is active (not expired and not revoked)
  RefreshToken.prototype.isActive = function() {
    return !this.isExpired() && !this.isRevoked();
  };

  // Revoke this token (soft delete)
  RefreshToken.prototype.revoke = async function() {
    this.revoked_at = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  // Update last used timestamp
  RefreshToken.prototype.updateLastUsed = async function() {
    this.last_used_at = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  return RefreshToken;
}