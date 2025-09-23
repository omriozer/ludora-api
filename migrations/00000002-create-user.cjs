'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('user', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING
      },
      full_name: {
        type: DataTypes.STRING
      },
      disabled: {
        type: DataTypes.STRING
      },
      is_verified: {
        type: DataTypes.BOOLEAN
      },
      _app_role: {
        type: DataTypes.STRING
      },
      role: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'user'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_login: {
        type: DataTypes.DATE
      },
      phone: {
        type: DataTypes.STRING(255)
      },
      education_level: {
        type: DataTypes.STRING(255)
      },
      content_creator_agreement_sign_date: {
        type: DataTypes.DATE
      },
      user_type: {
        type: DataTypes.STRING(255)
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user');
  }
};