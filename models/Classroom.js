import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Classroom = sequelize.define('Classroom', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
    grade_level: { type: DataTypes.STRING, allowNull: true },
    year: { type: DataTypes.STRING, allowNull: true },
    teacher_id: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'classroom',
    indexes: [
      {
        fields: ['teacher_id'],
      },
      {
        fields: ['is_active'],
      },
    ],
  });

  Classroom.associate = function(models) {
    // Define associations here
    Classroom.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
    Classroom.hasMany(models.StudentInvitation, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.ClassroomMembership, { foreignKey: 'classroom_id' });
  };

  return Classroom;
}