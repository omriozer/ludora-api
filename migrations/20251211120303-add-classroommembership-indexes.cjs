/**
 * Migration: Add ClassroomMembership Table Indexes (Split 3/7)
 *
 * Creates performance indexes for the ClassroomMembership table:
 * - Unified student_id membership queries
 * - Unique membership constraint enforcement
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    console.log('🔄 Adding ClassroomMembership table indexes using CONCURRENTLY...');

    const indexes = [
      { name: 'idx_classroommembership_student', columns: 'student_id', description: 'Student membership queries', unique: false },
      { name: 'idx_classroommembership_unique_student_membership', columns: 'classroom_id, student_id', description: 'Unique membership constraint', unique: true }
    ];

    let createdCount = 0;
    for (const index of indexes) {
      try {
        // Check if index already exists
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'classroommembership'
          AND indexname = '${index.name}'
        `);

        if (indexExists.length > 0) {
          console.log(`⚠️ Index ${index.name} already exists, skipping`);
          continue;
        }

        console.log(`Creating ${index.name} (${index.description})...`);

        // Use CONCURRENTLY to prevent table locks
        const uniqueClause = index.unique ? 'UNIQUE' : '';
        await queryInterface.sequelize.query(`
          CREATE ${uniqueClause} INDEX CONCURRENTLY "${index.name}" ON "classroommembership" (${index.columns});
        `);

        console.log(`✅ Created ${index.name}`);
        createdCount++;
      } catch (error) {
        console.log(`⚠️ Failed to create ${index.name}:`, error.message);
        // Continue with other indexes instead of failing completely
      }
    }

    console.log(`✅ ClassroomMembership table indexes completed. Created ${createdCount} new indexes.`);
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging during rollback
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('🔄 Rolling back ClassroomMembership table indexes...');

    const indexesToRemove = [
      'idx_classroommembership_student',
      'idx_classroommembership_unique_student_membership'
    ];

    let removedCount = 0;
    for (const indexName of indexesToRemove) {
      try {
        // Check if index exists before trying to remove it
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'classroommembership'
          AND indexname = '${indexName}'
        `);

        if (indexExists.length === 0) {
          console.log(`⚠️ Index ${indexName} does not exist, skipping`);
          continue;
        }

        // Drop index using raw SQL for better control
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${indexName}";`);
        console.log(`✅ Removed index ${indexName}`);
        removedCount++;
      } catch (error) {
        console.log(`⚠️ Failed to remove ${indexName}:`, error.message);
        // Continue with other indexes instead of failing completely
      }
    }

    console.log(`✅ ClassroomMembership indexes rollback completed. Removed ${removedCount} indexes.`);
  }
};