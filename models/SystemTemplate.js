import { DataTypes, Op } from 'sequelize';
import { baseFields, baseOptions, generateId } from './baseModel.js';

export default function(sequelize) {
  const SystemTemplate = sequelize.define('SystemTemplate', {
    ...baseFields,
    id: {
      ...baseFields.id,
      defaultValue: () => generateId(),
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Human-readable template name (e.g., "Landscape Footer", "Portrait Minimal")'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional description of template purpose and usage'
    },
    template_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isIn: [['branding', 'watermark']] // Simplified: only branding and watermark types
      },
      comment: 'Type of template (branding, watermark)'
    },
    target_format: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan']]
      },
      comment: 'Target format: pdf-a4-landscape, pdf-a4-portrait, or svg-lessonplan'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this template is the default for its template_type'
    },
    template_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Flexible template configuration data structure, varies by template_type'
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email of user who created this template (admin user)'
    }
  }, {
    ...baseOptions,
    tableName: 'system_templates',
    indexes: [
      {
        fields: ['template_type'],
        name: 'idx_system_templates_type'
      },
      {
        fields: ['target_format'],
        name: 'idx_system_templates_format'
      },
      {
        fields: ['is_default'],
        name: 'idx_system_templates_default'
      },
      {
        fields: ['template_type', 'is_default'],
        name: 'idx_system_templates_type_default'
      },
      {
        fields: ['template_type', 'target_format'],
        name: 'idx_system_templates_type_format'
      },
      {
        fields: ['created_by'],
        name: 'idx_system_templates_created_by'
      },
      {
        unique: true,
        fields: ['template_type', 'target_format', 'is_default'],
        name: 'unique_default_per_type_format',
        where: {
          is_default: true
        }
      }
    ]
  });

  SystemTemplate.associate = function(models) {
    // Files can reference system templates for branding configuration
    SystemTemplate.hasMany(models.File, {
      foreignKey: 'branding_template_id',
      as: 'files_using_branding_template'
    });

    // Files can reference system templates for watermark configuration
    SystemTemplate.hasMany(models.File, {
      foreignKey: 'watermark_template_id',
      as: 'files_using_watermark_template'
    });

    // LessonPlans can reference system templates for watermark configuration
    SystemTemplate.hasMany(models.LessonPlan, {
      foreignKey: 'watermark_template_id',
      as: 'lesson_plans_using_watermark_template'
    });
  };

  // Validation methods
  SystemTemplate.prototype.isBrandingTemplate = function() {
    return this.template_type === 'branding';
  };

  SystemTemplate.prototype.isWatermarkTemplate = function() {
    return this.template_type === 'watermark';
  };

  SystemTemplate.prototype.isDefaultTemplate = function() {
    return this.is_default === true;
  };

  // Branding-specific template data validation
  SystemTemplate.prototype.validateBrandingTemplateData = function() {
    if (!this.isBrandingTemplate()) {
      throw new Error('Template is not a branding template');
    }

    const data = this.template_data;
    if (!data || typeof data !== 'object') {
      throw new Error('Branding template data must be a valid object');
    }

    // Only support unified structure - must have elements object
    if (!data.elements || typeof data.elements !== 'object') {
      throw new Error('Branding template must have a valid elements object with unified structure');
    }

    // Validate globalSettings if provided
    if (data.globalSettings && typeof data.globalSettings !== 'object') {
      throw new Error('Branding template globalSettings must be an object');
    }

    // Validate each element type array in the elements object
    Object.entries(data.elements).forEach(([elementType, elementArray]) => {
      if (!Array.isArray(elementArray)) {
        throw new Error(`Element type ${elementType} must be an array`);
      }

      elementArray.forEach((element, index) => {
        if (!element || typeof element !== 'object') {
          throw new Error(`Element ${elementType}[${index}] must be an object`);
        }

        // Validate required fields for all elements
        if (!element.id || typeof element.id !== 'string') {
          throw new Error(`Element ${elementType}[${index}] missing required 'id' string`);
        }

        if (!element.type || typeof element.type !== 'string') {
          throw new Error(`Element ${elementType}[${index}] missing required 'type' string`);
        }

        if (typeof element.visible !== 'boolean') {
          element.visible = true; // Default if missing
        }

        if (typeof element.deletable !== 'boolean') {
          element.deletable = true; // Default if missing
        }

        if (!element.position || typeof element.position !== 'object') {
          throw new Error(`Element ${elementType}[${index}] missing required 'position' object`);
        }

        if (typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
          throw new Error(`Element ${elementType}[${index}] position must have numeric x and y values`);
        }

        if (!element.style || typeof element.style !== 'object') {
          throw new Error(`Element ${elementType}[${index}] missing required 'style' object`);
        }

        // Validate element-type-specific properties
        if (['url', 'copyright-text', 'free-text', 'user-info'].includes(elementType)) {
          // Text-based elements should have content
          if (element.content !== undefined && typeof element.content !== 'string') {
            throw new Error(`Text element ${elementType}[${index}] content must be a string if provided`);
          }
        }

        if (elementType === 'logo') {
          // Logo elements should have size in style
          if (element.style.size !== undefined && typeof element.style.size !== 'number') {
            throw new Error(`Logo element ${elementType}[${index}] style.size must be a number if provided`);
          }
        }

        // Validate common style properties
        if (element.style.opacity !== undefined && (typeof element.style.opacity !== 'number' || element.style.opacity < 0 || element.style.opacity > 100)) {
          throw new Error(`Element ${elementType}[${index}] style.opacity must be a number between 0 and 100`);
        }

        if (element.style.rotation !== undefined && typeof element.style.rotation !== 'number') {
          throw new Error(`Element ${elementType}[${index}] style.rotation must be a number`);
        }
      });
    });

    return true;
  };

  // Watermark-specific template data validation
  SystemTemplate.prototype.validateWatermarkTemplateData = function() {
    if (!this.isWatermarkTemplate()) {
      throw new Error('Template is not a watermark template');
    }

    const data = this.template_data;
    if (!data || typeof data !== 'object') {
      throw new Error('Watermark template data must be a valid object');
    }

    // Check for unified structure or legacy structure
    const hasUnifiedStructure = data.elements && typeof data.elements === 'object';
    const hasLegacyStructure = data.textElements || data.logoElements;

    if (!hasUnifiedStructure && !hasLegacyStructure) {
      throw new Error('Template must have unified structure (elements object) or legacy elements (textElements, logoElements)');
    }

    // CRITICAL FIX: Validate that watermark templates actually contain watermark elements
    let totalElements = 0;

    if (hasUnifiedStructure) {
      // Count elements in unified structure
      totalElements = Object.values(data.elements).reduce((sum, elementArray) => {
        return sum + (Array.isArray(elementArray) ? elementArray.length : 0);
      }, 0);
    } else if (hasLegacyStructure) {
      // Count elements in legacy structure
      totalElements = (data.textElements?.length || 0) + (data.logoElements?.length || 0);
    }

    if (totalElements === 0) {
      throw new Error('Watermark template must contain at least one watermark element (text, logo, etc.). Empty watermark templates are not allowed.');
    }

    // Validate unified structure
    if (hasUnifiedStructure) {
      // Validate each element type array in the elements object
      Object.entries(data.elements).forEach(([elementType, elementArray]) => {
        if (!Array.isArray(elementArray)) {
          throw new Error(`Element type ${elementType} must be an array`);
        }

        elementArray.forEach((element, index) => {
          if (!element || typeof element !== 'object') {
            throw new Error(`Element ${elementType}[${index}] must be an object`);
          }

          // Validate required fields for all elements
          if (!element.id || typeof element.id !== 'string') {
            throw new Error(`Element ${elementType}[${index}] missing required 'id' string`);
          }

          if (!element.type || typeof element.type !== 'string') {
            throw new Error(`Element ${elementType}[${index}] missing required 'type' string`);
          }

          if (typeof element.visible !== 'boolean') {
            element.visible = true; // Default if missing
          }

          if (typeof element.deletable !== 'boolean') {
            element.deletable = true; // Default if missing
          }

          if (!element.position || typeof element.position !== 'object') {
            throw new Error(`Element ${elementType}[${index}] missing required 'position' object`);
          }

          if (typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
            throw new Error(`Element ${elementType}[${index}] position must have numeric x and y values`);
          }

          if (!element.style || typeof element.style !== 'object') {
            throw new Error(`Element ${elementType}[${index}] missing required 'style' object`);
          }

          // Validate element-type-specific properties for watermark templates
          if (['watermark-text', 'free-text'].includes(elementType)) {
            // Text-based watermark elements should have content
            if (element.content !== undefined && typeof element.content !== 'string') {
              throw new Error(`Watermark text element ${elementType}[${index}] content must be a string if provided`);
            }
          }

          if (['watermark-logo', 'logo'].includes(elementType)) {
            // Logo watermark elements should have size in style
            if (element.style.size !== undefined && typeof element.style.size !== 'number') {
              throw new Error(`Watermark logo element ${elementType}[${index}] style.size must be a number if provided`);
            }
          }

          // Validate common style properties
          if (element.style.opacity !== undefined && (typeof element.style.opacity !== 'number' || element.style.opacity < 0 || element.style.opacity > 100)) {
            throw new Error(`Element ${elementType}[${index}] style.opacity must be a number between 0 and 100`);
          }

          if (element.style.rotation !== undefined && typeof element.style.rotation !== 'number') {
            throw new Error(`Element ${elementType}[${index}] style.rotation must be a number`);
          }
        });
      });

      // Validate globalSettings if provided
      if (data.globalSettings && typeof data.globalSettings !== 'object') {
        throw new Error('Watermark template globalSettings must be an object');
      }

      return true; // Exit early if unified structure is valid
    }

    // Legacy structure validation (kept for backward compatibility)
    // Validate textElements array
    if (data.textElements) {
      if (!Array.isArray(data.textElements)) {
        throw new Error('Watermark template textElements must be an array');
      }

      data.textElements.forEach((element, index) => {
        if (!element.id || typeof element.id !== 'string') {
          throw new Error(`Text element ${index} missing required string 'id'`);
        }

        if (!element.content || typeof element.content !== 'string') {
          throw new Error(`Text element ${index} missing required string 'content'`);
        }

        if (!element.position || typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
          throw new Error(`Text element ${index} position must have numeric x and y values`);
        }

        if (!element.style || typeof element.style !== 'object') {
          throw new Error(`Text element ${index} missing required 'style' object`);
        }

        if (typeof element.visible !== 'boolean') {
          element.visible = true; // Default if missing
        }

        if (!['single', 'grid', 'scattered'].includes(element.pattern)) {
          element.pattern = 'single'; // Default if missing or invalid
        }
      });
    }

    // Validate logoElements array
    if (data.logoElements) {
      if (!Array.isArray(data.logoElements)) {
        throw new Error('Watermark template logoElements must be an array');
      }

      data.logoElements.forEach((element, index) => {
        if (!element.id || typeof element.id !== 'string') {
          throw new Error(`Logo element ${index} missing required string 'id'`);
        }

        if (!element.source || !['system-logo', 'custom-url', 'uploaded-file'].includes(element.source)) {
          throw new Error(`Logo element ${index} source must be 'system-logo', 'custom-url', or 'uploaded-file'`);
        }

        if (element.source !== 'system-logo' && (!element.url || typeof element.url !== 'string')) {
          throw new Error(`Logo element ${index} with source '${element.source}' must have a valid url string`);
        }

        if (!element.position || typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
          throw new Error(`Logo element ${index} position must have numeric x and y values`);
        }

        if (!element.style || typeof element.style !== 'object') {
          throw new Error(`Logo element ${index} missing required 'style' object`);
        }

        if (typeof element.visible !== 'boolean') {
          element.visible = true; // Default if missing
        }

        if (!['single', 'grid', 'scattered'].includes(element.pattern)) {
          element.pattern = 'single'; // Default if missing or invalid
        }
      });
    }

    // Validate globalSettings
    if (data.globalSettings && typeof data.globalSettings !== 'object') {
      throw new Error('Watermark template globalSettings must be an object');
    }

    return true;
  };

  // Template data access and manipulation
  SystemTemplate.prototype.getTemplateData = function() {
    return this.template_data || {};
  };

  SystemTemplate.prototype.updateTemplateData = function(newData) {
    this.template_data = { ...this.template_data, ...newData };
    if (this.isBrandingTemplate()) {
      this.validateBrandingTemplateData();
    } else if (this.isWatermarkTemplate()) {
      this.validateWatermarkTemplateData();
    }
    return this.save();
  };

  // Static methods for querying templates
  SystemTemplate.findByType = function(templateType, options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        template_type: templateType
      },
      order: [['is_default', 'DESC'], ['created_at', 'ASC']]
    });
  };

  SystemTemplate.findDefaultByType = function(templateType, targetFormat = null) {
    const whereClause = {
      template_type: templateType,
      is_default: true
    };

    if (targetFormat) {
      whereClause.target_format = targetFormat;
    }

    return this.findOne({
      where: whereClause
    });
  };

  SystemTemplate.findByFormat = function(templateType, targetFormat, options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        template_type: templateType,
        target_format: targetFormat
      },
      order: [['is_default', 'DESC'], ['created_at', 'ASC']]
    });
  };

  // Static method to set a template as default (ensures only one default per type)
  SystemTemplate.setAsDefault = async function(templateId) {
    const template = await this.findByPk(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Start transaction to ensure atomicity
    const transaction = await sequelize.transaction();

    try {
      // Clear existing default for this template type and target format
      await this.update(
        { is_default: false },
        {
          where: {
            template_type: template.template_type,
            target_format: template.target_format,
            is_default: true
          },
          transaction
        }
      );

      // Set this template as default
      await template.update(
        { is_default: true },
        { transaction }
      );

      await transaction.commit();
      return template;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Helper method to create branding template with validation
  SystemTemplate.createBrandingTemplate = function(data) {
    const template = this.build({
      ...data,
      template_type: 'branding'
    });

    template.validateBrandingTemplateData();
    return template.save();
  };

  // Helper method to create watermark template with validation
  SystemTemplate.createWatermarkTemplate = function(data) {
    const template = this.build({
      ...data,
      template_type: 'watermark'
    });

    template.validateWatermarkTemplateData();
    return template.save();
  };

  // Method to check if template supports specific format
  SystemTemplate.prototype.supportsFormat = function(targetFormat) {
    return this.target_format === targetFormat;
  };

  // Method to get format type (pdf or svg)
  SystemTemplate.prototype.getFormatType = function() {
    return this.target_format.startsWith('pdf') ? 'pdf' : 'svg';
  };

  return SystemTemplate;
}