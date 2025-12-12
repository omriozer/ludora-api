'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding user profile fields to User table...');

    // Check if columns already exist
    const tableDescription = await queryInterface.describeTable('user');

    // Add profile_image_url field
    if (!tableDescription.profile_image_url) {
      await queryInterface.addColumn('user', 'profile_image_url', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Google profile picture URL from Firebase authentication'
      });
      console.log('✅ Added profile_image_url field');
    } else {
      console.log('⚠️ profile_image_url column already exists');
    }

    // Add first_name field
    if (!tableDescription.first_name) {
      await queryInterface.addColumn('user', 'first_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'First name from Firebase (given_name)'
      });
      console.log('✅ Added first_name field');
    } else {
      console.log('⚠️ first_name column already exists');
    }

    // Add last_name field
    if (!tableDescription.last_name) {
      await queryInterface.addColumn('user', 'last_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Last name from Firebase (family_name)'
      });
      console.log('✅ Added last_name field');
    } else {
      console.log('⚠️ last_name column already exists');
    }

    // Add indexes for performance (names are searchable)
    try {
      await queryInterface.addIndex('user', {
        name: 'idx_user_first_name',
        fields: ['first_name']
      });
      console.log('✅ Added first_name index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ first_name index already exists');
      } else {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex('user', {
        name: 'idx_user_last_name',
        fields: ['last_name']
      });
      console.log('✅ Added last_name index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ last_name index already exists');
      } else {
        throw error;
      }
    }

    console.log('🎯 User profile fields migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back user profile fields...');

    // Remove indexes first
    try {
      await queryInterface.removeIndex('user', 'idx_user_first_name');
      console.log('❌ Removed first_name index');
    } catch (error) {
      console.log('⚠️ first_name index not found or already removed');
    }

    try {
      await queryInterface.removeIndex('user', 'idx_user_last_name');
      console.log('❌ Removed last_name index');
    } catch (error) {
      console.log('⚠️ last_name index not found or already removed');
    }

    // Remove columns
    await queryInterface.removeColumn('user', 'profile_image_url');
    console.log('❌ Removed profile_image_url field');

    await queryInterface.removeColumn('user', 'first_name');
    console.log('❌ Removed first_name field');

    await queryInterface.removeColumn('user', 'last_name');
    console.log('❌ Removed last_name field');

    console.log('🔄 User profile fields rollback completed');
  }
};