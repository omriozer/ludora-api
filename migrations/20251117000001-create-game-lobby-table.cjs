'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 Creating gamelobby table...');

      // Create the main gamelobby table
      await queryInterface.createTable('gamelobby', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          comment: 'Primary key for game lobby'
        },
        game_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'game',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: 'Reference to the game being played in this lobby'
        },
        owner_user_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'user',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: 'User who bought/has access to the game'
        },
        host_user_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'user',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: 'User who opened this specific lobby session'
        },
        lobby_code: {
          type: Sequelize.STRING(6),
          allowNull: false,
          unique: true,
          comment: 'Short unique code for joining lobby (e.g., ABC123)'
        },
        settings: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Lobby settings including max_players, invitation_type, game rules, etc.'
        },
        status: {
          type: Sequelize.ENUM('pending', 'open', 'closed'),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Current status of the lobby'
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
          comment: 'When this lobby will automatically close'
        },
        closed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the lobby was manually closed (if applicable)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Create indexes for better performance
      await queryInterface.addIndex('gamelobby', ['game_id'], {
        name: 'gamelobby_game_id_idx',
        transaction
      });

      await queryInterface.addIndex('gamelobby', ['owner_user_id'], {
        name: 'gamelobby_owner_user_id_idx',
        transaction
      });

      await queryInterface.addIndex('gamelobby', ['host_user_id'], {
        name: 'gamelobby_host_user_id_idx',
        transaction
      });

      await queryInterface.addIndex('gamelobby', ['lobby_code'], {
        unique: true,
        name: 'gamelobby_lobby_code_unique',
        transaction
      });

      await queryInterface.addIndex('gamelobby', ['status'], {
        name: 'gamelobby_status_idx',
        transaction
      });

      await queryInterface.addIndex('gamelobby', ['expires_at'], {
        name: 'gamelobby_expires_at_idx',
        transaction
      });

      await transaction.commit();
      console.log('✅ Game lobby table created successfully');
      console.log('📊 This table stores multiplayer game lobbies where players can join and play games together');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back gamelobby table...');

      // Drop indexes first
      await queryInterface.removeIndex('gamelobby', 'gamelobby_expires_at_idx', { transaction });
      await queryInterface.removeIndex('gamelobby', 'gamelobby_status_idx', { transaction });
      await queryInterface.removeIndex('gamelobby', 'gamelobby_lobby_code_unique', { transaction });
      await queryInterface.removeIndex('gamelobby', 'gamelobby_host_user_id_idx', { transaction });
      await queryInterface.removeIndex('gamelobby', 'gamelobby_owner_user_id_idx', { transaction });
      await queryInterface.removeIndex('gamelobby', 'gamelobby_game_id_idx', { transaction });

      // Drop the enum type
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gamelobby_status";', { transaction });

      // Drop the table
      await queryInterface.dropTable('gamelobby', { transaction });

      await transaction.commit();
      console.log('✅ Game lobby table rolled back');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};