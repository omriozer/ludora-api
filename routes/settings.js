import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import EntityService from '../services/EntityService.js';
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

export default router;