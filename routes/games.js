import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import models from '../models/index.js';
import EntityService from '../services/EntityService.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// GET /api/games - Get games for management
// Returns user's games (or all games if admin) with associated product data
router.get('/', async (req, res) => {
  try {
    const { user } = req;

    // Build where clause based on user role
    let whereClause = {};
    if (user.role !== 'admin') {
      // Non-admin users can only see their own games
      whereClause.creator_user_id = user.id;
    }
    // Admin users see all games (no filter)

    // Get games with creator and product information
    const games = await models.Game.findAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // For each game, find if there's an associated product
    const gamesWithProducts = await Promise.all(games.map(async (game) => {
      const gameData = game.toJSON();

      // Find associated product
      const product = await models.Product.findOne({
        where: {
          product_type: 'game',
          entity_id: game.id
        }
      });

      return {
        ...gameData,
        product: product ? product.toJSON() : null
      };
    }));

    res.json(gamesWithProducts);
  } catch (error) {
    console.error('Error fetching games for management:', error);
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

    // Build where clause based on user role
    let whereClause = { id };
    if (user.role !== 'admin') {
      // Non-admin users can only see their own games
      whereClause.creator_user_id = user.id;
    }

    const game = await models.Game.findOne({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found or access denied' });
    }

    // Find associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: game.id
      }
    });

    const gameData = game.toJSON();
    res.json({
      ...gameData,
      product: product ? product.toJSON() : null
    });
  } catch (error) {
    console.error('Error fetching game:', error);
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
    console.error('Error creating game:', error);
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

    // Check if user can edit this game
    const existingGame = await models.Game.findOne({
      where: { id }
    });

    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Non-admin users can only edit their own games
    if (user.role !== 'admin' && existingGame.creator_user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update game using EntityService
    const updatedGame = await EntityService.update('game', id, updateData, user.id);

    // Return updated game with creator and product info
    const gameWithDetails = await models.Game.findOne({
      where: { id },
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    // Find associated product
    const product = await models.Product.findOne({
      where: {
        product_type: 'game',
        entity_id: id
      }
    });

    res.json({
      ...gameWithDetails.toJSON(),
      product: product ? product.toJSON() : null
    });
  } catch (error) {
    console.error('Error updating game:', error);
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

    // Check if user can delete this game
    const existingGame = await models.Game.findOne({
      where: { id }
    });

    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Non-admin users can only delete their own games
    if (user.role !== 'admin' && existingGame.creator_user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete game using EntityService (this will also handle product deletion)
    await EntityService.delete('game', id);

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({
      error: 'Failed to delete game',
      message: error.message
    });
  }
});

export default router;