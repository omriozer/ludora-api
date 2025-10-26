import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

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
      comment: 'URL to school logo image'
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

  return School;
}