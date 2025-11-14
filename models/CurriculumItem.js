import { DataTypes } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const CurriculumItem = sequelize.define('CurriculumItem', {
    ...baseFields,
    curriculum_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'curriculum',
        key: 'id'
      }
    },
    study_topic: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Main study topic'
    },
    is_mandatory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this item is mandatory or optional'
    },
    mandatory_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order for mandatory items'
    },
    custom_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Custom order set by teacher'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional description or notes'
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether teacher has marked this as learned/completed'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the item was marked as completed'
    }
  }, {
    ...baseOptions,
    tableName: 'curriculum_item',
    indexes: [
      {
        fields: ['curriculum_id']
      },
      {
        fields: ['study_topic']
      },
      {
        fields: ['is_mandatory']
      },
      {
        fields: ['mandatory_order']
      },
      {
        fields: ['custom_order']
      },
      {
        fields: ['is_completed']
      },
      {
        fields: ['curriculum_id', 'mandatory_order']
      },
      {
        fields: ['curriculum_id', 'custom_order']
      }
    ]
  });

  // Instance methods
  CurriculumItem.prototype.markCompleted = function() {
    this.is_completed = true;
    this.completed_at = new Date();
    return this.save();
  };

  CurriculumItem.prototype.markIncomplete = function() {
    this.is_completed = false;
    this.completed_at = null;
    return this.save();
  };

  CurriculumItem.prototype.updateOrder = function(newOrder, isCustom = false) {
    if (isCustom) {
      this.custom_order = newOrder;
    } else if (!this.is_mandatory) {
      // Only update mandatory_order for optional items if needed
      this.mandatory_order = newOrder;
    }
    return this.save();
  };

  CurriculumItem.prototype.getDisplayOrder = function() {
    // Return custom order if set, otherwise mandatory order
    return this.custom_order !== null ? this.custom_order : this.mandatory_order;
  };

  CurriculumItem.prototype.getFullTopicName = function() {
    // Content topics now come through products → contentTopic
    if (this.products && this.products.length > 0) {
      const topicNames = [];
      this.products.forEach(product => {
        if (product.contentTopic) {
          topicNames.push(product.contentTopic.name);
        }
      });
      if (topicNames.length > 0) {
        return `${this.study_topic} - ${topicNames.join(', ')}`;
      }
    }
    return this.study_topic;
  };

  // Class methods
  CurriculumItem.findByCurriculum = function(curriculumId, options = {}) {
    return this.findAll({
      where: {
        curriculum_id: curriculumId,
        ...options.where
      },
      order: [
        ['mandatory_order', 'ASC'],
        ['custom_order', 'ASC'],
        ['created_at', 'ASC']
      ],
      ...options
    });
  };

  CurriculumItem.findMandatory = function(curriculumId, options = {}) {
    return this.findAll({
      where: {
        curriculum_id: curriculumId,
        is_mandatory: true,
        ...options.where
      },
      order: [['mandatory_order', 'ASC']],
      ...options
    });
  };

  CurriculumItem.findOptional = function(curriculumId, options = {}) {
    return this.findAll({
      where: {
        curriculum_id: curriculumId,
        is_mandatory: false,
        ...options.where
      },
      order: [['custom_order', 'ASC'], ['created_at', 'ASC']],
      ...options
    });
  };

  CurriculumItem.findCompleted = function(curriculumId, options = {}) {
    return this.findAll({
      where: {
        curriculum_id: curriculumId,
        is_completed: true,
        ...options.where
      },
      ...options
    });
  };

  CurriculumItem.findPending = function(curriculumId, options = {}) {
    return this.findAll({
      where: {
        curriculum_id: curriculumId,
        is_completed: false,
        ...options.where
      },
      ...options
    });
  };

  // Define associations
  CurriculumItem.associate = function(models) {
    // Curriculum association
    CurriculumItem.belongsTo(models.Curriculum, {
      foreignKey: 'curriculum_id',
      as: 'curriculum'
    });

    // Products association (many-to-many through CurriculumProduct)
    CurriculumItem.belongsToMany(models.Product, {
      through: 'curriculum_product',
      foreignKey: 'curriculum_item_id',
      otherKey: 'product_id',
      as: 'products'
    });
  };

  return CurriculumItem;
}