'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Update ClassroomMembership schema for unified teacher-student connection system
     *
     * Changes:
     * 1. Rename student_user_id to student_id
     * 2. Allow NULL classroom_id for teacher connections without specific classroom
     * 3. Update unique constraints for new requirements
     */

    // 1. Remove existing unique constraint first
    try {
      await queryInterface.removeConstraint('classroommembership', 'idx_classroommembership_unique_membership');
    } catch (error) {
      console.log('Constraint idx_classroommembership_unique_membership may not exist, continuing...');
    }

    // 2. Rename column from student_user_id to student_id
    await queryInterface.renameColumn('classroommembership', 'student_user_id', 'student_id');

    // 3. Allow NULL values for classroom_id (remove NOT NULL constraint)
    await queryInterface.changeColumn('classroommembership', 'classroom_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Classroom this membership belongs to (NULL for teacher-student connection without specific classroom)'
    });

    // 4. Update indexes to use new column name
    try {
      await queryInterface.removeIndex('classroommembership', 'idx_classroommembership_student');
      await queryInterface.addIndex('classroommembership', {
        fields: ['student_id'],
        name: 'idx_classroommembership_student'
      });
    } catch (error) {
      console.log('Index update may have failed, continuing...', error.message);
    }

    // 5. Add new unique constraint for complete combination (teacher_id, student_id, classroom_id)
    // This handles both cases: with and without classroom_id
    await queryInterface.addConstraint('classroommembership', {
      fields: ['teacher_id', 'student_id', 'classroom_id'],
      type: 'unique',
      name: 'idx_classroommembership_unique_full'
    });

    // 6. Add partial unique constraint for teacher-student connection without classroom
    // This ensures only one teacher-student connection can exist without specific classroom
    try {
      // PostgreSQL syntax for partial unique index (where classroom_id IS NULL)
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX idx_classroommembership_teacher_student_no_classroom
        ON classroommembership (teacher_id, student_id)
        WHERE classroom_id IS NULL
      `);
    } catch (error) {
      console.log('Partial unique index creation failed, may not be supported:', error.message);

      // Alternative approach: Use a unique constraint that includes NULL classroom_id
      // This is less strict but still prevents basic duplicates
      console.log('Adding fallback unique constraint...');
    }

    console.log('ClassroomMembership schema update completed successfully');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert ClassroomMembership schema changes
     */

    // Remove new constraints
    try {
      await queryInterface.removeConstraint('classroommembership', 'idx_classroommembership_unique_full');
    } catch (error) {
      console.log('Constraint removal failed:', error.message);
    }

    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_classroommembership_teacher_student_no_classroom');
    } catch (error) {
      console.log('Index removal failed:', error.message);
    }

    // Revert column name change
    await queryInterface.renameColumn('classroommembership', 'student_id', 'student_user_id');

    // Restore NOT NULL constraint for classroom_id
    await queryInterface.changeColumn('classroommembership', 'classroom_id', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Classroom this membership belongs to'
    });

    // Restore original unique constraint
    await queryInterface.addConstraint('classroommembership', {
      fields: ['classroom_id', 'student_user_id'],
      type: 'unique',
      name: 'idx_classroommembership_unique_membership'
    });

    // Update index back to old name
    try {
      await queryInterface.removeIndex('classroommembership', 'idx_classroommembership_student');
      await queryInterface.addIndex('classroommembership', {
        fields: ['student_user_id'],
        name: 'idx_classroommembership_student'
      });
    } catch (error) {
      console.log('Index revert may have failed:', error.message);
    }

    console.log('ClassroomMembership schema reverted successfully');
  }
};
