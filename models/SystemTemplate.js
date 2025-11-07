import { DataTypes, Op } from 'sequelize';
import { baseFields, baseOptions } from './baseModel.js';

export default function(sequelize) {
  const SystemTemplate = sequelize.define('SystemTemplate', {
    ...baseFields,
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
        isIn: [['footer', 'header', 'watermark']] // Extensible for future template types
      },
      comment: 'Type of template (footer, header, watermark, etc.)'
    },
    target_file_types: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: null,
      validate: {
        isValidFileTypes(value) {
          if (value === null || value === undefined) return; // Allow null for footer/header templates

          if (!Array.isArray(value)) {
            throw new Error('target_file_types must be an array');
          }

          const validTypes = ['pdf', 'svg', 'both'];
          const invalidTypes = value.filter(type => !validTypes.includes(type));
          if (invalidTypes.length > 0) {
            throw new Error(`Invalid file types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`);
          }

          // Ensure no duplicates
          const uniqueTypes = [...new Set(value)];
          if (uniqueTypes.length !== value.length) {
            throw new Error('target_file_types cannot contain duplicates');
          }
        }
      },
      comment: 'Array of file types this template applies to: [pdf, svg, both] - null for footer/header templates'
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Template category (landscape, portrait, minimal, logo-only, corporate, etc.)'
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
        fields: ['category'],
        name: 'idx_system_templates_category'
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
        fields: ['created_by'],
        name: 'idx_system_templates_created_by'
      },
      {
        fields: ['target_file_types'],
        name: 'idx_system_templates_file_types'
      },
      {
        unique: true,
        fields: ['template_type', 'is_default'],
        name: 'unique_default_per_type',
        where: {
          is_default: true
        }
      }
    ]
  });

  SystemTemplate.associate = function(models) {
    // Files can reference system templates for footer configuration
    SystemTemplate.hasMany(models.File, {
      foreignKey: 'footer_template_id',
      as: 'files_using_footer_template'
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
  SystemTemplate.prototype.isFooterTemplate = function() {
    return this.template_type === 'footer';
  };

  SystemTemplate.prototype.isHeaderTemplate = function() {
    return this.template_type === 'header';
  };

  SystemTemplate.prototype.isWatermarkTemplate = function() {
    return this.template_type === 'watermark';
  };

  SystemTemplate.prototype.isDefaultTemplate = function() {
    return this.is_default === true;
  };

  // Footer-specific template data validation
  SystemTemplate.prototype.validateFooterTemplateData = function() {
    if (!this.isFooterTemplate()) {
      throw new Error('Template is not a footer template');
    }

    const data = this.template_data;
    if (!data || typeof data !== 'object') {
      throw new Error('Footer template data must be a valid object');
    }

    // Validate required footer structure
    const requiredElements = ['logo', 'text', 'url'];
    for (const element of requiredElements) {
      if (!data[element] || typeof data[element] !== 'object') {
        throw new Error(`Footer template missing required element: ${element}`);
      }

      const elementData = data[element];

      // Check for required fields
      if (typeof elementData.visible !== 'boolean') {
        throw new Error(`Footer template ${element} missing required 'visible' boolean`);
      }

      if (typeof elementData.hidden !== 'boolean') {
        elementData.hidden = false; // Default if missing
      }

      if (typeof elementData.rotation !== 'number') {
        elementData.rotation = 0; // Default if missing
      }

      if (!elementData.position || typeof elementData.position !== 'object') {
        throw new Error(`Footer template ${element} missing required 'position' object`);
      }

      if (typeof elementData.position.x !== 'number' || typeof elementData.position.y !== 'number') {
        throw new Error(`Footer template ${element} position must have numeric x and y values`);
      }

      if (!elementData.style || typeof elementData.style !== 'object') {
        throw new Error(`Footer template ${element} missing required 'style' object`);
      }
    }

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
    if (this.isFooterTemplate()) {
      this.validateFooterTemplateData();
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

  SystemTemplate.findDefaultByType = function(templateType) {
    return this.findOne({
      where: {
        template_type: templateType,
        is_default: true
      }
    });
  };

  SystemTemplate.findByCategory = function(templateType, category, options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        template_type: templateType,
        category: category
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
      // Clear existing default for this template type
      await this.update(
        { is_default: false },
        {
          where: {
            template_type: template.template_type,
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

  // Helper method to create footer template with validation
  SystemTemplate.createFooterTemplate = function(data) {
    const template = this.build({
      ...data,
      template_type: 'footer'
    });

    template.validateFooterTemplateData();
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

  // Static method to find watermark templates by file type
  SystemTemplate.findWatermarksByFileType = function(fileType, options = {}) {
    return this.findAll({
      ...options,
      where: {
        ...options.where,
        template_type: 'watermark',
        [Op.or]: [
          { target_file_types: { [Op.contains]: [fileType] } },
          { target_file_types: { [Op.contains]: ['both'] } },
          { target_file_types: null } // Include templates that apply to all file types
        ]
      },
      order: [['is_default', 'DESC'], ['created_at', 'ASC']]
    });
  };

  // Static method to find default watermark template by file type
  SystemTemplate.findDefaultWatermarkByFileType = function(fileType) {
    return this.findOne({
      where: {
        template_type: 'watermark',
        is_default: true,
        [Op.or]: [
          { target_file_types: { [Op.contains]: [fileType] } },
          { target_file_types: { [Op.contains]: ['both'] } },
          { target_file_types: null }
        ]
      }
    });
  };

  // Method to check if template supports specific file type
  SystemTemplate.prototype.supportsFileType = function(fileType) {
    if (!this.target_file_types || this.target_file_types.length === 0) {
      return true; // null means supports all file types
    }

    return this.target_file_types.includes(fileType) || this.target_file_types.includes('both');
  };

  return SystemTemplate;
}