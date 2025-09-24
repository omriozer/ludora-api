'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
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
      title: {
        type: DataTypes.STRING(255)
      },
      description: {
        type: DataTypes.TEXT
      },
      short_description: {
        type: DataTypes.TEXT
      },
      game_type: {
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
      subject: {
        type: DataTypes.STRING(255)
      },
      skills: {
        type: DataTypes.JSONB,
        defaultValue: '[]'
      },
      age_range: {
        type: DataTypes.STRING(255)
      },
      grade_range: {
        type: DataTypes.STRING(255)
      },
      device_compatibility: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'both'
      },
      game_settings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: '{}'
      },
      tags: {
        type: DataTypes.JSONB,
        defaultValue: '[]'
      },
      difficulty_level: {
        type: DataTypes.STRING(255)
      },
      estimated_duration: {
        type: DataTypes.INTEGER
      },
      content_creator_id: {
        type: DataTypes.STRING(255)
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('game');
  }
};