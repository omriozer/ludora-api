'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Rename all remaining student_user_id columns to student_id for unified system
     *
     * This migration completes the transition from student_user_id to student_id
     * across all tables in the system.
     */

    // 1. Fix StudentInvitation table
    try {
      console.log('Checking StudentInvitation table...');

      // Check if column exists before renaming
      const [results] = await queryInterface.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'studentinvitation'
        AND column_name = 'student_user_id'
      `);

      if (results.length > 0) {
        console.log('Renaming student_user_id to student_id in studentinvitation table...');
        await queryInterface.renameColumn('studentinvitation', 'student_user_id', 'student_id');
        console.log('✅ StudentInvitation table updated');

        // Update any indexes that reference the old column name
        try {
          await queryInterface.removeIndex('studentinvitation', 'idx_studentinvitation_student_user_id');
          await queryInterface.addIndex('studentinvitation', {
            fields: ['student_id'],
            name: 'idx_studentinvitation_student_id'
          });
        } catch (indexError) {
          console.log('Index update not needed or failed:', indexError.message);
        }
      } else {
        console.log('StudentInvitation table already has student_id column');
      }
    } catch (error) {
      console.log('StudentInvitation table update failed or not needed:', error.message);
    }

    // 2. Fix ParentConsent table (if it exists)
    try {
      console.log('Checking ParentConsent table...');

      // Check if table exists and has the column
      const [parentConsentResults] = await queryInterface.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'parentconsent'
        AND column_name = 'student_user_id'
      `);

      if (parentConsentResults.length > 0) {
        console.log('Renaming student_user_id to student_id in parentconsent table...');
        await queryInterface.renameColumn('parentconsent', 'student_user_id', 'student_id');
        console.log('✅ ParentConsent table updated');

        // Update any indexes that reference the old column name
        try {
          await queryInterface.removeIndex('parentconsent', 'idx_parentconsent_student_user_id');
          await queryInterface.addIndex('parentconsent', {
            fields: ['student_id'],
            name: 'idx_parentconsent_student_id'
          });
        } catch (indexError) {
          console.log('ParentConsent index update not needed or failed:', indexError.message);
        }
      } else {
        console.log('ParentConsent table does not exist or already has student_id column');
      }
    } catch (error) {
      console.log('ParentConsent table update failed or not needed:', error.message);
    }

    // 3. Double-check ClassroomMembership table (should already be done)
    try {
      console.log('Verifying ClassroomMembership table...');

      const [classroomResults] = await queryInterface.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'classroommembership'
        AND column_name = 'student_user_id'
      `);

      if (classroomResults.length > 0) {
        console.log('ClassroomMembership still has student_user_id, fixing...');
        await queryInterface.renameColumn('classroommembership', 'student_user_id', 'student_id');
        console.log('✅ ClassroomMembership table updated');
      } else {
        console.log('✅ ClassroomMembership table already has student_id column');
      }
    } catch (error) {
      console.log('ClassroomMembership verification failed:', error.message);
    }

    // 4. Check for any other tables with student_user_id columns
    try {
      console.log('Scanning for any remaining student_user_id columns...');

      const [allResults] = await queryInterface.sequelize.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE column_name = 'student_user_id'
        ORDER BY table_name
      `);

      if (allResults.length > 0) {
        console.log('⚠️ Found remaining student_user_id columns:');
        allResults.forEach(result => {
          console.log(`   - ${result.table_name}.${result.column_name}`);
        });
      } else {
        console.log('✅ No remaining student_user_id columns found');
      }
    } catch (error) {
      console.log('Full scan failed:', error.message);
    }

    console.log('Student ID unification migration completed');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert all column renames back to student_user_id
     */

    console.log('Reverting student_id columns back to student_user_id...');

    // Revert StudentInvitation
    try {
      await queryInterface.renameColumn('studentinvitation', 'student_id', 'student_user_id');

      // Revert indexes
      try {
        await queryInterface.removeIndex('studentinvitation', 'idx_studentinvitation_student_id');
        await queryInterface.addIndex('studentinvitation', {
          fields: ['student_user_id'],
          name: 'idx_studentinvitation_student_user_id'
        });
      } catch (indexError) {
        console.log('StudentInvitation index revert failed:', indexError.message);
      }
    } catch (error) {
      console.log('StudentInvitation revert failed:', error.message);
    }

    // Revert ParentConsent
    try {
      await queryInterface.renameColumn('parentconsent', 'student_id', 'student_user_id');

      // Revert indexes
      try {
        await queryInterface.removeIndex('parentconsent', 'idx_parentconsent_student_id');
        await queryInterface.addIndex('parentconsent', {
          fields: ['student_user_id'],
          name: 'idx_parentconsent_student_user_id'
        });
      } catch (indexError) {
        console.log('ParentConsent index revert failed:', indexError.message);
      }
    } catch (error) {
      console.log('ParentConsent revert failed:', error.message);
    }

    // Revert ClassroomMembership if needed
    try {
      await queryInterface.renameColumn('classroommembership', 'student_id', 'student_user_id');
    } catch (error) {
      console.log('ClassroomMembership revert failed:', error.message);
    }

    console.log('Column rename revert completed');
  }
};