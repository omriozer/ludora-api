'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('emailtemplate', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING
      },
      subject: {
        type: DataTypes.STRING
      },
      html_content: {
        type: DataTypes.TEXT
      },
      trigger_type: {
        type: DataTypes.STRING
      },
      trigger_hours_before: {
        type: DataTypes.DECIMAL
      },
      trigger_hours_after: {
        type: DataTypes.DECIMAL
      },
      target_product_types: {
        type: DataTypes.JSONB
      },
      target_product_ids: {
        type: DataTypes.JSONB
      },
      target_admin_emails: {
        type: DataTypes.JSONB
      },
      is_active: {
        type: DataTypes.BOOLEAN
      },
      send_to_admins: {
        type: DataTypes.BOOLEAN
      },
      access_expiry_days_before: {
        type: DataTypes.DECIMAL
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
    await queryInterface.dropTable('emailtemplate');
  }
};