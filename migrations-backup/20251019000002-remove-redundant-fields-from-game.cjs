'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table exists before dropping columns
      const tableExists = await queryInterface.tableExists('game');
      if (!tableExists) {
        console.log('Game table does not exist, skipping migration');
        await transaction.commit();
        return;
      }

      // Check if columns exist before dropping them
      const tableInfo = await queryInterface.describeTable('game');

      const columnsToRemove = [
        'title',
        'description',
        'short_description',
        'price',
        'is_published',
        'image_url',
        'image_is_private',
        'subject',
        'skills',
        'age_range',
        'grade_range',
        'tags',
        'estimated_duration'
      ];

      for (const column of columnsToRemove) {
        if (tableInfo[column]) {
          console.log(`Removing column ${column} from game table`);
          await queryInterface.removeColumn('game', column, { transaction });
        } else {
          console.log(`Column ${column} does not exist in game table, skipping`);
        }
      }

      await transaction.commit();
      console.log('Successfully removed redundant fields from game table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing redundant fields from game table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table exists
      const tableExists = await queryInterface.tableExists('game');
      if (!tableExists) {
        console.log('Game table does not exist, skipping rollback');
        await transaction.commit();
        return;
      }

      // Add back the removed columns with their original definitions
      await queryInterface.addColumn('game', 'title', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'short_description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'price', {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0
      }, { transaction });

      await queryInterface.addColumn('game', 'is_published', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction });

      await queryInterface.addColumn('game', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'image_is_private', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }, { transaction });

      await queryInterface.addColumn('game', 'subject', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'skills', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await queryInterface.addColumn('game', 'age_range', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'grade_range', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('game', 'tags', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await queryInterface.addColumn('game', 'estimated_duration', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await transaction.commit();
      console.log('Successfully rolled back removal of redundant fields from game table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error rolling back removal of redundant fields from game table:', error);
      throw error;
    }
  }
};