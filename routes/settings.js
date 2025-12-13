import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { addETagSupport } from '../middleware/etagMiddleware.js';
import SettingsService from '../services/SettingsService.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';
import { GAME_TYPES } from '../config/gameTypes.js';
import { LANGUAGES_OPTIONS } from '../constants/langauages.js';
import { ACCESS_CONTROL_KEYS, ALL_SETTINGS_KEYS_ARRAY } from '../constants/settingsKeys.js';
import { SYSADMIN_FORBIDDEN_ACTIONS } from '../constants/adminAccess.js';

const router = express.Router();

// GET /settings - Get system settings (forwards to entities/settings with enhancements)
router.get('/', optionalAuth, addETagSupport('settings'), async (req, res) => {
  try {
    // Get settings from SettingsService (returns built settings object with all keys)
    const settingsObject = await SettingsService.getSettings();

    // Validate that all required settings keys exist (system integrity check)
    const existingKeys = Object.keys(settingsObject);
    const missingKeys = ALL_SETTINGS_KEYS_ARRAY.filter(requiredKey => !existingKeys.includes(requiredKey));

    if (missingKeys.length > 0) {
      // Add system validation header for debugging (not visible to frontend)
      res.set('X-Settings-Validation-Warning', `${missingKeys.length} missing keys`);
    }

    // Add enhanced configuration - merge into single settings object
    const enhancedSettings = {
      ...settingsObject,
      file_types_config: getFileTypesForFrontend(),
      study_subjects: STUDY_SUBJECTS,
      audiance_targets: AUDIANCE_TARGETS,
      school_grades: SCHOOL_GRADES,
      game_types: GAME_TYPES,
      languade_options: LANGUAGES_OPTIONS,
      sysadmin_forbidden_actions: SYSADMIN_FORBIDDEN_ACTIONS
    };

    res.json(enhancedSettings);
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