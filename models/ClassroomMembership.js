import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ClassroomMembership = sequelize.define('ClassroomMembership', {
    ...baseFields,
    classroom_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Classroom this membership belongs to'
    },
    student_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Student User ID or Player ID (format: user_xxx or player_xxx)'
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
        fields: ['student_user_id'],
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
      {
        unique: true,
        fields: ['classroom_id', 'student_user_id'],
        name: 'idx_classroommembership_unique_membership'
      },
    ],
  });

  ClassroomMembership.associate = function(models) {
    // Define associations here
    ClassroomMembership.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'student_user_id', as: 'Student' });
    ClassroomMembership.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
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
    return this.student_user_id && this.student_user_id.startsWith('player_');
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