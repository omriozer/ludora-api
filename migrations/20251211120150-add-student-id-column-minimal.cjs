/**
 * MINIMAL Migration: Add student_id column to UserSession
 *
 * This is a simplified version that only adds the essential student_id column
 * to allow the server to start. Complex data migration is deferred.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🔄 Adding student_id column to UserSession...');

      // Add student_id column to user_session table
      await queryInterface.addColumn('user_session', 'student_id', {
        type: Sequelize.STRING(25),
        allowNull: true,
        comment: 'Student identifier - can be user_abc123def456 (24 chars) or player_XXXXXX (13 chars)'
      });

      // Copy existing user_id values to student_id
      await queryInterface.sequelize.query(`
        UPDATE user_session
        SET student_id = user_id
        WHERE user_id IS NOT NULL
      `);

      console.log('✅ Minimal student_id migration completed');

    } catch (error) {
      console.error('❌ Minimal student_id migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('🔄 Removing student_id column...');

      await queryInterface.removeColumn('user_session', 'student_id');

      console.log('✅ Minimal student_id migration rolled back');

    } catch (error) {
      console.error('❌ Minimal student_id rollback failed:', error);
      throw error;
    }
  }
};