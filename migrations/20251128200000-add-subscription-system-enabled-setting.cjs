'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding subscription_system_enabled setting...');

    // Check if the setting already exists
    const existingSetting = await queryInterface.rawSelect('settings', {
      where: { key: 'subscription_system_enabled' }
    }, ['id']);

    if (!existingSetting) {
      // Generate a unique ID for the setting (following the pattern from add-missing-settings.js)
      const settingId = 'settings_' + Math.random().toString(36).substring(2, 10);

      await queryInterface.bulkInsert('settings', [{
        id: settingId,
        key: 'subscription_system_enabled',
        value: JSON.stringify(true), // JSONB field requires JSON string
        value_type: 'boolean',
        description: 'Whether the subscription system is enabled for creating and managing subscription plans',
        created_at: new Date(),
        updated_at: new Date()
      }]);

      console.log('✅ Added subscription_system_enabled setting with value: true');
    } else {
      // Update existing setting to ensure it's set to true
      await queryInterface.bulkUpdate('settings', {
        value: JSON.stringify(true), // JSONB field requires JSON string
        updated_at: new Date()
      }, {
        key: 'subscription_system_enabled'
      });

      console.log('✅ Updated existing subscription_system_enabled setting to: true');
    }

    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back subscription_system_enabled setting...');

    await queryInterface.bulkDelete('settings', {
      key: 'subscription_system_enabled'
    });

    console.log('❌ Removed subscription_system_enabled setting');
    console.log('🔄 Migration rollback completed');
  }
};