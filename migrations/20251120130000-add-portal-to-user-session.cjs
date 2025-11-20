'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add portal field to user_session table
    await queryInterface.addColumn('user_session', 'portal', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'teacher', // Default to teacher for existing sessions
      comment: 'Portal context where this session was created (teacher or student)'
    });

    // Add check constraint to ensure portal is either 'teacher' or 'student'
    await queryInterface.addConstraint('user_session', {
      fields: ['portal'],
      type: 'check',
      name: 'user_session_portal_check',
      where: {
        portal: {
          [Sequelize.Op.in]: ['teacher', 'student']
        }
      }
    });

    // Create index for portal field for efficient queries
    await queryInterface.addIndex('user_session', ['portal'], {
      name: 'idx_user_session_portal'
    });

    // Create composite index for portal + user_id for efficient portal-specific user queries
    await queryInterface.addIndex('user_session', ['portal', 'user_id'], {
      name: 'idx_user_session_portal_user'
    });

    // Create composite index for portal + player_id for efficient portal-specific player queries
    await queryInterface.addIndex('user_session', ['portal', 'player_id'], {
      name: 'idx_user_session_portal_player'
    });

    // Create composite index for portal + is_active for efficient portal-specific active session queries
    await queryInterface.addIndex('user_session', ['portal', 'is_active'], {
      name: 'idx_user_session_portal_active'
    });

    console.log('✅ Portal field added to user_session table with indexes');
  },

  async down(queryInterface, Sequelize) {
    // Remove constraint
    await queryInterface.removeConstraint('user_session', 'user_session_portal_check');

    // Remove indexes
    await queryInterface.removeIndex('user_session', 'idx_user_session_portal');
    await queryInterface.removeIndex('user_session', 'idx_user_session_portal_user');
    await queryInterface.removeIndex('user_session', 'idx_user_session_portal_player');
    await queryInterface.removeIndex('user_session', 'idx_user_session_portal_active');

    // Remove portal column
    await queryInterface.removeColumn('user_session', 'portal');

    console.log('✅ Portal field removed from user_session table');
  }
};