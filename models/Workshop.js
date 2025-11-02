import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

export default function(sequelize) {
  const Workshop = sequelize.define('Workshop', {
    ...baseFields,
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Workshop marketing image URL or placeholder'
    },
    image_is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether the image requires authentication to access'
    },
    // Standardized video fields (added in migration 20251031000001)
    has_video: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Clear boolean indicator for content video existence'
    },
    video_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Standardized video filename storage (replaces video_file_url)'
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    target_audience: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    access_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_lifetime_access: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    // Workshop-specific fields
    workshop_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'recorded',
      validate: {
        isIn: [['recorded', 'online_live']]
      }
    },
    video_file_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'DEPRECATED: Use has_video and video_filename instead. Kept for backward compatibility.'
    },
    scheduled_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meeting_link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meeting_password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meeting_platform: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['zoom', 'google_meet', 'teams', 'other']]
      }
    },
    max_participants: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    ...baseOptions,
    tableName: 'workshop',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
      {
        fields: ['workshop_type'],
      },
    ],
  });

  Workshop.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  // Video reference standardization methods
  Workshop.prototype.hasVideoAsset = function() {
    // Use standardized field if available, fallback to legacy pattern
    if (this.has_video !== undefined) {
      return this.has_video;
    }
    // Legacy fallback
    return !!(this.video_file_url && this.video_file_url !== '');
  };

  Workshop.prototype.getVideoFilename = function() {
    // Use standardized field if available
    if (this.video_filename) {
      return this.video_filename;
    }
    // Legacy fallback - check for video_file_url
    if (this.video_file_url && this.video_file_url !== '') {
      DeprecationWarnings.warnDirectUrlStorage('workshop', 'video_file_url', {
        workshopId: this.id,
        videoFileUrl: this.video_file_url,
        location: 'Workshop.getVideoFilename'
      });
      return 'video.mp4'; // Standard filename for legacy videos
    }
    return null;
  };

  Workshop.prototype.getVideoUrl = function() {
    // For backward compatibility during transition period
    if (this.hasVideoAsset()) {
      const filename = this.getVideoFilename();
      if (filename) {
        // Return the standardized path structure
        return `/api/media/stream/workshop/${this.id}`;
      }
    }
    return null;
  };

  // Legacy compatibility method with deprecation warning
  Workshop.prototype.getVideoFileUrl = function() {
    if (this.video_file_url) {
      DeprecationWarnings.warnDirectUrlStorage('workshop', 'video_file_url', {
        workshopId: this.id,
        videoFileUrl: this.video_file_url,
        location: 'Workshop.getVideoFileUrl'
      });
    }
    return this.getVideoUrl();
  };

  return Workshop;
}