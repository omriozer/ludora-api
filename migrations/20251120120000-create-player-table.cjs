'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
        comment: 'Unique player identifier'
      },
      privacy_code: {
        type: Sequelize.STRING(8),
        allowNull: false,
        unique: true,
        comment: 'Unique privacy code for anonymous player authentication (e.g. AB3X7KM9)'
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Display name shown in games and to teachers'
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'user',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Associated user account (null for anonymous players)'
      },
      teacher_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'user',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'Teacher who owns/manages this player'
      },
      achievements: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of player achievements and badges'
      },
      preferences: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Player preferences and settings'
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether player is currently connected via SSE'
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Last time player was active or seen online'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether player account is active (soft delete)'
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
    await queryInterface.addIndex('player', ['privacy_code'], {
      name: 'idx_player_privacy_code',
      unique: true
    });

    await queryInterface.addIndex('player', ['user_id'], {
      name: 'idx_player_user_id'
    });

    await queryInterface.addIndex('player', ['teacher_id'], {
      name: 'idx_player_teacher_id'
    });

    await queryInterface.addIndex('player', ['teacher_id', 'is_active'], {
      name: 'idx_player_teacher_active'
    });

    await queryInterface.addIndex('player', ['is_online'], {
      name: 'idx_player_online'
    });

    await queryInterface.addIndex('player', ['last_seen'], {
      name: 'idx_player_last_seen'
    });

    await queryInterface.addIndex('player', ['teacher_id', 'is_online'], {
      name: 'idx_player_teacher_online'
    });

    await queryInterface.addIndex('player', ['display_name'], {
      name: 'idx_player_display_name'
    });

    console.log('✅ Player table created with indexes');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('player', 'idx_player_privacy_code');
    await queryInterface.removeIndex('player', 'idx_player_user_id');
    await queryInterface.removeIndex('player', 'idx_player_teacher_id');
    await queryInterface.removeIndex('player', 'idx_player_teacher_active');
    await queryInterface.removeIndex('player', 'idx_player_online');
    await queryInterface.removeIndex('player', 'idx_player_last_seen');
    await queryInterface.removeIndex('player', 'idx_player_teacher_online');
    await queryInterface.removeIndex('player', 'idx_player_display_name');

    // Drop table
    await queryInterface.dropTable('player');

    console.log('✅ Player table dropped with indexes');
  }
};