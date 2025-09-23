import { DataTypes } from 'sequelize';

// Base fields that appear in most models (following Base44 schema)
export const baseFields = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
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
  created_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  created_by_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
};

// Standard options for most models
export const baseOptions = {
  timestamps: false, // We handle timestamps manually
};

// Create a simple model with just base fields (for empty schemas from Base44)
export function createSimpleModel(sequelize, modelName, tableName) {
  const Model = sequelize.define(modelName, {
    ...baseFields,
  }, {
    ...baseOptions,
    tableName: tableName || modelName.toLowerCase(),
  });

  return Model;
}

// Generate UUID-like ID for new entities
export function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}