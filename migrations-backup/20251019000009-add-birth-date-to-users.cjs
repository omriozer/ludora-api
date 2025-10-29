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
    if (tableDescription.birth_date) {
      console.log('birth_date column already exists, skipping migration');
      return;
    }

    await queryInterface.addColumn('user', 'birth_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'User birth date for age verification and onboarding'
    });

    // Add index on birth_date for efficient queries
    await queryInterface.addIndex('user', {
      fields: ['birth_date'],
      name: 'user_birth_date_idx'
    });

    console.log('Successfully added birth_date column to user table');
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
    if (!tableDescription.birth_date) {
      console.log('birth_date column does not exist, skipping rollback');
      return;
    }

    // Remove index first
    try {
      await queryInterface.removeIndex('user', 'user_birth_date_idx');
    } catch (error) {
      console.log('Index user_birth_date_idx does not exist or already removed');
    }

    await queryInterface.removeColumn('user', 'birth_date');
    console.log('Successfully removed birth_date column from user table');
  }
};