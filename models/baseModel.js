import { DataTypes } from 'sequelize';
import { customAlphabet } from 'nanoid';

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

// Create nanoid generator with custom alphabet (excludes confusing characters 0, O, 1, l, I)
const nanoid = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', 6);

// Generate 6-character ID for new entities
export function generateId() {
  return nanoid();
}