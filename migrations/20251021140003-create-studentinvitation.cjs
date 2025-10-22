'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table exists before creating
    const tableExists = await queryInterface.tableExists('studentinvitation');
    if (!tableExists) {
      await queryInterface.createTable('studentinvitation', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false
        },
        classroom_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        teacher_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        student_user_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        student_email: {
          type: Sequelize.STRING,
          allowNull: true
        },
        student_name: {
          type: Sequelize.STRING,
          allowNull: true
        },
        parent_email: {
          type: Sequelize.STRING,
          allowNull: true
        },
        parent_name: {
          type: Sequelize.STRING,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true
        },
        invitation_token: {
          type: Sequelize.STRING,
          allowNull: true
        },
        parent_consent_token: {
          type: Sequelize.STRING,
          allowNull: true
        },
        expires_at: {
          type: Sequelize.STRING,
          allowNull: true
        },
        parent_consent_given_at: {
          type: Sequelize.STRING,
          allowNull: true
        },
        student_accepted_at: {
          type: Sequelize.STRING,
          allowNull: true
        },
        converted_to_membership_at: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      // Add indexes
      await queryInterface.addIndex('studentinvitation', ['classroom_id']);
      await queryInterface.addIndex('studentinvitation', ['teacher_id']);
      await queryInterface.addIndex('studentinvitation', ['student_email']);
      await queryInterface.addIndex('studentinvitation', ['status']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('studentinvitation');
    if (tableExists) {
      await queryInterface.dropTable('studentinvitation');
    }
  }
};