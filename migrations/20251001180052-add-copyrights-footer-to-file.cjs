'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('file');

    if (!tableDescription.add_copyrights_footer) {
      await queryInterface.addColumn('file', 'add_copyrights_footer', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('file');

    if (tableDescription.add_copyrights_footer) {
      await queryInterface.removeColumn('file', 'add_copyrights_footer');
    }
  }
};
