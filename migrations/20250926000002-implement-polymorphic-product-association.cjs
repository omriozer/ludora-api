'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if entity_id column already exists (from previous migration)
      const productColumns = await queryInterface.describeTable('product');

      if (!productColumns.entity_id) {
        // 1. Add entity_id column to product table
        await queryInterface.addColumn('product', 'entity_id', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '' // Temporary default, will be updated below
        }, { transaction });

        // 2. Migrate existing data - set entity_id = id for existing products
        // This works with the current monolithic structure
        await queryInterface.sequelize.query(`
          UPDATE product SET entity_id = id WHERE entity_id = '';
        `, { transaction });

        // 3. Add unique constraint on product (product_type, entity_id)
        await queryInterface.addConstraint('product', {
          fields: ['product_type', 'entity_id'],
          type: 'unique',
          name: 'unique_product_type_entity_id',
          transaction
        });

        // 4. Add index on entity_id for better query performance
        await queryInterface.addIndex('product', ['entity_id'], {
          name: 'product_entity_id_index',
          transaction
        });

        console.log('✅ Added entity_id column and constraints to product table');
      } else {
        console.log('✅ entity_id column already exists, polymorphic association already implemented');
      }

      // Note: We're not removing product_id columns from type tables because
      // they don't exist in the current monolithic structure. This migration
      // is designed to work with the existing database state.

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
      try {
        await queryInterface.removeConstraint('product', 'unique_product_type_entity_id', { transaction });
      } catch (error) {
        console.log('Constraint may not exist, continuing...');
      }

      try {
        await queryInterface.removeIndex('product', 'product_entity_id_index', { transaction });
      } catch (error) {
        console.log('Index may not exist, continuing...');
      }

      // 2. Remove entity_id from product table
      try {
        await queryInterface.removeColumn('product', 'entity_id', { transaction });
      } catch (error) {
        console.log('Column may not exist, continuing...');
      }

      await transaction.commit();
      console.log('✅ Polymorphic product association rollback completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};