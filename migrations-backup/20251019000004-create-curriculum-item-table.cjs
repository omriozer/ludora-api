'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create curriculum_item table
      await queryInterface.createTable('curriculum_item', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false
        },
        curriculum_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'curriculum',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        study_topic: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Main study topic'
        },
        content_topic: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Specific content topic within study topic'
        },
        is_mandatory: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether this item is mandatory or optional'
        },
        mandatory_order: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Order for mandatory items'
        },
        custom_order: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Custom order set by teacher'
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Additional description or notes'
        },
        is_completed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether teacher has marked this as learned/completed'
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the item was marked as completed'
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

      // Add indexes
      await queryInterface.addIndex('curriculum_item', ['curriculum_id'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['study_topic'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['content_topic'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['is_mandatory'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['mandatory_order'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['custom_order'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['is_completed'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['curriculum_id', 'mandatory_order'], { transaction });
      await queryInterface.addIndex('curriculum_item', ['curriculum_id', 'custom_order'], { transaction });

      await transaction.commit();
      console.log('Successfully created curriculum_item table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating curriculum_item table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table exists before dropping
      const tableExists = await queryInterface.tableExists('curriculum_item');
      if (tableExists) {
        await queryInterface.dropTable('curriculum_item', { transaction });
        console.log('Successfully dropped curriculum_item table');
      } else {
        console.log('Curriculum_item table does not exist, skipping drop');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error dropping curriculum_item table:', error);
      throw error;
    }
  }
};