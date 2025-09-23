'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_wisdom_maze_settings', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      game_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      maze_complexity: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'medium'
      },
      question_frequency: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '3'
      },
      hint_system_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      max_hints_per_question: {
        type: DataTypes.INTEGER,
        defaultValue: '2'
      },
      time_pressure_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      time_limit_per_question: {
        type: DataTypes.INTEGER
      },
      branching_paths_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '2'
      },
      success_threshold_percentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '70'
      },
      adaptive_difficulty: {
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
    await queryInterface.dropTable('game_wisdom_maze_settings');
  }
};