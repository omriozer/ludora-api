'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Fixing ClassroomMembership approval columns...');

    try {
      // Get table description to check existing columns
      const tableDescription = await queryInterface.describeTable('classroommembership');

      // Helper function to check if column exists
      const hasColumn = (columnName) => {
        return Object.prototype.hasOwnProperty.call(tableDescription, columnName);
      };

      // Add requested_at column if it doesn't exist
      if (!hasColumn('requested_at')) {
        console.log('📅 Adding requested_at column...');
        await queryInterface.addColumn('classroommembership', 'requested_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the membership was requested'
        });
      } else {
        console.log('✅ requested_at column already exists');
      }

      // Add approved_at column if it doesn't exist
      if (!hasColumn('approved_at')) {
        console.log('📅 Adding approved_at column...');
        await queryInterface.addColumn('classroommembership', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the membership was approved'
        });
      } else {
        console.log('✅ approved_at column already exists');
      }

      // Add request_message column if it doesn't exist
      if (!hasColumn('request_message')) {
        console.log('💬 Adding request_message column...');
        await queryInterface.addColumn('classroommembership', 'request_message', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Optional message from student when requesting to join'
        });
      } else {
        console.log('✅ request_message column already exists');
      }

      // Add approval_message column if it doesn't exist
      if (!hasColumn('approval_message')) {
        console.log('💬 Adding approval_message column...');
        await queryInterface.addColumn('classroommembership', 'approval_message', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Optional message from teacher when approving/denying'
        });
      } else {
        console.log('✅ approval_message column already exists');
      }

      // Add helpful indexes if they don't exist
      const indexQueries = [
        {
          name: 'idx_classroommembership_requested_at',
          query: `CREATE INDEX IF NOT EXISTS "idx_classroommembership_requested_at" ON "classroommembership" ("requested_at");`
        },
        {
          name: 'idx_classroommembership_approved_at',
          query: `CREATE INDEX IF NOT EXISTS "idx_classroommembership_approved_at" ON "classroommembership" ("approved_at");`
        },
        {
          name: 'idx_classroommembership_student_status',
          query: `CREATE INDEX IF NOT EXISTS "idx_classroommembership_student_status" ON "classroommembership" ("student_user_id", "status");`
        },
        {
          name: 'idx_classroommembership_teacher_workflow',
          query: `CREATE INDEX IF NOT EXISTS "idx_classroommembership_teacher_workflow" ON "classroommembership" ("teacher_id", "status");`
        }
      ];

      console.log('🔗 Adding helpful indexes...');
      for (const index of indexQueries) {
        try {
          await queryInterface.sequelize.query(index.query);
          console.log(`✅ Added index ${index.name}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`✅ Index ${index.name} already exists`);
          } else {
            console.warn(`⚠️ Warning: Could not create index ${index.name}:`, error.message);
          }
        }
      }

      console.log('✅ ClassroomMembership approval columns fix completed');

    } catch (error) {
      console.error('❌ Error fixing ClassroomMembership approval columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back ClassroomMembership approval columns fix...');

    try {
      // Remove indexes
      const indexesToDrop = [
        'idx_classroommembership_requested_at',
        'idx_classroommembership_approved_at',
        'idx_classroommembership_student_status',
        'idx_classroommembership_teacher_workflow'
      ];

      for (const indexName of indexesToDrop) {
        try {
          await queryInterface.removeIndex('classroommembership', indexName);
          console.log(`✅ Removed index ${indexName}`);
        } catch (error) {
          if (!error.message.includes('does not exist')) {
            console.warn(`⚠️ Warning: Could not remove index ${indexName}:`, error.message);
          }
        }
      }

      // Remove columns (only remove if they exist)
      const tableDescription = await queryInterface.describeTable('classroommembership');

      if (Object.prototype.hasOwnProperty.call(tableDescription, 'approval_message')) {
        await queryInterface.removeColumn('classroommembership', 'approval_message');
        console.log('✅ Removed approval_message column');
      }

      if (Object.prototype.hasOwnProperty.call(tableDescription, 'request_message')) {
        await queryInterface.removeColumn('classroommembership', 'request_message');
        console.log('✅ Removed request_message column');
      }

      if (Object.prototype.hasOwnProperty.call(tableDescription, 'approved_at')) {
        await queryInterface.removeColumn('classroommembership', 'approved_at');
        console.log('✅ Removed approved_at column');
      }

      if (Object.prototype.hasOwnProperty.call(tableDescription, 'requested_at')) {
        await queryInterface.removeColumn('classroommembership', 'requested_at');
        console.log('✅ Removed requested_at column');
      }

      console.log('✅ ClassroomMembership approval columns rollback completed');

    } catch (error) {
      console.error('❌ Error rolling back ClassroomMembership approval columns:', error);
      throw error;
    }
  }
};