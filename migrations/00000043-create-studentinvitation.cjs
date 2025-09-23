'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('studentinvitation', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      classroom_id: {
        type: DataTypes.STRING
      },
      teacher_id: {
        type: DataTypes.STRING
      },
      student_user_id: {
        type: DataTypes.STRING
      },
      student_email: {
        type: DataTypes.STRING
      },
      student_name: {
        type: DataTypes.STRING
      },
      parent_email: {
        type: DataTypes.STRING
      },
      parent_name: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING
      },
      invitation_token: {
        type: DataTypes.STRING
      },
      parent_consent_token: {
        type: DataTypes.STRING
      },
      expires_at: {
        type: DataTypes.STRING
      },
      parent_consent_given_at: {
        type: DataTypes.STRING
      },
      student_accepted_at: {
        type: DataTypes.STRING
      },
      converted_to_membership_at: {
        type: DataTypes.STRING
      },
      notes: {
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
    await queryInterface.dropTable('studentinvitation');
  }
};