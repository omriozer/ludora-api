'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_session', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Unique session identifier'
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'ID of the user this session belongs to'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this session expires'
      },
      last_accessed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When this session was last accessed'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this session is active'
      },
      invalidated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this session was manually invalidated'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Session metadata like user agent, IP, login method'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes for performance
    await queryInterface.addIndex('user_session', ['user_id'], {
      name: 'idx_user_session_user_id'
    });

    await queryInterface.addIndex('user_session', ['expires_at'], {
      name: 'idx_user_session_expires_at'
    });

    await queryInterface.addIndex('user_session', ['is_active'], {
      name: 'idx_user_session_is_active'
    });

    await queryInterface.addIndex('user_session', ['last_accessed_at'], {
      name: 'idx_user_session_last_accessed'
    });

    await queryInterface.addIndex('user_session', ['user_id', 'is_active'], {
      name: 'idx_user_session_user_active'
    });

    await queryInterface.addIndex('user_session', ['user_id', 'expires_at'], {
      name: 'idx_user_session_user_expires'
    });

    console.log('✅ UserSession table created with indexes');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('user_session', 'idx_user_session_user_id');
    await queryInterface.removeIndex('user_session', 'idx_user_session_expires_at');
    await queryInterface.removeIndex('user_session', 'idx_user_session_is_active');
    await queryInterface.removeIndex('user_session', 'idx_user_session_last_accessed');
    await queryInterface.removeIndex('user_session', 'idx_user_session_user_active');
    await queryInterface.removeIndex('user_session', 'idx_user_session_user_expires');

    // Drop table
    await queryInterface.dropTable('user_session');

    console.log('✅ UserSession table dropped with indexes');
  }
};