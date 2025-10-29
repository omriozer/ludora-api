'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create curriculum table
      await queryInterface.createTable('curriculum', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false
        },
        subject: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Study subject from STUDY_SUBJECTS constant'
        },
        grade: {
          type: Sequelize.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 12
          },
          comment: 'Grade level 1-12'
        },
        teacher_user_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'user',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'null = system default curriculum'
        },
        class_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'classroom',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'null = system default curriculum'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
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
      await queryInterface.addIndex('curriculum', ['subject'], { transaction });
      await queryInterface.addIndex('curriculum', ['grade'], { transaction });
      await queryInterface.addIndex('curriculum', ['teacher_user_id'], { transaction });
      await queryInterface.addIndex('curriculum', ['class_id'], { transaction });
      await queryInterface.addIndex('curriculum', ['is_active'], { transaction });
      await queryInterface.addIndex('curriculum', ['subject', 'grade'], { transaction });
      await queryInterface.addIndex('curriculum', ['teacher_user_id', 'class_id'], { transaction });

      await transaction.commit();
      console.log('Successfully created curriculum table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating curriculum table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table exists before dropping
      const tableExists = await queryInterface.tableExists('curriculum');
      if (tableExists) {
        await queryInterface.dropTable('curriculum', { transaction });
        console.log('Successfully dropped curriculum table');
      } else {
        console.log('Curriculum table does not exist, skipping drop');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error dropping curriculum table:', error);
      throw error;
    }
  }
};