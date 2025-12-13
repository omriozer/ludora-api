/**
 * Migration: Add ClassroomMembership approval workflow
 *
 * Adds comprehensive approval workflow to ClassroomMembership table:
 * - Status enum with pending/active/denied/inactive states
 * - Approval workflow timestamps and messages
 * - Enhanced indexes for workflow management
 * - Support for both teacher-initiated and student-initiated flows
 *
 * Note: Works with the new student_id field (not student_user_id)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging on large operations
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 180000;'); // 3 minutes for complex operations

    console.log('🔄 Adding ClassroomMembership approval workflow (optimized)...');

      // Step 1: Check current table structure
      const tableDescription = await queryInterface.describeTable('classroommembership');

      // Step 2: Handle status field (could be varchar or enum)
      if (!tableDescription.status) {
        console.log('📝 Adding status enum column...');
        await queryInterface.addColumn('classroommembership', 'status', {
          type: Sequelize.ENUM('pending', 'active', 'denied', 'inactive'),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Membership approval status'
        });
      } else {
        console.log('⚠️ Status column already exists, checking if it needs conversion to enum...');

        // Check if status is already an enum or varchar
        const statusColumn = tableDescription.status;

        if (statusColumn.type === 'character varying') {
          console.log('🔄 Converting varchar status column to enum...');

          // Step 1: Create the enum type
          await queryInterface.sequelize.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_classroommembership_status') THEN
                CREATE TYPE enum_classroommembership_status AS ENUM ('pending', 'active', 'denied', 'inactive');
              END IF;
            END $$;
          `);

          // Step 2: Update existing values to match enum values
          await queryInterface.sequelize.query(`
            UPDATE classroommembership
            SET status = CASE
              WHEN status = 'active' OR status = 'approved' OR status IS NULL THEN 'active'
              WHEN status = 'pending' OR status = 'requested' THEN 'pending'
              WHEN status = 'denied' OR status = 'rejected' THEN 'denied'
              WHEN status = 'inactive' OR status = 'removed' THEN 'inactive'
              ELSE 'pending'
            END
          `);

          // Step 3: Convert the column type
          await queryInterface.changeColumn('classroommembership', 'status', {
            type: 'enum_classroommembership_status',
            allowNull: false,
            defaultValue: 'pending'
          });

          console.log('✅ Successfully converted status column to enum');
        } else {
          console.log('✅ Status column is already an enum type');
        }
      }

      // Step 3: Add approval workflow timestamp fields
      if (!tableDescription.requested_at) {
        console.log('📅 Adding requested_at timestamp...');
        await queryInterface.addColumn('classroommembership', 'requested_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When membership was requested'
        });
      }

      if (!tableDescription.approved_at) {
        console.log('📅 Adding approved_at timestamp...');
        await queryInterface.addColumn('classroommembership', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When membership was approved/denied'
        });
      }

      // Step 4: Add approval workflow message fields
      if (!tableDescription.request_message) {
        console.log('💬 Adding request_message field...');
        await queryInterface.addColumn('classroommembership', 'request_message', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Optional message from student when requesting'
        });
      }

      if (!tableDescription.approval_message) {
        console.log('💬 Adding approval_message field...');
        await queryInterface.addColumn('classroommembership', 'approval_message', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Optional message from teacher when approving/denying'
        });
      }

      // Step 5: Add student display name field for privacy
      if (!tableDescription.student_display_name) {
        console.log('👤 Adding student_display_name field...');
        await queryInterface.addColumn('classroommembership', 'student_display_name', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Custom display name for privacy (optional)'
        });
      }

      // Step 6: Update existing active memberships to have proper timestamps
      console.log('🔄 Updating existing memberships...');

      // Set requested_at for existing records that don't have it
      await queryInterface.sequelize.query(`
        UPDATE classroommembership
        SET requested_at = created_at
        WHERE requested_at IS NULL
      `);

      // Set approved_at for active memberships that don't have it
      // Note: joined_at is varchar, so we need to convert it to timestamp if possible
      await queryInterface.sequelize.query(`
        UPDATE classroommembership
        SET approved_at = CASE
          WHEN joined_at IS NOT NULL AND joined_at != '' THEN
            CASE
              WHEN joined_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN joined_at::timestamp
              ELSE created_at
            END
          ELSE created_at
        END
        WHERE status = 'active' AND approved_at IS NULL
      `);

      // Step 7: Create workflow-specific indexes using CONCURRENTLY
      console.log('🔗 Creating approval workflow indexes using CONCURRENTLY...');

      const indexes = [
        { name: 'idx_classroommembership_teacher_status', columns: 'teacher_id, status', description: 'Teacher pending approvals' },
        { name: 'idx_classroommembership_classroom_status', columns: 'classroom_id, status', description: 'Classroom status filtering' },
        { name: 'idx_classroommembership_requested_at', columns: 'requested_at', description: 'Request timestamp ordering' },
        { name: 'idx_classroommembership_approved_at', columns: 'approved_at', description: 'Approval timestamp ordering' },
        { name: 'idx_classroommembership_teacher_workflow', columns: 'teacher_id, status, requested_at', description: 'Teacher dashboard queries' },
        { name: 'idx_classroommembership_student_status', columns: 'student_id, status', description: 'Student-specific index' }
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
          await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY "${index.name}" ON "classroommembership" (${index.columns});
          `);

          console.log(`✅ Created ${index.name}`);
          createdCount++;
        } catch (error) {
          console.log(`⚠️ Failed to create ${index.name}:`, error.message);
          // Continue with other indexes instead of failing completely
        }
      }

      console.log(`✅ Created ${createdCount} workflow indexes using CONCURRENTLY`)

      // Step 8: Verify the migration
      const updatedTable = await queryInterface.describeTable('classroommembership');
      const requiredFields = ['status', 'requested_at', 'approved_at', 'request_message', 'approval_message'];
      const missingFields = requiredFields.filter(field => !updatedTable[field]);

      if (missingFields.length > 0) {
        throw new Error(`Migration incomplete. Missing fields: ${missingFields.join(', ')}`);
      }

      console.log('✅ ClassroomMembership approval workflow migration completed successfully:');
      console.log('   - Added status enum with workflow states');
      console.log('   - Added approval timestamps and message fields');
      console.log('   - Created workflow-optimized indexes using CONCURRENTLY');
      console.log('   - Updated existing memberships with proper timestamps');
      console.log('   - Compatible with unified student_id field');
  },

  async down(queryInterface, Sequelize) {
    // Set timeouts to prevent hanging during rollback
    await queryInterface.sequelize.query('SET lock_timeout = 30000;'); // 30 seconds
    await queryInterface.sequelize.query('SET statement_timeout = 60000;'); // 60 seconds

    console.log('🔄 Rolling back ClassroomMembership approval workflow...');

    // Remove workflow-specific indexes
    const indexesToRemove = [
      'idx_classroommembership_student_status',
      'idx_classroommembership_teacher_workflow',
      'idx_classroommembership_approved_at',
      'idx_classroommembership_requested_at',
      'idx_classroommembership_teacher_status',
      'idx_classroommembership_classroom_status'
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

    // Remove approval workflow columns
    const columnsToRemove = [
      'student_display_name',
      'approval_message',
      'request_message',
      'approved_at',
      'requested_at'
    ];

    for (const columnName of columnsToRemove) {
      try {
        await queryInterface.removeColumn('classroommembership', columnName);
        console.log(`✅ Removed column ${columnName}`);
      } catch (error) {
        console.log(`⚠️ Column ${columnName} may not exist:`, error.message);
      }
    }

    // Note: We don't remove the status enum completely as it might break existing data
    // In production, enum modifications should be handled more carefully

    console.log(`✅ ClassroomMembership approval workflow rollback completed. Removed ${removedCount} indexes.`);
  }
};