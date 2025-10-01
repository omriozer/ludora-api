import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const File = sequelize.define('File', {
    ...baseFields,
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Core file-specific fields only
    file_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['pdf', 'ppt', 'docx', 'zip', 'other']]
      }
    },
    allow_preview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    add_copyrights_footer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    // Product references this via polymorphic association (product_type + entity_id)
  };

  return File;
}