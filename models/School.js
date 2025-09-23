import { createSimpleModel } from './baseModel.js';

export default function(sequelize) {
  return createSimpleModel(sequelize, 'School', 'school');
}