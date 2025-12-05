'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding parent_consent_required setting...');

    // Check if settings table exists
    const tableExists = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.settings') AS exists",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!tableExists[0].exists) {
      console.log('❌ Settings table does not exist, skipping migration');
      return;
    }

    // Check if the setting already exists
    const existingSetting = await queryInterface.sequelize.query(
      "SELECT id FROM settings WHERE key = 'parent_consent_required'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingSetting.length > 0) {
      console.log('⚠️ parent_consent_required setting already exists');
      return;
    }

    // Insert the parent_consent_required setting
    console.log('➕ Inserting parent_consent_required setting...');
    await queryInterface.bulkInsert('settings', [{
      id: 'setting_' + Math.random().toString(36).substring(2, 10),
      key: 'parent_consent_required',
      value: JSON.stringify(false),
      value_type: 'boolean',
      description: 'Whether parent consent is required for students under 18 to access the platform',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    console.log('✅ parent_consent_required setting added successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back parent_consent_required setting...');

    // Remove the setting
    await queryInterface.bulkDelete('settings', {
      key: 'parent_consent_required'
    });

    console.log('❌ Removed parent_consent_required setting');
    console.log('🔄 Migration rollback completed');
  }
};