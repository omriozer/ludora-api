import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SupportMessage = sequelize.define('SupportMessage', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'supportmessage',
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['is_read'],
      },
    ],
  });

  return SupportMessage;
}