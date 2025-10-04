'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Add type_attributes JSONB column to product table
      console.log('Adding type_attributes column to product table...');
      await queryInterface.addColumn('product', 'type_attributes', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Type-specific attributes based on product_type'
      }, { transaction });

      // Step 2: Check if difficulty_level column exists and remove it
      const columnExists = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'difficulty_level' AND table_schema = 'public';`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      if (columnExists.length > 0) {
        console.log('Removing difficulty_level column from product table...');
        await queryInterface.removeColumn('product', 'difficulty_level', { transaction });
      } else {
        console.log('difficulty_level column not found in product table, skipping removal');
      }

      // Step 3: Remove difficulty_level index if it exists
      try {
        await queryInterface.removeIndex('product', ['difficulty_level'], { transaction });
        console.log('Removed difficulty_level index');
      } catch (error) {
        console.log('difficulty_level index not found or already removed:', error.message);
      }

      await transaction.commit();
      console.log('Successfully added type_attributes column and removed difficulty_level from product table');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Remove type_attributes column
      const typeAttributesExists = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'type_attributes' AND table_schema = 'public';`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      if (typeAttributesExists.length > 0) {
        console.log('Removing type_attributes column from product table...');
        await queryInterface.removeColumn('product', 'type_attributes', { transaction });
      }

      // Step 2: Re-add difficulty_level column
      const difficultyExists = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'difficulty_level' AND table_schema = 'public';`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      if (difficultyExists.length === 0) {
        console.log('Restoring difficulty_level column to product table...');
        await queryInterface.addColumn('product', 'difficulty_level', {
          type: Sequelize.STRING,
          allowNull: true,
          validate: {
            isIn: [['beginner', 'intermediate', 'advanced']]
          }
        }, { transaction });

        // Step 3: Re-add index
        await queryInterface.addIndex('product', ['difficulty_level'], { transaction });
        console.log('Restored difficulty_level index');
      }

      await transaction.commit();
      console.log('Successfully reverted migration: removed type_attributes and restored difficulty_level');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};