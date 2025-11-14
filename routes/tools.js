import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import {
  getAllToolTypes,
  getToolType,
  isValidToolType,
  getToolsByCategory,
  getAllCategories,
  TOOL_TYPES,
  TOOL_CATEGORIES
} from '../config/toolTypes.js';

const router = express.Router();

/**
 * GET /tools/types
 * Get all available tool types
 */
router.get('/types', optionalAuth, (req, res) => {
  try {
    const toolTypes = getAllToolTypes();
    res.json({
      success: true,
      data: toolTypes,
      count: toolTypes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tool types'
    });
  }
});

/**
 * GET /tools/types/:key
 * Get specific tool type by key
 */
router.get('/types/:key', optionalAuth, (req, res) => {
  try {
    const { key } = req.params;
    const toolType = getToolType(key);

    if (!toolType) {
      return res.status(404).json({
        success: false,
        error: 'Tool type not found'
      });
    }

    res.json({
      success: true,
      data: toolType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tool type'
    });
  }
});

/**
 * GET /tools/categories
 * Get all available tool categories
 */
router.get('/categories', optionalAuth, (req, res) => {
  try {
    const categories = getAllCategories();
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tool categories'
    });
  }
});

/**
 * GET /tools/categories/:category
 * Get tools by category
 */
router.get('/categories/:category', optionalAuth, (req, res) => {
  try {
    const { category } = req.params;

    if (!TOOL_CATEGORIES[category]) {
      return res.status(404).json({
        success: false,
        error: 'Tool category not found'
      });
    }

    const tools = getToolsByCategory(category);
    const categoryInfo = TOOL_CATEGORIES[category];

    res.json({
      success: true,
      data: {
        category: categoryInfo,
        tools: tools,
        count: tools.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tools by category'
    });
  }
});

/**
 * POST /tools/validate
 * Validate if a tool type is valid and enabled
 */
router.post('/validate', optionalAuth, (req, res) => {
  try {
    const { toolKey } = req.body;

    if (!toolKey) {
      return res.status(400).json({
        success: false,
        error: 'Tool key is required'
      });
    }

    const isValid = isValidToolType(toolKey);
    const toolType = getToolType(toolKey);

    res.json({
      success: true,
      data: {
        isValid,
        toolKey,
        toolType: isValid ? toolType : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate tool type'
    });
  }
});

export default router;