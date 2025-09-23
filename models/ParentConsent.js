import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ParentConsent = sequelize.define('ParentConsent', {
    ...baseFields,
    student_user_id: { type: DataTypes.STRING, allowNull: true },
    student_email: { type: DataTypes.STRING, allowNull: true },
    parent_email: { type: DataTypes.STRING, allowNull: true },
    parent_name: { type: DataTypes.STRING, allowNull: true },
    parent_id: { type: DataTypes.STRING, allowNull: true },
    parent_relation: { type: DataTypes.STRING, allowNull: true },
    consent_text: { type: DataTypes.TEXT, allowNull: true },
    digital_signature: { type: DataTypes.STRING, allowNull: true },
    signature_ip: { type: DataTypes.STRING, allowNull: true },
    signature_user_agent: { type: DataTypes.STRING, allowNull: true },
    consent_version: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true },
    related_invitation_id: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'parentconsent',
    indexes: [
      {
        fields: ['student_user_id'],
      },
      {
        fields: ['parent_email'],
      },
    ],
  });

  ParentConsent.associate = function(models) {
    // Define associations here
    ParentConsent.belongsTo(models.User, { foreignKey: 'student_user_id', as: 'Student' });
    ParentConsent.belongsTo(models.User, { foreignKey: 'parent_id', as: 'Parent' });
    ParentConsent.belongsTo(models.StudentInvitation, { foreignKey: 'related_invitation_id' });
  };

  return ParentConsent;
}