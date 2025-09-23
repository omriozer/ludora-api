import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: false, // Base44 doesn't enforce unique emails
      validate: {
        isEmail: true,
      },
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    disabled: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    education_level: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['no_education_degree', 'bachelor_education', 'master_education', 'phd_education']]
      }
    },
    content_creator_agreement_sign_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
      validate: {
        isIn: [['user', 'admin', 'sysadmin']]
      }
    },
    user_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['teacher', 'student', 'parent', 'headmaster', null]]
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'user', // Match Base44 table name
    timestamps: false, // We handle timestamps manually
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['phone'],
      },
      {
        fields: ['content_creator_agreement_sign_date'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['user_type'],
      },
      {
        fields: ['role', 'user_type'],
      },
    ],
  });

  User.associate = function(models) {
    // Define associations here
    User.hasMany(models.Purchase, { foreignKey: 'buyer_email', sourceKey: 'email' });
    User.hasMany(models.GameSession, { foreignKey: 'user_id' });
    User.hasMany(models.SubscriptionHistory, { foreignKey: 'user_id' });
    User.hasMany(models.Classroom, { foreignKey: 'teacher_id' });
    User.hasMany(models.StudentInvitation, { foreignKey: 'teacher_id' });
    User.hasMany(models.ClassroomMembership, { foreignKey: 'student_user_id' });
  };

  // Instance methods
  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    return values;
  };

  // System role checking methods
  User.prototype.isAdmin = function() {
    return this.role === 'admin';
  };

  User.prototype.isSysAdmin = function() {
    return this.role === 'sysadmin';
  };

  User.prototype.isUser = function() {
    return this.role === 'user';
  };

  // User type checking methods
  User.prototype.isTeacher = function() {
    return this.user_type === 'teacher';
  };

  User.prototype.isStudent = function() {
    return this.user_type === 'student';
  };

  User.prototype.isParent = function() {
    return this.user_type === 'parent';
  };

  User.prototype.isHeadmaster = function() {
    return this.user_type === 'headmaster';
  };

  // Legacy compatibility methods
  User.prototype.isStaff = function() {
    // Staff functionality now maps to admin role
    return this.role === 'admin' || this.role === 'sysadmin';
  };

  User.prototype.canAccess = function(requiredRole) {
    const roleHierarchy = {
      'user': 0,
      'admin': 1,
      'sysadmin': 2
    };
    return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
  };

  // Combined role and type checking
  User.prototype.hasRoleAndType = function(role, userType = null) {
    const hasRole = this.role === role;
    if (userType === null) return hasRole;
    return hasRole && this.user_type === userType;
  };

  return User;
}