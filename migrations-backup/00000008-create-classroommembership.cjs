'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('classroommembership', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      classroom_id: {
        type: DataTypes.STRING
      },
      student_user_id: {
        type: DataTypes.STRING
      },
      teacher_id: {
        type: DataTypes.STRING
      },
      joined_at: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING
      },
      notes: {
        type: DataTypes.STRING
      },
      student_display_name: {
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
    await queryInterface.dropTable('classroommembership');
  }
};