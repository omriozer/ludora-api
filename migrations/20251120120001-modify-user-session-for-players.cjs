'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Make user_id nullable to support player sessions
    await queryInterface.changeColumn('user_session', 'user_id', {
      type: Sequelize.STRING,
      allowNull: true, // Changed from false to true
      references: {
        model: 'user',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'ID of the user this session belongs to (null for player sessions)'
    });

    // Add player_id column
    await queryInterface.addColumn('user_session', 'player_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'player',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'ID of the player this session belongs to (null for user sessions)'
    });

    // Add constraint to ensure exactly one of user_id or player_id is set
    await queryInterface.addConstraint('user_session', {
      fields: [],
      type: 'check',
      name: 'user_session_entity_check',
      where: {
        [Sequelize.Op.or]: [
          {
            [Sequelize.Op.and]: [
              { user_id: { [Sequelize.Op.ne]: null } },
              { player_id: { [Sequelize.Op.is]: null } }
            ]
          },
          {
            [Sequelize.Op.and]: [
              { user_id: { [Sequelize.Op.is]: null } },
              { player_id: { [Sequelize.Op.ne]: null } }
            ]
          }
        ]
      }
    });

    // Create indexes for player_id
    await queryInterface.addIndex('user_session', ['player_id'], {
      name: 'idx_user_session_player_id'
    });

    await queryInterface.addIndex('user_session', ['player_id', 'is_active'], {
      name: 'idx_user_session_player_active'
    });

    await queryInterface.addIndex('user_session', ['player_id', 'expires_at'], {
      name: 'idx_user_session_player_expires'
    });

    console.log('✅ UserSession table modified to support player sessions');
  },

  async down(queryInterface, Sequelize) {
    // Remove constraint
    await queryInterface.removeConstraint('user_session', 'user_session_entity_check');

    // Remove player indexes
    await queryInterface.removeIndex('user_session', 'idx_user_session_player_id');
    await queryInterface.removeIndex('user_session', 'idx_user_session_player_active');
    await queryInterface.removeIndex('user_session', 'idx_user_session_player_expires');

    // Remove player_id column
    await queryInterface.removeColumn('user_session', 'player_id');

    // Make user_id required again
    await queryInterface.changeColumn('user_session', 'user_id', {
      type: Sequelize.STRING,
      allowNull: false, // Changed back to false
      references: {
        model: 'user',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'ID of the user this session belongs to'
    });

    console.log('✅ UserSession table reverted to user-only sessions');
  }
};