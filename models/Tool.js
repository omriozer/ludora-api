import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const Tool = sequelize.define('Tool', {
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
    // Tool-specific fields
    tool_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tool_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    access_type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'direct',
      validate: {
        isIn: [['direct', 'embedded', 'api']]
      }
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
    tableName: 'tool',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['is_published'],
      },
      {
        fields: ['access_type'],
      },
      {
        fields: ['creator_user_id'],
      },
    ],
  });

  Tool.associate = function(models) {
    Tool.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator',
      targetKey: 'id'
    });
    // Note: Purchases will reference this via polymorphic relation
    // Product references this via polymorphic association (product_type + entity_id)
  };

  return Tool;
}