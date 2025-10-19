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
    // No associations currently defined
  };

  return AudioFile;
}