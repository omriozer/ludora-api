'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding student_onboarding_enabled setting...');

    // Check if the setting already exists
    const existingSetting = await queryInterface.rawSelect('settings', {
      where: { key: 'student_onboarding_enabled' }
    }, ['id']);

    if (!existingSetting) {
      // Generate a unique ID for the setting (following the pattern from add-missing-settings.js)
      const settingId = 'settings_' + Math.random().toString(36).substring(2, 10);

      await queryInterface.bulkInsert('settings', [{
        id: settingId,
        key: 'student_onboarding_enabled',
        value: JSON.stringify(false), // JSONB field requires JSON string
        value_type: 'boolean',
        description: 'Whether student onboarding flow is enabled (does nothing for now)',
        created_at: new Date(),
        updated_at: new Date()
      }]);

      console.log('✅ Added student_onboarding_enabled setting');
    } else {
      console.log('⚠️ student_onboarding_enabled setting already exists');
    }

    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back student_onboarding_enabled setting...');

    await queryInterface.bulkDelete('settings', {
      key: 'student_onboarding_enabled'
    });

    console.log('❌ Removed student_onboarding_enabled setting');
    console.log('🔄 Migration rollback completed');
  }
};