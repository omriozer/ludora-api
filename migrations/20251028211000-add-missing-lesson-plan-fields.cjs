'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add missing fields to lesson_plan table
      await queryInterface.addColumn('lesson_plan', 'estimated_duration', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Estimated duration of the lesson in minutes'
      }, { transaction });

      await queryInterface.addColumn('lesson_plan', 'total_slides', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Total number of slides in the lesson plan'
      }, { transaction });

      await queryInterface.addColumn('lesson_plan', 'teacher_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes and instructions for the teacher conducting the lesson'
      }, { transaction });

      await transaction.commit();
      console.log('Successfully added missing lesson plan fields');
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding missing lesson plan fields:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove the added fields from lesson_plan table
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (lessonPlanTableExists) {
        const lessonPlanColumns = await queryInterface.describeTable('lesson_plan');

        if (lessonPlanColumns.estimated_duration) {
          await queryInterface.removeColumn('lesson_plan', 'estimated_duration', { transaction });
        }
        if (lessonPlanColumns.total_slides) {
          await queryInterface.removeColumn('lesson_plan', 'total_slides', { transaction });
        }
        if (lessonPlanColumns.teacher_notes) {
          await queryInterface.removeColumn('lesson_plan', 'teacher_notes', { transaction });
        }
      }

      await transaction.commit();
      console.log('Successfully removed lesson plan fields');
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing lesson plan fields:', error);
      throw error;
    }
  }
};