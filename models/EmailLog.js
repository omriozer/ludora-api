import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const EmailLog = sequelize.define('EmailLog', {
    ...baseFields,
    template_id: { type: DataTypes.STRING, allowNull: true },
    recipient_email: { type: DataTypes.STRING, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true },
    trigger_type: { type: DataTypes.STRING, allowNull: true },
    related_product_id: { type: DataTypes.STRING, allowNull: true },
    related_registration_id: { type: DataTypes.STRING, allowNull: true },
    related_purchase_id: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    error_message: { type: DataTypes.STRING, allowNull: true },
    scheduled_for: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'emaillog',
    indexes: [
      {
        fields: ['recipient_email'],
      },
      {
        fields: ['template_id'],
      },
      {
        fields: ['status'],
      },
    ],
  });

  EmailLog.associate = function(models) {
    // Define associations here
    EmailLog.belongsTo(models.EmailTemplate, { foreignKey: 'template_id' });
    // Removed Product association as it doesn't exist
    EmailLog.belongsTo(models.Registration, { foreignKey: 'related_registration_id' });
    EmailLog.belongsTo(models.Purchase, { foreignKey: 'related_purchase_id' });
  };

  return EmailLog;
}