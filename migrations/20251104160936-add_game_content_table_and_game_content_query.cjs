'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('gamecontent', {
      id: {
        type: Sequelize.STRING, // Assuming UUIDs are stored as STRING
        primaryKey: true,
        allowNull: false,
      },
      semantic_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      data_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addColumn('game', 'content_query', {
      type: Sequelize.JSONB,
      allowNull: true, // Can be null if game doesn't use content_query
      defaultValue: {},
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('game', 'content_query');
    await queryInterface.dropTable('gamecontent');
  }
};
