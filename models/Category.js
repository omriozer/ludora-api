import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Category = sequelize.define('Category', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    is_default: { type: DataTypes.BOOLEAN, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'category',
  });

  Category.associate = function(models) {
    // Define associations here - categories can be referenced by workshops and other content
    if (models.Workshop) {
      Category.hasMany(models.Workshop, { foreignKey: 'category', sourceKey: 'name' });
    }
  };

  return Category;
}