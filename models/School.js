import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import DeprecationWarnings from '../utils/deprecationWarnings.js';

export default function(sequelize) {
  const School = sequelize.define('School', {
    // Base fields (id, created_at, updated_at)
    ...baseFields,

    // Core school information
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      },
      comment: 'School name'
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      },
      comment: 'City where the school is located'
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 500]
      },
      comment: 'Full address of the school'
    },
    institution_symbol: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isNumeric: true,
        len: [1, 20]
      },
      comment: 'Unique institution symbol/code'
    },

    // Contact information
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
        len: [0, 255]
      },
      comment: 'Primary email address'
    },
    phone_numbers: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidPhoneNumbers(value) {
          if (value && Array.isArray(value)) {
            for (const phoneEntry of value) {
              if (typeof phoneEntry !== 'object' ||
                  typeof phoneEntry.phone !== 'string' ||
                  typeof phoneEntry.description !== 'string') {
                throw new Error('Each phone entry must have phone and description strings');
              }
            }
          }
        }
      },
      comment: 'Array of phone objects with phone and description fields'
    },

    // Educational information
    education_levels: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidEducationLevels(value) {
          if (value && Array.isArray(value)) {
            const validLevels = ['elementary', 'middle_school', 'high_school', 'academic'];
            for (const level of value) {
              if (!validLevels.includes(level)) {
                throw new Error(`Invalid education level: ${level}. Must be one of: ${validLevels.join(', ')}`);
              }
            }
          }
        }
      },
      comment: 'Array of education levels (elementary, middle_school, high_school, academic)'
    },
    district: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['צפון', 'חיפה', 'מרכז', 'תל אביב', 'ירושלים', 'דרום']]
      },
      comment: 'Educational district'
    },

    // Visual branding
    logo_url: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
        len: [0, 500]
      },
      comment: 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.'
    },
    has_logo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Clear boolean indicator for logo image existence'
    },
    logo_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Standardized logo filename storage (replaces logo_url)'
    },

    // Management & System Integration (Admin-only fields)
    school_headmaster_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'School headmaster user ID'
    },
    edu_system_id: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      },
      comment: 'Education system identifier'
    },
  }, {
    ...baseOptions,
    tableName: 'school',
    indexes: [
      {
        fields: ['institution_symbol'],
        unique: true,
        name: 'idx_school_institution_symbol'
      },
      {
        fields: ['city'],
        name: 'idx_school_city'
      },
      {
        fields: ['district'],
        name: 'idx_school_district'
      },
      {
        fields: ['school_headmaster_id'],
        name: 'idx_school_headmaster_id'
      },
      {
        fields: ['edu_system_id'],
        name: 'idx_school_edu_system_id'
      },
      {
        fields: ['created_at'],
        name: 'idx_school_created_at'
      },
      {
        fields: ['has_logo'],
        name: 'idx_school_has_logo'
      },
      {
        fields: ['logo_filename'],
        name: 'idx_school_logo_filename'
      }
    ]
  });

  // Define associations
  School.associate = function(models) {
    // Headmaster relationship
    School.belongsTo(models.User, {
      foreignKey: 'school_headmaster_id',
      as: 'Headmaster',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // School has many users (teachers, students, etc.)
    School.hasMany(models.User, {
      foreignKey: 'school_id',
      as: 'Users',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // School has many classrooms
    School.hasMany(models.Classroom, {
      foreignKey: 'school_id',
      as: 'Classrooms',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  };

  // Logo reference standardization methods
  School.prototype.hasLogoAsset = function() {
    // Use standardized field if available, fallback to legacy pattern
    if (this.has_logo !== undefined) {
      return this.has_logo;
    }
    // Legacy fallback
    return !!(this.logo_url && this.logo_url !== '');
  };

  School.prototype.getLogoFilename = function() {
    // Use standardized field if available
    if (this.logo_filename) {
      return this.logo_filename;
    }
    // Legacy fallback - extract filename from URL
    if (this.logo_url && this.logo_url.includes('/')) {
      DeprecationWarnings.warnDirectUrlStorage('school', 'logo_url', {
        schoolId: this.id,
        logoUrl: this.logo_url,
        location: 'School.getLogoFilename'
      });
      const parts = this.logo_url.split('/');
      return parts[parts.length - 1] || 'logo.jpg';
    }
    return null;
  };

  School.prototype.getLogoUrl = function() {
    // For backward compatibility during transition period
    if (this.hasLogoAsset()) {
      const filename = this.getLogoFilename();
      if (filename) {
        // Return the standardized path structure
        return `/api/assets/image/school/${this.id}/${filename}`;
      }
    }
    return null;
  };

  // Legacy compatibility method with deprecation warning
  School.prototype.getLegacyLogoUrl = function() {
    if (this.logo_url) {
      DeprecationWarnings.warnDirectUrlStorage('school', 'logo_url', {
        schoolId: this.id,
        logoUrl: this.logo_url,
        location: 'School.getLegacyLogoUrl'
      });
    }
    return this.getLogoUrl();
  };

  return School;
}