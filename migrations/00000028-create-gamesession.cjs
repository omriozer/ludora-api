'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('gamesession', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.STRING
      },
      guest_ip: {
        type: DataTypes.STRING
      },
      game_id: {
        type: DataTypes.STRING
      },
      game_type: {
        type: DataTypes.STRING
      },
      session_start_time: {
        type: DataTypes.STRING
      },
      session_end_time: {
        type: DataTypes.STRING
      },
      duration_seconds: {
        type: DataTypes.STRING
      },
      session_data: {
        type: DataTypes.STRING
      },
      completed: {
        type: DataTypes.BOOLEAN
      },
      score: {
        type: DataTypes.STRING
      },
      exit_reason: {
        type: DataTypes.STRING
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
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('gamesession');
  }
};