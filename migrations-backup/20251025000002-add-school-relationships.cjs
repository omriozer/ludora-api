'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding school_id columns and setting up school relationships...');

    // Add school_id to user table
    console.log('Adding school_id to user table...');
    await queryInterface.addColumn('user', 'school_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'school',
        key: 'id',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      comment: 'School that this user belongs to (teachers, students, headmasters)'
    });

    // Add school_id to classroom table
    console.log('Adding school_id to classroom table...');
    await queryInterface.addColumn('classroom', 'school_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'school',
        key: 'id',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      comment: 'School that this classroom belongs to'
    });

    // Add indexes for optimal performance
    console.log('Adding performance indexes...');

    // Index on user.school_id for finding all users of a school
    await queryInterface.addIndex('user', ['school_id'], {
      name: 'idx_user_school_id'
    });

    // Index on classroom.school_id for finding all classrooms of a school
    await queryInterface.addIndex('classroom', ['school_id'], {
      name: 'idx_classroom_school_id'
    });

    // Composite index on user.school_id + user_type for finding teachers/students of a school
    await queryInterface.addIndex('user', ['school_id', 'user_type'], {
      name: 'idx_user_school_type'
    });

    // Composite index on classroom.school_id + teacher_id for finding teacher's classrooms in a school
    await queryInterface.addIndex('classroom', ['school_id', 'teacher_id'], {
      name: 'idx_classroom_school_teacher'
    });

    // Composite index on classroom.teacher_id + is_active for finding active classrooms by teacher
    await queryInterface.addIndex('classroom', ['teacher_id', 'is_active'], {
      name: 'idx_classroom_teacher_active'
    });

    // Index on user.user_type for filtering by type
    await queryInterface.addIndex('user', ['user_type'], {
      name: 'idx_user_type'
    });

    console.log('School relationships and indexes created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing school relationships...');

    // Remove indexes first
    try {
      await queryInterface.removeIndex('user', 'idx_user_school_id');
    } catch (e) {
      console.log('Index idx_user_school_id might not exist');
    }

    try {
      await queryInterface.removeIndex('classroom', 'idx_classroom_school_id');
    } catch (e) {
      console.log('Index idx_classroom_school_id might not exist');
    }

    try {
      await queryInterface.removeIndex('user', 'idx_user_school_type');
    } catch (e) {
      console.log('Index idx_user_school_type might not exist');
    }

    try {
      await queryInterface.removeIndex('classroom', 'idx_classroom_school_teacher');
    } catch (e) {
      console.log('Index idx_classroom_school_teacher might not exist');
    }

    try {
      await queryInterface.removeIndex('classroom', 'idx_classroom_teacher_active');
    } catch (e) {
      console.log('Index idx_classroom_teacher_active might not exist');
    }

    try {
      await queryInterface.removeIndex('user', 'idx_user_type');
    } catch (e) {
      console.log('Index idx_user_type might not exist');
    }

    // Remove columns
    await queryInterface.removeColumn('user', 'school_id');
    await queryInterface.removeColumn('classroom', 'school_id');

    console.log('School relationships removed successfully');
  }
};