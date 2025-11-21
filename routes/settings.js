import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import EntityService from '../services/EntityService.js';
import SettingsService from '../services/SettingsService.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';
import { GAME_TYPES } from '../config/gameTypes.js';
import { LANGUAGES_OPTIONS } from '../constants/langauages.js';

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
    // TODO remove debug - setup Socket.IO portal-aware authentication
    console.log('📡 [SettingsPublic] Request for public settings');

    // Get only the students_access setting - no authentication required
    const studentsAccessMode = await SettingsService.getStudentsAccessMode();

    res.json({
      students_access: studentsAccessMode
    });

  } catch (error) {
    console.error('📡 [SettingsPublic] Error fetching public settings:', error);
    res.status(500).json({
      error: 'Failed to fetch public settings',
      students_access: 'all' // Safe fallback for privacy compliance
    });
  }
});

export default router;