'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('attribute', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      type: {
        type: DataTypes.STRING
      },
      value: {
        type: DataTypes.STRING
      },
      added_by: {
        type: DataTypes.STRING
      },
      approved_by: {
        type: DataTypes.STRING
      },
      is_approved: {
        type: DataTypes.BOOLEAN
      },
      source: {
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
    await queryInterface.dropTable('attribute');
  }
};