'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('registration', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
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
      },
      user_id: {
        type: DataTypes.STRING(255)
      },
      workshop_id: {
        type: DataTypes.STRING(255)
      },
      participant_name: {
        type: DataTypes.STRING(255)
      },
      participant_phone: {
        type: DataTypes.STRING(255)
      },
      payment_amount: {
        type: DataTypes.DECIMAL
      },
      payment_status: {
        type: DataTypes.STRING(255)
      },
      access_until: {
        type: DataTypes.DATE
      },
      environment: {
        type: DataTypes.STRING(255)
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('registration');
  }
};