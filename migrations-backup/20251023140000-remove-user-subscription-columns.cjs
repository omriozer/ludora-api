'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists before attempting to drop columns
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('user')
    );

    if (!tableExists) {
      console.log('User table does not exist, skipping column drops');
      return;
    }

    // Get table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('user');

    // Drop columns if they exist
    const columnsToRemove = [
      'current_subscription_plan_id',
      'subscription_status',
      'subscription_start_date',
      'subscription_end_date',
      'subscription_status_updated_at',
      'payplus_subscription_uid'
    ];

    for (const column of columnsToRemove) {
      if (tableDescription[column]) {
        console.log(`Removing column: ${column}`);
        await queryInterface.removeColumn('user', column);
      } else {
        console.log(`Column ${column} does not exist, skipping`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Recreate the columns if needed (rollback)
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('user')
    );

    if (!tableExists) {
      console.log('User table does not exist, cannot restore columns');
      return;
    }

    // Restore columns (best effort - some data types might need adjustment)
    await queryInterface.addColumn('user', 'current_subscription_plan_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'subscriptionplans',
        key: 'id'
      }
    });

    await queryInterface.addColumn('user', 'subscription_status', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('user', 'subscription_start_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('user', 'subscription_end_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('user', 'subscription_status_updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('user', 'payplus_subscription_uid', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};