'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Add entity_id column to product table
      await queryInterface.addColumn('product', 'entity_id', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '' // Temporary default, will be updated below
      }, { transaction });

      // 2. Migrate existing data - set entity_id = id for existing products
      // This assumes current products are self-referential or need custom logic
      await queryInterface.sequelize.query(`
        UPDATE product SET entity_id = id WHERE entity_id = '';
      `, { transaction });

      // 3. Remove product_id columns from type tables and their constraints

      // Remove foreign key constraints first (if they exist)
      try {
        await queryInterface.removeConstraint('course', 'course_product_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint course_product_id_fkey may not exist, continuing...');
      }

      try {
        await queryInterface.removeConstraint('workshop', 'workshop_product_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint workshop_product_id_fkey may not exist, continuing...');
      }

      try {
        await queryInterface.removeConstraint('file', 'file_product_id_fkey', { transaction });
      } catch (error) {
        console.log('Constraint file_product_id_fkey may not exist, continuing...');
      }

      // Remove product_id columns from type tables
      await queryInterface.removeColumn('course', 'product_id', { transaction });
      await queryInterface.removeColumn('workshop', 'product_id', { transaction });
      await queryInterface.removeColumn('file', 'product_id', { transaction });
      await queryInterface.removeColumn('tool', 'product_id', { transaction });
      await queryInterface.removeColumn('game', 'product_id', { transaction });

      // 4. Add unique constraint on product (product_type, entity_id)
      await queryInterface.addConstraint('product', {
        fields: ['product_type', 'entity_id'],
        type: 'unique',
        name: 'unique_product_type_entity_id',
        transaction
      });

      // 5. Add index on entity_id for better query performance
      await queryInterface.addIndex('product', ['entity_id'], {
        name: 'product_entity_id_index',
        transaction
      });

      await transaction.commit();
      console.log('✅ Polymorphic product association migration completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Remove constraints and indexes
      await queryInterface.removeConstraint('product', 'unique_product_type_entity_id', { transaction });
      await queryInterface.removeIndex('product', 'product_entity_id_index', { transaction });

      // 2. Remove entity_id from product table
      await queryInterface.removeColumn('product', 'entity_id', { transaction });

      // 3. Re-add product_id columns to type tables
      await queryInterface.addColumn('course', 'product_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'product',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('workshop', 'product_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'product',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('file', 'product_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'product',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('tool', 'product_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'product',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('game', 'product_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'product',
          key: 'id'
        }
      }, { transaction });

      await transaction.commit();
      console.log('✅ Polymorphic product association rollback completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};