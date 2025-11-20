'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 Creating refresh_token table for persistent session management...');

      // Create the refresh_token table
      console.log('🔧 Creating refresh_token table...');
      await queryInterface.createTable('refresh_token', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          comment: 'Unique identifier for the refresh token'
        },
        user_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'user',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'ID of the user this refresh token belongs to'
        },
        token_hash: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'SHA256 hash of the refresh token for security'
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
          comment: 'When this refresh token expires'
        },
        revoked_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When this token was manually revoked (soft delete)'
        },
        last_used_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When this token was last used to refresh access token'
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: '{}',
          comment: 'Additional metadata like user agent, IP, device info'
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

      // Create indexes for performance optimization
      console.log('🔧 Creating performance indexes...');

      // Index on user_id for finding user's tokens
      await queryInterface.addIndex('refresh_token', ['user_id'], {
        name: 'idx_refresh_token_user_id',
        transaction
      });

      // Index on expires_at for cleanup operations
      await queryInterface.addIndex('refresh_token', ['expires_at'], {
        name: 'idx_refresh_token_expires_at',
        transaction
      });

      // Unique index on token_hash for token verification
      await queryInterface.addIndex('refresh_token', ['token_hash'], {
        name: 'idx_refresh_token_hash',
        unique: true,
        transaction
      });

      // Index on revoked_at for filtering active tokens
      await queryInterface.addIndex('refresh_token', ['revoked_at'], {
        name: 'idx_refresh_token_revoked_at',
        transaction
      });

      // Composite index for finding active tokens for a user
      await queryInterface.addIndex('refresh_token', ['user_id', 'revoked_at'], {
        name: 'idx_refresh_token_user_active',
        transaction
      });

      await transaction.commit();
      console.log('✅ refresh_token table created successfully');
      console.log('🔒 Refresh tokens will now persist across server restarts');
      console.log('📊 Users will stay logged in during deployments');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back refresh_token table creation...');

      // Remove all indexes first
      console.log('🔧 Removing indexes...');
      const indexes = [
        'idx_refresh_token_user_id',
        'idx_refresh_token_expires_at',
        'idx_refresh_token_hash',
        'idx_refresh_token_revoked_at',
        'idx_refresh_token_user_active'
      ];

      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('refresh_token', indexName, { transaction });
        } catch (error) {
          // Index might not exist, continue
          console.warn(`Index ${indexName} might not exist, skipping...`);
        }
      }

      // Drop the table
      console.log('🔧 Dropping refresh_token table...');
      await queryInterface.dropTable('refresh_token', { transaction });

      await transaction.commit();
      console.log('✅ refresh_token table rolled back successfully');
      console.log('⚠️  Session persistence is now disabled - server restarts will log out users');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};