import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import models from '../models/index.js';
import EntityService from '../services/EntityService.js';
const { Game, GameContentLink, GameContentRelation, GameContentRelationItem, GameContent } = models;

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

// Memory Game Specific Routes

// GET /api/games/:id/memory-pairs - Get all content relations for a game (for memory game)
router.get('/:id/memory-pairs', async (req, res) => {
  try {
    const { user } = req;
    const { id: gameId } = req.params;

    // Check if user can access this game
    const game = await Game.findOne({
      where: {
        id: gameId,
        ...(user.role !== 'admin' ? { creator_user_id: user.id } : {})
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found or access denied' });
    }

    // Get all relation links for this game using raw SQL to avoid association scope issues
    let relationLinksResult;
    try {
      const queryResponse = await models.sequelize.query(
        `SELECT gcl.*,
                gcr.id as relation_id,
                gcr.relation_type,
                gcr.is_bidirectional,
                gcr.metadata as relation_metadata,
                gcri.content_id,
                gcri.role,
                gc.semantic_type,
                gc.data_type,
                gc.value,
                gc.metadata as content_metadata
         FROM game_content_link gcl
         JOIN game_content_relation gcr ON gcl.target_id = gcr.id
         JOIN game_content_relation_items gcri ON gcr.id = gcri.relation_id
         JOIN gamecontent gc ON gcri.content_id = gc.id
         WHERE gcl.game_id = :gameId AND gcl.link_type = 'relation'
         ORDER BY gcl.created_at ASC, gcri.role ASC`,
        {
          replacements: { gameId },
          type: models.Sequelize.QueryTypes.SELECT
        }
      );

      // Sequelize returns [results, metadata] - we want the results
      relationLinksResult = Array.isArray(queryResponse) ? queryResponse : queryResponse;
    } catch (queryError) {
      console.error('SQL query error:', queryError);
      return res.status(500).json({
        error: 'Failed to fetch memory pairs',
        message: queryError.message
      });
    }

    // Group the results by link and relation
    const enrichedLinks = [];
    const linkMap = new Map();

    // Handle empty results - ensure relationLinksResult is an array
    if (!relationLinksResult || !Array.isArray(relationLinksResult) || relationLinksResult.length === 0) {
      return res.json([]);
    }

    relationLinksResult.forEach(row => {
      const linkId = row.id;

      if (!linkMap.has(linkId)) {
        linkMap.set(linkId, {
          id: linkId,
          game_id: row.game_id,
          link_type: row.link_type,
          target_id: row.target_id,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at,
          relation: {
            id: row.relation_id,
            relation_type: row.relation_type,
            is_bidirectional: row.is_bidirectional,
            metadata: row.relation_metadata,
            items: []
          }
        });
        enrichedLinks.push(linkMap.get(linkId));
      }

      const link = linkMap.get(linkId);
      link.relation.items.push({
        role: row.role,
        content_id: row.content_id,
        content: {
          id: row.content_id,
          semantic_type: row.semantic_type,
          data_type: row.data_type,
          value: row.value,
          metadata: row.content_metadata
        }
      });
    });

    // Transform to frontend-friendly format
    const memoryPairs = enrichedLinks.map(link => {
      const relation = link.relation;
      if (!relation) return null; // Skip if relation not found
      const items = relation.items || [];

      return {
        id: relation.id,
        linkId: link.id,
        relationId: relation.id,
        relationType: relation.relation_type,
        isBidirectional: relation.is_bidirectional,
        items: items.map(item => ({
          role: item.role,
          content_id: item.content_id,
          content: item.content
        })),
        metadata: {
          ...link.metadata,
          ...relation.metadata
        }
      };
    }).filter(pair => pair !== null); // Remove any null entries

    res.json(memoryPairs);
  } catch (error) {
    console.error('Error fetching memory pairs:', error);
    res.status(500).json({
      error: 'Failed to fetch memory pairs',
      message: error.message
    });
  }
});

// POST /api/games/:id/memory-pairs - Create new content relation for game
router.post('/:id/memory-pairs', async (req, res) => {
  try {
    const { user } = req;
    const { id: gameId } = req.params;
    const { contentIdA, contentIdB, relationType, metadata = {} } = req.body;

    // Validate required fields
    if (!contentIdA || !contentIdB || !relationType) {
      return res.status(400).json({ error: 'contentIdA, contentIdB, and relationType are required' });
    }

    // Validate relation type
    const validRelationTypes = ['translation', 'antonym', 'synonym', 'similar_meaning', 'question_answer', 'answer_question', 'distractor'];
    if (!validRelationTypes.includes(relationType)) {
      return res.status(400).json({ error: `Invalid relation type. Must be one of: ${validRelationTypes.join(', ')}` });
    }

    // Check if user can edit this game
    const game = await Game.findOne({
      where: {
        id: gameId,
        ...(user.role !== 'admin' ? { creator_user_id: user.id } : {})
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found or access denied' });
    }

    // Check if content exists
    const [contentA, contentB] = await Promise.all([
      GameContent.findByPk(contentIdA),
      GameContent.findByPk(contentIdB)
    ]);

    if (!contentA || !contentB) {
      return res.status(404).json({ error: 'One or both content items not found' });
    }

    // Check if this exact pair already exists as a relation of the same type
    const existingRelations = await GameContentRelation.findAll({
      where: {
        relation_type: relationType
      },
      include: [{
        model: GameContentRelationItem,
        as: 'items',
        where: {
          content_id: [contentIdA, contentIdB]
        }
      }]
    });

    let relation = null;
    for (const rel of existingRelations) {
      const contentIds = rel.items.map(item => item.content_id);
      if (contentIds.includes(contentIdA) && contentIds.includes(contentIdB) && contentIds.length === 2) {
        relation = rel;
        break;
      }
    }

    // Create new relation if doesn't exist
    let link;
    if (!relation) {
      // Use transaction to ensure atomicity
      const transaction = await models.sequelize.transaction();

      try {
        // Determine if relation is bidirectional based on type
        const bidirectionalTypes = ['translation', 'synonym', 'similar_meaning'];
        const isBidirectional = bidirectionalTypes.includes(relationType);

        relation = await GameContentRelation.create({
          relation_type: relationType,
          is_bidirectional: isBidirectional,
          metadata: metadata.relation || {}
        }, { transaction });

        // Create relation items
        await GameContentRelationItem.bulkCreate([
          { relation_id: relation.id, content_id: contentIdA, role: 'pair_a' },
          { relation_id: relation.id, content_id: contentIdB, role: 'pair_b' }
        ], { transaction });

        // Create link between game and relation
        link = await GameContentLink.create({
          game_id: gameId,
          link_type: 'relation',
          target_id: relation.id,
          metadata: metadata.link || {}
        }, { transaction });

        await transaction.commit();
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } else {
      // Relation exists, just create the link
      link = await GameContentLink.create({
        game_id: gameId,
        link_type: 'relation',
        target_id: relation.id,
        metadata: metadata.link || {}
      });
    }

    // Return the complete relation data
    const relationLink = await GameContentLink.findOne({
      where: { id: link.id },
      include: [{
        model: GameContentRelation,
        as: 'relation',
        include: [{
          model: GameContentRelationItem,
          as: 'items',
          include: [{
            model: GameContent,
            as: 'content'
          }]
        }]
      }]
    });

    const items = relationLink.relation.items;

    res.status(201).json({
      id: relation.id,
      linkId: link.id,
      relationId: relation.id,
      relationType: relation.relation_type,
      isBidirectional: relation.is_bidirectional,
      items: items.map(item => ({
        role: item.role,
        content_id: item.content_id,
        content: item.content
      })),
      metadata: {
        ...link.metadata,
        ...relation.metadata
      }
    });
  } catch (error) {
    console.error('Error creating memory pair:', error);
    res.status(500).json({
      error: 'Failed to create memory pair',
      message: error.message
    });
  }
});

// PUT /api/games/:id/memory-pairs/:relationId - Update content relation
router.put('/:id/memory-pairs/:relationId', async (req, res) => {
  try {
    const { user } = req;
    const { id: gameId, relationId } = req.params;
    const { contentIdA, contentIdB, relationType, metadata = {} } = req.body;

    // Check if user can edit this game
    const game = await Game.findOne({
      where: {
        id: gameId,
        ...(user.role !== 'admin' ? { creator_user_id: user.id } : {})
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found or access denied' });
    }

    // Find the link
    const link = await GameContentLink.findOne({
      where: {
        game_id: gameId,
        target_id: relationId,
        link_type: 'relation'
      }
    });

    if (!link) {
      return res.status(404).json({ error: 'Content relation not found in this game' });
    }

    // Get the relation
    const relation = await GameContentRelation.findByPk(relationId);
    if (!relation) {
      return res.status(404).json({ error: 'Content relation not found' });
    }

    // Update relation type if provided
    if (relationType) {
      const validRelationTypes = ['translation', 'antonym', 'synonym', 'similar_meaning', 'question_answer', 'answer_question', 'distractor'];
      if (!validRelationTypes.includes(relationType)) {
        return res.status(400).json({ error: `Invalid relation type. Must be one of: ${validRelationTypes.join(', ')}` });
      }

      // Determine if relation is bidirectional based on type
      const bidirectionalTypes = ['translation', 'synonym', 'similar_meaning'];
      const isBidirectional = bidirectionalTypes.includes(relationType);

      await relation.update({
        relation_type: relationType,
        is_bidirectional: isBidirectional
      });
    }

    // Update relation items if content IDs provided
    if (contentIdA || contentIdB) {
      // Get current items
      const currentItems = await GameContentRelationItem.findAll({
        where: { relation_id: relationId }
      });

      // Update items
      const updates = [];
      if (contentIdA) {
        const itemAItem = currentItems.find(item => item.role === 'pair_a');
        if (itemAItem) {
          updates.push(GameContentRelationItem.update(
            { content_id: contentIdA },
            { where: { relation_id: relationId, role: 'pair_a' } }
          ));
        }
      }

      if (contentIdB) {
        const itemBItem = currentItems.find(item => item.role === 'pair_b');
        if (itemBItem) {
          updates.push(GameContentRelationItem.update(
            { content_id: contentIdB },
            { where: { relation_id: relationId, role: 'pair_b' } }
          ));
        }
      }

      await Promise.all(updates);
    }

    // Update metadata
    if (metadata.link) {
      await link.update({ metadata: metadata.link });
    }
    if (metadata.relation) {
      await GameContentRelation.update(
        { metadata: metadata.relation },
        { where: { id: relationId } }
      );
    }

    // Return updated data
    const updatedLink = await GameContentLink.findOne({
      where: { id: link.id },
      include: [{
        model: GameContentRelation,
        as: 'relation',
        include: [{
          model: GameContentRelationItem,
          as: 'items',
          include: [{
            model: GameContent,
            as: 'content'
          }]
        }]
      }]
    });

    const updatedRelation = updatedLink.relation;
    const items = updatedRelation.items;

    res.json({
      id: updatedRelation.id,
      linkId: link.id,
      relationId: updatedRelation.id,
      relationType: updatedRelation.relation_type,
      isBidirectional: updatedRelation.is_bidirectional,
      items: items.map(item => ({
        role: item.role,
        content_id: item.content_id,
        content: item.content
      })),
      metadata: {
        ...updatedLink.metadata,
        ...updatedRelation.metadata
      }
    });
  } catch (error) {
    console.error('Error updating memory pair:', error);
    res.status(500).json({
      error: 'Failed to update memory pair',
      message: error.message
    });
  }
});

// DELETE /api/games/:id/memory-pairs/:relationId - Remove memory pair from game
router.delete('/:id/memory-pairs/:relationId', async (req, res) => {
  try {
    const { user } = req;
    const { id: gameId, relationId } = req.params;

    // Check if user can edit this game
    const game = await Game.findOne({
      where: {
        id: gameId,
        ...(user.role !== 'admin' ? { creator_user_id: user.id } : {})
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found or access denied' });
    }

    // Find and delete the link
    const link = await GameContentLink.findOne({
      where: {
        game_id: gameId,
        target_id: relationId,
        link_type: 'relation'
      }
    });

    if (!link) {
      return res.status(404).json({ error: 'Memory pair not found in this game' });
    }

    await link.destroy();

    res.json({ message: 'Memory pair removed from game successfully' });
  } catch (error) {
    console.error('Error removing memory pair:', error);
    res.status(500).json({
      error: 'Failed to remove memory pair',
      message: error.message
    });
  }
});

// GET /api/games/memory-pairs/library - Browse global content relations library
router.get('/memory-pairs/library', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, relationType } = req.query;
    const offset = (page - 1) * limit;

    // Build search conditions
    const whereConditions = {};
    if (relationType) {
      whereConditions.relation_type = relationType;
    }

    // Get memory pairs with content
    const relations = await GameContentRelation.findAndCountAll({
      where: whereConditions,
      include: [{
        model: GameContentRelationItem,
        as: 'items',
        include: [{
          model: GameContent,
          as: 'content',
          ...(search ? {
            where: {
              value: {
                [models.Sequelize.Op.iLike]: `%${search}%`
              }
            }
          } : {})
        }]
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Transform to frontend format
    const contentRelations = relations.rows.map(relation => {
      const items = relation.items;

      return {
        id: relation.id,
        relationId: relation.id,
        relationType: relation.relation_type,
        isBidirectional: relation.is_bidirectional,
        items: items.map(item => ({
          role: item.role,
          content_id: item.content_id,
          content: item.content
        })),
        metadata: relation.metadata,
        usageCount: 0 // TODO: Calculate how many games use this relation
      };
    }).filter(relation => relation.items.length >= 2); // Only complete relations

    res.json({
      contentRelations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: relations.count,
        totalPages: Math.ceil(relations.count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching memory pairs library:', error);
    res.status(500).json({
      error: 'Failed to fetch memory pairs library',
      message: error.message
    });
  }
});

export default router;