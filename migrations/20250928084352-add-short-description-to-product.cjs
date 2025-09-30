'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('product', 'short_description', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'title'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'short_description');
  }
};
