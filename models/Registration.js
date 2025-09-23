import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Registration = sequelize.define('Registration', {
    ...baseFields,
    user_id: { type: DataTypes.STRING, allowNull: true },
    workshop_id: { type: DataTypes.STRING, allowNull: true },
    participant_name: { type: DataTypes.STRING, allowNull: true },
    participant_phone: { type: DataTypes.STRING, allowNull: true },
    payment_amount: { type: DataTypes.DECIMAL, allowNull: true },
    payment_status: { type: DataTypes.STRING, allowNull: true },
    access_until: { type: DataTypes.DATE, allowNull: true },
    environment: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'registration',
  });

  Registration.associate = function(models) {
    Registration.belongsTo(models.User, { foreignKey: 'user_id' });
    Registration.belongsTo(models.Workshop, { foreignKey: 'workshop_id' });
  };

  return Registration;
}