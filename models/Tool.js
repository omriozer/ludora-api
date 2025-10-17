import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default (sequelize) => {
  const Tool = sequelize.define('Tool', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => generateId()
    },
    tool_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique identifier for the tool (e.g., CONTACT_PAGE_GENERATOR)'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'generators',
      comment: 'Category of the tool (e.g., generators, utilities)'
    },
    default_access_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 365,
      comment: 'Default access duration when purchased'
    }
  }, {
    tableName: 'tool',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['tool_key'],
        name: 'tool_tool_key_unique'
      },
      {
        fields: ['category'],
        name: 'tool_category_idx'
      }
    ]
  });

  Tool.associate = function(models) {
    // Tool has one Product that represents it in the marketplace
    Tool.hasOne(models.Product, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: { product_type: 'tool' },
      as: 'product'
    });
  };

  // Instance methods
  Tool.prototype.getAccessDuration = function() {
    return this.default_access_days === null ? 'lifetime' : `${this.default_access_days} days`;
  };


  return Tool;
};