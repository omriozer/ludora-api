'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove the index on creator_user_id first
      await queryInterface.removeIndex('game', ['creator_user_id'], { transaction });
      console.log('Removed index on game.creator_user_id');

      // Remove the creator_user_id column
      await queryInterface.removeColumn('game', 'creator_user_id', { transaction });
      console.log('Removed creator_user_id column from game table');

      await transaction.commit();
      console.log('Migration completed: Game table no longer has creator_user_id - ownership is now through Product table');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Re-add the creator_user_id column
      await queryInterface.addColumn('game', 'creator_user_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'user',
          key: 'id'
        },
        comment: 'User who created this game'
      }, { transaction });
      console.log('Re-added creator_user_id column to game table');

      // Re-add the index
      await queryInterface.addIndex('game', ['creator_user_id'], { transaction });
      console.log('Re-added index on game.creator_user_id');

      await transaction.commit();
      console.log('Rollback completed: Game table has creator_user_id again');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};