'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('emaillog', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      template_id: {
        type: DataTypes.STRING
      },
      recipient_email: {
        type: DataTypes.STRING
      },
      subject: {
        type: DataTypes.STRING
      },
      content: {
        type: DataTypes.TEXT
      },
      trigger_type: {
        type: DataTypes.STRING
      },
      related_product_id: {
        type: DataTypes.STRING
      },
      related_registration_id: {
        type: DataTypes.STRING
      },
      related_purchase_id: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING
      },
      error_message: {
        type: DataTypes.STRING
      },
      scheduled_for: {
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
    await queryInterface.dropTable('emaillog');
  }
};