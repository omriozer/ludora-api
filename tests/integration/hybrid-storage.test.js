const { Game, MemoryPairingRule, ManualMemoryPair } = require('../../models');
const { MemoryGamePlugin } = require('../../plugins/MemoryGamePlugin');
const GameDataSyncService = require('../../services/GameDataSyncService');
const gamePluginRegistry = require('../../plugins/GamePluginRegistry');

describe('Hybrid Storage Integration', () => {
  let memoryPlugin;
  let testGame;

  beforeEach(async () => {
    memoryPlugin = new MemoryGamePlugin();

    // Create a test game with memory pairing rules
    const gameData = {
      id: 'test-memory-game-001',
      title: 'Test Memory Game',
      game_type: 'memory_game',
      game_settings: {
        type: 'memory_game',
        version: '2.0',
        pairs_count: 8,
        match_time_limit: 10,
        pairing_rules: [
          {
            id: 'rule_001',
            rule_type: 'manual_pairs',
            priority: 1,
            is_active: true,
            manual_pairs: [
              {
                id: 'pair_001',
                content_a_id: 'word_001',
                content_a_type: 'Word',
                content_b_id: 'image_001',
                content_b_type: 'Image'
              },
              {
                id: 'pair_002',
                content_a_id: 'word_002',
                content_a_type: 'Word',
                content_b_id: 'image_002',
                content_b_type: 'Image'
              }
            ]
          },
          {
            id: 'rule_002',
            rule_type: 'content_type_match',
            content_type_a: 'Word',
            content_type_b: 'WordEN',
            priority: 0,
            is_active: true
          }
        ]
      },
      memory_pairing_rules: [
        {
          id: 'rule_001',
          rule_type: 'manual_pairs',
          priority: 1,
          is_active: true,
          manual_pairs: [
            {
              id: 'pair_001',
              content_a_id: 'word_001',
              content_a_type: 'Word',
              content_b_id: 'image_001',
              content_b_type: 'Image'
            },
            {
              id: 'pair_002',
              content_a_id: 'word_002',
              content_a_type: 'Word',
              content_b_id: 'image_002',
              content_b_type: 'Image'
            }
          ]
        },
        {
          id: 'rule_002',
          rule_type: 'content_type_match',
          content_type_a: 'Word',
          content_type_b: 'WordEN',
          priority: 0,
          is_active: true
        }
      ]
    };

    testGame = await Game.create(gameData);
  });

  afterEach(async () => {
    // Clean up test data
    await MemoryPairingRule.destroy({ where: { game_id: testGame.id } });
    await Game.destroy({ where: { id: testGame.id } });
  });

  describe('Plugin Schema Definition', () => {
    test('should define structured tables and settings', () => {
      const schema = memoryPlugin.getSchemaDefinition();

      expect(schema.structuredTables).toContain('memory_pairing_rules');
      expect(schema.extractedSettings).toContain('pairing_rules');
      expect(schema.jsonbIndexes).toContain('pairs_count');
    });

    test('should extract structured data correctly', () => {
      const structuredData = memoryPlugin.extractStructuredData(testGame.toJSON());

      expect(structuredData.memory_pairing_rules).toHaveLength(2);
      expect(structuredData.memory_pairing_rules[0].rule_type).toBe('manual_pairs');
      expect(structuredData.memory_pairing_rules[1].rule_type).toBe('content_type_match');
    });
  });

  describe('Structured Data Synchronization', () => {
    test('should sync pairing rules to structured tables', async () => {
      // Sync data to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Verify structured data was created
      const rules = await MemoryPairingRule.findByGameId(testGame.id);
      expect(rules).toHaveLength(2);

      const manualRule = rules.find(r => r.rule_type === 'manual_pairs');
      expect(manualRule).toBeTruthy();
      expect(manualRule.manual_pairs).toHaveLength(2);

      const contentTypeRule = rules.find(r => r.rule_type === 'content_type_match');
      expect(contentTypeRule).toBeTruthy();
      expect(contentTypeRule.content_type_a).toBe('Word');
      expect(contentTypeRule.content_type_b).toBe('WordEN');
    });

    test('should load structured data back into game settings', async () => {
      // First sync to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Then load it back
      const enhancedGameData = await GameDataSyncService.loadStructuredData(
        testGame.toJSON(),
        memoryPlugin
      );

      expect(enhancedGameData.memory_pairing_rules).toHaveLength(2);
      expect(enhancedGameData.game_settings.pairing_rules).toHaveLength(2);
    });
  });

  describe('Data Consistency Validation', () => {
    test('should validate consistency between JSONB and structured data', async () => {
      // Sync to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Validate consistency
      const validation = await testGame.validateDataConsistency(memoryPlugin);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect inconsistencies', async () => {
      // Sync to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Manually modify JSONB to create inconsistency
      await testGame.update({
        game_settings: {
          ...testGame.game_settings,
          pairing_rules: [] // Clear rules in JSONB but keep in structured tables
        }
      });

      // Validate consistency
      const validation = await testGame.validateDataConsistency(memoryPlugin);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin Registry Integration', () => {
    test('should transform for save with structured data extraction', () => {
      const transformed = gamePluginRegistry.transformForSave(
        'memory_game',
        testGame.toJSON()
      );

      expect(transformed._structuredData).toBeDefined();
      expect(transformed._structuredData.memory_pairing_rules).toHaveLength(2);
      expect(transformed.game_settings.pairing_rules).toHaveLength(2);
    });

    test('should transform for edit with structured data merging', async () => {
      // First sync to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Load structured data
      const structuredData = await GameDataSyncService.loadStructuredData(
        testGame.toJSON(),
        memoryPlugin
      );

      // Transform for edit
      const transformed = gamePluginRegistry.transformForEdit(
        'memory_game',
        testGame.toJSON(),
        { memory_pairing_rules: structuredData.memory_pairing_rules }
      );

      expect(transformed.memory_pairing_rules).toHaveLength(2);
      expect(transformed.game_settings.pairing_rules).toHaveLength(2);
    });
  });

  describe('Game Model Integration', () => {
    test('should create game with hybrid storage', async () => {
      const gameData = {
        id: 'test-hybrid-game-001',
        title: 'Hybrid Storage Test',
        game_type: 'memory_game',
        game_settings: {
          type: 'memory_game',
          pairs_count: 6,
          pairing_rules: [
            {
              id: 'rule_hybrid_001',
              rule_type: 'attribute_match',
              attribute_name: 'difficulty',
              priority: 0,
              is_active: true
            }
          ]
        },
        _structuredData: {
          memory_pairing_rules: [
            {
              id: 'rule_hybrid_001',
              rule_type: 'attribute_match',
              attribute_name: 'difficulty',
              priority: 0,
              is_active: true
            }
          ]
        }
      };

      const game = await Game.createWithHybridStorage(gameData, memoryPlugin);

      expect(game).toBeTruthy();
      expect(game.id).toBe('test-hybrid-game-001');

      // Verify structured data was created
      const rules = await MemoryPairingRule.findByGameId(game.id);
      expect(rules).toHaveLength(1);
      expect(rules[0].rule_type).toBe('attribute_match');

      // Clean up
      await Game.destroy({ where: { id: game.id } });
    });

    test('should find game with structured data loaded', async () => {
      // First sync to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Find with structured data
      const gameWithStructuredData = await Game.findWithStructuredData(
        testGame.id,
        'memory_game'
      );

      expect(gameWithStructuredData.memory_pairing_rules).toHaveLength(2);
      expect(gameWithStructuredData.game_settings.pairing_rules).toHaveLength(2);
    });
  });

  describe('Performance and Analytics', () => {
    test('should provide analytics data from structured tables', async () => {
      // Sync multiple games to structured tables
      await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        memoryPlugin
      );

      // Get analytics
      const analytics = await GameDataSyncService.getAnalytics({
        gameType: 'memory_game'
      });

      expect(analytics.memory_games).toBeDefined();
      expect(analytics.memory_games.pairing_rule_distribution).toBeDefined();
      expect(analytics.memory_games.total_rules).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing plugin gracefully', async () => {
      const result = await GameDataSyncService.syncToStructuredTables(
        testGame.id,
        testGame.toJSON(),
        null
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('No plugin schema definition');
    });

    test('should handle invalid structured data', async () => {
      const invalidData = {
        ...testGame.toJSON(),
        memory_pairing_rules: [
          {
            // Missing required fields
            rule_type: 'manual_pairs'
          }
        ]
      };

      try {
        await GameDataSyncService.syncToStructuredTables(
          testGame.id,
          invalidData,
          memoryPlugin
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });
});