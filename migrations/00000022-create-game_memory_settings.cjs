'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_memory_settings', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      game_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      pairs_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '6'
      },
      flip_time_limit: {
        type: DataTypes.INTEGER
      },
      match_time_limit: {
        type: DataTypes.INTEGER
      },
      allow_mismatched_types: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      shuffle_cards: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      reveal_duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '2000'
      },
      difficulty_progression: {
        type: DataTypes.JSONB,
        defaultValue: '{}'
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
    await queryInterface.dropTable('game_memory_settings');
  }
};