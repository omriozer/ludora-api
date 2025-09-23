import express from 'express';
import Joi from 'joi';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import models from '../models/index.js';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';
import ContentResolutionService from '../services/ContentResolutionService.js';

const router = express.Router();

const {
  GameContentUsageTemplate,
  GameContentRule,
  GameTypeContentRestriction,
  User
} = models;

// Validation schemas for game content templates
const templateCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  game_type: Joi.string().min(1).max(100).required(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).required(),
  is_global: Joi.boolean().optional(),
  rules: Joi.array().optional()
});

const templateUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).optional(),
  is_global: Joi.boolean().optional()
});

const ruleSchema = Joi.object({
  rule_type: Joi.string().valid('attribute_based', 'content_list', 'complex_attribute', 'relation_based').required(),
  rule_config: Joi.object().required(),
  priority: Joi.number().integer().min(0).max(1000).optional()
});

// Helper function to validate content types against game type restrictions
async function validateContentTypesForGameType(gameType, contentTypes) {
  const restriction = await GameTypeContentRestriction.getByGameType(gameType);
  if (!restriction) {
    throw new BadRequestError(`No content type restrictions found for game type: ${gameType}`);
  }

  const allowedTypes = restriction.allowed_content_types;
  const invalidTypes = contentTypes.filter(type => !allowedTypes.includes(type));

  if (invalidTypes.length > 0) {
    throw new BadRequestError(
      `Content types not allowed for ${gameType}: ${invalidTypes.join(', ')}. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
}

// Helper function to check admin permissions
function checkAdminPermissions(user) {
  if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
    throw new BadRequestError('Only administrators can manage content templates');
  }
}

// GET /api/game-content-templates - Get all templates
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { game_type, is_global, include_rules } = req.query;

    let whereClause = {};
    if (game_type) whereClause.game_type = game_type;
    if (is_global !== undefined) whereClause.is_global = is_global === 'true';

    const includeOptions = [{
      model: User,
      as: 'creator',
      attributes: ['id', 'full_name', 'email']
    }];

    if (include_rules === 'true') {
      includeOptions.push({
        model: GameContentRule,
        as: 'rules',
        order: [['priority', 'DESC']]
      });
    }

    const templates = await GameContentUsageTemplate.findAll({
      where: whereClause,
      include: includeOptions,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: templates,
      meta: {
        total: templates.length,
        filters: { game_type, is_global, include_rules }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/game-content-templates/game-type/:gameType - Get templates for specific game type
router.get('/game-type/:gameType', authenticateToken, async (req, res, next) => {
  try {
    const { gameType } = req.params;
    const { include_global } = req.query;

    const templates = await GameContentUsageTemplate.getTemplatesForGameType(
      gameType,
      include_global !== 'false'
    );

    res.json({
      success: true,
      data: templates,
      meta: {
        game_type: gameType,
        include_global: include_global !== 'false',
        total: templates.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/game-content-templates/global - Get global templates
router.get('/global', authenticateToken, async (req, res, next) => {
  try {
    const templates = await GameContentUsageTemplate.getGlobalTemplates();

    res.json({
      success: true,
      data: templates,
      meta: {
        total: templates.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/game-content-templates/:id - Get template by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const template = await GameContentUsageTemplate.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: GameContentRule,
        as: 'rules',
        order: [['priority', 'DESC']]
      }]
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-content-templates - Create new template
router.post('/', authenticateToken, validateBody(templateCreateSchema), async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const { name, description, game_type, content_types, is_global, rules } = req.body;

    // Validate content types against game type restrictions
    if (!is_global) {
      await validateContentTypesForGameType(game_type, content_types);
    }

    // Create template
    const template = await GameContentUsageTemplate.create({
      name,
      description,
      game_type,
      content_types,
      is_global: is_global || false,
      created_by: req.user.id
    });

    // Create associated rules if provided
    if (rules && Array.isArray(rules) && rules.length > 0) {
      const rulePromises = rules.map((rule, index) => {
        return GameContentRule.create({
          template_id: template.id,
          rule_type: rule.rule_type,
          rule_config: rule.rule_config,
          priority: rule.priority || index
        });
      });

      await Promise.all(rulePromises);
    }

    // Fetch complete template with rules
    const completeTemplate = await GameContentUsageTemplate.findByPk(template.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: GameContentRule,
        as: 'rules',
        order: [['priority', 'DESC']]
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: completeTemplate
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/game-content-templates/:id - Update template
router.put('/:id', authenticateToken, validateBody(templateUpdateSchema), async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const template = await GameContentUsageTemplate.findByPk(req.params.id);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    const { name, description, content_types, is_global } = req.body;

    // Validate content types if provided
    if (content_types && !is_global) {
      await validateContentTypesForGameType(template.game_type, content_types);
    }

    // Update template
    await template.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(content_types && { content_types }),
      ...(is_global !== undefined && { is_global })
    });

    // Fetch updated template with associations
    const updatedTemplate = await GameContentUsageTemplate.findByPk(template.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: GameContentRule,
        as: 'rules',
        order: [['priority', 'DESC']]
      }]
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: updatedTemplate
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game-content-templates/:id - Delete template
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const template = await GameContentUsageTemplate.findByPk(req.params.id);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    await template.destroy();

    res.json({
      success: true,
      message: 'Template deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-content-templates/:id/rules - Add rule to template
router.post('/:id/rules', authenticateToken, validateBody(ruleSchema), async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const template = await GameContentUsageTemplate.findByPk(req.params.id);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    const { rule_type, rule_config, priority } = req.body;

    const rule = await GameContentRule.create({
      template_id: template.id,
      rule_type,
      rule_config,
      priority: priority || 0
    });

    res.status(201).json({
      success: true,
      message: 'Rule added to template successfully',
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/game-content-templates/:id/rules/:ruleId - Update template rule
router.put('/:id/rules/:ruleId', authenticateToken, validateBody(ruleSchema), async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const rule = await GameContentRule.findOne({
      where: {
        id: req.params.ruleId,
        template_id: req.params.id
      }
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    const { rule_type, rule_config, priority } = req.body;

    await rule.update({
      rule_type,
      rule_config,
      priority: priority !== undefined ? priority : rule.priority
    });

    res.json({
      success: true,
      message: 'Rule updated successfully',
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game-content-templates/:id/rules/:ruleId - Delete template rule
router.delete('/:id/rules/:ruleId', authenticateToken, async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const rule = await GameContentRule.findOne({
      where: {
        id: req.params.ruleId,
        template_id: req.params.id
      }
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    await rule.destroy();

    res.json({
      success: true,
      message: 'Rule deleted successfully',
      data: { id: req.params.ruleId }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-content-templates/preview-rule - Preview content for rule configuration (admin only)
router.post('/preview-rule', authenticateToken, validateBody(Joi.object({
  rule_type: Joi.string().valid('attribute_based', 'content_list', 'complex_attribute', 'relation_based').required(),
  rule_config: Joi.object().required(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).required(),
  limit: Joi.number().integer().min(1).max(100).default(10)
})), async (req, res, next) => {
  try {
    checkAdminPermissions(req.user);

    const { rule_type, rule_config, content_types, limit } = req.body;

    const preview = await ContentResolutionService.previewContentForRule(
      rule_type,
      rule_config,
      content_types,
      limit
    );

    res.json({
      success: true,
      data: preview,
      message: 'Rule preview generated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;