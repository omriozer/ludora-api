import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const ContentRelationship = sequelize.define('ContentRelationship', {
    ...baseFields,
    source_id: { type: DataTypes.STRING, allowNull: true },
    source_type: { type: DataTypes.STRING, allowNull: true },
    target_id: { type: DataTypes.STRING, allowNull: true },
    target_type: { type: DataTypes.STRING, allowNull: true },
    relationship_types: { type: DataTypes.JSONB, allowNull: true },
    difficulty: { type: DataTypes.STRING, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    context_data: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'contentrelationship',
    indexes: [
      {
        fields: ['source_type', 'source_id'],
      },
      {
        fields: ['target_type', 'target_id'],
      },
    ],
  });

  ContentRelationship.associate = function(models) {
    // Polymorphic associations - these will be defined at the model level
    // Source associations
    ContentRelationship.belongsTo(models.Word, { foreignKey: 'source_id', constraints: false, as: 'SourceWord' });
    ContentRelationship.belongsTo(models.WordEN, { foreignKey: 'source_id', constraints: false, as: 'SourceWordEN' });
    ContentRelationship.belongsTo(models.Image, { foreignKey: 'source_id', constraints: false, as: 'SourceImage' });
    ContentRelationship.belongsTo(models.QA, { foreignKey: 'source_id', constraints: false, as: 'SourceQA' });
    ContentRelationship.belongsTo(models.Grammar, { foreignKey: 'source_id', constraints: false, as: 'SourceGrammar' });
    ContentRelationship.belongsTo(models.ContentList, { foreignKey: 'source_id', constraints: false, as: 'SourceContentList' });
    ContentRelationship.belongsTo(models.Attribute, { foreignKey: 'source_id', constraints: false, as: 'SourceAttribute' });
    
    // Target associations
    ContentRelationship.belongsTo(models.Word, { foreignKey: 'target_id', constraints: false, as: 'TargetWord' });
    ContentRelationship.belongsTo(models.WordEN, { foreignKey: 'target_id', constraints: false, as: 'TargetWordEN' });
    ContentRelationship.belongsTo(models.Image, { foreignKey: 'target_id', constraints: false, as: 'TargetImage' });
    ContentRelationship.belongsTo(models.QA, { foreignKey: 'target_id', constraints: false, as: 'TargetQA' });
    ContentRelationship.belongsTo(models.Grammar, { foreignKey: 'target_id', constraints: false, as: 'TargetGrammar' });
    ContentRelationship.belongsTo(models.ContentList, { foreignKey: 'target_id', constraints: false, as: 'TargetContentList' });
    ContentRelationship.belongsTo(models.Attribute, { foreignKey: 'target_id', constraints: false, as: 'TargetAttribute' });
  };

  return ContentRelationship;
}