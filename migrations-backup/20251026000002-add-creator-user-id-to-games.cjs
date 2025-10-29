'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding creator_user_id column to games table...');

    // Check if the column already exists
    const tableDescription = await queryInterface.describeTable('game');

    if (!tableDescription.creator_user_id) {
      await queryInterface.addColumn('game', 'creator_user_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });

      // Add index for performance
      await queryInterface.addIndex('game', ['creator_user_id'], {
        name: 'idx_game_creator_user_id'
      });

      console.log('✅ Added creator_user_id column to games table');
    } else {
      console.log('⏭️ creator_user_id column already exists in games table');
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing creator_user_id column from games table...');

    // Check if the column exists
    const tableDescription = await queryInterface.describeTable('game');

    if (tableDescription.creator_user_id) {
      // Remove index first
      try {
        await queryInterface.removeIndex('game', 'idx_game_creator_user_id');
      } catch (error) {
        console.log('Index might not exist, continuing...');
      }

      await queryInterface.removeColumn('game', 'creator_user_id');
      console.log('✅ Removed creator_user_id column from games table');
    } else {
      console.log('⏭️ creator_user_id column does not exist in games table');
    }
  }
};