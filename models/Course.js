import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

export default function(sequelize) {
  const Course = sequelize.define('Course', {
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
      comment: 'Course marketing image URL or placeholder'
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
      comment: 'Standardized video filename storage for course content'
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
    // Course-specific fields
    course_modules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    total_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    ...baseOptions,
    tableName: 'course',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
    ],
  });

  Course.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  // Video reference standardization methods
  Course.prototype.hasVideoAsset = function() {
    // Use standardized field if available
    if (this.has_video !== undefined) {
      return this.has_video;
    }
    // Note: Course entities don't have legacy video_file_url field
    // Videos are stored in course_modules JSONB structure
    return false;
  };

  Course.prototype.getVideoFilename = function() {
    // Use standardized field if available
    if (this.video_filename) {
      return this.video_filename;
    }
    // Note: Course content videos are typically in modules, not main entity
    return null;
  };

  Course.prototype.getVideoUrl = function() {
    // For backward compatibility during transition period
    if (this.hasVideoAsset()) {
      const filename = this.getVideoFilename();
      if (filename) {
        // Return the standardized path structure
        return `/api/media/stream/course/${this.id}`;
      }
    }
    return null;
  };

  // Course module video analysis helper
  Course.prototype.getModuleVideoCount = function() {
    if (!this.course_modules || !Array.isArray(this.course_modules)) {
      return 0;
    }

    let videoCount = 0;
    this.course_modules.forEach(module => {
      if (module.lessons && Array.isArray(module.lessons)) {
        module.lessons.forEach(lesson => {
          if (lesson.video_url || lesson.video_filename) {
            videoCount++;
          }
        });
      }
    });

    return videoCount;
  };

  Course.prototype.hasModuleVideos = function() {
    return this.getModuleVideoCount() > 0;
  };

  return Course;
}