'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding teacher consent verification features...');

    // 1. Add teacher_approval_data JSONB column to ParentConsent table
    console.log('➕ Adding teacher_approval_data JSONB column to ParentConsent table...');
    const tableInfo = await queryInterface.describeTable('parentconsent');

    if (!tableInfo.teacher_approval_data) {
      await queryInterface.addColumn('parentconsent', 'teacher_approval_data', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Teacher approval metadata when consent_method is teacher_verification. Structure: {teacher_id, approved_at, ...}'
      });
      console.log('✅ Added teacher_approval_data JSONB column');
    } else {
      console.log('⚠️ teacher_approval_data column already exists');
    }

    // 2. Add index for teacher_approval_data for efficient querying
    console.log('➕ Adding GIN index for teacher_approval_data...');
    try {
      await queryInterface.addIndex('parentconsent', {
        name: 'idx_parentconsent_teacher_approval_data',
        fields: ['teacher_approval_data'],
        using: 'gin'
      });
      console.log('✅ Added GIN index for teacher_approval_data');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Index idx_parentconsent_teacher_approval_data already exists');
      } else {
        throw error;
      }
    }

    // 3. Update parent_email to be nullable (for teacher verification cases)
    console.log('🔄 Making parent_email nullable for teacher verification cases...');
    await queryInterface.changeColumn('parentconsent', 'parent_email', {
      type: Sequelize.STRING,
      allowNull: true, // Changed from false to true
      comment: 'Email address of the parent/guardian (nullable when consent_method is teacher_verification)'
    });
    console.log('✅ Updated parent_email to be nullable');

    // 4. Update parent_name to be nullable (for teacher verification cases)
    console.log('🔄 Making parent_name nullable for teacher verification cases...');
    await queryInterface.changeColumn('parentconsent', 'parent_name', {
      type: Sequelize.STRING,
      allowNull: true, // Changed from false to true
      comment: 'Full name of the parent/guardian providing consent (nullable when consent_method is teacher_verification)'
    });
    console.log('✅ Updated parent_name to be nullable');

    // 5. Add teacher consent verification enabled setting
    console.log('➕ Adding teacher_consent_verification_enabled setting...');

    // Check if settings table exists
    const settingsTableExists = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.settings') AS exists",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!settingsTableExists[0].exists) {
      console.log('❌ Settings table does not exist, skipping settings insertion');
    } else {
      // Check if the setting already exists
      const existingSetting = await queryInterface.sequelize.query(
        "SELECT id FROM settings WHERE key = 'teacher_consent_verification_enabled'",
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (existingSetting.length > 0) {
        console.log('⚠️ teacher_consent_verification_enabled setting already exists');
      } else {
        // Insert the teacher_consent_verification_enabled setting
        await queryInterface.bulkInsert('settings', [{
          id: 'setting_' + Math.random().toString(36).substring(2, 10),
          key: 'teacher_consent_verification_enabled',
          value: JSON.stringify(false), // Default to disabled
          value_type: 'boolean',
          description: 'Whether teachers can mark parent consent as accepted by taking legal responsibility for consent verification',
          created_at: new Date(),
          updated_at: new Date()
        }]);
        console.log('✅ teacher_consent_verification_enabled setting added successfully');
      }
    }

    console.log('🎯 Teacher consent verification migration completed successfully');
    console.log('📝 Note: consent_method validation including "teacher_verification" is handled at model level');
    console.log('📋 When teacher approves, teacher_approval_data format: {teacher_id: "user_123", approved_at: "2024-12-11T10:30:00.000Z"}');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back teacher consent verification features...');

    // 1. Remove teacher consent verification setting
    console.log('❌ Removing teacher_consent_verification_enabled setting...');
    try {
      await queryInterface.bulkDelete('settings', {
        key: 'teacher_consent_verification_enabled'
      });
      console.log('✅ Removed teacher_consent_verification_enabled setting');
    } catch (error) {
      console.log('⚠️ Error removing setting (might not exist):', error.message);
    }

    // 2. Revert parent_name to be non-nullable
    console.log('🔄 Reverting parent_name to be non-nullable...');
    await queryInterface.changeColumn('parentconsent', 'parent_name', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Full name of the parent/guardian providing consent'
    });
    console.log('✅ Reverted parent_name to non-nullable');

    // 3. Revert parent_email to be non-nullable
    console.log('🔄 Reverting parent_email to be non-nullable...');
    await queryInterface.changeColumn('parentconsent', 'parent_email', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Email address of the parent/guardian'
    });
    console.log('✅ Reverted parent_email to non-nullable');

    // 4. Remove index for teacher_approval_data
    console.log('❌ Removing index for teacher_approval_data...');
    try {
      await queryInterface.removeIndex('parentconsent', 'idx_parentconsent_teacher_approval_data');
      console.log('✅ Removed index for teacher_approval_data');
    } catch (error) {
      console.log('⚠️ Error removing index (might not exist):', error.message);
    }

    // 5. Remove teacher_approval_data column
    console.log('❌ Removing teacher_approval_data column...');
    const tableInfo = await queryInterface.describeTable('parentconsent');

    if (tableInfo.teacher_approval_data) {
      await queryInterface.removeColumn('parentconsent', 'teacher_approval_data');
      console.log('✅ Removed teacher_approval_data column');
    } else {
      console.log('⚠️ teacher_approval_data column does not exist');
    }

    console.log('🔄 Teacher consent verification rollback completed');
  }
};