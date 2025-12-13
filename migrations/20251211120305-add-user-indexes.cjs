/**
 * Migration: Add User Table Indexes (Split 5/7)
 *
 * Creates performance indexes for the User table:
 * - User type filtering (student/teacher)
 * - Verification status tracking
 * - Active status management
 * - Invitation code lookup
 *
 * Part of the split enhanced indexes migration for faster deployment.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging on large user table
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 120000;'); // 2 minutes for index creation

    console.log('🔄 Adding User table indexes using CONCURRENTLY...');

    const indexes = [
      { name: 'idx_user_type', column: 'user_type', description: 'User type index (for student/teacher filtering)' },
      { name: 'idx_user_verified', column: 'is_verified', description: 'User verification status index' },
      { name: 'idx_user_active', column: 'is_active', description: 'User active status index' },
      { name: 'idx_user_invitation_code', column: 'invitation_code', description: 'Teacher invitation code index' }
    ];

    let createdCount = 0;
    for (const index of indexes) {
      try {
        // Check if index already exists
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'user'
          AND indexname = '${index.name}'
        `);

        if (indexExists.length > 0) {
          console.log(`⚠️ Index ${index.name} already exists, skipping`);
          continue;
        }

        console.log(`Creating ${index.name} (${index.description})...`);

        // Use CONCURRENTLY to prevent table locks
        await queryInterface.sequelize.query(`
          CREATE INDEX CONCURRENTLY "${index.name}" ON "user" (${index.column});
        `);

        console.log(`✅ Created ${index.name}`);
        createdCount++;
      } catch (error) {
        console.log(`⚠️ Failed to create ${index.name}:`, error.message);
        // Continue with other indexes instead of failing completely
      }
    }

    console.log(`✅ User table indexes completed. Created ${createdCount} new indexes.`);
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging during rollback
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('🔄 Rolling back User table indexes...');

    const indexesToRemove = [
      'idx_user_type',
      'idx_user_verified',
      'idx_user_active',
      'idx_user_invitation_code'
    ];

    let removedCount = 0;
    for (const indexName of indexesToRemove) {
      try {
        // Check if index exists before trying to remove it
        const [indexExists] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'user'
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

    console.log(`✅ User indexes rollback completed. Removed ${removedCount} indexes.`);
  }
};