'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add fields for uploaded marketing video files as alternative to YouTube

    await queryInterface.addColumn('product', 'marketing_video_title', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Title for uploaded marketing video'
    });

    await queryInterface.addColumn('product', 'marketing_video_duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Duration of uploaded marketing video in seconds'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('product', 'marketing_video_title');
    await queryInterface.removeColumn('product', 'marketing_video_duration');
  }
};
