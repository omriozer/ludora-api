import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const QA = sequelize.define('QA', {
    ...baseFields,
    question_text: { type: DataTypes.TEXT, allowNull: true },
    correct_answers: { type: DataTypes.JSONB, allowNull: true },
    incorrect_answers: { type: DataTypes.JSONB, allowNull: true },
    difficulty: { type: DataTypes.DECIMAL, allowNull: true },
    added_by: { type: DataTypes.STRING, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    is_approved: { type: DataTypes.BOOLEAN, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
  }, {
    ...baseOptions,
    tableName: 'qa',
    indexes: [
      {
        fields: ['difficulty'],
      },
      {
        fields: ['is_approved'],
      },
    ],
  });

  QA.associate = function(models) {
    // QA can be referenced in ContentRelationship
    QA.hasMany(models.ContentRelationship, { foreignKey: 'source_id', constraints: false, scope: { source_type: 'QA' } });
    QA.hasMany(models.ContentRelationship, { foreignKey: 'target_id', constraints: false, scope: { target_type: 'QA' } });
    QA.hasMany(models.ContentTag, { foreignKey: 'content_id', constraints: false, scope: { content_type: 'QA' } });
  };

  return QA;
}