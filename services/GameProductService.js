import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import fileService from './FileService.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * GameProductService - Domain-specific service for Game products
 *
 * Handles:
 * - Game creation with type-specific settings
 * - Game type settings coordination (scatter, memory, etc.)
 * - Game content management
 * - Marketing video cleanup
 * - Special Game entity logic (NOT using normalized product structure)
 */
class GameProductService extends BaseProductService {
  constructor() {
    super('game');
  }

  // Create game with type-specific settings coordination
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      let isCommitted = false;

      try {
        ludlog.generic('Creating game with type settings', {
          gameType: data.game_type,
          createdBy
        });

        const GameModel = this.getModel('game');

        // Extract game-type-specific settings
        const {
          scatter_settings,
          memory_settings,
          ...gameData
        } = data;

        // Add audit fields to game data
        const entityData = {
          ...gameData,
          id: gameData.id || generateId(),
          created_at: new Date(),
          updated_at: new Date(),
          creator_user_id: createdBy
        };

        // Create the main game record
        const game = await GameModel.create(entityData, { transaction });

        // Create game-type-specific settings if provided
        if (game.game_type && data[`${game.game_type.replace('_game', '')}_settings`]) {
          const typeSettings = data[`${game.game_type.replace('_game', '')}_settings`];

          // Skip type settings creation for drafts or if method doesn't exist
          if (typeof game.createTypeSettings === 'function') {
            try {
              await game.createTypeSettings(typeSettings);
            } catch (typeError) {
              ludlog.generic('Type settings creation skipped', {
                gameId: game.id,
                gameType: game.game_type,
                error: typeError.message
              });
              // Continue without type settings for drafts
            }
          }
        }

        isCommitted = true;

        ludlog.generic('Game created successfully', {
          gameId: game.id,
          gameType: game.game_type,
          hasTypeSettings: !!data[`${game.game_type?.replace('_game', '') || 'unknown'}_settings`]
        });

        // Return the created game directly (avoid complex queries after transaction)
        return game;
      } catch (error) {
        // Only rollback if transaction hasn't been committed
        if (!isCommitted) {
          ludlog.generic('Game creation failed, rolling back transaction', {
            error: error.message
          });
        }
        throw new Error(`Failed to create game: ${error.message}`);
      }
    });
  }

  // Update game with type-specific settings coordination
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating game with type settings', {
          gameId: id,
          updatedBy
        });

        const GameModel = this.getModel('game');

        // Find existing game
        const game = await GameModel.findByPk(id, { transaction });
        if (!game) {
          throw new Error('Game not found');
        }

        // Extract game-type-specific settings
        const {
          scatter_settings,
          memory_settings,
          ...gameData
        } = data;

        // Prepare update data for main game record
        const updateData = {
          ...gameData,
          updated_at: new Date(),
          ...(updatedBy && { updated_by: updatedBy })
        };

        // Don't allow updating certain fields
        delete updateData.id;
        delete updateData.created_at;
        // Remove creator field from update data (shouldn't be changed)
        delete updateData.creator_user_id;

        // Update main game record
        await game.update(updateData, { transaction });

        // Update game-type-specific settings if provided
        if (game.game_type) {
          const settingsKey = `${game.game_type.replace('_game', '')}_settings`;
          if (data[settingsKey]) {
            try {
              if (typeof game.updateTypeSettings === 'function') {
                await game.updateTypeSettings(data[settingsKey]);
              }
            } catch (typeError) {
              ludlog.generic('Type settings update failed', {
                gameId: id,
                gameType: game.game_type,
                error: typeError.message
              });
              // Continue with game update even if type settings fail
            }
          }
        }

        ludlog.generic('Game updated successfully', {
          gameId: id,
          gameType: game.game_type
        });

        // Return updated game with type settings
        return await this.findById(id);
      } catch (error) {
        throw error;
      }
    });
  }

  // Enhanced findById for games with proper includes
  async findById(id, include = null) {
    try {
      ludlog.generic('Finding game by ID', { gameId: id });

      const GameModel = this.getModel('game');

      // Build query options with creator include
      const queryOptions = {
        where: { id },
        include: []
      };

      // Include creator information
      if (this.shouldIncludeCreator()) {
        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false // LEFT JOIN to include games even without creators
        });
      }

      // Temporarily disable additional includes until schema is fixed
      // Future: Add game content, sessions, etc.

      const game = await GameModel.findOne(queryOptions);

      if (!game) {
        throw new Error('Game not found');
      }

      // Post-process to add default creator name when creator is null
      if (this.shouldIncludeCreator() && !game.creator) {
        game.dataValues.creator = {
          id: null,
          full_name: 'Ludora',
          email: null
        };
      }

      ludlog.generic('Game found successfully', {
        gameId: id,
        gameType: game.game_type
      });

      return game;
    } catch (error) {
      throw error;
    }
  }

  // Delete game with marketing video cleanup
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting game', { gameId: id });

        const GameModel = this.getModel('game');
        const game = await GameModel.findByPk(id, { transaction });

        if (!game) {
          throw new Error('Game not found');
        }

        // Handle marketing video cleanup
        try {
          const marketingVideoKey = constructS3Path('game', id, 'marketing-video', 'video.mp4');
          await fileService.deleteS3Object(marketingVideoKey);
          ludlog.generic('Marketing video cleaned up', { gameId: id });
        } catch (videoError) {
          ludlog.generic('Marketing video cleanup skipped (might not exist)', {
            gameId: id,
            error: videoError.message
          });
          // Marketing video might not exist, which is okay
        }

        // Delete the game entity
        await game.destroy({ transaction });

        ludlog.generic('Game deleted successfully', { gameId: id });

        return { id, deleted: true };
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create games
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk game creation', {
          count: dataArray.length,
          createdBy
        });

        const GameModel = this.getModel('game');

        const games = dataArray.map(data => ({
          ...data,
          id: data.id || generateId(),
          created_at: new Date(),
          updated_at: new Date(),
          creator_user_id: createdBy
        }));

        const results = await GameModel.bulkCreate(games, { transaction });

        ludlog.generic('Bulk game creation completed', {
          count: results.length
        });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create games: ${error.message}`);
      }
    });
  }

  // Bulk delete games with marketing video cleanup
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk game deletion', { count: ids.length });

        const GameModel = this.getModel('game');

        // Handle marketing video cleanup for each game
        for (const gameId of ids) {
          try {
            const marketingVideoKey = constructS3Path('game', gameId, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            ludlog.generic('Marketing video cleanup failed for game in bulk delete', {
              gameId,
              error: videoError.message
            });
            // Marketing video might not exist, which is okay
            // Continue with other games even if one video cleanup fails
          }
        }

        // Delete the game entities
        const deletedCount = await GameModel.destroy({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        ludlog.generic('Bulk game deletion completed', {
          deletedCount,
          requestedCount: ids.length
        });

        return {
          deletedCount,
          ids: ids.slice(0, deletedCount)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete games: ${error.message}`);
      }
    });
  }

  // Override the find method to include game-specific logic
  async find(query = {}, options = {}) {
    try {
      ludlog.generic('Finding games with query', { query, options });

      // Use parent find method but with game-specific creator handling
      const results = await super.find(query, options);

      ludlog.generic('Games found successfully', {
        count: results.length
      });

      return results;
    } catch (error) {
      throw new Error(`Failed to find games: ${error.message}`);
    }
  }

  // Override shouldIncludeCreator to return true for games
  shouldIncludeCreator() {
    return true; // Games have creator_user_id and should include creator
  }
}

export default new GameProductService();