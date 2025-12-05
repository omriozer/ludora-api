'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Creating ParentConsent table...');

    await queryInterface.createTable('parentconsent', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        defaultValue: Sequelize.literal("('consent_' || substr(gen_random_uuid()::text, 1, 8))")
      },
      student_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User ID of the student requiring consent'
      },
      parent_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Full name of the parent/guardian providing consent'
      },
      parent_email: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Email address of the parent/guardian'
      },
      parent_phone: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Optional phone number of the parent/guardian'
      },
      consent_method: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Method through which consent was obtained: email, form, phone'
      },
      ip_address: {
        type: Sequelize.STRING(45), // IPv6 max length
        allowNull: true,
        comment: 'IP address when consent was given (for audit trail)'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Browser user agent when consent was given (for audit trail)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex('parentconsent', {
      name: 'idx_parentconsent_student_unique',
      fields: ['student_user_id'],
      unique: true
    });

    await queryInterface.addIndex('parentconsent', {
      name: 'idx_parentconsent_parent_email',
      fields: ['parent_email']
    });

    await queryInterface.addIndex('parentconsent', {
      name: 'idx_parentconsent_consent_method',
      fields: ['consent_method']
    });

    await queryInterface.addIndex('parentconsent', {
      name: 'idx_parentconsent_created_at',
      fields: ['created_at']
    });

    // Note: Consent method validation is handled at the model level

    console.log('✅ ParentConsent table created successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back ParentConsent table...');

    await queryInterface.dropTable('parentconsent');

    console.log('❌ Removed ParentConsent table');
    console.log('🔄 Migration rollback completed');
  }
};