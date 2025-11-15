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
    ContentTopic.hasMany(models.Product, {
      foreignKey: 'content_topic_id',
      as: 'products'
    });
  };

  return ContentTopic;
}