import { DataTypes, Op } from 'sequelize';
import { baseFields, baseOptions, generateId } from './baseModel.js';

export default function(sequelize) {
  const EduContent = sequelize.define('EduContent', {
    ...baseFields,
    element_type: {
      type: DataTypes.ENUM('playing_card_complete', 'playing_card_bg', 'data'),
      allowNull: false,
      comment: 'Type of educational content element'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'The actual content - image URL, text value, etc.'
    },
    content_metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Flexible metadata for content (language, difficulty, represents_data_id, etc.)',
      validate: {
        isValidMetadata(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('content_metadata must be a valid JSON object');
          }

          // Validate represents_data_id if present
          if (value.represents_data_id && typeof value.represents_data_id !== 'string') {
            throw new Error('represents_data_id must be a string');
          }
        }
      }
    }
  }, {
    ...baseOptions,
    tableName: 'edu_content',
    indexes: [
      {
        fields: ['element_type']
      },
      {
        fields: ['content_metadata'],
        using: 'gin'
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      beforeCreate: (eduContent) => {
        if (!eduContent.id) {
          eduContent.id = generateId();
        }
      }
    }
  });

  // Instance methods
  EduContent.prototype.isPlayingCard = function() {
    return this.element_type === 'playing_card_complete';
  };

  EduContent.prototype.isPlayingCardBackground = function() {
    return this.element_type === 'playing_card_bg';
  };

  EduContent.prototype.isData = function() {
    return this.element_type === 'data';
  };

  EduContent.prototype.getMetadata = function() {
    return typeof this.content_metadata === 'string'
      ? JSON.parse(this.content_metadata)
      : this.content_metadata;
  };

  EduContent.prototype.updateMetadata = function(newMetadata) {
    this.content_metadata = {
      ...this.getMetadata(),
      ...newMetadata
    };
    return this.save();
  };

  EduContent.prototype.getRepresentsDataId = function() {
    const metadata = this.getMetadata();
    return metadata.represents_data_id || null;
  };

  EduContent.prototype.setRepresentsDataId = function(dataId) {
    const metadata = this.getMetadata();
    metadata.represents_data_id = dataId;
    this.content_metadata = metadata;
    return this.save();
  };

  // Class methods
  EduContent.findByElementType = function(elementType, options = {}) {
    return this.findAll({
      where: {
        element_type: elementType,
        ...options.where
      },
      ...options
    });
  };

  EduContent.findDataContent = function(options = {}) {
    return this.findByElementType('data', options);
  };

  EduContent.findPlayingCards = function(options = {}) {
    return this.findByElementType('playing_card_complete', options);
  };

  EduContent.findPlayingCardBackgrounds = function(options = {}) {
    return this.findByElementType('playing_card_bg', options);
  };

  EduContent.findByMetadata = function(metadataQuery, options = {}) {
    return this.findAll({
      where: {
        content_metadata: {
          [Op.contains]: metadataQuery
        },
        ...options.where
      },
      ...options
    });
  };

  EduContent.findByLanguage = function(language, options = {}) {
    return this.findByMetadata({ language }, options);
  };

  EduContent.findRepresentingData = function(dataId, options = {}) {
    return this.findByMetadata({ represents_data_id: dataId }, options);
  };

  // Define associations
  EduContent.associate = function(models) {
    // Has many usage records (content can be used in multiple games)
    EduContent.hasMany(models.EduContentUse, {
      foreignKey: 'contents_data',
      constraints: false, // Since we're using JSONB array, not direct FK
      as: 'usages'
    });

    // Note: The actual relationship is through the JSONB array in EduContentUse
    // We'll handle this in application logic rather than database constraints
  };

  return EduContent;
}