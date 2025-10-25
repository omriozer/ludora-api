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
    school_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'school',
        key: 'id'
      },
      comment: 'School that this classroom belongs to'
    },
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
      {
        fields: ['school_id'],
        name: 'idx_classroom_school_id'
      },
      {
        fields: ['school_id', 'teacher_id'],
        name: 'idx_classroom_school_teacher'
      },
      {
        fields: ['teacher_id', 'is_active'],
        name: 'idx_classroom_teacher_active'
      },
    ],
  });

  Classroom.associate = function(models) {
    // Define associations here
    Classroom.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
    Classroom.hasMany(models.StudentInvitation, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.ClassroomMembership, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.Curriculum, { foreignKey: 'class_id', as: 'curricula' });

    // School association
    Classroom.belongsTo(models.School, {
      foreignKey: 'school_id',
      as: 'School',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  };

  return Classroom;
}