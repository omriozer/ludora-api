'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get all tables that might have difficulty_level column
      const tablesToCheck = [
        'file',
        'product',
        'game',
        'tool',
        'course',
        'workshop',
        'game_scatter_settings'
      ];

      for (const tableName of tablesToCheck) {
        try {
          // Check if table exists
          const tableExists = await queryInterface.sequelize.query(
            `SELECT table_name FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = 'public';`,
            { type: Sequelize.QueryTypes.SELECT, transaction }
          );

          if (tableExists.length > 0) {
            // Check if difficulty_level column exists in this table
            const columnExists = await queryInterface.sequelize.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'difficulty_level' AND table_schema = 'public';`,
              { type: Sequelize.QueryTypes.SELECT, transaction }
            );

            if (columnExists.length > 0) {
              console.log(`Removing difficulty_level column from ${tableName} table`);
              await queryInterface.removeColumn(tableName, 'difficulty_level', { transaction });
            } else {
              console.log(`difficulty_level column not found in ${tableName} table, skipping`);
            }
          } else {
            console.log(`Table ${tableName} does not exist, skipping`);
          }
        } catch (error) {
          console.log(`Error processing table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }

      await transaction.commit();
      console.log('Successfully removed difficulty_level columns from all applicable tables');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Re-add difficulty_level columns with ENUM type
      const tablesToRestore = [
        'file',
        'product',
        'game',
        'tool',
        'course',
        'workshop',
        'game_scatter_settings'
      ];

      for (const tableName of tablesToRestore) {
        try {
          // Check if table exists
          const tableExists = await queryInterface.sequelize.query(
            `SELECT table_name FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = 'public';`,
            { type: Sequelize.QueryTypes.SELECT, transaction }
          );

          if (tableExists.length > 0) {
            // Check if difficulty_level column doesn't exist
            const columnExists = await queryInterface.sequelize.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'difficulty_level' AND table_schema = 'public';`,
              { type: Sequelize.QueryTypes.SELECT, transaction }
            );

            if (columnExists.length === 0) {
              console.log(`Restoring difficulty_level column to ${tableName} table`);
              await queryInterface.addColumn(tableName, 'difficulty_level', {
                type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'),
                allowNull: true,
                defaultValue: null
              }, { transaction });
            }
          }
        } catch (error) {
          console.log(`Error restoring column in table ${tableName}:`, error.message);
          // Continue with other tables even if one fails
        }
      }

      await transaction.commit();
      console.log('Successfully restored difficulty_level columns to all applicable tables');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};