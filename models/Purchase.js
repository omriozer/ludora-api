import { DataTypes } from 'sequelize';
import { PURCHASABLE_PRODUCT_TYPES } from '../constants/productTypes.js';

export default function(sequelize) {
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    buyer_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      }
    },
    // Polymorphic product reference (clean)
    purchasable_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [PURCHASABLE_PRODUCT_TYPES]
      }
    },
    purchasable_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Payment information
    payment_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    original_price: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true,
      defaultValue: 0,
    },
    coupon_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'cart',
      validate: {
        isIn: [['cart', 'pending', 'completed', 'failed', 'refunded', 'abandoned']]
      }
    },
    // Payment polling fields (added for Task 02: Payment Status Polling)
    polling_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of polling attempts made for this payment'
    },
    last_polled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last polling attempt'
    },
    resolution_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Method used to resolve the payment status',
      validate: {
        isIn: [['webhook', 'polling', 'manual', 'abandoned_after_polling']]
      }
    },
    // Access control (simplified)
    access_expires_at: {
      type: DataTypes.DATE,
      allowNull: true, // null means lifetime access
    },
    // Usage tracking
    download_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    first_accessed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_accessed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Flexible metadata for additional data
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    // Transaction reference for multi-item payments
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'transaction',
        key: 'id',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      }
    },
    // Bundle purchase reference for auto-created individual purchases
    bundle_purchase_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'References the main bundle purchase ID when this purchase was auto-created from a bundle'
    },
    // Standard timestamps
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
    tableName: 'purchase',
    timestamps: false,
    indexes: [
      {
        fields: ['buyer_user_id'],
        name: 'idx_purchase_buyer_user_id'
      },
      {
        fields: ['purchasable_type', 'purchasable_id'],
        name: 'idx_purchase_polymorphic'
      },
      {
        fields: ['payment_status'],
        name: 'idx_purchase_payment_status'
      },
      {
        fields: ['access_expires_at'],
        name: 'idx_purchase_access_expires'
      },
      {
        fields: ['created_at'],
        name: 'idx_purchase_created_at'
      },
    ],
  });

  Purchase.associate = function(models) {
    // Proper FK association to user
    Purchase.belongsTo(models.User, {
      foreignKey: 'buyer_user_id',
      as: 'buyer'
    });

    // Association to transaction for multi-item payments
    Purchase.belongsTo(models.Transaction, {
      foreignKey: 'transaction_id',
      as: 'transaction'
    });

    // Clean polymorphic associations
    Purchase.belongsTo(models.Workshop, {
      foreignKey: 'purchasable_id',
      constraints: false,
      scope: { purchasable_type: 'workshop' },
      as: 'workshop'
    });
    Purchase.belongsTo(models.Course, {
      foreignKey: 'purchasable_id',
      constraints: false,
      scope: { purchasable_type: 'course' },
      as: 'course'
    });
    Purchase.belongsTo(models.File, {
      foreignKey: 'purchasable_id',
      constraints: false,
      scope: { purchasable_type: 'file' },
      as: 'file'
    });
    Purchase.belongsTo(models.Tool, {
      foreignKey: 'purchasable_id',
      constraints: false,
      scope: { purchasable_type: 'tool' },
      as: 'tool'
    });
    Purchase.belongsTo(models.Game, {
      foreignKey: 'purchasable_id',
      constraints: false,
      scope: { purchasable_type: 'game' },
      as: 'game'
    });

    // NOTE: Subscription association removed - subscriptions now use dedicated subscription system
    // Previously had: Purchase.belongsTo(models.SubscriptionPlan, {...})
  };

  return Purchase;
}