'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_content_usage_template', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      game_type: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      content_types: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: '[]'
      },
      is_global: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_by: {
        type: DataTypes.STRING(255)
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
    await queryInterface.dropTable('game_content_usage_template');
  }
};