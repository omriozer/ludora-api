import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const StudentInvitation = sequelize.define('StudentInvitation', {
    ...baseFields,
    classroom_id: { type: DataTypes.STRING, allowNull: true },
    teacher_id: { type: DataTypes.STRING, allowNull: true },
    student_user_id: { type: DataTypes.STRING, allowNull: true },
    student_email: { type: DataTypes.STRING, allowNull: true },
    student_name: { type: DataTypes.STRING, allowNull: true },
    parent_email: { type: DataTypes.STRING, allowNull: true },
    parent_name: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    invitation_token: { type: DataTypes.STRING, allowNull: true },
    parent_consent_token: { type: DataTypes.STRING, allowNull: true },
    expires_at: { type: DataTypes.STRING, allowNull: true },
    parent_consent_given_at: { type: DataTypes.STRING, allowNull: true },
    student_accepted_at: { type: DataTypes.STRING, allowNull: true },
    converted_to_membership_at: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'studentinvitation',
    indexes: [
      {
        fields: ['classroom_id'],
      },
      {
        fields: ['teacher_id'],
      },
      {
        fields: ['student_email'],
      },
      {
        fields: ['status'],
      },
    ],
  });

  StudentInvitation.associate = function(models) {
    // Define associations here
    StudentInvitation.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    StudentInvitation.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
    StudentInvitation.belongsTo(models.User, { foreignKey: 'student_user_id', as: 'Student' });
    StudentInvitation.hasOne(models.ParentConsent, { foreignKey: 'related_invitation_id' });
    StudentInvitation.hasOne(models.ClassroomMembership, { foreignKey: 'student_user_id', sourceKey: 'student_user_id' });
  };

  return StudentInvitation;
}