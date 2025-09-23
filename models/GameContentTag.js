import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const GameContentTag = sequelize.define('GameContentTag', {
    ...baseFields,
    name: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'gamecontenttag',
  });

  GameContentTag.associate = function(models) {
    // GameContentTag can be referenced by ContentTag
    GameContentTag.hasMany(models.ContentTag, { foreignKey: 'tag_id' });
  };

  return GameContentTag;
}