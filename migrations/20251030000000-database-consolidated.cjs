'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Database Consolidation Migration
     *
     * This migration represents the consolidated state of the database
     * after restoration from backup. All previous migrations have been
     * applied and the schema is now managed via create-schema.sql.
     *
     * This migration does nothing but serves as a placeholder to prevent
     * deployment failures when no migrations exist.
     */

    console.log('✅ Database consolidation migration - no changes needed');
    console.log('📋 Schema managed via create-schema.sql');
    console.log('🔄 Previous migrations applied during backup restoration');

    // No actual changes - database already at correct state
    return Promise.resolve();
  },

  async down(queryInterface, Sequelize) {
    /**
     * This migration cannot be rolled back as it represents
     * a consolidation of many previous migrations.
     */
    console.log('⚠️  Cannot rollback consolidated database state');
    console.log('📝 Use backup restoration for database rollback');
    return Promise.resolve();
  }
};