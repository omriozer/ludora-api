import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Coupon = sequelize.define('Coupon', {
    ...baseFields,
    code: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    discount_type: { type: DataTypes.STRING, allowNull: true },
    discount_value: { type: DataTypes.DECIMAL, allowNull: true },
    minimum_amount: { type: DataTypes.DECIMAL, allowNull: true },
    usage_limit: { type: DataTypes.STRING, allowNull: true },
    usage_count: { type: DataTypes.DECIMAL, allowNull: true },
    valid_until: { type: DataTypes.STRING, allowNull: true },
    is_visible: { type: DataTypes.BOOLEAN, allowNull: true },
    is_admin_only: { type: DataTypes.BOOLEAN, allowNull: true },
    allow_stacking: { type: DataTypes.BOOLEAN, allowNull: true },
    stackable_with: { type: DataTypes.JSONB, allowNull: true },
    applicable_categories: { type: DataTypes.JSONB, allowNull: true },
    applicable_workshops: { type: DataTypes.JSONB, allowNull: true },
    workshop_types: { type: DataTypes.JSONB, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'coupon',
    indexes: [
      {
        fields: ['code'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_visible'],
      },
    ],
  });

  Coupon.associate = function(models) {
    // Define associations here - coupons can be referenced in purchases
    Coupon.hasMany(models.Purchase, { foreignKey: 'coupon_code', sourceKey: 'code' });
  };

  return Coupon;
}