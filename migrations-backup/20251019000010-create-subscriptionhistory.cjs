'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the table already exists
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('subscriptionhistory')
    );

    if (!tableExists) {
      await queryInterface.createTable('subscriptionhistory', {
        id: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true
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
        },
        creator_user_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'user',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        user_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'user',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        subscription_plan_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'subscriptionplan',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        action_type: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Type of subscription action: started, ended, upgraded, downgraded, cancelled, onboarding_selection'
        },
        previous_plan_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'subscriptionplan',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the subscription period started'
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the subscription period ended'
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Current status: active, inactive, cancelled, expired'
        }
      });

      // Add indexes for better performance
      await queryInterface.addIndex('subscriptionhistory', ['user_id']);
      await queryInterface.addIndex('subscriptionhistory', ['subscription_plan_id']);
      await queryInterface.addIndex('subscriptionhistory', ['action_type']);
      await queryInterface.addIndex('subscriptionhistory', ['status']);
      await queryInterface.addIndex('subscriptionhistory', ['start_date']);
      await queryInterface.addIndex('subscriptionhistory', ['end_date']);
      await queryInterface.addIndex('subscriptionhistory', ['user_id', 'status']);
      await queryInterface.addIndex('subscriptionhistory', ['user_id', 'start_date']);

      console.log('✅ Created subscriptionhistory table with indexes');
    } else {
      console.log('ℹ️ subscriptionhistory table already exists, skipping creation');
    }
  },

  async down(queryInterface, Sequelize) {
    // Drop the table if it exists
    const tableExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('subscriptionhistory')
    );

    if (tableExists) {
      await queryInterface.dropTable('subscriptionhistory');
      console.log('✅ Dropped subscriptionhistory table');
    } else {
      console.log('ℹ️ subscriptionhistory table does not exist, skipping drop');
    }
  }
};