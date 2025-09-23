import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const AudioFile = sequelize.define('AudioFile', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    file_url: { type: DataTypes.STRING, allowNull: true },
    duration: { type: DataTypes.DECIMAL, allowNull: true },
    volume: { type: DataTypes.DECIMAL, allowNull: true },
    file_size: { type: DataTypes.DECIMAL, allowNull: true },
    file_type: { type: DataTypes.STRING, allowNull: true },
    is_default_for: { type: DataTypes.JSONB, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'audiofile',
  });

  AudioFile.associate = function(models) {
    // AudioFiles can be referenced by GameAudioSettings
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'opening_music', sourceKey: 'id' });
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'ending_music', sourceKey: 'id' });
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'correct_answer_sound', sourceKey: 'id' });
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'wrong_answer_sound', sourceKey: 'id' });
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'action_sound', sourceKey: 'id' });
    AudioFile.hasMany(models.GameAudioSettings, { foreignKey: 'background_music', sourceKey: 'id' });
  };

  return AudioFile;
}