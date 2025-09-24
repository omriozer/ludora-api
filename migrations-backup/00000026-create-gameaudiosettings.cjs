'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('gameaudiosettings', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      game_type: {
        type: DataTypes.STRING
      },
      opening_music: {
        type: DataTypes.STRING
      },
      ending_music: {
        type: DataTypes.STRING
      },
      correct_answer_sound: {
        type: DataTypes.STRING
      },
      wrong_answer_sound: {
        type: DataTypes.STRING
      },
      action_sound: {
        type: DataTypes.STRING
      },
      background_music: {
        type: DataTypes.STRING
      },
      master_volume: {
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
      created_by: {
        type: DataTypes.STRING
      },
      created_by_id: {
        type: DataTypes.STRING
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('gameaudiosettings');
  }
};