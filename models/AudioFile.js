import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

export default function(sequelize) {
  const AudioFile = sequelize.define('AudioFile', {
    ...baseFields,
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Display name for the audio file'
    },
    file_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'DEPRECATED: Use has_file and file_filename instead. Kept for backward compatibility.'
    },
    has_file: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Clear boolean indicator for audio file existence'
    },
    file_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Standardized audio filename storage (replaces file_url)'
    },
    duration: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      comment: 'Duration of the audio file in seconds'
    },
    volume: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      comment: 'Default volume level (0.0 to 1.0)'
    },
    file_size: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      comment: 'File size in bytes'
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'MIME type of the audio file'
    },
    is_default_for: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuration for which contexts this audio file is the default'
    },
  }, {
    ...baseOptions,
    tableName: 'audiofile',
    indexes: [
      {
        fields: ['has_file'],
        name: 'idx_audiofile_has_file'
      },
      {
        fields: ['file_filename'],
        name: 'idx_audiofile_file_filename'
      },
      {
        fields: ['file_type'],
        name: 'idx_audiofile_file_type'
      },
      {
        fields: ['created_at'],
        name: 'idx_audiofile_created_at'
      }
    ]
  });

  AudioFile.associate = function(models) {
    // No associations currently defined
  };

  // File reference standardization methods
  AudioFile.prototype.hasFileAsset = function() {
    // Use standardized field if available, fallback to legacy pattern
    if (this.has_file !== undefined) {
      return this.has_file;
    }
    // Legacy fallback
    return !!(this.file_url && this.file_url !== '');
  };

  AudioFile.prototype.getAudioFilename = function() {
    // Use standardized field if available
    if (this.file_filename) {
      return this.file_filename;
    }
    // Legacy fallback - extract filename from URL
    if (this.file_url && this.file_url.includes('/')) {
      DeprecationWarnings.warnDirectUrlStorage('audiofile', 'file_url', {
        audioFileId: this.id,
        fileUrl: this.file_url,
        location: 'AudioFile.getAudioFilename'
      });
      const parts = this.file_url.split('/');
      return parts[parts.length - 1] || 'audio.mp3';
    }
    return null;
  };

  AudioFile.prototype.getAudioUrl = function() {
    // For backward compatibility during transition period
    if (this.hasFileAsset()) {
      const filename = this.getAudioFilename();
      if (filename) {
        // Return the standardized path structure
        return `/api/media/stream/audiofile/${this.id}`;
      }
    }
    return null;
  };

  // Legacy compatibility method with deprecation warning
  AudioFile.prototype.getLegacyFileUrl = function() {
    if (this.file_url) {
      DeprecationWarnings.warnDirectUrlStorage('audiofile', 'file_url', {
        audioFileId: this.id,
        fileUrl: this.file_url,
        location: 'AudioFile.getLegacyFileUrl'
      });
    }
    return this.getAudioUrl();
  };

  // Audio-specific utility methods
  AudioFile.prototype.getDurationFormatted = function() {
    if (!this.duration) return '0:00';

    const totalSeconds = Math.floor(this.duration);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  AudioFile.prototype.getFileSizeFormatted = function() {
    if (!this.file_size) return '0 B';

    const bytes = this.file_size;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return AudioFile;
}