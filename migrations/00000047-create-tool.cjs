'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('tool', {
      id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      short_description: {
        type: DataTypes.TEXT
      },
      category: {
        type: DataTypes.STRING(255)
      },
      price: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        defaultValue: '0'
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      image_url: {
        type: DataTypes.STRING(255)
      },
      image_is_private: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      tags: {
        type: DataTypes.JSONB
      },
      target_audience: {
        type: DataTypes.STRING(255)
      },
      difficulty_level: {
        type: DataTypes.STRING(255)
      },
      access_days: {
        type: DataTypes.INTEGER
      },
      is_lifetime_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      tool_url: {
        type: DataTypes.STRING(255)
      },
      tool_config: {
        type: DataTypes.JSONB,
        defaultValue: '{}'
      },
      access_type: {
        type: DataTypes.STRING(255),
        defaultValue: 'direct'
      },
      creator_user_id: {
        type: DataTypes.STRING(255)
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      created_by: {
        type: DataTypes.STRING(255)
      },
      created_by_id: {
        type: DataTypes.STRING(255)
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tool');
  }
};