import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';
import { isPlayerId } from '../utils/studentUtils.js';

export default function(sequelize) {
  const ClassroomMembership = sequelize.define('ClassroomMembership', {
    ...baseFields,
    classroom_id: {
      type: DataTypes.STRING,
      allowNull: true,  // Allow NULL for teacher-student connections without specific classroom
      comment: 'Classroom this membership belongs to (NULL for teacher-student connection without specific classroom)'
    },
    student_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Student ID - can be User ID or Player ID (format: user_xxx or player_xxx)'
    },
    teacher_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Teacher who manages this classroom'
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'denied', 'inactive'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Membership approval status'
    },

    // Approval workflow fields
    requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When membership was requested'
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When membership was approved/denied'
    },
    request_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional message from student when requesting'
    },
    approval_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional message from teacher when approving/denying'
    },

    // Legacy field (keeping for compatibility)
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Legacy field - use approved_at instead'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about this membership'
    },
    student_display_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Custom display name for privacy (optional)'
    },
  }, {
    ...baseOptions,
    tableName: 'classroommembership',
    indexes: [
      {
        fields: ['classroom_id'],
        name: 'idx_classroommembership_classroom'
      },
      {
        fields: ['student_id'],
        name: 'idx_classroommembership_student'
      },
      {
        fields: ['teacher_id'],
        name: 'idx_classroommembership_teacher'
      },
      {
        fields: ['status'],
        name: 'idx_classroommembership_status'
      },
      {
        fields: ['teacher_id', 'status'],
        name: 'idx_classroommembership_teacher_status'
      },
      {
        fields: ['classroom_id', 'status'],
        name: 'idx_classroommembership_classroom_status'
      },
      {
        fields: ['requested_at'],
        name: 'idx_classroommembership_requested_at'
      },
      // Basic unique constraint - complex constraints will be added in migration
      {
        unique: true,
        fields: ['teacher_id', 'student_id', 'classroom_id'],
        name: 'idx_classroommembership_unique_full'
      },
    ],
  });

  ClassroomMembership.associate = function(models) {
    // Define associations here
    ClassroomMembership.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    // Note: student_id can be either User.id or Player.id - associations need dynamic handling
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
    // TODO: Add association for Player model when needed for Player students
  };

  // Instance methods for approval workflow

  // Check if membership is active
  ClassroomMembership.prototype.isActive = function() {
    return this.status === 'active';
  };

  // Check if membership is pending approval
  ClassroomMembership.prototype.isPending = function() {
    return this.status === 'pending';
  };

  // Check if student is a Player (anonymous) or User (registered)
  ClassroomMembership.prototype.isPlayerStudent = function() {
    return this.student_id && isPlayerId(this.student_id);
  };

  // Approve membership
  ClassroomMembership.prototype.approve = async function(approvalMessage = null) {
    this.status = 'active';
    this.approved_at = new Date();
    this.approval_message = approvalMessage;
    this.updated_at = new Date();
    return await this.save();
  };

  // Deny membership
  ClassroomMembership.prototype.deny = async function(denialMessage = null) {
    this.status = 'denied';
    this.approved_at = new Date();
    this.approval_message = denialMessage;
    this.updated_at = new Date();
    return await this.save();
  };

  // Deactivate membership (soft remove)
  ClassroomMembership.prototype.deactivate = async function() {
    this.status = 'inactive';
    this.updated_at = new Date();
    return await this.save();
  };

  return ClassroomMembership;
}