'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('audiofile', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING
      },
      file_url: {
        type: DataTypes.STRING
      },
      duration: {
        type: DataTypes.DECIMAL
      },
      volume: {
        type: DataTypes.DECIMAL
      },
      file_size: {
        type: DataTypes.DECIMAL
      },
      file_type: {
        type: DataTypes.STRING
      },
      is_default_for: {
        type: DataTypes.JSONB
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
    await queryInterface.dropTable('audiofile');
  }
};