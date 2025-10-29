'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('Starting grade range migration...');

      // Add new columns one by one
      await queryInterface.addColumn('curriculum', 'grade_from', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Starting grade for range (1-12)'
      }, { transaction });
      console.log('Added grade_from column');

      await queryInterface.addColumn('curriculum', 'grade_to', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Ending grade for range (1-12)'
      }, { transaction });
      console.log('Added grade_to column');

      await queryInterface.addColumn('curriculum', 'is_grade_range', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this curriculum applies to a grade range or single grade'
      }, { transaction });
      console.log('Added is_grade_range column');

      // Migrate existing data (PostgreSQL compatible)
      await queryInterface.sequelize.query(`
        UPDATE curriculum
        SET grade_from = grade, grade_to = grade, is_grade_range = false
        WHERE grade_from IS NULL AND grade_to IS NULL
      `, { transaction });
      console.log('Migrated existing data');

      await transaction.commit();
      console.log('✅ Grade range migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Grade range migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('curriculum', 'grade_from', { transaction });
      await queryInterface.removeColumn('curriculum', 'grade_to', { transaction });
      await queryInterface.removeColumn('curriculum', 'is_grade_range', { transaction });

      await transaction.commit();
      console.log('✅ Grade range rollback completed');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Grade range rollback failed:', error);
      throw error;
    }
  }
};