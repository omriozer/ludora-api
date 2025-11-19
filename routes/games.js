import express from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth.js';
import { checkStudentsAccess } from '../middleware/studentsAccessMiddleware.js';
import models from '../models/index.js';
import EntityService from '../services/EntityService.js';
import GameContentService from '../services/GameContentService.js';
import GameLobbyService from '../services/GameLobbyService.js';
import { clog, cerror } from '../lib/utils.js';
const { Game, sequelize } = models;

const router = express.Router();

// Helper function to check game ownership via Product table
async function validateGameOwnership(gameId, userId, userRole) {
  // Admin users can access any game
  if (userRole === 'admin' || userRole === 'sysadmin') {
    return true;
  }

  // Find the associated product
  const product = await models.Product.findOne({
    where: {
      product_type: 'game',
      entity_id: gameId
    }
  });

  if (!product) {
    return true; // Game without product belongs to Ludora, allow access
  }

  // If product has no creator_user_id, it belongs to Ludora (allow access)
  if (!product.creator_user_id) {
    return true;
  }

  // Check product ownership
  return String(product.creator_user_id) === String(userId);
}

// Helper function to get user's games based on Product ownership
async function getUserGames(userId, userRole) {
  if (userRole === 'admin' || userRole === 'sysadmin') {
    // Admin users see all games
    return await models.Game.findAll({
      order: [['created_at', 'DESC']]
    });
  }

  // Find products owned by user
  const userProducts = await models.Product.findAll({
    where: {
      product_type: 'game',
      creator_user_id: userId
    }
  });

  // Get games for those products, plus Ludora-owned games (no product or no creator)
  const userProductGameIds = userProducts.map(p => p.entity_id);

  const allProducts = await models.Product.findAll({
    where: { product_type: 'game' }
  });

  const ludoraGameIds = await models.Game.findAll({
    where: {
      id: {
        [models.Sequelize.Op.notIn]: allProducts.map(p => p.entity_id)
      }
    },
    attributes: ['id']
  }).then(games => games.map(g => g.id));

  const noCreatorProducts = allProducts.filter(p => !p.creator_user_id);
  const noCreatorGameIds = noCreatorProducts.map(p => p.entity_id);

  const allowedGameIds = [...userProductGameIds, ...ludoraGameIds, ...noCreatorGameIds];

  return await models.Game.findAll({
    where: {
      id: allowedGameIds
    },
    order: [['created_at', 'DESC']]
  });
}

// Shared function to get games with products and lobbies for consistent response format
async function getGamesWithProducts(userId, userRole) {
  // Get games based on Product ownership for the target user
  const games = await getUserGames(userId, userRole);

  // For each game, find if there's an associated product and get lobby information
  const gamesWithProductsAndLobbies = await Promise.all(games.map(async (game) => {
    const gameData = game.toJSON();

    // Find associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: game.id
      },
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    // Get lobby information for this game
    let lobbies = [];
    try {
      lobbies = await GameLobbyService.getLobbiesByGame(game.id);
      clog(`📋 Found ${lobbies.length} lobbies for game ${game.id}`);
    } catch (error) {
      cerror(`❌ Error fetching lobbies for game ${game.id}:`, error);
      // Continue with empty lobbies array if fetch fails
    }

    return {
      ...gameData,
      product: product ? product.toJSON() : null,
      lobbies: lobbies
    };
  }));

  return gamesWithProductsAndLobbies;
}

// Student-facing route for getting teacher games by invitation code
// GET /api/games/teacher/:code - Get games for teacher by invitation code (with student access control)
router.get('/teacher/:code', checkStudentsAccess, async (req, res) => {
  try {
    const { code } = req.params;

    // Find the teacher by invitation code
    const teacher = await models.User.findOne({
      where: {
        invitation_code: code,
        user_type: 'teacher'
      },
      attributes: ['id', 'role', 'full_name', 'email']
    });

    if (!teacher) {
      return res.status(404).json({
        error: 'Teacher not found',
        message: 'Invalid invitation code or teacher not found'
      });
    }

    const gamesWithProducts = await getGamesWithProducts(teacher.id, teacher.role);

    res.json(gamesWithProducts);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch teacher games',
      message: error.message
    });
  }
});

// Apply auth middleware to all other routes
router.use(authenticateToken);

// GET /api/games - Get games for authenticated user
// Returns user's games (or all games if admin) with associated product data
router.get('/', async (req, res) => {
  try {
    const { user } = req;

    const gamesWithProducts = await getGamesWithProducts(user.id, user.role);

    res.json(gamesWithProducts);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch games',
      message: error.message
    });
  }
});

// GET /api/games/:id - Get specific game with product data
router.get('/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Validate game ownership via Product table
    try {
      await validateGameOwnership(id, user.id, user.role);
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({ error: 'Game not found' });
      }
      return res.status(403).json({ error: 'Access denied' });
    }

    const game = await models.Game.findByPk(id);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Find associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: game.id
      },
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    const gameData = game.toJSON();
    res.json({
      ...gameData,
      product: product ? product.toJSON() : null
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch game',
      message: error.message
    });
  }
});

// POST /api/games - Create new game
router.post('/', async (req, res) => {
  try {
    const { user } = req;
    const gameData = req.body;

    // Create game using EntityService
    const game = await EntityService.create('game', gameData, user.id);

    // Return game with creator info
    const gameWithCreator = await models.Game.findOne({
      where: { id: game.id },
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.status(201).json({
      ...gameWithCreator.toJSON(),
      product: null // New games don't have products yet
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create game',
      message: error.message
    });
  }
});

// PUT /api/games/:id - Update game
router.put('/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Validate game ownership via Product table
    try {
      await validateGameOwnership(id, user.id, user.role);
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({ error: 'Game not found' });
      }
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update game using EntityService
    const updatedGame = await EntityService.update('game', id, updateData, user.id);

    // Return updated game with product info
    const gameWithDetails = await models.Game.findByPk(id);

    // Find associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: id
      },
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    res.json({
      ...gameWithDetails.toJSON(),
      product: product ? product.toJSON() : null
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update game',
      message: error.message
    });
  }
});

// DELETE /api/games/:id - Delete game
router.delete('/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Validate game ownership via Product table
    try {
      await validateGameOwnership(id, user.id, user.role);
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({ error: 'Game not found' });
      }
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete game using EntityService (this will also handle product deletion)
    await EntityService.delete('game', id);

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete game',
      message: error.message
    });
  }
});

// ==========================================
// GAME CONTENT MANAGEMENT ROUTES
// ==========================================

// Validation schemas for content management
const contentUseCreateSchema = Joi.object({
  use_type: Joi.string()
    .valid('pair', 'single_content', 'group', 'mixed_edu_contents')
    .required()
    .messages({
      'any.only': 'use_type must be one of: pair, single_content, group, mixed_edu_contents'
    }),
  contents: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required().messages({
          'string.empty': 'Content object id cannot be empty',
          'any.required': 'Content object must have an id'
        }),
        source: Joi.string()
          .valid('eduContent', 'eduContentUse')
          .required()
          .messages({
            'any.only': 'Content object source must be eduContent or eduContentUse',
            'any.required': 'Content object must have a source'
          })
      })
    )
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'contents array must have at least 1 item',
      'array.max': 'contents array must have at most 10 items'
    }),
  usage_metadata: Joi.object()
    .optional()
    .messages({
      'object.base': 'usage_metadata must be a valid JSON object'
    })
});

const contentUseUpdateSchema = Joi.object({
  contents: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required().messages({
          'string.empty': 'Content object id cannot be empty',
          'any.required': 'Content object must have an id'
        }),
        source: Joi.string()
          .valid('eduContent', 'eduContentUse')
          .required()
          .messages({
            'any.only': 'Content object source must be eduContent or eduContentUse',
            'any.required': 'Content object must have a source'
          })
      })
    )
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'contents array must have at least 1 item',
      'array.max': 'contents array must have at most 10 items'
    }),
  usage_metadata: Joi.object()
    .optional()
    .messages({
      'object.base': 'usage_metadata must be a valid JSON object'
    })
});

// Validation middleware
const validateContentUseCreate = (req, res, next) => {
  const { error, value } = contentUseCreateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  req.validatedData = value;
  next();
};

const validateContentUseUpdate = (req, res, next) => {
  const { error, value } = contentUseUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  req.validatedData = value;
  next();
};

/**
 * GET /api/games/:gameId/contents
 * Get all content usage for a game with populated content and streaming URLs
 */
router.get('/:gameId/contents', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { use_type } = req.query;

    clog(`Getting contents for game ${gameId}`);

    const contents = await GameContentService.getGameContents(gameId, { use_type });

    res.json({
      data: contents,
      pagination: {
        total: contents.length,
        limit: contents.length,
        offset: 0
      }
    });
  } catch (error) {
    cerror(`Error in GET /games/${req.params.gameId}/contents:`, error);

    if (error.message === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/games/:gameId/content-use
 * Create new content usage for a game
 */
router.post('/:gameId/content-use',
  validateContentUseCreate,
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { gameId } = req.params;
      const { user } = req;

      clog(`Creating content use for game ${gameId}`);

      const contentUse = await GameContentService.createContentUse(
        gameId,
        req.validatedData,
        user.id,
        transaction,
        user.role
      );

      await transaction.commit();

      res.status(201).json(contentUse);
    } catch (error) {
      await transaction.rollback();
      cerror(`Error in POST /games/${req.params.gameId}/content-use:`, error);

      if (error.message === 'Game not found') {
        return res.status(404).json({ error: 'Game not found' });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      if (error.message.includes('Content not found') ||
          error.message.includes('use_type') ||
          error.message.includes('content ID')) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * PUT /api/games/:gameId/content-use/:useId
 * Update existing content usage for a game
 */
router.put('/:gameId/content-use/:useId',
  validateContentUseUpdate,
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { gameId, useId } = req.params;
      const { user } = req;

      clog(`Updating content use ${useId} for game ${gameId}`);

      const contentUse = await GameContentService.updateContentUse(
        gameId,
        useId,
        req.validatedData,
        user.id,
        transaction,
        user.role
      );

      await transaction.commit();

      res.json(contentUse);
    } catch (error) {
      await transaction.rollback();
      cerror(`Error in PUT /games/${req.params.gameId}/content-use/${req.params.useId}:`, error);

      if (error.message === 'Game not found' || error.message === 'Content usage not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      if (error.message.includes('Content not found') ||
          error.message.includes('use_type') ||
          error.message.includes('content ID')) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/games/:gameId/content-use/:useId
 * Delete content usage from a game
 */
router.delete('/:gameId/content-use/:useId', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { gameId, useId } = req.params;
    const { user } = req;

    clog(`Deleting content use ${useId} from game ${gameId}`);

    await GameContentService.deleteContentUse(gameId, useId, user.id, transaction, user.role);

    await transaction.commit();

    res.json({
      success: true,
      message: 'Content usage deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    cerror(`Error in DELETE /games/${req.params.gameId}/content-use/${req.params.useId}:`, error);

    if (error.message === 'Game not found' || error.message === 'Content usage not found') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/games/:gameId/content-stats
 * Get content statistics for a game
 */
router.get('/:gameId/content-stats', async (req, res) => {
  try {
    const { gameId } = req.params;

    clog(`Getting content stats for game ${gameId}`);

    const stats = await GameContentService.getGameContentStats(gameId);

    res.json(stats);
  } catch (error) {
    cerror(`Error in GET /games/${req.params.gameId}/content-stats:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;