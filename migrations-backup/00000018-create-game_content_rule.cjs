'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('game_content_rule', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      template_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      rule_type: {
        type: DataTypes.ENUM('attribute_based', 'content_list', 'complex_attribute', 'relation_based'),
        allowNull: false
      },
      rule_config: {
        type: DataTypes.JSON,
        allowNull: false
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '0'
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
    await queryInterface.dropTable('game_content_rule');
  }
};