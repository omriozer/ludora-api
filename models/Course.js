import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Course = sequelize.define('Course', {
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
    // Course-specific fields
    course_modules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    total_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    ...baseOptions,
    tableName: 'course',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
    ],
  });

  Course.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  return Course;
}