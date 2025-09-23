import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameAudioSettings = sequelize.define('GameAudioSettings', {
    ...baseFields,
    game_type: { type: DataTypes.STRING, allowNull: true },
    opening_music: { type: DataTypes.STRING, allowNull: true },
    ending_music: { type: DataTypes.STRING, allowNull: true },
    correct_answer_sound: { type: DataTypes.STRING, allowNull: true },
    wrong_answer_sound: { type: DataTypes.STRING, allowNull: true },
    action_sound: { type: DataTypes.STRING, allowNull: true },
    background_music: { type: DataTypes.STRING, allowNull: true },
    master_volume: { type: DataTypes.DECIMAL, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'gameaudiosettings',
  });

  GameAudioSettings.associate = function(models) {
    // Define associations here
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'opening_music', as: 'OpeningMusic' });
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'ending_music', as: 'EndingMusic' });
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'correct_answer_sound', as: 'CorrectAnswerSound' });
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'wrong_answer_sound', as: 'WrongAnswerSound' });
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'action_sound', as: 'ActionSound' });
    GameAudioSettings.belongsTo(models.AudioFile, { foreignKey: 'background_music', as: 'BackgroundMusic' });
  };

  return GameAudioSettings;
}