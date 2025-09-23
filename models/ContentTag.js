import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ContentTag = sequelize.define('ContentTag', {
    ...baseFields,
    content_id: { type: DataTypes.STRING, allowNull: true },
    content_type: { type: DataTypes.STRING, allowNull: true },
    tag_id: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'contenttag',
    indexes: [
      {
        fields: ['content_type', 'content_id'],
      },
      {
        fields: ['tag_id'],
      },
    ],
  });

  ContentTag.associate = function(models) {
    // Define associations here
    ContentTag.belongsTo(models.GameContentTag, { foreignKey: 'tag_id' });
    
    // Polymorphic associations for content
    ContentTag.belongsTo(models.Word, { foreignKey: 'content_id', constraints: false, as: 'ContentWord' });
    ContentTag.belongsTo(models.WordEN, { foreignKey: 'content_id', constraints: false, as: 'ContentWordEN' });
    ContentTag.belongsTo(models.Image, { foreignKey: 'content_id', constraints: false, as: 'ContentImage' });
    ContentTag.belongsTo(models.QA, { foreignKey: 'content_id', constraints: false, as: 'ContentQA' });
    ContentTag.belongsTo(models.Grammar, { foreignKey: 'content_id', constraints: false, as: 'ContentGrammar' });
    ContentTag.belongsTo(models.ContentList, { foreignKey: 'content_id', constraints: false, as: 'ContentContentList' });
    ContentTag.belongsTo(models.Attribute, { foreignKey: 'content_id', constraints: false, as: 'ContentAttribute' });
  };

  return ContentTag;
}