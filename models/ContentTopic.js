import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ContentTopic = sequelize.define('ContentTopic', {
    ...baseFields,
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    ...baseOptions,
    tableName: 'content_topic',
  });

  ContentTopic.associate = function(models) {
    // Define associations here if needed in the future
    // Could be used to categorize content, curricula, etc.
  };

  return ContentTopic;
}