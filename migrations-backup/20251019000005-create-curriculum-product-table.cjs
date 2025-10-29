'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create curriculum_product table (connecting table)
      await queryInterface.createTable('curriculum_product', {
        curriculum_item_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'curriculum_item',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        product_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'product',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Add composite primary key
      await queryInterface.addConstraint('curriculum_product', {
        fields: ['curriculum_item_id', 'product_id'],
        type: 'primary key',
        name: 'curriculum_product_pkey',
        transaction
      });

      // Add indexes for efficient querying
      await queryInterface.addIndex('curriculum_product', ['curriculum_item_id'], { transaction });
      await queryInterface.addIndex('curriculum_product', ['product_id'], { transaction });

      await transaction.commit();
      console.log('Successfully created curriculum_product table');
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating curriculum_product table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if table exists before dropping
      const tableExists = await queryInterface.tableExists('curriculum_product');
      if (tableExists) {
        await queryInterface.dropTable('curriculum_product', { transaction });
        console.log('Successfully dropped curriculum_product table');
      } else {
        console.log('Curriculum_product table does not exist, skipping drop');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error dropping curriculum_product table:', error);
      throw error;
    }
  }
};