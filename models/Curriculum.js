import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Curriculum = sequelize.define('Curriculum', {
    ...baseFields,
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Study subject from STUDY_SUBJECTS constant'
    },
    grade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Grade level 1-12'
    },
    teacher_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      },
      comment: 'null = system default curriculum'
    },
    class_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'classroom',
        key: 'id'
      },
      comment: 'null = system default curriculum'
    },
    original_curriculum_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'curriculum',
        key: 'id'
      },
      comment: 'ID of the system curriculum this was copied from (null for system curricula)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    ...baseOptions,
    tableName: 'curriculum',
    indexes: [
      {
        fields: ['subject']
      },
      {
        fields: ['grade']
      },
      {
        fields: ['teacher_user_id']
      },
      {
        fields: ['class_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['subject', 'grade']
      },
      {
        fields: ['teacher_user_id', 'class_id']
      },
      {
        fields: ['original_curriculum_id']
      }
    ]
  });

  // Instance methods
  Curriculum.prototype.isSystemDefault = function() {
    return this.teacher_user_id === null && this.class_id === null;
  };

  Curriculum.prototype.isClassroomCurriculum = function() {
    return this.teacher_user_id !== null && this.class_id !== null;
  };

  Curriculum.prototype.getDisplayName = function() {
    if (this.isSystemDefault()) {
      return `תכנית לימודים - ${this.subject} כיתה ${this.grade}`;
    }
    return `תכנית כיתתית - ${this.subject} כיתה ${this.grade}`;
  };

  // Class methods
  Curriculum.findSystemDefaults = function(options = {}) {
    return this.findAll({
      where: {
        teacher_user_id: null,
        class_id: null,
        is_active: true,
        ...options.where
      },
      ...options
    });
  };

  Curriculum.findByGradeAndSubject = function(grade, subject, options = {}) {
    return this.findAll({
      where: {
        grade: grade,
        subject: subject,
        teacher_user_id: null,
        class_id: null,
        is_active: true,
        ...options.where
      },
      ...options
    });
  };

  Curriculum.findByTeacher = function(teacherUserId, options = {}) {
    return this.findAll({
      where: {
        teacher_user_id: teacherUserId,
        is_active: true,
        ...options.where
      },
      ...options
    });
  };

  Curriculum.findByClassroom = function(classId, options = {}) {
    return this.findAll({
      where: {
        class_id: classId,
        is_active: true,
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  Curriculum.associate = function(models) {
    // User associations
    Curriculum.belongsTo(models.User, {
      foreignKey: 'teacher_user_id',
      as: 'teacher'
    });

    // Classroom associations
    Curriculum.belongsTo(models.Classroom, {
      foreignKey: 'class_id',
      as: 'classroom'
    });

    // Curriculum items
    Curriculum.hasMany(models.CurriculumItem, {
      foreignKey: 'curriculum_id',
      as: 'items'
    });

    // Original curriculum (for copied curricula)
    Curriculum.belongsTo(models.Curriculum, {
      foreignKey: 'original_curriculum_id',
      as: 'originalCurriculum'
    });

    // Copied curricula (for system curricula)
    Curriculum.hasMany(models.Curriculum, {
      foreignKey: 'original_curriculum_id',
      as: 'copiedCurricula'
    });
  };

  return Curriculum;
}