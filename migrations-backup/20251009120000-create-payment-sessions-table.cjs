'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if payment_session table already exists
    try {
      await queryInterface.describeTable('payment_session');
      console.log('PaymentSession table already exists, skipping creation...');
    } catch (error) {
      // Table doesn't exist, create it
      await queryInterface.createTable('payment_session', {
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
        session_status: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'created',
          validate: {
            isIn: [['created', 'pending', 'completed', 'failed', 'expired', 'cancelled']]
          }
        },
        purchase_ids: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of purchase IDs included in this payment session'
        },
        total_amount: {
          type: DataTypes.DECIMAL(10,2),
          allowNull: false,
        },
        original_amount: {
          type: DataTypes.DECIMAL(10,2),
          allowNull: true,
          comment: 'Original amount before coupons'
        },
        coupon_discount: {
          type: DataTypes.DECIMAL(10,2),
          allowNull: true,
          defaultValue: 0.00,
        },
        applied_coupons: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'Array of applied coupon information'
        },
        payplus_page_uid: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
          comment: 'PayPlus page request UID for tracking'
        },
        payplus_response: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: {},
          comment: 'Complete PayPlus API response data'
        },
        payment_page_url: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'PayPlus payment page URL for user redirection'
        },
        return_url: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Return URL after payment completion'
        },
        callback_url: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Webhook callback URL for payment notifications'
        },
        environment: {
          type: DataTypes.STRING(20),
          allowNull: true,
          defaultValue: 'production',
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Session expiration timestamp (30 minutes from creation)'
        },
        completed_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp when payment was completed'
        },
        failed_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp when payment failed'
        },
        error_message: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Error message if payment failed'
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: {},
          comment: 'Additional session metadata and tracking information'
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
      }, {
        indexes: [
          {
            fields: ['user_id'],
            name: 'idx_payment_session_user_id'
          },
          {
            fields: ['session_status'],
            name: 'idx_payment_session_status'
          },
          {
            fields: ['payplus_page_uid'],
            name: 'idx_payment_session_payplus_page_uid',
            unique: true,
            where: {
              payplus_page_uid: {
                [Sequelize.Op.ne]: null
              }
            }
          },
          {
            fields: ['created_at'],
            name: 'idx_payment_session_created_at'
          },
          {
            fields: ['expires_at'],
            name: 'idx_payment_session_expires_at'
          },
          {
            fields: ['user_id', 'session_status'],
            name: 'idx_payment_session_user_status'
          },
        ],
      });

      console.log('PaymentSession table created successfully');
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Drop payment_session table if it exists
      await queryInterface.dropTable('payment_session');
      console.log('Dropped payment_session table');
    } catch (error) {
      console.log('PaymentSession table does not exist or error dropping:', error.message);
    }

    console.log('Reverted payment session table changes');
  }
};