/**
 * Migration: Remove Player.user_id field
 *
 * Removes the redundant user_id field from Player table and associated index.
 * This field was causing dual identity confusion - Players should be independent
 * anonymous entities until migrated to Users.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Removing Player.user_id field and associated index...');

    // Remove index first
    try {
      await queryInterface.removeIndex('player', 'idx_player_user_id');
      console.log('✅ Removed idx_player_user_id index');
    } catch (error) {
      console.log('⚠️ Index idx_player_user_id may not exist:', error.message);
    }

    // Remove user_id column
    try {
      await queryInterface.removeColumn('player', 'user_id');
      console.log('✅ Removed Player.user_id column');
    } catch (error) {
      console.log('⚠️ Column user_id may not exist:', error.message);
    }

    console.log('✅ Player.user_id removal completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Restoring Player.user_id field...');

    // Add user_id column back
    await queryInterface.addColumn('player', 'user_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'Associated user account (null for anonymous players)'
    });

    // Add index back
    await queryInterface.addIndex('player', {
      fields: ['user_id'],
      name: 'idx_player_user_id'
    });

    console.log('✅ Player.user_id restoration completed');
  }
};