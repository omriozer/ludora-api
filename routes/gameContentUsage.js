import express from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateQuery, customValidators } from '../middleware/validation.js';
import models from '../models/index.js';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import ContentResolutionService from '../services/ContentResolutionService.js';

const router = express.Router();

const {
  GameContentUsage,
  GameContentRuleInstance,
  GameContentUsageTemplate,
  GameContentRule,
  Game,
  User
} = models;

// Validation schemas
const usageCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).required(),
  template_id: Joi.string().min(1).max(255).allow(null).optional(),
  rules: Joi.array().optional()
});

const usageUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).optional()
});

const copyTemplateSchema = Joi.object({
  template_id: Joi.string().min(1).max(255).required(),
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).allow(null, '').optional()
});

// Helper function to check game access permissions
async function checkGameAccess(user, gameId) {
  const game = await Game.findByPk(gameId);
  if (!game) {
    throw new NotFoundError('Game not found');
  }

  // Admins and sysadmins can access any game
  if (user.role === 'admin' || user.role === 'sysadmin') {
    return game;
  }

  // Content creators can only access their own games
  if (game.content_creator_id && game.content_creator_id === user.id) {
    return game;
  }

  throw new BadRequestError('You do not have permission to access this game');
}

// GET /api/games/:gameId/content-usage - Get all content usage for a game
router.get('/:gameId/content-usage', authenticateToken, async (req, res, next) => {
  try {
    const game = await checkGameAccess(req.user, req.params.gameId);

    const usages = await GameContentUsage.getByGame(req.params.gameId);

    res.json({
      success: true,
      data: usages,
      meta: {
        game_id: req.params.gameId,
        game_title: game.title,
        total: usages.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:gameId/content-usage/:usageId - Get specific content usage
router.get('/:gameId/content-usage/:usageId', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const usage = await GameContentUsage.findOne({
      where: {
        id: req.params.usageId,
        game_id: req.params.gameId
      },
      include: [{
        model: GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }, {
        model: GameContentUsageTemplate,
        as: 'template'
      }]
    });

    if (!usage) {
      throw new NotFoundError('Content usage not found');
    }

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:gameId/content-usage - Create new content usage for game
router.post('/:gameId/content-usage', authenticateToken, validateBody(usageCreateSchema), async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const { name, description, content_types, template_id, rules } = req.body;

    // Create usage
    const usage = await GameContentUsage.create({
      game_id: req.params.gameId,
      template_id: template_id || null,
      name,
      description,
      content_types
    });

    // Create associated rule instances if provided
    if (rules && Array.isArray(rules) && rules.length > 0) {
      const rulePromises = rules.map((rule, index) => {
        return GameContentRuleInstance.create({
          game_usage_id: usage.id,
          rule_type: rule.rule_type,
          rule_config: rule.rule_config,
          priority: rule.priority || index
        });
      });

      await Promise.all(rulePromises);
    }

    // Fetch complete usage with rules
    const completeUsage = await GameContentUsage.findByPk(usage.id, {
      include: [{
        model: GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }, {
        model: GameContentUsageTemplate,
        as: 'template'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Content usage created successfully',
      data: completeUsage
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:gameId/content-usage/copy-template - Copy template to create usage
router.post('/:gameId/content-usage/copy-template', authenticateToken, validateBody(copyTemplateSchema), async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const { template_id, name, description } = req.body;

    // Get template with rules
    const template = await GameContentUsageTemplate.findByPk(template_id, {
      include: [{
        model: GameContentRule,
        as: 'rules'
      }]
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Create usage from template
    const usage = await GameContentUsage.create({
      game_id: req.params.gameId,
      template_id: template.id,
      name: name || template.name,
      description: description || template.description,
      content_types: template.content_types
    });

    // Copy rules from template
    if (template.rules && template.rules.length > 0) {
      const rulePromises = template.rules.map(rule => {
        return GameContentRuleInstance.create({
          game_usage_id: usage.id,
          rule_type: rule.rule_type,
          rule_config: rule.rule_config,
          priority: rule.priority
        });
      });

      await Promise.all(rulePromises);
    }

    // Fetch complete usage
    const completeUsage = await GameContentUsage.findByPk(usage.id, {
      include: [{
        model: GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }, {
        model: GameContentUsageTemplate,
        as: 'template'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Template copied successfully',
      data: completeUsage
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/games/:gameId/content-usage/:usageId - Update content usage
router.put('/:gameId/content-usage/:usageId', authenticateToken, validateBody(usageUpdateSchema), async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const usage = await GameContentUsage.findOne({
      where: {
        id: req.params.usageId,
        game_id: req.params.gameId
      }
    });

    if (!usage) {
      throw new NotFoundError('Content usage not found');
    }

    const { name, description, content_types } = req.body;

    await usage.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(content_types && { content_types })
    });

    // Fetch updated usage with associations
    const updatedUsage = await GameContentUsage.findByPk(usage.id, {
      include: [{
        model: GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }, {
        model: GameContentUsageTemplate,
        as: 'template'
      }]
    });

    res.json({
      success: true,
      message: 'Content usage updated successfully',
      data: updatedUsage
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/games/:gameId/content-usage/:usageId - Delete content usage
router.delete('/:gameId/content-usage/:usageId', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const usage = await GameContentUsage.findOne({
      where: {
        id: req.params.usageId,
        game_id: req.params.gameId
      }
    });

    if (!usage) {
      throw new NotFoundError('Content usage not found');
    }

    await usage.destroy();

    res.json({
      success: true,
      message: 'Content usage deleted successfully',
      data: { id: req.params.usageId }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:gameId/content-usage/:usageId/rules - Add rule to usage
router.post('/:gameId/content-usage/:usageId/rules', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const usage = await GameContentUsage.findOne({
      where: {
        id: req.params.usageId,
        game_id: req.params.gameId
      }
    });

    if (!usage) {
      throw new NotFoundError('Content usage not found');
    }

    const { rule_type, rule_config, priority } = req.body;

    const rule = await GameContentRuleInstance.create({
      game_usage_id: usage.id,
      rule_type,
      rule_config,
      priority: priority || 0
    });

    res.status(201).json({
      success: true,
      message: 'Rule added successfully',
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/games/:gameId/content-usage/:usageId/rules/:ruleId - Update usage rule
router.put('/:gameId/content-usage/:usageId/rules/:ruleId', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const rule = await GameContentRuleInstance.findOne({
      where: {
        id: req.params.ruleId,
        game_usage_id: req.params.usageId
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

// DELETE /api/games/:gameId/content-usage/:usageId/rules/:ruleId - Delete usage rule
router.delete('/:gameId/content-usage/:usageId/rules/:ruleId', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const rule = await GameContentRuleInstance.findOne({
      where: {
        id: req.params.ruleId,
        game_usage_id: req.params.usageId
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

// GET /api/games/:gameId/content-usage/:usageId/resolve - Resolve content for usage
router.get('/:gameId/content-usage/:usageId/resolve', authenticateToken, async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    // Verify the usage belongs to this game
    const usage = await GameContentUsage.findOne({
      where: {
        id: req.params.usageId,
        game_id: req.params.gameId
      }
    });

    if (!usage) {
      throw new NotFoundError('Content usage not found');
    }

    const resolvedContent = await ContentResolutionService.resolveContentForUsage(req.params.usageId);

    res.json({
      success: true,
      data: resolvedContent
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:gameId/content-usage/preview-rule - Preview content for rule configuration
router.post('/:gameId/content-usage/preview-rule', authenticateToken, validateBody(Joi.object({
  rule_type: Joi.string().valid('attribute_based', 'content_list', 'complex_attribute', 'relation_based').required(),
  rule_config: Joi.object().required(),
  content_types: Joi.array().items(
    Joi.string().valid('word', 'worden', 'image', 'qa', 'grammar', 'audiofile', 'contentlist', 'attribute')
  ).required(),
  limit: Joi.number().integer().min(1).max(100).default(10)
})), async (req, res, next) => {
  try {
    await checkGameAccess(req.user, req.params.gameId);

    const { rule_type, rule_config, content_types, limit } = req.body;

    const preview = await ContentResolutionService.previewContentForRule(
      rule_type,
      rule_config,
      content_types,
      limit
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    next(error);
  }
});

export default router;