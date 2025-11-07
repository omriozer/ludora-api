import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import models from '../models/index.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

/**
 * Validate watermark template data structure
 * @param {Object} templateData - Watermark template data to validate
 * @throws {Error} If validation fails
 */
function validateWatermarkTemplateData(templateData) {
  if (!templateData || typeof templateData !== 'object') {
    throw new Error('Template data must be an object');
  }

  // Check for at least one element type
  if (!templateData.textElements && !templateData.logoElements) {
    throw new Error('Template must have at least one textElements or logoElements array');
  }

  // Validate text elements
  if (templateData.textElements) {
    if (!Array.isArray(templateData.textElements)) {
      throw new Error('textElements must be an array');
    }

    for (const [index, textEl] of templateData.textElements.entries()) {
      if (!textEl.id || typeof textEl.id !== 'string') {
        throw new Error(`Text element ${index} must have a string id`);
      }
      if (!textEl.content || typeof textEl.content !== 'string') {
        throw new Error(`Text element ${index} must have string content`);
      }
      if (!textEl.position || typeof textEl.position.x !== 'number' || typeof textEl.position.y !== 'number') {
        throw new Error(`Text element ${index} must have position with numeric x and y`);
      }
      if (!textEl.style || typeof textEl.style !== 'object') {
        throw new Error(`Text element ${index} must have a style object`);
      }
      if (!['single', 'grid', 'scattered'].includes(textEl.pattern)) {
        throw new Error(`Text element ${index} pattern must be 'single', 'grid', or 'scattered'`);
      }
      if (typeof textEl.visible !== 'boolean') {
        throw new Error(`Text element ${index} visible must be boolean`);
      }
    }
  }

  // Validate logo elements
  if (templateData.logoElements) {
    if (!Array.isArray(templateData.logoElements)) {
      throw new Error('logoElements must be an array');
    }

    for (const [index, logoEl] of templateData.logoElements.entries()) {
      if (!logoEl.id || typeof logoEl.id !== 'string') {
        throw new Error(`Logo element ${index} must have a string id`);
      }
      if (!logoEl.source || typeof logoEl.source !== 'string') {
        throw new Error(`Logo element ${index} must have a string source`);
      }
      if (!logoEl.position || typeof logoEl.position.x !== 'number' || typeof logoEl.position.y !== 'number') {
        throw new Error(`Logo element ${index} must have position with numeric x and y`);
      }
      if (!logoEl.style || typeof logoEl.style !== 'object') {
        throw new Error(`Logo element ${index} must have a style object`);
      }
      if (!['single', 'grid', 'scattered'].includes(logoEl.pattern)) {
        throw new Error(`Logo element ${index} pattern must be 'single', 'grid', or 'scattered'`);
      }
      if (typeof logoEl.visible !== 'boolean') {
        throw new Error(`Logo element ${index} visible must be boolean`);
      }
    }
  }

  // Validate global settings if present
  if (templateData.globalSettings && typeof templateData.globalSettings !== 'object') {
    throw new Error('globalSettings must be an object');
  }
}

/**
 * Get all system templates or filter by type
 * GET /api/system-templates?type=footer&category=landscape
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, category, include_inactive } = req.query;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'sysadmin';

    clog('SystemTemplates: Getting templates', {
      userId: req.user.uid,
      type,
      category,
      include_inactive,
      isAdmin
    });

    // Build where clause
    const whereClause = {};

    if (type) {
      whereClause.template_type = type;
    }

    if (category) {
      whereClause.category = category;
    }

    // Non-admins can only see active templates (when we add active field later)
    // For now, all templates are visible

    const templates = await models.SystemTemplate.findAll({
      where: whereClause,
      order: [['is_default', 'DESC'], ['category', 'ASC'], ['created_at', 'ASC']],
      include: isAdmin ? [] : [] // Can include File associations later if needed
    });

    res.json({
      success: true,
      data: templates,
      meta: {
        total: templates.length,
        type: type || 'all',
        category: category || 'all'
      }
    });

  } catch (error) {
    cerror('SystemTemplates: Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get templates by type (convenience endpoint)
 * GET /api/system-templates/footer
 * GET /api/system-templates/header
 */
router.get('/:templateType', authenticateToken, async (req, res) => {
  try {
    const { templateType } = req.params;
    const { category } = req.query;

    clog('SystemTemplates: Getting templates by type', {
      userId: req.user.uid,
      templateType,
      category
    });

    // Validate template type
    const validTypes = ['footer', 'header', 'watermark'];
    if (!validTypes.includes(templateType)) {
      return res.status(400).json({
        error: `Invalid template type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const whereClause = { template_type: templateType };

    if (category) {
      whereClause.category = category;
    }

    const templates = await models.SystemTemplate.findByType(templateType, {
      where: category ? { category } : {}
    });

    // Get the default template
    const defaultTemplate = templates.find(t => t.is_default);

    res.json({
      success: true,
      data: templates,
      meta: {
        total: templates.length,
        default_template: defaultTemplate ? defaultTemplate.id : null,
        type: templateType,
        category: category || 'all'
      }
    });

  } catch (error) {
    cerror('SystemTemplates: Error getting templates by type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get default template for a type
 * GET /api/system-templates/default/footer
 */
router.get('/default/:templateType', authenticateToken, async (req, res) => {
  try {
    const { templateType } = req.params;

    clog('SystemTemplates: Getting default template', {
      userId: req.user.uid,
      templateType
    });

    const defaultTemplate = await models.SystemTemplate.findDefaultByType(templateType);

    if (!defaultTemplate) {
      return res.status(404).json({
        error: `No default template found for type: ${templateType}`
      });
    }

    res.json({
      success: true,
      data: defaultTemplate
    });

  } catch (error) {
    cerror('SystemTemplates: Error getting default template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new system template (Admin only)
 * POST /api/system-templates
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, template_type, category, template_data, is_default } = req.body;
    const createdBy = req.user.email;

    clog('SystemTemplates: Creating new template', {
      name,
      template_type,
      category,
      is_default,
      createdBy
    });

    // Validation
    if (!name || !template_type || !template_data) {
      return res.status(400).json({
        error: 'name, template_type, and template_data are required'
      });
    }

    // Validate template type
    const validTypes = ['footer', 'header', 'watermark'];
    if (!validTypes.includes(template_type)) {
      return res.status(400).json({
        error: `Invalid template type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate template data based on type
    if (template_type === 'footer') {
      const template = models.SystemTemplate.build({
        name,
        description,
        template_type,
        category,
        template_data,
        is_default: false, // Validate first, then set default if needed
        created_by: createdBy
      });

      try {
        template.validateFooterTemplateData();
      } catch (validationError) {
        return res.status(400).json({
          error: `Invalid footer template data: ${validationError.message}`
        });
      }
    } else if (template_type === 'watermark') {
      try {
        validateWatermarkTemplateData(template_data);
      } catch (validationError) {
        return res.status(400).json({
          error: `Invalid watermark template data: ${validationError.message}`
        });
      }
    }

    // Create the template
    const template = await models.SystemTemplate.create({
      name,
      description,
      template_type,
      category,
      template_data,
      is_default: !!is_default,
      created_by: createdBy
    });

    // If this should be the default, set it as default (handles uniqueness)
    if (is_default) {
      await models.SystemTemplate.setAsDefault(template.id);
      await template.reload(); // Refresh to get updated is_default status
    }

    clog('SystemTemplates: Template created successfully', {
      templateId: template.id,
      name: template.name
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error creating template:', error);

    // Handle unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'A default template already exists for this type'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a system template (Admin only)
 * PUT /api/system-templates/:id
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, template_data, is_default } = req.body;

    clog('SystemTemplates: Updating template', {
      templateId: id,
      name,
      category,
      is_default
    });

    const template = await models.SystemTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Validate template_data if being updated
    if (template_data) {
      if (template.template_type === 'footer') {
        const testTemplate = models.SystemTemplate.build({
          ...template.toJSON(),
          template_data
        });

        try {
          testTemplate.validateFooterTemplateData();
        } catch (validationError) {
          return res.status(400).json({
            error: `Invalid footer template data: ${validationError.message}`
          });
        }
      } else if (template.template_type === 'watermark') {
        try {
          validateWatermarkTemplateData(template_data);
        } catch (validationError) {
          return res.status(400).json({
            error: `Invalid watermark template data: ${validationError.message}`
          });
        }
      }
    }

    // Update the template
    const updatedData = {};
    if (name !== undefined) updatedData.name = name;
    if (description !== undefined) updatedData.description = description;
    if (category !== undefined) updatedData.category = category;
    if (template_data !== undefined) updatedData.template_data = template_data;

    await template.update(updatedData);

    // Handle default status separately to ensure uniqueness
    if (is_default !== undefined) {
      if (is_default && !template.is_default) {
        await models.SystemTemplate.setAsDefault(template.id);
      } else if (!is_default && template.is_default) {
        // Can't remove default status unless there's another default
        const otherDefaults = await models.SystemTemplate.findAll({
          where: {
            template_type: template.template_type,
            is_default: true,
            id: { [models.sequelize.Sequelize.Op.ne]: template.id }
          }
        });

        if (otherDefaults.length > 0) {
          await template.update({ is_default: false });
        } else {
          return res.status(400).json({
            error: 'Cannot remove default status - at least one default template must exist for each type'
          });
        }
      }
    }

    await template.reload();

    clog('SystemTemplates: Template updated successfully', {
      templateId: template.id,
      name: template.name
    });

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a system template (Admin only)
 * DELETE /api/system-templates/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    clog('SystemTemplates: Deleting template', { templateId: id });

    const template = await models.SystemTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if template is being used by any files
    const filesUsingTemplate = await models.File.count({
      where: { footer_template_id: id }
    });

    if (filesUsingTemplate > 0) {
      return res.status(409).json({
        error: `Cannot delete template - it is being used by ${filesUsingTemplate} file(s)`
      });
    }

    // Check if this is the only default template for its type
    if (template.is_default) {
      const otherDefaults = await models.SystemTemplate.count({
        where: {
          template_type: template.template_type,
          is_default: true,
          id: { [models.sequelize.Sequelize.Op.ne]: template.id }
        }
      });

      if (otherDefaults === 0) {
        return res.status(400).json({
          error: 'Cannot delete the only default template for this type'
        });
      }
    }

    const templateName = template.name;
    await template.destroy();

    clog('SystemTemplates: Template deleted successfully', {
      templateId: id,
      name: templateName
    });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set template as default (Admin only)
 * POST /api/system-templates/:id/set-default
 */
router.post('/:id/set-default', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    clog('SystemTemplates: Setting template as default', { templateId: id });

    const template = await models.SystemTemplate.setAsDefault(id);

    clog('SystemTemplates: Template set as default successfully', {
      templateId: template.id,
      name: template.name
    });

    res.json({
      success: true,
      data: template,
      message: 'Template set as default successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error setting template as default:', error);

    if (error.message === 'Template not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Duplicate a template (Admin only)
 * POST /api/system-templates/:id/duplicate
 */
router.post('/:id/duplicate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const createdBy = req.user.email;

    clog('SystemTemplates: Duplicating template', {
      sourceTemplateId: id,
      newName: name
    });

    const sourceTemplate = await models.SystemTemplate.findByPk(id);

    if (!sourceTemplate) {
      return res.status(404).json({ error: 'Source template not found' });
    }

    const newName = name || `${sourceTemplate.name} - Copy`;

    const duplicatedTemplate = await models.SystemTemplate.create({
      name: newName,
      description: sourceTemplate.description,
      template_type: sourceTemplate.template_type,
      category: sourceTemplate.category,
      template_data: sourceTemplate.template_data,
      is_default: false, // Duplicated templates are never default
      created_by: createdBy
    });

    clog('SystemTemplates: Template duplicated successfully', {
      sourceTemplateId: id,
      newTemplateId: duplicatedTemplate.id,
      newName: duplicatedTemplate.name
    });

    res.status(201).json({
      success: true,
      data: duplicatedTemplate,
      message: 'Template duplicated successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error duplicating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save file footer configuration as a new template (Admin only)
 * POST /api/system-templates/save-from-file/:fileId
 */
router.post('/save-from-file/:fileId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { name, description, category } = req.body;
    const createdBy = req.user.email;

    clog('SystemTemplates: Saving file footer as template', {
      fileId,
      name,
      category
    });

    // Get the file with its footer configuration
    const file = await models.File.findByPk(fileId, {
      include: {
        model: models.SystemTemplate,
        as: 'footerTemplate'
      }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the effective footer configuration for this file
    let footerData;

    if (file.footerTemplate) {
      // File has a template, merge with overrides
      footerData = file.mergeWithTemplateData(file.footerTemplate.template_data);
    } else {
      // File doesn't have a template, try to get default template
      const defaultTemplate = await models.SystemTemplate.findDefaultByType('footer');
      if (defaultTemplate) {
        footerData = file.mergeWithTemplateData(defaultTemplate.template_data);
      } else {
        return res.status(400).json({
          error: 'No footer configuration found for this file'
        });
      }
    }

    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Create the new template
    const template = await models.SystemTemplate.create({
      name,
      description: description || `Template created from file: ${file.title}`,
      template_type: 'footer',
      category: category || 'custom',
      template_data: footerData,
      is_default: false,
      created_by: createdBy
    });

    clog('SystemTemplates: Template created from file footer', {
      templateId: template.id,
      fileId: file.id,
      name: template.name
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully from file footer configuration'
    });

  } catch (error) {
    cerror('SystemTemplates: Error saving file footer as template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preview watermark template with sample content
 * POST /api/system-templates/:id/preview-watermark
 */
router.post('/:id/preview-watermark', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { contentType, sampleContent, variables } = req.body;

    clog('SystemTemplates: Previewing watermark template', {
      templateId: id,
      contentType,
      userId: req.user.uid
    });

    const template = await models.SystemTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.template_type !== 'watermark') {
      return res.status(400).json({ error: 'Template is not a watermark template' });
    }

    // Import watermark processing based on content type
    let previewResult = null;
    const defaultVariables = {
      filename: 'sample-document.pdf',
      user: req.user.email || 'user@example.com',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      ...variables
    };

    if (contentType === 'svg') {
      const { applyWatermarksToSvg } = await import('../utils/svgWatermark.js');
      const sampleSvg = sampleContent || `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f0f0f0"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">
    Sample Content for Watermark Preview
  </text>
</svg>`;

      previewResult = await applyWatermarksToSvg(sampleSvg, template.template_data, defaultVariables);
    } else if (contentType === 'pdf') {
      // For PDF preview, return template data with variables substituted
      previewResult = {
        template_data: template.template_data,
        variables: defaultVariables,
        note: 'PDF preview requires actual PDF processing. This shows the template configuration with substituted variables.'
      };
    } else {
      return res.status(400).json({
        error: 'Unsupported content type. Use "svg" or "pdf"'
      });
    }

    res.json({
      success: true,
      data: {
        template_id: template.id,
        template_name: template.name,
        content_type: contentType,
        preview: previewResult,
        variables_used: defaultVariables
      }
    });

  } catch (error) {
    cerror('SystemTemplates: Error previewing watermark template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test watermark template variables
 * POST /api/system-templates/test-variables
 */
router.post('/test-variables', authenticateToken, async (req, res) => {
  try {
    const { template_data, variables } = req.body;

    clog('SystemTemplates: Testing watermark variables', {
      userId: req.user.uid,
      variableCount: Object.keys(variables || {}).length
    });

    if (!template_data) {
      return res.status(400).json({ error: 'template_data is required' });
    }

    // Validate template data structure
    try {
      validateWatermarkTemplateData(template_data);
    } catch (validationError) {
      return res.status(400).json({
        error: `Invalid watermark template data: ${validationError.message}`
      });
    }

    const testVariables = {
      filename: 'test-document.pdf',
      user: req.user.email || 'user@example.com',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      slideId: 'slide_001',
      lessonPlan: 'Sample Lesson Plan',
      ...variables
    };

    // Extract variables from template content
    const extractedVariables = new Set();
    const variableRegex = /\{\{(\w+)\}\}/g;

    // Check text elements for variables
    if (template_data.textElements) {
      for (const textEl of template_data.textElements) {
        let match;
        while ((match = variableRegex.exec(textEl.content)) !== null) {
          extractedVariables.add(match[1]);
        }
      }
    }

    // Substitute variables in text content
    const processedElements = {
      textElements: template_data.textElements?.map(textEl => ({
        ...textEl,
        content: textEl.content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          return testVariables[varName] || match;
        })
      })),
      logoElements: template_data.logoElements
    };

    res.json({
      success: true,
      data: {
        original_template: template_data,
        processed_template: processedElements,
        variables_found: Array.from(extractedVariables),
        variables_provided: testVariables,
        missing_variables: Array.from(extractedVariables).filter(v => !(v in testVariables))
      }
    });

  } catch (error) {
    cerror('SystemTemplates: Error testing variables:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get watermark template usage statistics
 * GET /api/system-templates/:id/usage
 */
router.get('/:id/usage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    clog('SystemTemplates: Getting template usage', {
      templateId: id,
      userId: req.user.uid
    });

    const template = await models.SystemTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.template_type !== 'watermark') {
      return res.status(400).json({ error: 'Template is not a watermark template' });
    }

    // Count usage in Files
    const fileUsage = await models.File.count({
      where: { watermark_template_id: id }
    });

    // Count usage in LessonPlans
    const lessonPlanUsage = await models.LessonPlan.count({
      where: { watermark_template_id: id }
    });

    // Get sample entities using this template
    const sampleFiles = await models.File.findAll({
      where: { watermark_template_id: id },
      attributes: ['id', 'title', 'file_name'],
      limit: 5
    });

    const sampleLessonPlans = await models.LessonPlan.findAll({
      where: { watermark_template_id: id },
      attributes: ['id', 'title', 'description'],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        template_id: template.id,
        template_name: template.name,
        usage: {
          total: fileUsage + lessonPlanUsage,
          files: fileUsage,
          lesson_plans: lessonPlanUsage
        },
        samples: {
          files: sampleFiles,
          lesson_plans: sampleLessonPlans
        },
        can_delete: fileUsage === 0 && lessonPlanUsage === 0
      }
    });

  } catch (error) {
    cerror('SystemTemplates: Error getting template usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export watermark template for backup/sharing
 * GET /api/system-templates/:id/export
 */
router.get('/:id/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    clog('SystemTemplates: Exporting template', {
      templateId: id,
      userId: req.user.uid
    });

    const template = await models.SystemTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.template_type !== 'watermark') {
      return res.status(400).json({ error: 'Template is not a watermark template' });
    }

    const exportData = {
      version: '1.0',
      export_date: new Date().toISOString(),
      exported_by: req.user.email,
      template: {
        name: template.name,
        description: template.description,
        template_type: template.template_type,
        category: template.category,
        template_data: template.template_data
      }
    };

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="watermark-template-${template.name.replace(/[^a-zA-Z0-9]/g, '-')}.json"`);
    res.setHeader('Content-Type', 'application/json');

    res.json(exportData);

  } catch (error) {
    cerror('SystemTemplates: Error exporting template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Import watermark template from exported file
 * POST /api/system-templates/import
 */
router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { template_data: importData, new_name } = req.body;
    const createdBy = req.user.email;

    clog('SystemTemplates: Importing template', {
      newName: new_name,
      userId: req.user.uid
    });

    if (!importData || !importData.template) {
      return res.status(400).json({
        error: 'Invalid import data. Expected exported template format.'
      });
    }

    const templateData = importData.template;

    // Validate template structure
    if (templateData.template_type !== 'watermark') {
      return res.status(400).json({
        error: 'Import data is not a watermark template'
      });
    }

    try {
      validateWatermarkTemplateData(templateData.template_data);
    } catch (validationError) {
      return res.status(400).json({
        error: `Invalid watermark template data: ${validationError.message}`
      });
    }

    const templateName = new_name || `${templateData.name} (Imported)`;

    // Create the imported template
    const template = await models.SystemTemplate.create({
      name: templateName,
      description: templateData.description || 'Imported watermark template',
      template_type: templateData.template_type,
      category: templateData.category || 'imported',
      template_data: templateData.template_data,
      is_default: false, // Imported templates are never default
      created_by: createdBy
    });

    clog('SystemTemplates: Template imported successfully', {
      templateId: template.id,
      name: template.name,
      originalName: templateData.name
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Watermark template imported successfully'
    });

  } catch (error) {
    cerror('SystemTemplates: Error importing template:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;