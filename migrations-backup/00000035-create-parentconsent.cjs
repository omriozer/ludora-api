'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('parentconsent', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      student_user_id: {
        type: DataTypes.STRING
      },
      student_email: {
        type: DataTypes.STRING
      },
      parent_email: {
        type: DataTypes.STRING
      },
      parent_name: {
        type: DataTypes.STRING
      },
      parent_id: {
        type: DataTypes.STRING
      },
      parent_relation: {
        type: DataTypes.STRING
      },
      consent_text: {
        type: DataTypes.TEXT
      },
      digital_signature: {
        type: DataTypes.STRING
      },
      signature_ip: {
        type: DataTypes.STRING
      },
      signature_user_agent: {
        type: DataTypes.STRING
      },
      consent_version: {
        type: DataTypes.STRING
      },
      is_active: {
        type: DataTypes.BOOLEAN
      },
      related_invitation_id: {
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
    await queryInterface.dropTable('parentconsent');
  }
};