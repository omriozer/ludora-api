const { DataTypes } = require('sequelize');

/**
 * Migration: Drop Unused Tables
 *
 * Drops unused tables that are no longer needed:
 * 1. contact_page_generators - Obsolete contact page generation functionality
 * 2. transaction_temp - Temporary transaction table no longer used
 *
 * Uses IF EXISTS to avoid errors if tables are already dropped.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Starting unused tables cleanup...');

      // Drop contact_page_generators table
      console.log('🗑️ Dropping contact_page_generators table...');
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS contact_page_generators CASCADE;',
        { transaction }
      );

      // Drop transaction_temp table
      console.log('🗑️ Dropping transaction_temp table...');
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS transaction_temp CASCADE;',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Unused tables cleanup completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting unused tables cleanup...');
      console.log('⚠️ Note: This migration cannot be fully reversed as the original table structures are unknown.');
      console.log('⚠️ If you need to restore these tables, you will need to recreate them manually.');

      // We cannot restore the tables without knowing their original structure
      // This is intentionally left incomplete as these tables were marked for deletion

      await transaction.commit();
      console.log('✅ Rollback completed (tables remain dropped as intended).');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};