'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove entity-specific fields that shouldn't be in the polymorphic Product table

    // Workshop-specific fields
    const workshopFields = [
      'workshop_id',
      'workshop_type',
      'scheduled_date',
      'meeting_link',
      'meeting_password',
      'meeting_platform',
      'max_participants',
      'duration_minutes'
    ];

    // Course-specific fields
    const courseFields = [
      'course_modules',
      'total_duration_minutes'
    ];

    // File-specific fields
    const fileFields = [
      'file_url',
      'preview_file_url',
      'file_type',
      'downloads_count'
    ];

    // Video-specific fields
    const videoFields = [
      'video_file_url'
    ];

    // Redundant fields
    const redundantFields = [
      'is_lifetime_access', // redundant with access_days NULL check
      'is_sample'
    ];

    // Remove all problematic columns
    const allFieldsToRemove = [
      ...workshopFields,
      ...courseFields,
      ...fileFields,
      ...videoFields,
      ...redundantFields
    ];

    for (const field of allFieldsToRemove) {
      try {
        await queryInterface.removeColumn('product', field);
        console.log(`✅ Removed column: ${field}`);
      } catch (error) {
        console.log(`⚠️  Column ${field} may not exist: ${error.message}`);
      }
    }

    console.log('🧹 Product table cleanup completed - now a clean polymorphic reference table');
  },

  async down (queryInterface, Sequelize) {
    // Re-add the removed columns (for rollback purposes)

    // Workshop fields
    await queryInterface.addColumn('product', 'workshop_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'workshop_type', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'scheduled_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'meeting_link', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'meeting_password', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'meeting_platform', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'max_participants', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'duration_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Course fields
    await queryInterface.addColumn('product', 'course_modules', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'total_duration_minutes', {
      type: Sequelize.DECIMAL,
      allowNull: true
    });

    // File fields
    await queryInterface.addColumn('product', 'file_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'preview_file_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'file_type', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'downloads_count', {
      type: Sequelize.DECIMAL,
      allowNull: true
    });

    // Video fields
    await queryInterface.addColumn('product', 'video_file_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Redundant fields
    await queryInterface.addColumn('product', 'is_lifetime_access', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    });
    await queryInterface.addColumn('product', 'is_sample', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    });
  }
};
