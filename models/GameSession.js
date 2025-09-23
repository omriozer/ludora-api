import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameSession = sequelize.define('GameSession', {
    ...baseFields,
    user_id: { type: DataTypes.STRING, allowNull: true },
    guest_ip: { type: DataTypes.STRING, allowNull: true },
    game_id: { type: DataTypes.STRING, allowNull: true },
    game_type: { type: DataTypes.STRING, allowNull: true },
    session_start_time: { type: DataTypes.STRING, allowNull: true },
    session_end_time: { type: DataTypes.STRING, allowNull: true },
    duration_seconds: { type: DataTypes.STRING, allowNull: true },
    session_data: { type: DataTypes.STRING, allowNull: true },
    completed: { type: DataTypes.BOOLEAN, allowNull: true },
    score: { type: DataTypes.STRING, allowNull: true },
    exit_reason: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'gamesession',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['game_id'],
      },
      {
        fields: ['game_type'],
      },
    ],
  });

  GameSession.associate = function(models) {
    // Define associations here
    GameSession.belongsTo(models.User, { foreignKey: 'user_id' });
    GameSession.belongsTo(models.Game, { foreignKey: 'game_id' });
  };

  return GameSession;
}