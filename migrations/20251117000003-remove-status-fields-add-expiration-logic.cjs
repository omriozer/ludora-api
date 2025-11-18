'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 Removing status fields and implementing expiration-based logic...');

      // Remove status index from gamelobby
      console.log('🔧 Removing gamelobby status index...');
      await queryInterface.removeIndex('gamelobby', 'gamelobby_status_idx', { transaction });

      // Remove status index from gamesession
      console.log('🔧 Removing gamesession status index...');
      await queryInterface.removeIndex('gamesession', 'gamesession_status_idx', { transaction });

      // Remove status column from gamelobby
      console.log('🔧 Removing status field from gamelobby...');
      await queryInterface.removeColumn('gamelobby', 'status', { transaction });

      // Remove status column from gamesession
      console.log('🔧 Removing status field from gamesession...');
      await queryInterface.removeColumn('gamesession', 'status', { transaction });

      // Drop the ENUM types
      console.log('🔧 Dropping ENUM types...');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gamelobby_status";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_gamesession_status";', { transaction });

      // Make expires_at nullable on gamelobby (pending lobbies have no expiration)
      console.log('🔧 Making gamelobby.expires_at nullable...');
      await queryInterface.changeColumn('gamelobby', 'expires_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this lobby will automatically close (null = pending activation)'
      }, { transaction });

      // Add expires_at field to gamesession
      console.log('🔧 Adding expires_at field to gamesession...');
      await queryInterface.addColumn('gamesession', 'expires_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this session expires (inherits from lobby or independent)'
      }, { transaction });

      // Add index on gamesession.expires_at
      console.log('🔧 Adding expires_at index to gamesession...');
      await queryInterface.addIndex('gamesession', ['expires_at'], {
        name: 'gamesession_expires_at_idx',
        transaction
      });

      await transaction.commit();
      console.log('✅ Status fields removed and expiration logic implemented successfully');
      console.log('📊 Lobbies and sessions now use expires_at field for status computation');
      console.log('📊 Status logic: null=pending, future=open, past=closed, ~100years=indefinite');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back expiration logic changes...');

      // Remove expires_at index from gamesession
      console.log('🔧 Removing gamesession expires_at index...');
      await queryInterface.removeIndex('gamesession', 'gamesession_expires_at_idx', { transaction });

      // Remove expires_at column from gamesession
      console.log('🔧 Removing expires_at field from gamesession...');
      await queryInterface.removeColumn('gamesession', 'expires_at', { transaction });

      // Make gamelobby.expires_at not nullable again
      console.log('🔧 Making gamelobby.expires_at required...');
      await queryInterface.changeColumn('gamelobby', 'expires_at', {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this lobby will automatically close'
      }, { transaction });

      // Re-create ENUM types
      console.log('🔧 Re-creating ENUM types...');
      await queryInterface.sequelize.query(
        'CREATE TYPE "enum_gamelobby_status" AS ENUM(\'pending\', \'open\', \'closed\');',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'CREATE TYPE "enum_gamesession_status" AS ENUM(\'pending\', \'open\', \'closed\');',
        { transaction }
      );

      // Re-add status column to gamelobby
      console.log('🔧 Re-adding status field to gamelobby...');
      await queryInterface.addColumn('gamelobby', 'status', {
        type: Sequelize.ENUM('pending', 'open', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the lobby'
      }, { transaction });

      // Re-add status column to gamesession
      console.log('🔧 Re-adding status field to gamesession...');
      await queryInterface.addColumn('gamesession', 'status', {
        type: Sequelize.ENUM('pending', 'open', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the game session'
      }, { transaction });

      // Re-add status indexes
      console.log('🔧 Re-adding status indexes...');
      await queryInterface.addIndex('gamelobby', ['status'], {
        name: 'gamelobby_status_idx',
        transaction
      });

      await queryInterface.addIndex('gamesession', ['status'], {
        name: 'gamesession_status_idx',
        transaction
      });

      await transaction.commit();
      console.log('✅ Expiration logic rolled back successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};