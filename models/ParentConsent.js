import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ParentConsent = sequelize.define('ParentConsent', {
    ...baseFields,
    student_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'User ID of the student requiring consent'
    },
    parent_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Full name of the parent/guardian providing consent'
    },
    parent_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
      comment: 'Email address of the parent/guardian'
    },
    parent_phone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional phone number of the parent/guardian'
    },
    consent_method: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['email', 'form', 'phone']]
      },
      comment: 'Method through which consent was obtained'
    },
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 max length
      allowNull: true,
      comment: 'IP address when consent was given (for audit trail)'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Browser user agent when consent was given (for audit trail)'
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when consent was revoked (NULL = still active)'
    },
    revoked_by: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User ID of who revoked consent (parent, teacher, admin)'
    },
    revocation_reason: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['parent_request', 'teacher_unlink', 'admin_action', 'student_deactivation', 'system_cleanup']]
      },
      comment: 'Reason for consent revocation'
    },
    revocation_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address when consent was revoked (for audit trail)'
    },
    revocation_user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Browser user agent when consent was revoked (for audit trail)'
    },
  }, {
    ...baseOptions,
    tableName: 'parentconsent',
    indexes: [
      {
        fields: ['student_id'],
        unique: true,
        name: 'idx_parentconsent_student_unique'
      },
      {
        fields: ['parent_email'],
        name: 'idx_parentconsent_parent_email'
      },
      {
        fields: ['consent_method'],
        name: 'idx_parentconsent_consent_method'
      },
      {
        fields: ['created_at'],
        name: 'idx_parentconsent_created_at'
      },
      {
        fields: ['revoked_at'],
        name: 'idx_parentconsent_revoked_at'
      },
      {
        fields: ['revoked_by'],
        name: 'idx_parentconsent_revoked_by'
      },
      {
        fields: ['revocation_reason'],
        name: 'idx_parentconsent_revocation_reason'
      },
    ],
  });

  ParentConsent.associate = function(models) {
    // Define associations here
    ParentConsent.belongsTo(models.User, {
      foreignKey: 'student_id',
      as: 'Student',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  ParentConsent.prototype.toJSON = function() {
    const values = { ...this.get() };
    return values;
  };

  // Check if consent is valid (exists, not expired, and not revoked)
  ParentConsent.prototype.isValid = function() {
    // Check if consent has been revoked
    if (this.revoked_at) {
      return false;
    }

    // For now, consent doesn't expire
    // Future: could add expiration logic here
    return true;
  };

  // Revoke consent with audit trail
  ParentConsent.prototype.revokeConsent = async function(revokedBy, reason, auditData = {}) {
    const now = new Date();

    await this.update({
      revoked_at: now,
      revoked_by: revokedBy,
      revocation_reason: reason,
      revocation_ip: auditData.ip || null,
      revocation_user_agent: auditData.userAgent || null,
      updated_at: now
    });

    return this;
  };

  // Check if consent is currently active (not revoked)
  ParentConsent.prototype.isActive = function() {
    return !this.revoked_at;
  };

  // Get revocation details
  ParentConsent.prototype.getRevocationInfo = function() {
    if (!this.revoked_at) {
      return null;
    }

    return {
      revoked_at: this.revoked_at,
      revoked_by: this.revoked_by,
      revocation_reason: this.revocation_reason,
      revocation_ip: this.revocation_ip,
      revocation_user_agent: this.revocation_user_agent
    };
  };

  return ParentConsent;
}