'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding linked_teacher_id field to User table...');

    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('user');
    if (tableDescription.linked_teacher_id) {
      console.log('⚠️ linked_teacher_id column already exists');
      return;
    }

    // Add the linked_teacher_id column
    await queryInterface.addColumn('user', 'linked_teacher_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'User ID of teacher this student is linked to for parent consent requirements. NULL = not linked to teacher'
    });

    // Add foreign key constraint (self-referential to User table)
    await queryInterface.addConstraint('user', {
      name: 'fk_user_linked_teacher',
      type: 'foreign key',
      fields: ['linked_teacher_id'],
      references: {
        table: 'user',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for efficient querying
    await queryInterface.addIndex('user', {
      name: 'idx_user_linked_teacher',
      fields: ['linked_teacher_id']
    });

    console.log('✅ linked_teacher_id field added successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back linked_teacher_id field...');

    // Remove the constraint first
    await queryInterface.removeConstraint('user', 'fk_user_linked_teacher');

    // Remove the index
    await queryInterface.removeIndex('user', 'idx_user_linked_teacher');

    // Remove the column
    await queryInterface.removeColumn('user', 'linked_teacher_id');

    console.log('❌ Removed linked_teacher_id field');
    console.log('🔄 Migration rollback completed');
  }
};