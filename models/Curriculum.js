import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import { luderror } from '../lib/ludlog.js';

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
      allowNull: true, // Made nullable since we're transitioning to ranges
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Grade level 1-12 (legacy field, use grade_from/grade_to for ranges)'
    },
    grade_from: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Starting grade for range (1-12)'
    },
    grade_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Ending grade for range (1-12)'
    },
    is_grade_range: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this curriculum applies to a grade range or single grade'
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
        fields: ['grade_from']
      },
      {
        fields: ['grade_to']
      },
      {
        fields: ['is_grade_range']
      },
      {
        fields: ['grade_from', 'grade_to']
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
    const gradeText = this.getGradeDisplayText();
    if (this.isSystemDefault()) {
      return `תכנית לימודים - ${this.subject} ${gradeText}`;
    }
    return `תכנית כיתתית - ${this.subject} ${gradeText}`;
  };

  Curriculum.prototype.getGradeDisplayText = function() {
    if (this.is_grade_range && this.grade_from && this.grade_to) {
      if (this.grade_from === this.grade_to) {
        return `כיתה ${this.grade_from}`;
      }
      return `כיתות ${this.grade_from}-${this.grade_to}`;
    }
    // Fallback to legacy grade field
    return `כיתה ${this.grade || this.grade_from || this.grade_to}`;
  };

  Curriculum.prototype.includesGrade = function(gradeNumber) {
    if (this.is_grade_range && this.grade_from && this.grade_to) {
      return gradeNumber >= this.grade_from && gradeNumber <= this.grade_to;
    }
    // Fallback to legacy grade field
    return this.grade === gradeNumber;
  };

  Curriculum.prototype.getGradeRange = function() {
    if (this.is_grade_range && this.grade_from && this.grade_to) {
      return { from: this.grade_from, to: this.grade_to };
    }
    // Fallback to legacy grade field
    const grade = this.grade || this.grade_from || this.grade_to;
    return { from: grade, to: grade };
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

    const { Op } = this.sequelize.Sequelize;

    // Extract specific where conditions and remove them from options.where to avoid conflicts
    const { teacher_user_id, class_id, is_active, ...otherWhereConditions } = options.where || {};

    // Helper function to normalize values (handle string "null", "undefined", etc)
    const normalizeValue = (value) => {
      if (value === undefined || value === 'undefined' || value === 'null' || value === '') {
        return null;
      }
      return value;
    };

    // Validate subject parameter - require a valid subject for filtering
    if (!subject || subject.trim() === '') {

      throw new Error('Subject parameter is required for grade-based curriculum filtering');
    }

    // Build the where clause with properly normalized values
    const whereClause = {
      subject: subject.trim(), // Ensure we trim whitespace
      [Op.or]: [
        // Legacy single grade curricula
        {
          grade: grade,
          is_grade_range: false
        },
        // Range curricula that include this grade
        {
          grade_from: { [Op.lte]: grade },
          grade_to: { [Op.gte]: grade },
          is_grade_range: true
        }
      ],
      ...otherWhereConditions
    };

    // Only add these conditions if they have meaningful values
    const normalizedTeacherUserId = normalizeValue(teacher_user_id);
    const normalizedClassId = normalizeValue(class_id);
    const normalizedIsActive = normalizeValue(is_active);

    if (normalizedTeacherUserId !== undefined) {
      whereClause.teacher_user_id = normalizedTeacherUserId;
    }
    if (normalizedClassId !== undefined) {
      whereClause.class_id = normalizedClassId;
    }
    if (normalizedIsActive !== undefined) {
      whereClause.is_active = normalizedIsActive === 'true' || normalizedIsActive === true;
    }

    // Remove the where from options to avoid duplication
    const { where: _, ...optionsWithoutWhere } = options;

    return this.findAll({
      where: whereClause,
      ...optionsWithoutWhere
    });
  };

  // New method for finding curricula by grade range
  Curriculum.findByGradeRange = function(gradeFrom, gradeTo, subject, options = {}) {
    const { Op } = this.sequelize.Sequelize;

    return this.findAll({
      where: {
        subject: subject,
        teacher_user_id: null,
        class_id: null,
        is_active: true,
        grade_from: gradeFrom,
        grade_to: gradeTo,
        is_grade_range: true,
        ...options.where
      },
      ...options
    });
  };

  // Helper method to find all curricula that overlap with a grade range
  Curriculum.findOverlappingGradeRange = function(gradeFrom, gradeTo, subject, options = {}) {
    const { Op } = this.sequelize.Sequelize;

    return this.findAll({
      where: {
        subject: subject,
        teacher_user_id: null,
        class_id: null,
        is_active: true,
        [Op.or]: [
          // Legacy single grade curricula within range
          {
            grade: { [Op.between]: [gradeFrom, gradeTo] },
            is_grade_range: false
          },
          // Range curricula that overlap with the specified range
          {
            [Op.and]: [
              { grade_from: { [Op.lte]: gradeTo } },
              { grade_to: { [Op.gte]: gradeFrom } }
            ],
            is_grade_range: true
          }
        ],
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