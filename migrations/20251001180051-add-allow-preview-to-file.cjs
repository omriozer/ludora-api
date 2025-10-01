'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('file');

    if (!tableDescription.allow_preview) {
      await queryInterface.addColumn('file', 'allow_preview', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('file');

    if (tableDescription.allow_preview) {
      await queryInterface.removeColumn('file', 'allow_preview');
    }
  }
};
