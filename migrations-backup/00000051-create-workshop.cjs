'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('workshop', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      short_description: {
        type: DataTypes.TEXT
      },
      category: {
        type: DataTypes.STRING(255)
      },
      price: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        defaultValue: '0'
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      image_url: {
        type: DataTypes.STRING(255)
      },
      image_is_private: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      tags: {
        type: DataTypes.JSONB
      },
      target_audience: {
        type: DataTypes.STRING(255)
      },
      difficulty_level: {
        type: DataTypes.STRING(255)
      },
      access_days: {
        type: DataTypes.INTEGER
      },
      is_lifetime_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      workshop_type: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'recorded'
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
      },
      creator_user_id: {
        type: DataTypes.STRING(255)
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      created_by: {
        type: DataTypes.STRING(255)
      },
      created_by_id: {
        type: DataTypes.STRING(255)
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('workshop');
  }
};