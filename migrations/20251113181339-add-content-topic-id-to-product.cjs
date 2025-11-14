'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add content_topic_id column to product table
    await queryInterface.addColumn('product', 'content_topic_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'content_topic',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for better performance
    await queryInterface.addIndex('product', ['content_topic_id'], {
      name: 'idx_product_content_topic_id'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the index first
    await queryInterface.removeIndex('product', 'idx_product_content_topic_id');

    // Remove the column
    await queryInterface.removeColumn('product', 'content_topic_id');
  }
};
