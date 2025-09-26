import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const File = sequelize.define('File', {
    ...baseFields,
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image_is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    target_audience: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    access_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_lifetime_access: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    // File-specific fields
    file_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    preview_file_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    preview_file_is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['pdf', 'ppt', 'docx', 'zip', 'other']]
      }
    },
    downloads_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    creator_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'user',
        key: 'id'
      }
    },
  }, {
    ...baseOptions,
    tableName: 'file',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
      {
        fields: ['file_type'],
      },
      {
        fields: ['creator_user_id'],
      },
    ],
  });

  File.associate = function(models) {
    File.belongsTo(models.User, { 
      foreignKey: 'creator_user_id', 
      as: 'creator',
      targetKey: 'id'
    });
    // Note: Purchases will reference this via polymorphic relation
  };

  return File;
}