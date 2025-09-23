'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('manual_memory_pairs', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      pairing_rule_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content_a_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content_a_type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      content_b_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content_b_type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      pair_metadata: {
        type: DataTypes.JSONB,
        defaultValue: '{}'
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
    await queryInterface.dropTable('manual_memory_pairs');
  }
};