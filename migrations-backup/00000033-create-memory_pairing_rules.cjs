'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('memory_pairing_rules', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      game_id: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      rule_type: {
        type: DataTypes.ENUM('manual_pairs', 'attribute_match', 'content_type_match', 'semantic_match'),
        allowNull: false
      },
      content_type_a: {
        type: DataTypes.STRING(50)
      },
      content_type_b: {
        type: DataTypes.STRING(50)
      },
      attribute_name: {
        type: DataTypes.STRING(100)
      },
      pair_config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: '{}'
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: '0'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.dropTable('memory_pairing_rules');
  }
};