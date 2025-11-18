'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 Creating gamesession table...');

      // Create the main gamesession table
      await queryInterface.createTable('gamesession', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          comment: 'UUID primary key for game session'
        },
        lobby_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'gamelobby',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: 'Reference to the game lobby this session belongs to'
        },
        session_number: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: 'Sequential number of this session within the lobby (1, 2, 3...)'
        },
        participants: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of participant objects with id, isAuthedUser, display_name, user_id?, guest_token?, team_assignment?, joined_at'
        },
        current_state: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null,
          comment: 'Current live game state while the game is active'
        },
        data: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null,
          comment: 'Final results, scores, winners, and detailed game data when completed'
        },
        status: {
          type: Sequelize.ENUM('pending', 'open', 'closed'),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Current status of the game session'
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: 'When this game session started'
        },
        finished_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When this game session finished (null if still active)'
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
      await queryInterface.addIndex('gamesession', ['lobby_id'], {
        name: 'gamesession_lobby_id_idx',
        transaction
      });

      await queryInterface.addIndex('gamesession', ['lobby_id', 'session_number'], {
        unique: true,
        name: 'gamesession_lobby_session_unique',
        transaction
      });

      await queryInterface.addIndex('gamesession', ['status'], {
        name: 'gamesession_status_idx',
        transaction
      });

      await queryInterface.addIndex('gamesession', ['started_at'], {
        name: 'gamesession_started_at_idx',
        transaction
      });

      await queryInterface.addIndex('gamesession', ['finished_at'], {
        name: 'gamesession_finished_at_idx',
        transaction
      });

      await transaction.commit();
      console.log('✅ Game session table created successfully');
      console.log('📊 This table stores individual game sessions within lobbies, tracking participants and game state');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back gamesession table...');

      // Drop indexes first
      await queryInterface.removeIndex('gamesession', 'gamesession_finished_at_idx', { transaction });
      await queryInterface.removeIndex('gamesession', 'gamesession_started_at_idx', { transaction });
      await queryInterface.removeIndex('gamesession', 'gamesession_status_idx', { transaction });
      await queryInterface.removeIndex('gamesession', 'gamesession_lobby_session_unique', { transaction });
      await queryInterface.removeIndex('gamesession', 'gamesession_lobby_id_idx', { transaction });

      // Drop the enum type
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gamesession_status";', { transaction });

      // Drop the table
      await queryInterface.dropTable('gamesession', { transaction });

      await transaction.commit();
      console.log('✅ Game session table rolled back');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};