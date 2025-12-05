'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding age_verified_by field to User table...');

    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('user');
    if (tableDescription.age_verified_by) {
      console.log('⚠️ age_verified_by column already exists');
      return;
    }

    // Add the age_verified_by column
    await queryInterface.addColumn('user', 'age_verified_by', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'User ID of teacher who verified student is 18+ years old. NULL = not verified'
    });

    // Add foreign key constraint (self-referential to User table)
    await queryInterface.addConstraint('user', {
      name: 'fk_user_age_verified_by',
      type: 'foreign key',
      fields: ['age_verified_by'],
      references: {
        table: 'user',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for efficient querying
    await queryInterface.addIndex('user', {
      name: 'idx_user_age_verified_by',
      fields: ['age_verified_by']
    });

    console.log('✅ age_verified_by field added successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back age_verified_by field...');

    // Remove the constraint first
    await queryInterface.removeConstraint('user', 'fk_user_age_verified_by');

    // Remove the index
    await queryInterface.removeIndex('user', 'idx_user_age_verified_by');

    // Remove the column
    await queryInterface.removeColumn('user', 'age_verified_by');

    console.log('❌ Removed age_verified_by field');
    console.log('🔄 Migration rollback completed');
  }
};