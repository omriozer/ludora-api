import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Logs = sequelize.define('Logs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.ENUM('app', 'api'),
      allowNull: false,
    },
    log_type: {
      type: DataTypes.ENUM('log', 'error', 'debug', 'warn', 'info'),
      allowNull: false,
      defaultValue: 'log',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'logs',
    timestamps: false, // We manage created_at manually
    indexes: [
      {
        fields: ['source_type']
      },
      {
        fields: ['log_type']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  Logs.associate = function(models) {
    // Associate with User if user model exists
    if (models.User) {
      Logs.belongsTo(models.User, {
        foreignKey: 'user_id',
        targetKey: 'id',
        as: 'user'
      });
    }
  };

  return Logs;
}