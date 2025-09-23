import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ClassroomMembership = sequelize.define('ClassroomMembership', {
    ...baseFields,
    classroom_id: { type: DataTypes.STRING, allowNull: true },
    student_user_id: { type: DataTypes.STRING, allowNull: true },
    teacher_id: { type: DataTypes.STRING, allowNull: true },
    joined_at: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.STRING, allowNull: true },
    student_display_name: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'classroommembership',
    indexes: [
      {
        fields: ['classroom_id'],
      },
      {
        fields: ['student_user_id'],
      },
      {
        fields: ['teacher_id'],
      },
    ],
  });

  ClassroomMembership.associate = function(models) {
    // Define associations here
    ClassroomMembership.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'student_user_id', as: 'Student' });
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
  };

  return ClassroomMembership;
}