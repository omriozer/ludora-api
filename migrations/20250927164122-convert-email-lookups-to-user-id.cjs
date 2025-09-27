'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add indexes for efficient user ID lookups where they might be missing
    try {
      await queryInterface.addIndex('purchase', ['buyer_user_id'], {
        name: 'idx_purchase_buyer_user_id_efficient',
        concurrently: true
      });
    } catch (error) {
      // Index might already exist, ignore error
      console.log('Index on purchase.buyer_user_id might already exist:', error.message);
    }

    try {
      await queryInterface.addIndex('user', ['email'], {
        name: 'idx_user_email_lookup',
        concurrently: true
      });
    } catch (error) {
      // Index might already exist, ignore error
      console.log('Index on user.email might already exist:', error.message);
    }

    // Add any missing foreign key constraints for data integrity
    try {
      await queryInterface.addConstraint('purchase', {
        fields: ['buyer_user_id'],
        type: 'foreign key',
        name: 'fk_purchase_buyer_user_id',
        references: {
          table: 'user',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    } catch (error) {
      // Constraint might already exist, ignore error
      console.log('Foreign key constraint on purchase.buyer_user_id might already exist:', error.message);
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove the indexes and constraints added in up()
    try {
      await queryInterface.removeIndex('purchase', 'idx_purchase_buyer_user_id_efficient');
    } catch (error) {
      console.log('Could not remove index idx_purchase_buyer_user_id_efficient:', error.message);
    }

    try {
      await queryInterface.removeIndex('user', 'idx_user_email_lookup');
    } catch (error) {
      console.log('Could not remove index idx_user_email_lookup:', error.message);
    }

    try {
      await queryInterface.removeConstraint('purchase', 'fk_purchase_buyer_user_id');
    } catch (error) {
      console.log('Could not remove constraint fk_purchase_buyer_user_id:', error.message);
    }
  }
};
