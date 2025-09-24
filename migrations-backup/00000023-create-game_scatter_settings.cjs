'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_scatter_settings', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      game_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      board_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '10'
      },
      max_words: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '8'
      },
      word_directions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: '["horizontal", "vertical"]'
      },
      difficulty_level: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'medium'
      },
      time_limit_seconds: {
        type: DataTypes.INTEGER
      },
      hint_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      highlight_found_words: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      case_sensitive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('game_scatter_settings');
  }
};