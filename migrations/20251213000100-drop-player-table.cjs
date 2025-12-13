'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // First, remove the foreign key constraint from user_session
      try {
        await queryInterface.removeConstraint('user_session', 'user_session_player_id_fkey', { transaction });
      } catch (error) {
        // Constraint might not exist or have different name, continue
        console.log('Constraint removal warning:', error.message);
      }

      // Also remove player_id column from user_session since it's no longer needed
      try {
        await queryInterface.removeColumn('user_session', 'player_id', { transaction });
      } catch (error) {
        // Column might not exist, continue
        console.log('Column removal warning:', error.message);
      }

      // Now drop the player table
      await queryInterface.dropTable('player', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Recreate the player table in case rollback is needed
      await queryInterface.createTable('player', {
        id: {
          type: Sequelize.STRING(13),
          primaryKey: true,
          allowNull: false,
          comment: 'Unique player identifier (format: player_XXXXXX)'
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
        teacher_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'user',
            key: 'id'
          },
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
      }, { transaction });

      // Recreate indexes
      await queryInterface.addIndex('player', ['privacy_code'], {
        unique: true,
        name: 'idx_player_privacy_code',
        transaction
      });

      await queryInterface.addIndex('player', ['teacher_id'], {
        name: 'idx_player_teacher_id',
        transaction
      });

      await queryInterface.addIndex('player', ['teacher_id', 'is_active'], {
        name: 'idx_player_teacher_active',
        transaction
      });

      await queryInterface.addIndex('player', ['is_online'], {
        name: 'idx_player_online',
        transaction
      });

      await queryInterface.addIndex('player', ['last_seen'], {
        name: 'idx_player_last_seen',
        transaction
      });

      await queryInterface.addIndex('player', ['teacher_id', 'is_online'], {
        name: 'idx_player_teacher_online',
        transaction
      });

      await queryInterface.addIndex('player', ['display_name'], {
        name: 'idx_player_display_name',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};