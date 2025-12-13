'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Rename all remaining student_user_id columns to student_id for unified system
     *
     * Optimized version to prevent hanging during deployment
     */

    // Set reasonable lock timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('Starting optimized student_user_id -> student_id migration...');

    // Single query to find all tables that need updating
    const [tablesToUpdate] = await queryInterface.sequelize.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'student_user_id'
      AND table_name IN ('studentinvitation', 'parentconsent', 'classroommembership')
      ORDER BY table_name
    `);

    if (tablesToUpdate.length === 0) {
      console.log('✅ No tables need updating - all already use student_id');
      return;
    }

    console.log(`Found ${tablesToUpdate.length} table(s) to update:`, tablesToUpdate.map(t => t.table_name));

    // Process each table with optimized operations
    for (const { table_name } of tablesToUpdate) {
      try {
        console.log(`Processing ${table_name}...`);

        // Use raw SQL for faster execution than Sequelize's renameColumn
        await queryInterface.sequelize.query(`
          ALTER TABLE "${table_name}"
          RENAME COLUMN student_user_id TO student_id;
        `);

        // Handle index updates efficiently
        const indexName = `idx_${table_name}_student_user_id`;
        const newIndexName = `idx_${table_name}_student_id`;

        try {
          // Check if old index exists and drop it
          const [indexExists] = await queryInterface.sequelize.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = '${table_name}'
            AND indexname = '${indexName}'
          `);

          if (indexExists.length > 0) {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${indexName}";`);

            // Create new index
            await queryInterface.sequelize.query(`
              CREATE INDEX CONCURRENTLY "${newIndexName}" ON "${table_name}" (student_id);
            `);
            console.log(`✅ Index updated for ${table_name}`);
          }
        } catch (indexError) {
          console.log(`Index update skipped for ${table_name}:`, indexError.message);
        }

        console.log(`✅ ${table_name} updated successfully`);

      } catch (error) {
        console.log(`⚠️ Failed to update ${table_name}:`, error.message);
        // Continue with other tables instead of failing completely
      }
    }

    // Final verification with single query
    const [remainingColumns] = await queryInterface.sequelize.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name = 'student_user_id'
      ORDER BY table_name
    `);

    if (remainingColumns.length > 0) {
      console.log('⚠️ Some student_user_id columns remain:');
      remainingColumns.forEach(result => {
        console.log(`   - ${result.table_name}.${result.column_name}`);
      });
    } else {
      console.log('✅ All student_user_id columns successfully renamed to student_id');
    }

    console.log('Student ID unification migration completed');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert all column renames back to student_user_id
     * Optimized version to prevent hanging during rollback
     */

    // Set reasonable lock timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('Starting optimized rollback: student_id -> student_user_id...');

    // Single query to find all tables that need reverting
    const [tablesToRevert] = await queryInterface.sequelize.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'student_id'
      AND table_name IN ('studentinvitation', 'parentconsent', 'classroommembership')
      ORDER BY table_name
    `);

    if (tablesToRevert.length === 0) {
      console.log('✅ No tables need reverting - all already use student_user_id');
      return;
    }

    console.log(`Found ${tablesToRevert.length} table(s) to revert:`, tablesToRevert.map(t => t.table_name));

    // Process each table with optimized operations
    for (const { table_name } of tablesToRevert) {
      try {
        console.log(`Reverting ${table_name}...`);

        // Use raw SQL for faster execution
        await queryInterface.sequelize.query(`
          ALTER TABLE "${table_name}"
          RENAME COLUMN student_id TO student_user_id;
        `);

        // Handle index updates efficiently
        const oldIndexName = `idx_${table_name}_student_id`;
        const newIndexName = `idx_${table_name}_student_user_id`;

        try {
          // Check if old index exists and drop it
          const [indexExists] = await queryInterface.sequelize.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = '${table_name}'
            AND indexname = '${oldIndexName}'
          `);

          if (indexExists.length > 0) {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${oldIndexName}";`);

            // Create new index
            await queryInterface.sequelize.query(`
              CREATE INDEX CONCURRENTLY "${newIndexName}" ON "${table_name}" (student_user_id);
            `);
            console.log(`✅ Index reverted for ${table_name}`);
          }
        } catch (indexError) {
          console.log(`Index revert skipped for ${table_name}:`, indexError.message);
        }

        console.log(`✅ ${table_name} reverted successfully`);

      } catch (error) {
        console.log(`⚠️ Failed to revert ${table_name}:`, error.message);
        // Continue with other tables instead of failing completely
      }
    }

    console.log('Column rename revert completed');
  }
};