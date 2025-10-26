import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Workshop = sequelize.define('Workshop', {
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
    // Workshop-specific fields
    workshop_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'recorded',
      validate: {
        isIn: [['recorded', 'online_live']]
      }
    },
    video_file_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scheduled_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meeting_link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meeting_password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meeting_platform: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['zoom', 'google_meet', 'teams', 'other']]
      }
    },
    max_participants: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    ...baseOptions,
    tableName: 'workshop',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
      {
        fields: ['workshop_type'],
      },
    ],
  });

  Workshop.associate = function(models) {
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  return Workshop;
}