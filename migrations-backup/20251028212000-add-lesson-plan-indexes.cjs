'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add indexes for lesson_plans table
      await queryInterface.addIndex('lesson_plan', ['curriculum_item_id'], { transaction });
      await queryInterface.addIndex('lesson_plan', ['is_active'], { transaction });
      await queryInterface.addIndex('lesson_plan', ['context'], { transaction });
      await queryInterface.addIndex('lesson_plan', {
        fields: ['curriculum_item_id', 'is_active'],
        name: 'idx_lesson_plan_curriculum_active'
      }, { transaction });

      // Add GIN index for JSONB file_configs
      await queryInterface.addIndex('lesson_plan', ['file_configs'], {
        using: 'gin',
        name: 'idx_lesson_plan_file_configs_gin'
      }, { transaction });

      // Add index for is_asset_only column on file table
      await queryInterface.addIndex('file', ['is_asset_only'], { transaction });

      await transaction.commit();
      console.log('Successfully added lesson plan indexes');
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding lesson plan indexes:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes from lesson_plan table
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (lessonPlanTableExists) {
        await queryInterface.removeIndex('lesson_plan', ['curriculum_item_id'], { transaction });
        await queryInterface.removeIndex('lesson_plan', ['is_active'], { transaction });
        await queryInterface.removeIndex('lesson_plan', ['context'], { transaction });
        await queryInterface.removeIndex('lesson_plan', 'idx_lesson_plan_curriculum_active', { transaction });
        await queryInterface.removeIndex('lesson_plan', 'idx_lesson_plan_file_configs_gin', { transaction });
      }

      // Remove index from file table
      const fileTableExists = await queryInterface.tableExists('file');
      if (fileTableExists) {
        await queryInterface.removeIndex('file', ['is_asset_only'], { transaction });
      }

      await transaction.commit();
      console.log('Successfully removed lesson plan indexes');
    } catch (error) {
      await transaction.rollback();
      console.error('Error removing lesson plan indexes:', error);
      throw error;
    }
  }
};