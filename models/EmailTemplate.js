import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const EmailTemplate = sequelize.define('EmailTemplate', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true },
    html_content: { type: DataTypes.TEXT, allowNull: true },
    trigger_type: { type: DataTypes.STRING, allowNull: true },
    trigger_hours_before: { type: DataTypes.DECIMAL, allowNull: true },
    trigger_hours_after: { type: DataTypes.DECIMAL, allowNull: true },
    target_product_types: { type: DataTypes.JSONB, allowNull: true },
    target_product_ids: { type: DataTypes.JSONB, allowNull: true },
    target_admin_emails: { type: DataTypes.JSONB, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true },
    send_to_admins: { type: DataTypes.BOOLEAN, allowNull: true },
    access_expiry_days_before: { type: DataTypes.DECIMAL, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'emailtemplate',
  });

  EmailTemplate.associate = function(models) {
    // Define associations here
    EmailTemplate.hasMany(models.EmailLog, { foreignKey: 'template_id' });
  };

  return EmailTemplate;
}