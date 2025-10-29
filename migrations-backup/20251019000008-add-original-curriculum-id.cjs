'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add original_curriculum_id column to curriculum table
    await queryInterface.addColumn('curriculum', 'original_curriculum_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'curriculum',
        key: 'id'
      },
      comment: 'ID of the system curriculum this was copied from (null for system curricula)'
    });

    // Add index for better query performance
    await queryInterface.addIndex('curriculum', ['original_curriculum_id'], {
      name: 'curriculum_original_curriculum_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('curriculum', 'curriculum_original_curriculum_id_idx');

    // Remove column
    await queryInterface.removeColumn('curriculum', 'original_curriculum_id');
  }
};