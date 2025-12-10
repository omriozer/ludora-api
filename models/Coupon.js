import { DataTypes, Op } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Coupon = sequelize.define('Coupon', {
    ...baseFields,
    code: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    discount_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['percentage', 'fixed']]
      }
    },
    discount_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    minimum_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    usage_limit: { type: DataTypes.INTEGER, allowNull: true },
    usage_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    user_usage_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum number of times a single user can use this coupon. NULL = unlimited per user'
    },
    user_usage_tracking: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Tracks usage count per user: {"user_123": 2, "user_456": 1}'
    },
    valid_until: { type: DataTypes.DATE, allowNull: true },
    is_visible: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    is_admin_only: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    allow_stacking: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    stackable_with: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    applicable_categories: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    applicable_workshops: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    workshop_types: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },

    // NEW FIELDS - Base Requirements
    targeting_type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'general',
      validate: {
        isIn: [['general', 'product_type', 'product_id', 'user_segment']]
      }
    },
    target_product_types: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    target_product_ids: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    visibility: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'secret',
      validate: {
        isIn: [['secret', 'public', 'auto_suggest']]
      }
    },

    // NEW FIELDS - Phase 1 Extensions
    user_segments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Target user groups: new_user, vip, student, content_creator, etc'
    },
    priority_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 10
      },
      comment: '1=highest priority, 10=lowest priority for conflict resolution'
    },
    max_discount_cap: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Maximum discount amount in currency, overrides percentage calculations'
    },
    minimum_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
      validate: {
        min: 1
      },
      comment: 'Minimum number of items required in cart'
    },
    code_pattern: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Pattern for auto-generated codes like STUDENT2024-XXXX'
    },
    auto_generated: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether this coupon code was auto-generated'
    },
  }, {
    ...baseOptions,
    tableName: 'coupon',
    indexes: [
      {
        fields: ['code'],
        name: 'idx_coupon_code'
      },
      {
        fields: ['is_active'],
        name: 'idx_coupon_is_active'
      },
      {
        fields: ['is_visible'],
        name: 'idx_coupon_is_visible'
      },
      {
        fields: ['targeting_type'],
        name: 'idx_coupon_targeting_type'
      },
      {
        fields: ['visibility'],
        name: 'idx_coupon_visibility'
      },
      {
        fields: ['priority_level'],
        name: 'idx_coupon_priority_level'
      },
      {
        fields: ['valid_until'],
        name: 'idx_coupon_valid_until'
      },
      {
        fields: ['is_active', 'visibility'],
        name: 'idx_coupon_active_visibility'
      },
      {
        fields: ['user_usage_limit'],
        name: 'idx_coupon_user_usage_limit',
        where: {
          user_usage_limit: {
            [Op.ne]: null
          }
        }
      },
    ],
  });

  Coupon.associate = function(models) {
    // Define associations here - coupons can be referenced in purchases
    Coupon.hasMany(models.Purchase, { foreignKey: 'coupon_code', sourceKey: 'code' });
  };

  return Coupon;
}