import { BaseGamePlugin } from './BaseGamePlugin.js';

/**
 * Memory Game Plugin - API Version
 *
 * Handles memory/matching game logic, settings, and validation on the server side.
 * Manages card pairs, timing rules, difficulty progression, and content pairing logic.
 */
export class MemoryGamePlugin extends BaseGamePlugin {
  constructor() {
    super('memory_game');
  }

  getDefaultSettings() {
    return {
      pairs_count: 6,
      flip_time_limit: null,
      match_time_limit: 5,
      allow_mismatched_types: false,
      shuffle_cards: true,
      reveal_duration: 2000,
      difficulty_progression: {
        enabled: false,
        increase_pairs_per_level: 2,
        max_pairs: 12,
        decrease_time_per_level: 0.5
      },
      card_layout: 'grid',
      show_progress: true,
      sound_effects: true,
      animation_speed: 'normal'
    };
  }

  validateSettings(settings) {
    const errors = [];

    if (settings.pairs_count < 3 || settings.pairs_count > 20) {
      errors.push('מספר הזוגות חייב להיות בין 3 ל-20');
    }

    if (settings.flip_time_limit !== null && settings.flip_time_limit < 1) {
      errors.push('זמן הגבלת היפוך חייב להיות לפחות שנייה אחת');
    }

    if (settings.match_time_limit < 1 || settings.match_time_limit > 30) {
      errors.push('זמן התאמה חייב להיות בין 1 ל-30 שניות');
    }

    if (settings.reveal_duration < 500 || settings.reveal_duration > 5000) {
      errors.push('זמן חשיפת כרטיס חייב להיות בין 0.5 ל-5 שניות');
    }

    if (settings.difficulty_progression?.enabled) {
      const prog = settings.difficulty_progression;
      if (prog.max_pairs && prog.max_pairs < settings.pairs_count) {
        errors.push('מקסימום זוגות בהתקדמות חייב להיות גדול ממספר הזוגות ההתחלתי');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getSchemaDefinition() {
    return {
      structuredTables: ['memory_pairing_rules'],
      extractedSettings: ['pairing_rules'],
      jsonbIndexes: [
        'pairs_count',
        'difficulty_progression.enabled',
        'match_time_limit'
      ]
    };
  }

  extractStructuredData(gameData) {
    const pairingRules = gameData.memory_pairing_rules || gameData.game_settings?.pairing_rules || [];

    return {
      memory_pairing_rules: pairingRules
    };
  }

  mergeStructuredData(gameData, structuredData) {
    const enhanced = { ...gameData };

    if (structuredData.memory_pairing_rules) {
      enhanced.memory_pairing_rules = structuredData.memory_pairing_rules;

      enhanced.game_settings = {
        ...enhanced.game_settings,
        pairing_rules: structuredData.memory_pairing_rules
      };
    }

    return enhanced;
  }

  validateStructuredDataConsistency(gameSettings, structuredData) {
    const errors = [];

    const jsonbRules = gameSettings.pairing_rules || [];
    const structuredRules = structuredData.memory_pairing_rules || [];

    if (jsonbRules.length !== structuredRules.length) {
      errors.push(`Pairing rules count mismatch: JSONB has ${jsonbRules.length}, structured has ${structuredRules.length}`);
    }

    const jsonbRuleTypes = jsonbRules.map(r => r.rule_type).sort();
    const structuredRuleTypes = structuredRules.map(r => r.rule_type).sort();

    if (JSON.stringify(jsonbRuleTypes) !== JSON.stringify(structuredRuleTypes)) {
      errors.push('Pairing rule types do not match between JSONB and structured data');
    }

    const manualRules = structuredRules.filter(r => r.rule_type === 'manual_pairs');
    for (const rule of manualRules) {
      if (!rule.manual_pairs || rule.manual_pairs.length === 0) {
        errors.push(`Manual pairing rule ${rule.id} has no pairs defined`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  transformForSave(gameData) {
    const memorySettings = {
      type: 'memory_game',
      version: '2.0',
      pairs_count: gameData.game_settings?.pairs_count || this.getDefaultSettings().pairs_count,
      flip_time_limit: gameData.game_settings?.flip_time_limit || null,
      match_time_limit: gameData.game_settings?.match_time_limit || this.getDefaultSettings().match_time_limit,
      allow_mismatched_types: gameData.game_settings?.allow_mismatched_types !== undefined
        ? gameData.game_settings.allow_mismatched_types
        : this.getDefaultSettings().allow_mismatched_types,
      shuffle_cards: gameData.game_settings?.shuffle_cards !== undefined
        ? gameData.game_settings.shuffle_cards
        : this.getDefaultSettings().shuffle_cards,
      reveal_duration: gameData.game_settings?.reveal_duration || this.getDefaultSettings().reveal_duration,
      difficulty_progression: gameData.game_settings?.difficulty_progression || this.getDefaultSettings().difficulty_progression,
      pairing_rules: gameData.memory_pairing_rules || gameData.game_settings?.pairing_rules || []
    };

    const transformed = { ...gameData };
    transformed.game_settings = memorySettings;
    transformed.memory_pairing_rules = memorySettings.pairing_rules;

    return transformed;
  }

  transformForEdit(gameData) {
    const transformed = { ...gameData };

    transformed.game_settings = {
      ...this.getDefaultSettings(),
      ...gameData.game_settings
    };

    if (gameData.memory_pairing_rules) {
      transformed.memory_pairing_rules = gameData.memory_pairing_rules;
      transformed.game_settings.pairing_rules = gameData.memory_pairing_rules;
    } else if (gameData.game_settings?.pairing_rules) {
      transformed.memory_pairing_rules = gameData.game_settings.pairing_rules;
    }

    return transformed;
  }
}

export default MemoryGamePlugin;