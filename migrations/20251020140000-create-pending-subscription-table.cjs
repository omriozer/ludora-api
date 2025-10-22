'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the table already exists
    const tableExists = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.pendingsubscription');",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tableExists[0].to_regclass) {
      console.log('⚠️  Table pendingsubscription already exists, skipping creation');
      return;
    }

    console.log('📋 Creating pendingsubscription table...');

    await queryInterface.createTable('pendingsubscription', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      payplus_page_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'PayPlus payment page UID for tracking'
      },
      plan_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'subscriptionplan',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the subscription plan'
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
        comment: 'Reference to the user creating the subscription'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Subscription amount'
      },
      payment_page_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'PayPlus payment page URL'
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of the pending subscription (pending, processed, cancelled)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
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
        onDelete: 'SET NULL',
        comment: 'User who created this record'
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('pendingsubscription', ['user_id'], {
      name: 'idx_pendingsubscription_user_id'
    });

    await queryInterface.addIndex('pendingsubscription', ['plan_id'], {
      name: 'idx_pendingsubscription_plan_id'
    });

    await queryInterface.addIndex('pendingsubscription', ['payplus_page_uid'], {
      name: 'idx_pendingsubscription_payplus_page_uid'
    });

    await queryInterface.addIndex('pendingsubscription', ['status'], {
      name: 'idx_pendingsubscription_status'
    });

    console.log('✅ pendingsubscription table created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Dropping pendingsubscription table...');
    await queryInterface.dropTable('pendingsubscription');
    console.log('✅ pendingsubscription table dropped successfully');
  }
};