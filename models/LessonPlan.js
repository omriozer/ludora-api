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
      }
    ]
  });

  LessonPlan.associate = function(models) {
    // Lesson plans are connected to curriculum items through Product -> CurriculumProduct
    // No direct association needed here since it goes through the Product table

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
    const models = this.constructor.models;
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
    const models = this.models;

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

  return LessonPlan;
};