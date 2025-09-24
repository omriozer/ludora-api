'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('product', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.TEXT
      },
      category: {
        type: DataTypes.STRING
      },
      product_type: {
        type: DataTypes.STRING
      },
      price: {
        type: DataTypes.DECIMAL
      },
      is_published: {
        type: DataTypes.BOOLEAN
      },
      image_url: {
        type: DataTypes.STRING
      },
      youtube_video_id: {
        type: DataTypes.STRING
      },
      youtube_video_title: {
        type: DataTypes.STRING
      },
      file_url: {
        type: DataTypes.STRING
      },
      preview_file_url: {
        type: DataTypes.STRING
      },
      file_type: {
        type: DataTypes.STRING
      },
      downloads_count: {
        type: DataTypes.DECIMAL
      },
      tags: {
        type: DataTypes.JSONB
      },
      target_audience: {
        type: DataTypes.STRING
      },
      difficulty_level: {
        type: DataTypes.STRING
      },
      access_days: {
        type: DataTypes.DECIMAL
      },
      is_lifetime_access: {
        type: DataTypes.BOOLEAN
      },
      workshop_id: {
        type: DataTypes.STRING
      },
      course_modules: {
        type: DataTypes.JSONB
      },
      total_duration_minutes: {
        type: DataTypes.DECIMAL
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
      creator_user_id: {
        type: DataTypes.STRING(255)
      },
      workshop_type: {
        type: DataTypes.STRING(255)
      },
      video_file_url: {
        type: DataTypes.STRING(255)
      },
      scheduled_date: {
        type: DataTypes.DATE
      },
      meeting_link: {
        type: DataTypes.STRING(255)
      },
      meeting_password: {
        type: DataTypes.STRING(255)
      },
      meeting_platform: {
        type: DataTypes.STRING(255)
      },
      max_participants: {
        type: DataTypes.INTEGER
      },
      duration_minutes: {
        type: DataTypes.INTEGER
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product');
  }
};