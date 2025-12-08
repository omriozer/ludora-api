import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default (sequelize) => {
  const LessonPlan = sequelize.define('LessonPlan', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => generateId()
    },
    context: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Theme context like "animals", "hanukkah", "christmas", etc.'
    },
    file_configs: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'JSON configuration for files: roles, connections, slide configs',
      validate: {
        isValidFileConfigs(value) {
          if (value && typeof value !== 'object') {
            throw new Error('file_configs must be a valid JSON object');
          }
          // Validate structure if value exists
          if (value && value.files && !Array.isArray(value.files)) {
            throw new Error('file_configs.files must be an array');
          }
        }
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this lesson plan is active/published'
    },
    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Estimated duration of the lesson in minutes'
    },
    total_slides: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Total number of slides in the lesson plan'
    },
    teacher_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes and instructions for the teacher conducting the lesson'
    },
    accessible_slides: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: true,
      defaultValue: null,
      comment: 'Array of slide indices (0-based) accessible in preview mode: [0,2,4] or null for all slides'
    },
    allow_slide_preview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether slides can be previewed without purchase access'
    },
    watermark_template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference to system_templates for watermark configuration on slides'
    },
    branding_template_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Reference to system_templates for branding configuration on slides'
    },
    branding_settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Custom branding configuration settings for slides'
    },
    add_branding: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether branding is enabled for this lesson plan'
    }
  }, {
    tableName: 'lesson_plan',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['is_active'] },
      { fields: ['context'] },
      {
        fields: ['file_configs'],
        using: 'gin',
        name: 'idx_lesson_plan_file_configs_gin'
      },
      {
        fields: ['accessible_slides'],
        name: 'idx_lesson_plan_accessible_slides'
      },
      {
        fields: ['allow_slide_preview'],
        name: 'idx_lesson_plan_allow_slide_preview'
      },
      {
        fields: ['watermark_template_id'],
        name: 'idx_lesson_plan_watermark_template_id'
      },
      {
        fields: ['branding_template_id'],
        name: 'idx_lesson_plan_branding_template_id'
      },
      {
        fields: ['add_branding'],
        name: 'idx_lesson_plan_add_branding'
      }
    ]
  });

  LessonPlan.associate = function(models) {
    // Lesson plans are connected to curriculum items through Product -> CurriculumProduct
    // No direct association needed here since it goes through the Product table

    // SystemTemplate association for watermark configuration
    LessonPlan.belongsTo(models.SystemTemplate, {
      foreignKey: 'watermark_template_id',
      as: 'watermarkTemplate'
    });

    // SystemTemplate association for branding configuration
    LessonPlan.belongsTo(models.SystemTemplate, {
      foreignKey: 'branding_template_id',
      as: 'brandingTemplate'
    });

    // Store models reference for dynamic file associations
    LessonPlan.models = models;
  };

  // Helper methods for file configuration management
  LessonPlan.prototype.getFileConfigs = function() {
    return this.file_configs || {};
  };

  LessonPlan.prototype.getFiles = function() {
    const configs = this.getFileConfigs();
    return configs.files || [];
  };

  LessonPlan.prototype.getFilesByRole = function(role) {
    return this.getFiles().filter(file => file.file_role === role);
  };

  LessonPlan.prototype.getOpeningFiles = function() {
    return this.getFilesByRole('opening');
  };

  LessonPlan.prototype.getBodyFiles = function() {
    return this.getFilesByRole('body');
  };

  LessonPlan.prototype.getAudioFiles = function() {
    return this.getFilesByRole('audio');
  };

  LessonPlan.prototype.getAssetFiles = function() {
    return this.getFilesByRole('asset');
  };

  LessonPlan.prototype.getPresentationFiles = function() {
    return this.getFilesByRole('presentation').sort((a, b) => (a.slide_order || 0) - (b.slide_order || 0));
  };

  // Add a presentation slide with order
  LessonPlan.prototype.addPresentationSlide = function(fileId, slideOrder = null) {
    const presentationFiles = this.getPresentationFiles();
    const maxOrder = presentationFiles.length > 0 ? Math.max(...presentationFiles.map(f => f.slide_order || 0)) : 0;
    const newOrder = slideOrder !== null ? slideOrder : maxOrder + 1;

    const fileConfig = {
      file_id: fileId,
      file_role: 'presentation',
      slide_order: newOrder
    };

    this.addFileConfig(fileConfig);
  };

  // Reorder presentation slides
  LessonPlan.prototype.reorderPresentationSlides = function(fileIdOrder) {
    const configs = this.getFileConfigs();
    if (!configs.files) return;

    // Update slide_order for presentation files based on the new order
    fileIdOrder.forEach((fileId, index) => {
      const fileConfig = configs.files.find(file => file.file_id === fileId && file.file_role === 'presentation');
      if (fileConfig) {
        fileConfig.slide_order = index + 1;
      }
    });

    this.file_configs = configs;
  };

  // Remove a presentation slide
  LessonPlan.prototype.removePresentationSlide = function(fileId) {
    this.removeFileConfig(fileId);

    // Reorder remaining slides to fill gaps
    const presentationFiles = this.getPresentationFiles();
    const reorderedIds = presentationFiles.map(f => f.file_id);
    this.reorderPresentationSlides(reorderedIds);
  };

  // ===== DIRECT SVG STORAGE METHODS (No Files Table) =====

  // Add SVG slide directly to file_configs without Files table
  LessonPlan.prototype.addDirectPresentationSlide = function(slideData) {
    const configs = this.getFileConfigs();
    if (!configs.presentation) {
      configs.presentation = [];
    }

    const slideOrder = configs.presentation.length + 1;

    const slideConfig = {
      id: slideData.id || `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: slideData.filename,
      s3_key: slideData.s3_key,
      slide_order: slideOrder,
      title: slideData.title || slideData.filename,
      upload_date: new Date().toISOString(),
      file_size: slideData.file_size || null
    };

    configs.presentation.push(slideConfig);
    this.file_configs = configs;
    this.changed('file_configs', true); // Mark as changed for Sequelize

    return slideConfig;
  };

  // Get all direct presentation slides (not file_id based)
  LessonPlan.prototype.getDirectPresentationSlides = function() {
    const configs = this.getFileConfigs();
    return (configs.presentation || []).sort((a, b) => (a.slide_order || 0) - (b.slide_order || 0));
  };

  // Reorder direct presentation slides
  LessonPlan.prototype.reorderDirectPresentationSlides = function(slideIds) {
    const configs = this.getFileConfigs();
    if (!configs.presentation) return;

    // Update slide_order based on new order
    slideIds.forEach((slideId, index) => {
      const slide = configs.presentation.find(s => s.id === slideId);
      if (slide) {
        slide.slide_order = index + 1;
      }
    });

    this.file_configs = configs;
    this.changed('file_configs', true);
  };

  // Remove direct presentation slide
  LessonPlan.prototype.removeDirectPresentationSlide = function(slideId) {
    const configs = this.getFileConfigs();
    if (!configs.presentation) return null;

    const slideIndex = configs.presentation.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return null;

    const removedSlide = configs.presentation.splice(slideIndex, 1)[0];

    // Reorder remaining slides to fill gaps
    configs.presentation.forEach((slide, index) => {
      slide.slide_order = index + 1;
    });

    this.file_configs = configs;
    this.changed('file_configs', true);

    return removedSlide;
  };

  // Get direct presentation slide by ID
  LessonPlan.prototype.getDirectPresentationSlide = function(slideId) {
    const configs = this.getFileConfigs();
    if (!configs.presentation) return null;
    return configs.presentation.find(s => s.id === slideId) || null;
  };

  LessonPlan.prototype.addFileConfig = function(fileConfig) {
    const configs = this.getFileConfigs();
    if (!configs.files) {
      configs.files = [];
    }
    configs.files.push(fileConfig);
    this.file_configs = configs;
  };

  LessonPlan.prototype.removeFileConfig = function(fileId) {
    const configs = this.getFileConfigs();
    if (configs.files) {
      configs.files = configs.files.filter(file => file.file_id !== fileId);
      this.file_configs = configs;
    }
  };

  LessonPlan.prototype.updateFileConfig = function(fileId, updates) {
    const configs = this.getFileConfigs();
    if (configs.files) {
      const fileIndex = configs.files.findIndex(file => file.file_id === fileId);
      if (fileIndex !== -1) {
        configs.files[fileIndex] = { ...configs.files[fileIndex], ...updates };
        this.file_configs = configs;
      }
    }
  };

  // Get slide configuration for a specific file and slide
  LessonPlan.prototype.getSlideConfig = function(fileId, slideNumber) {
    const fileConfig = this.getFiles().find(file => file.file_id === fileId);
    if (fileConfig && fileConfig.slide_configs) {
      return fileConfig.slide_configs[slideNumber.toString()];
    }
    return null;
  };

  // Set slide configuration for a specific file and slide
  LessonPlan.prototype.setSlideConfig = function(fileId, slideNumber, config) {
    const configs = this.getFileConfigs();
    if (!configs.files) {
      configs.files = [];
    }

    let fileConfig = configs.files.find(file => file.file_id === fileId);
    if (!fileConfig) {
      fileConfig = { file_id: fileId, slide_configs: {} };
      configs.files.push(fileConfig);
    }

    if (!fileConfig.slide_configs) {
      fileConfig.slide_configs = {};
    }

    fileConfig.slide_configs[slideNumber.toString()] = config;
    this.file_configs = configs;
  };

  // Get connected assets for specific opening/body files
  LessonPlan.prototype.getConnectedAssets = function(fileIds) {
    if (!Array.isArray(fileIds)) {
      fileIds = [fileIds];
    }

    return this.getAssetFiles().filter(asset => {
      if (!asset.connected_to_files) return false;
      return fileIds.some(fileId => asset.connected_to_files.includes(fileId));
    });
  };

  // Get all file entities with their configurations
  LessonPlan.prototype.getFilesWithEntities = async function() {
    const { models } = this.constructor;
    const fileConfigs = this.getFiles();

    const filesWithEntities = await Promise.all(
      fileConfigs.map(async (config) => {
        const fileEntity = await models.File.findByPk(config.file_id);
        return {
          ...config,
          entity: fileEntity ? fileEntity.toJSON() : null
        };
      })
    );

    return filesWithEntities;
  };

  // Static method to find lesson plan with curriculum item data
  // Curriculum items are accessed through Product -> CurriculumProduct
  LessonPlan.findWithCurriculumItems = async function(lessonPlanId) {
    const { models } = this;

    // Find the lesson plan
    const lessonPlan = await this.findByPk(lessonPlanId);
    if (!lessonPlan) return null;

    // Find the product that references this lesson plan
    const product = await models.Product.findOne({
      where: {
        product_type: 'lesson_plan',
        entity_id: lessonPlanId
      },
      include: [{
        model: models.CurriculumProduct,
        as: 'curriculumProducts',
        include: [{
          model: models.CurriculumItem,
          as: 'curriculumItem'
        }]
      }]
    });

    return {
      ...lessonPlan.toJSON(),
      product: product ? product.toJSON() : null,
      curriculumItems: product?.curriculumProducts?.map(cp => cp.curriculumItem) || []
    };
  };

  // Default file_configs structure for new lesson plans
  LessonPlan.getDefaultFileConfigs = function() {
    return {
      files: []
    };
  };

  // Validation helper for file configs structure
  LessonPlan.validateFileConfigsStructure = function(fileConfigs) {
    if (!fileConfigs || typeof fileConfigs !== 'object') {
      return false;
    }

    if (fileConfigs.files && !Array.isArray(fileConfigs.files)) {
      return false;
    }

    // Validate each file config
    if (fileConfigs.files) {
      for (const file of fileConfigs.files) {
        if (!file.file_id || !file.file_role) {
          return false;
        }

        const validRoles = ['opening', 'body', 'audio', 'asset', 'presentation'];
        if (!validRoles.includes(file.file_role)) {
          return false;
        }

        if (file.connected_to_files && !Array.isArray(file.connected_to_files)) {
          return false;
        }

        if (file.slide_configs && typeof file.slide_configs !== 'object') {
          return false;
        }
      }
    }

    return true;
  };

  // ===== SLIDE ACCESS CONTROL METHODS =====

  // Check if slide preview is enabled
  LessonPlan.prototype.supportsSlidePreview = function() {
    return this.allow_slide_preview === true;
  };

  // Check if there are slide access restrictions
  LessonPlan.prototype.hasAccessibleSlidesRestriction = function() {
    return !!(this.accessible_slides && Array.isArray(this.accessible_slides) && this.accessible_slides.length > 0);
  };

  // Get accessible slide indices
  LessonPlan.prototype.getAccessibleSlides = function() {
    return this.accessible_slides || null; // null means all slides are accessible
  };

  // Set accessible slide indices
  LessonPlan.prototype.setAccessibleSlides = function(slideIndices) {
    if (slideIndices === null || slideIndices === undefined) {
      this.accessible_slides = null; // Clear restrictions, all slides accessible
    } else if (Array.isArray(slideIndices)) {
      // Validate slide indices (must be non-negative integers)
      const validIndices = slideIndices.filter(index => Number.isInteger(index) && index >= 0);
      this.accessible_slides = validIndices.length > 0 ? [...new Set(validIndices)].sort((a, b) => a - b) : null;
    } else {
      throw new Error('Accessible slides must be an array of non-negative integers or null');
    }
    return this.save();
  };

  // Check if specific slide index is accessible
  LessonPlan.prototype.isSlideAccessible = function(slideIndex) {
    if (!this.hasAccessibleSlidesRestriction()) {
      return true; // No restrictions, all slides accessible
    }

    return this.accessible_slides.includes(slideIndex);
  };

  // Add slide index to accessible slides
  LessonPlan.prototype.addAccessibleSlide = function(slideIndex) {
    if (!Number.isInteger(slideIndex) || slideIndex < 0) {
      throw new Error('Slide index must be a non-negative integer');
    }

    if (!this.hasAccessibleSlidesRestriction()) {
      this.accessible_slides = [slideIndex];
    } else if (!this.accessible_slides.includes(slideIndex)) {
      this.accessible_slides = [...this.accessible_slides, slideIndex].sort((a, b) => a - b);
    }

    return this.save();
  };

  // Remove slide index from accessible slides
  LessonPlan.prototype.removeAccessibleSlide = function(slideIndex) {
    if (!this.hasAccessibleSlidesRestriction()) {
      return this; // No restrictions to remove from
    }

    this.accessible_slides = this.accessible_slides.filter(index => index !== slideIndex);

    // If no slides left, set to null (unrestricted)
    if (this.accessible_slides.length === 0) {
      this.accessible_slides = null;
    }

    return this.save();
  };

  // Get accessible slides for direct presentation slides
  LessonPlan.prototype.getAccessibleDirectSlides = function() {
    const allSlides = this.getDirectPresentationSlides();

    if (!this.hasAccessibleSlidesRestriction()) {
      return allSlides; // All slides accessible
    }

    // Filter slides based on accessible_slides indices (0-based)
    return allSlides.filter((slide, index) => this.isSlideAccessible(index));
  };

  // Check if preview mode is restricted (has slide access restrictions)
  LessonPlan.prototype.isPreviewModeRestricted = function() {
    return this.supportsSlidePreview() && this.hasAccessibleSlidesRestriction();
  };

  // ===== WATERMARK TEMPLATE METHODS =====

  // Check if lesson plan has watermark template
  LessonPlan.prototype.hasWatermarkTemplate = function() {
    return !!(this.watermark_template_id);
  };

  // Get watermark template ID
  LessonPlan.prototype.getWatermarkTemplateId = function() {
    return this.watermark_template_id;
  };

  // Set watermark template
  LessonPlan.prototype.setWatermarkTemplate = function(templateId) {
    this.watermark_template_id = templateId;
    return this.save();
  };

  // Clear watermark template
  LessonPlan.prototype.clearWatermarkTemplate = function() {
    this.watermark_template_id = null;
    return this.save();
  };

  // ===== BRANDING TEMPLATE METHODS =====

  // Check if lesson plan has branding template
  LessonPlan.prototype.hasBrandingTemplate = function() {
    return !!(this.branding_template_id);
  };

  // Get branding template ID
  LessonPlan.prototype.getBrandingTemplateId = function() {
    return this.branding_template_id;
  };

  // Set branding template
  LessonPlan.prototype.setBrandingTemplate = function(templateId) {
    this.branding_template_id = templateId;
    return this.save();
  };

  // Clear branding template
  LessonPlan.prototype.clearBrandingTemplate = function() {
    this.branding_template_id = null;
    this.branding_settings = null;
    return this.save();
  };

  // Get branding settings
  LessonPlan.prototype.getBrandingSettings = function() {
    return this.branding_settings;
  };

  // Set branding settings
  LessonPlan.prototype.setBrandingSettings = function(settings) {
    this.branding_settings = settings;
    return this.save();
  };

  // Get comprehensive preview mode information
  LessonPlan.prototype.getPreviewModeInfo = function() {
    const directSlides = this.getDirectPresentationSlides();

    return {
      supportsSlidePreview: this.supportsSlidePreview(),
      hasSlideRestrictions: this.hasAccessibleSlidesRestriction(),
      accessibleSlides: this.getAccessibleSlides(),
      totalSlides: directSlides.length,
      totalAccessibleSlides: this.hasAccessibleSlidesRestriction()
        ? this.getAccessibleDirectSlides().length
        : directSlides.length,
      hasWatermarkTemplate: this.hasWatermarkTemplate(),
      watermarkTemplateId: this.getWatermarkTemplateId(),
      hasBrandingTemplate: this.hasBrandingTemplate(),
      brandingTemplateId: this.getBrandingTemplateId()
    };
  };

  return LessonPlan;
};