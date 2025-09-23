'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('settings', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      subscription_system_enabled: {
        type: DataTypes.BOOLEAN
      },
      default_recording_access_days: {
        type: DataTypes.DECIMAL
      },
      recording_lifetime_access: {
        type: DataTypes.BOOLEAN
      },
      default_course_access_days: {
        type: DataTypes.DECIMAL
      },
      course_lifetime_access: {
        type: DataTypes.BOOLEAN
      },
      default_file_access_days: {
        type: DataTypes.DECIMAL
      },
      file_lifetime_access: {
        type: DataTypes.BOOLEAN
      },
      contact_email: {
        type: DataTypes.STRING
      },
      contact_phone: {
        type: DataTypes.STRING
      },
      site_description: {
        type: DataTypes.TEXT
      },
      logo_url: {
        type: DataTypes.STRING
      },
      site_name: {
        type: DataTypes.STRING
      },
      maintenance_mode: {
        type: DataTypes.BOOLEAN
      },
      student_invitation_expiry_days: {
        type: DataTypes.DECIMAL
      },
      parent_consent_required: {
        type: DataTypes.BOOLEAN
      },
      nav_order: {
        type: DataTypes.JSONB
      },
      nav_files_text: {
        type: DataTypes.STRING
      },
      nav_files_icon: {
        type: DataTypes.STRING
      },
      nav_files_visibility: {
        type: DataTypes.STRING
      },
      nav_files_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_games_text: {
        type: DataTypes.STRING
      },
      nav_games_icon: {
        type: DataTypes.STRING
      },
      nav_games_visibility: {
        type: DataTypes.STRING
      },
      nav_games_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_workshops_text: {
        type: DataTypes.STRING
      },
      nav_workshops_icon: {
        type: DataTypes.STRING
      },
      nav_workshops_visibility: {
        type: DataTypes.STRING
      },
      nav_workshops_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_courses_text: {
        type: DataTypes.STRING
      },
      nav_courses_icon: {
        type: DataTypes.STRING
      },
      nav_courses_visibility: {
        type: DataTypes.STRING
      },
      nav_courses_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_classrooms_text: {
        type: DataTypes.STRING
      },
      nav_classrooms_icon: {
        type: DataTypes.STRING
      },
      nav_classrooms_visibility: {
        type: DataTypes.STRING
      },
      nav_classrooms_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_account_text: {
        type: DataTypes.STRING
      },
      nav_account_icon: {
        type: DataTypes.STRING
      },
      nav_account_visibility: {
        type: DataTypes.STRING
      },
      nav_account_enabled: {
        type: DataTypes.BOOLEAN
      },
      nav_content_creators_text: {
        type: DataTypes.STRING
      },
      nav_content_creators_icon: {
        type: DataTypes.STRING
      },
      nav_content_creators_visibility: {
        type: DataTypes.STRING
      },
      nav_content_creators_enabled: {
        type: DataTypes.BOOLEAN
      },
      is_sample: {
        type: DataTypes.BOOLEAN
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      created_by: {
        type: DataTypes.STRING
      },
      created_by_id: {
        type: DataTypes.STRING
      },
      allow_content_creator_workshops: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      allow_content_creator_courses: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      allow_content_creator_files: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      allow_content_creator_tools: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      allow_content_creator_games: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('settings');
  }
};