'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_content_usage', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      game_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      template_id: {
        type: DataTypes.STRING(255)
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      content_types: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: '[]'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('game_content_usage');
  }
};