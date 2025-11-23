import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import EntityService from '../services/EntityService.js';
import SettingsService from '../services/SettingsService.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';
import { GAME_TYPES } from '../config/gameTypes.js';
import { LANGUAGES_OPTIONS } from '../constants/langauages.js';
import { ACCESS_CONTROL_KEYS, ALL_SETTINGS_KEYS_ARRAY } from '../constants/settingsKeys.js';

const router = express.Router();

// GET /settings - Get system settings (forwards to entities/settings with enhancements)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit, offset, ...query } = req.query;
    const options = {};

    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    // Get settings from EntityService
    const results = await EntityService.find('settings', query, options);

    // Validate that all required settings keys exist (system integrity check)
    const existingKeys = results.map(setting => setting.key || setting.get?.('key')).filter(Boolean);
    const missingKeys = ALL_SETTINGS_KEYS_ARRAY.filter(requiredKey => !existingKeys.includes(requiredKey));

    if (missingKeys.length > 0) {
      // Log missing keys for system tracking (not displayed to user)
      console.error('[SETTINGS_VALIDATION] Missing settings keys detected:', {
        missing: missingKeys,
        timestamp: new Date().toISOString(),
        endpoint: '/api/settings',
        totalExpected: ALL_SETTINGS_KEYS_ARRAY.length,
        totalFound: existingKeys.length
      });

      // Add system validation header for debugging (not visible to frontend)
      res.set('X-Settings-Validation-Warning', `${missingKeys.length} missing keys`);
    }

    // Add enhanced configuration like the entities route does
    const enhancedResults = results.map(setting => {
      const settingData = setting.toJSON ? setting.toJSON() : setting;

      return {
        ...settingData,
        file_types_config: getFileTypesForFrontend(),
        study_subjects: STUDY_SUBJECTS,
        audiance_targets: AUDIANCE_TARGETS,
        school_grades: SCHOOL_GRADES,
        game_types: GAME_TYPES,
        languade_options: LANGUAGES_OPTIONS
      };
    });

    res.json(enhancedResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /settings/public - Public endpoint for Socket.IO client to get students_access setting
router.get('/public', async (req, res) => {
  try {
    // Get only the students_access setting - no authentication required
    const studentsAccessMode = await SettingsService.getStudentsAccessMode();

    res.json({
      [ACCESS_CONTROL_KEYS.STUDENTS_ACCESS]: studentsAccessMode
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch public settings',
      [ACCESS_CONTROL_KEYS.STUDENTS_ACCESS]: 'all' // Safe fallback for privacy compliance
    });
  }
});

export default router;