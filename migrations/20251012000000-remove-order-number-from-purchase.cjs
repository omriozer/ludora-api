'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the index exists before trying to remove it
    const indexes = await queryInterface.showIndex('purchase');
    const orderNumberIndex = indexes.find(index => index.name === 'idx_purchase_order_number');

    if (orderNumberIndex) {
      await queryInterface.removeIndex('purchase', 'idx_purchase_order_number');
    }

    // Check if the column exists before trying to remove it
    const tableInfo = await queryInterface.describeTable('purchase');
    if (tableInfo.order_number) {
      await queryInterface.removeColumn('purchase', 'order_number');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the order_number column
    await queryInterface.addColumn('purchase', 'order_number', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Re-add the index
    await queryInterface.addIndex('purchase', ['order_number'], {
      name: 'idx_purchase_order_number'
    });
  }
};