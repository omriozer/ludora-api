'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if lesson_plan table exists
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (!lessonPlanTableExists) {
        console.log('lesson_plan table does not exist, skipping curriculum_item_id column removal');
        await transaction.commit();
        return;
      }

      // Check if curriculum_item_id column exists
      const tableDescription = await queryInterface.describeTable('lesson_plan');
      if (tableDescription.curriculum_item_id) {
        // Remove any existing indexes on curriculum_item_id
        try {
          await queryInterface.removeIndex('lesson_plan', ['curriculum_item_id'], { transaction });
          console.log('Removed index on curriculum_item_id');
        } catch (error) {
          console.log('Index on curriculum_item_id may not exist, continuing...');
        }

        try {
          await queryInterface.removeIndex('lesson_plan', 'idx_lesson_plan_curriculum_active', { transaction });
          console.log('Removed composite index idx_lesson_plan_curriculum_active');
        } catch (error) {
          console.log('Composite index may not exist, continuing...');
        }

        // Remove curriculum_item_id column from lesson_plan table
        await queryInterface.removeColumn('lesson_plan', 'curriculum_item_id', { transaction });
        console.log('Successfully removed curriculum_item_id column from lesson_plan table');
      } else {
        console.log('curriculum_item_id column does not exist in lesson_plan table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing curriculum_item_id column from lesson_plan table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if lesson_plan table exists
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (!lessonPlanTableExists) {
        console.log('lesson_plan table does not exist, skipping curriculum_item_id column addition');
        await transaction.commit();
        return;
      }

      // Re-add curriculum_item_id column to lesson_plan table
      await queryInterface.addColumn('lesson_plan', 'curriculum_item_id', {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'curriculum_item',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Primary curriculum item this lesson plan belongs to (restored by rollback)'
      }, { transaction });

      // Re-add indexes
      await queryInterface.addIndex('lesson_plan', ['curriculum_item_id'], { transaction });
      await queryInterface.addIndex('lesson_plan', {
        fields: ['curriculum_item_id', 'is_active'],
        name: 'idx_lesson_plan_curriculum_active'
      }, { transaction });

      await transaction.commit();
      console.log('Successfully restored curriculum_item_id column to lesson_plan table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error restoring curriculum_item_id column to lesson_plan table:', error);
      throw error;
    }
  }
};