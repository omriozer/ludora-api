'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if customer_token table already exists
    try {
      await queryInterface.describeTable('customer_token');
      console.log('CustomerToken table already exists, skipping creation...');
      return;
    } catch (error) {
      // Table doesn't exist, create it
      console.log('Creating customer_token table...');
    }

    await queryInterface.createTable('customer_token', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        }
      },
      payplus_customer_uid: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'PayPlus customer UID for token-based payments'
      },
      token_value: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'PayPlus customer token for charging'
      },
      card_mask: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Masked card number for display (e.g., ****1234)'
      },
      card_brand: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Card brand (Visa, Mastercard, etc.)'
      },
      expiry_month: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Card expiry month (1-12)'
      },
      expiry_year: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Card expiry year'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this token is active and can be used for payments'
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is the user\'s default payment method'
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last time this token was used for a payment'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Token expiration date from PayPlus'
      },
      payplus_response: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Full PayPlus response when token was created'
      },
      environment: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'production',
        comment: 'Environment where token was created'
      },
    }, {
      indexes: [
        {
          fields: ['user_id'],
          name: 'idx_customer_token_user_id'
        },
        {
          fields: ['payplus_customer_uid'],
          name: 'idx_customer_token_payplus_customer_uid'
        },
        {
          fields: ['user_id', 'is_active'],
          name: 'idx_customer_token_user_active'
        },
        {
          fields: ['user_id', 'is_default'],
          name: 'idx_customer_token_user_default'
        },
        {
          fields: ['is_active', 'expires_at'],
          name: 'idx_customer_token_active_expires'
        },
        {
          fields: ['last_used_at'],
          name: 'idx_customer_token_last_used'
        },
        {
          fields: ['environment'],
          name: 'idx_customer_token_environment'
        },
      ],
    });

    console.log('CustomerToken table created successfully with all indexes');
  },

  async down(queryInterface, Sequelize) {
    try {
      // Drop customer_token table if it exists
      await queryInterface.dropTable('customer_token');
      console.log('Dropped customer_token table');
    } catch (error) {
      console.log('CustomerToken table does not exist or error dropping:', error.message);
    }

    console.log('Reverted customer_token table creation');
  }
};