'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Create lesson_plans table
      await queryInterface.createTable('lesson_plan', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false
        },
        curriculum_item_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'curriculum_item',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Primary curriculum item this lesson plan belongs to'
        },
        context: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Theme context like "animals", "hanukkah", "christmas", etc.'
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          comment: 'Price for this lesson plan'
        },
        file_configs: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: '{}',
          comment: 'JSON configuration for files: roles, connections, slide configs'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether this lesson plan is active/published'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Note: Indexes will be added in a separate migration to avoid transaction issues

      // 2. Add is_asset_only column to files table
      await queryInterface.addColumn('file', 'is_asset_only', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'true = asset only (not standalone product), false = can be standalone product'
      }, { transaction });

      // Note: File index will be added in a separate migration

      await transaction.commit();
      console.log('Successfully created lesson_plans infrastructure');
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating lesson_plans infrastructure:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove is_asset_only column from files
      const fileTableExists = await queryInterface.tableExists('file');
      if (fileTableExists) {
        const fileColumns = await queryInterface.describeTable('file');
        if (fileColumns.is_asset_only) {
          await queryInterface.removeColumn('file', 'is_asset_only', { transaction });
          console.log('Removed is_asset_only column from file table');
        }
      }

      // Drop lesson_plan table
      const lessonPlanTableExists = await queryInterface.tableExists('lesson_plan');
      if (lessonPlanTableExists) {
        await queryInterface.dropTable('lesson_plan', { transaction });
        console.log('Dropped lesson_plan table');
      }

      await transaction.commit();
      console.log('Successfully rolled back lesson_plans infrastructure');
    } catch (error) {
      await transaction.rollback();
      console.error('Error rolling back lesson_plans infrastructure:', error);
      throw error;
    }
  }
};