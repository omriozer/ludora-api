/**
 * Migration: Add UserSession Table Indexes (Split 2/7)
 *
 * Creates performance indexes for the UserSession table:
 * - Unified student_id performance indexing
 * - Portal-specific session management
 * - Session expiration and cleanup optimization
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging on user_session table
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    console.log('🔄 Adding UserSession table indexes using CONCURRENTLY...');

    const indexes = [
      { name: 'idx_user_session_student_id', columns: 'student_id', description: 'UserSession student_id index' },
      { name: 'idx_user_session_portal', columns: 'portal', description: 'UserSession portal-specific index' },
      { name: 'idx_user_session_portal_active', columns: 'portal, is_active', description: 'Active sessions by portal' },
      { name: 'idx_user_session_portal_student', columns: 'portal, student_id', description: 'Student sessions by portal' },
      { name: 'idx_user_session_student_active', columns: 'student_id, is_active', description: 'Student active sessions' },
      { name: 'idx_user_session_student_expires', columns: 'student_id, expires_at', description: 'Student session expiration' },
      { name: 'idx_user_session_expiration_cleanup', columns: 'expires_at, is_active', description: 'Session cleanup performance index' }
    ];

    let createdCount = 0;
    for (const index of indexes) {
      try {
        // Check if index already exists
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'user_session'
          AND indexname = '${index.name}'
        `);

        if (indexExists.length > 0) {
          console.log(`⚠️ Index ${index.name} already exists, skipping`);
          continue;
        }

        console.log(`Creating ${index.name} (${index.description})...`);

        // Use CONCURRENTLY to prevent table locks
        await queryInterface.sequelize.query(`
          CREATE INDEX CONCURRENTLY "${index.name}" ON "user_session" (${index.columns});
        `);

        console.log(`✅ Created ${index.name}`);
        createdCount++;
      } catch (error) {
        console.log(`⚠️ Failed to create ${index.name}:`, error.message);
        // Continue with other indexes instead of failing completely
      }
    }

    console.log(`✅ UserSession table indexes completed. Created ${createdCount} new indexes.`);
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging during rollback
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('🔄 Rolling back UserSession table indexes...');

    const indexesToRemove = [
      'idx_user_session_student_id',
      'idx_user_session_portal',
      'idx_user_session_portal_active',
      'idx_user_session_portal_student',
      'idx_user_session_student_active',
      'idx_user_session_student_expires',
      'idx_user_session_expiration_cleanup'
    ];

    let removedCount = 0;
    for (const indexName of indexesToRemove) {
      try {
        // Check if index exists before trying to remove it
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'user_session'
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

    console.log(`✅ UserSession indexes rollback completed. Removed ${removedCount} indexes.`);
  }
};