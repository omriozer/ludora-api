'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if lesson_plan table exists
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (!lessonPlanTableExists) {
        console.log('lesson_plan table does not exist, skipping price column removal');
        await transaction.commit();
        return;
      }

      // Check if price column exists
      const tableDescription = await queryInterface.describeTable('lesson_plan');
      if (tableDescription.price) {
        // Remove price column from lesson_plan table
        await queryInterface.removeColumn('lesson_plan', 'price', { transaction });
        console.log('Successfully removed price column from lesson_plan table');
      } else {
        console.log('price column does not exist in lesson_plan table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing price column from lesson_plan table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if lesson_plan table exists
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (!lessonPlanTableExists) {
        console.log('lesson_plan table does not exist, skipping price column addition');
        await transaction.commit();
        return;
      }

      // Re-add price column to lesson_plan table
      await queryInterface.addColumn('lesson_plan', 'price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Price for this lesson plan (restored by rollback)'
      }, { transaction });

      await transaction.commit();
      console.log('Successfully restored price column to lesson_plan table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error restoring price column to lesson_plan table:', error);
      throw error;
    }
  }
};