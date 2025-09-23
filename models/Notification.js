import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Notification = sequelize.define('Notification', {
    ...baseFields,
    user_id: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.STRING, allowNull: true },
    read: { type: DataTypes.BOOLEAN, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'notification',
  });

  return Notification;
}