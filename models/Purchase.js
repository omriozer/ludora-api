import { DataTypes } from 'sequelize';
import { PURCHASABLE_PRODUCT_TYPES } from '../constants/productTypes.js';

export default function(sequelize) {
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    order_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    product_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    workshop_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buyer_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buyer_email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buyer_phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_amount: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },
    original_price: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },
    discount_amount: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },
    coupon_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    access_until: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    purchased_access_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    purchased_lifetime_access: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    download_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    first_accessed: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_accessed: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    environment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_recording_only: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    is_subscription_renewal: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    subscription_plan_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_subscription_upgrade: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    upgrade_proration_amount: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscription_cycle_start: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscription_cycle_end: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Polymorphic fields for new entity system
    purchasable_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [PURCHASABLE_PRODUCT_TYPES]
      }
    },
    purchasable_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Access control fields
    access_expires_at: {
      type: DataTypes.DATE,
      allowNull: true, // null means lifetime access
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
    created_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_by_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'purchase',
    timestamps: false,
    indexes: [
      {
        fields: ['buyer_email'],
      },
      {
        fields: ['product_id'],
      },
      {
        fields: ['payment_status'],
      },
      {
        fields: ['order_number'],
      },
      // New polymorphic indexes
      {
        fields: ['purchasable_type', 'purchasable_id'],
      },
      {
        fields: ['access_expires_at'],
      },
    ],
  });

  Purchase.associate = function(models) {
    // Legacy association (will be deprecated) - removed Product reference as it doesn't exist
    Purchase.belongsTo(models.User, { foreignKey: 'buyer_email', targetKey: 'email' });
    
    // New polymorphic associations
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
    Purchase.belongsTo(models.SubscriptionPlan, { 
      foreignKey: 'purchasable_id', 
      constraints: false,
      scope: { purchasable_type: 'subscription' },
      as: 'subscriptionPlan'
    });
  };

  return Purchase;
}