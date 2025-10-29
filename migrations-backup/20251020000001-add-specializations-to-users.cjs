const { Sequelize } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('user')) {
      console.log('User table does not exist, skipping migration');
      return;
    }

    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('user');
    if (tableDescription.specializations) {
      console.log('specializations column already exists, skipping migration');
      return;
    }

    await queryInterface.addColumn('user', 'specializations', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Teacher specializations and teaching subjects as JSON array'
    });

    console.log('Successfully added specializations column to user table');
  },

  async down(queryInterface, Sequelize) {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('user')) {
      console.log('User table does not exist, skipping rollback');
      return;
    }

    // Check if column exists before removing
    const tableDescription = await queryInterface.describeTable('user');
    if (!tableDescription.specializations) {
      console.log('specializations column does not exist, skipping rollback');
      return;
    }

    await queryInterface.removeColumn('user', 'specializations');
    console.log('Successfully removed specializations column from user table');
  }
};