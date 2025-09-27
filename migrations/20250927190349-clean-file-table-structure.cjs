'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    console.log('🧹 Cleaning File table - removing Product-specific fields...');

    // Fields that should only exist in Product table (polymorphic reference)
    const productFieldsToRemove = [
      'price',
      'is_published',
      'image_url',
      'image_is_private',
      'tags',
      'target_audience',
      'difficulty_level',
      'access_days',
      'is_lifetime_access',
      'short_description'
    ];

    // Unnecessary file fields (per user request)
    const unnecessaryFileFields = [
      'description',
      'preview_file_url',
      'file_is_private',
      'preview_file_is_private',
      'downloads_count',
      'created_by',
      'created_by_id'
    ];

    const fieldsToRemove = [...productFieldsToRemove, ...unnecessaryFileFields];

    console.log(`📋 Removing ${fieldsToRemove.length} inappropriate fields from File table...`);

    // Remove each field if it exists
    for (const field of fieldsToRemove) {
      try {
        console.log(`  🗑️  Removing field: ${field}`);
        await queryInterface.removeColumn('file', field);
      } catch (error) {
        console.log(`  ⚠️  Field ${field} may not exist or already removed: ${error.message}`);
      }
    }

    console.log('✅ File table cleanup completed');
  },

  async down (queryInterface, Sequelize) {
    console.log('⚠️  Rolling back File table cleanup...');

    // Add back the removed fields with their original types
    const productFieldsToAdd = [
      { name: 'price', type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      { name: 'is_published', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'image_url', type: Sequelize.STRING },
      { name: 'image_is_private', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'tags', type: Sequelize.JSONB },
      { name: 'target_audience', type: Sequelize.STRING },
      { name: 'difficulty_level', type: Sequelize.STRING },
      { name: 'access_days', type: Sequelize.INTEGER },
      { name: 'is_lifetime_access', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'short_description', type: Sequelize.TEXT }
    ];

    const unnecessaryFileFieldsToAdd = [
      { name: 'description', type: Sequelize.TEXT },
      { name: 'preview_file_url', type: Sequelize.STRING },
      { name: 'file_is_private', type: Sequelize.BOOLEAN, defaultValue: true },
      { name: 'preview_file_is_private', type: Sequelize.BOOLEAN, defaultValue: false },
      { name: 'downloads_count', type: Sequelize.INTEGER, defaultValue: 0 },
      { name: 'created_by', type: Sequelize.STRING },
      { name: 'created_by_id', type: Sequelize.STRING }
    ];

    const fieldsToAdd = [...productFieldsToAdd, ...unnecessaryFileFieldsToAdd];

    for (const field of fieldsToAdd) {
      try {
        await queryInterface.addColumn('file', field.name, {
          type: field.type,
          defaultValue: field.defaultValue,
          allowNull: field.allowNull !== false
        });
      } catch (error) {
        console.log(`⚠️  Error adding back field ${field.name}: ${error.message}`);
      }
    }

    console.log('✅ File table rollback completed');
  }
};
