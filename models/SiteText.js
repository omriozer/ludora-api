import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SiteText = sequelize.define('SiteText', {
    ...baseFields,
    key: { type: DataTypes.STRING, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'sitetext',
  });

  return SiteText;
}