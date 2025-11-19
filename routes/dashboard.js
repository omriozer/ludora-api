import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/auth.js';
import models from '../models/index.js';
import { rateLimiters } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Apply rate limiting
router.use(rateLimiters.general);

/**
 * GET /api/dashboard/widgets
 * Get available dashboard widgets from global settings
 */
router.get('/widgets', async (req, res) => {
  try {
    // Get available widgets from settings (find the record that has widgets configured)
    const settings = await models.Settings.findOne({
      where: {
        available_dashboard_widgets: {
          [Op.ne]: null
        }
      }
    });

    if (!settings || !settings.available_dashboard_widgets) {
      return res.json({
        success: true,
        data: {},
        message: 'No widgets configured'
      });
    }

    res.json({
      success: true,
      data: settings.available_dashboard_widgets,
      message: 'Available widgets retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available widgets',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/dashboard/config
 * Get user's dashboard configuration
 */
router.get('/config', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's dashboard settings
    const user = await models.User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return dashboard settings or default empty config
    const dashboardConfig = user.dashboard_settings || {
      widgets: []
    };

    res.json({
      success: true,
      data: dashboardConfig,
      message: 'Dashboard configuration retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/dashboard/config
 * Update user's dashboard configuration
 */
router.put('/config', async (req, res) => {
  try {
    const userId = req.user.id;
    const { widgets } = req.body;

    // Validate input
    if (!Array.isArray(widgets)) {
      return res.status(400).json({
        success: false,
        message: 'Widgets must be an array'
      });
    }

    // Validate widget structure
    for (const widget of widgets) {
      if (!widget.id || !widget.type || typeof widget.order !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Each widget must have id, type, and order properties'
        });
      }
    }

    // Get user
    const user = await models.User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare dashboard settings
    const dashboardSettings = {
      widgets: widgets,
      updatedAt: new Date().toISOString()
    };

    // Update user's dashboard settings
    await user.update({
      dashboard_settings: dashboardSettings,
      updated_at: new Date()
    });

    res.json({
      success: true,
      data: dashboardSettings,
      message: 'Dashboard configuration updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update dashboard configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/dashboard/widgets
 * Add a widget to user's dashboard
 */
router.post('/widgets', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, settings = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Widget type is required'
      });
    }

    // Get available widgets to validate type (find the record that has widgets configured)
    const globalSettings = await models.Settings.findOne({
      where: {
        available_dashboard_widgets: {
          [Op.ne]: null
        }
      }
    });
    const availableWidgets = globalSettings?.available_dashboard_widgets || {};

    if (!availableWidgets[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid widget type'
      });
    }

    // Get user
    const user = await models.User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get current dashboard settings
    const currentSettings = user.dashboard_settings || { widgets: [] };

    // Generate new widget instance
    const newWidget = {
      id: `${type}-${Date.now()}`,
      type: type,
      order: currentSettings.widgets.length,
      settings: settings
    };

    // Add widget to dashboard
    const updatedSettings = {
      ...currentSettings,
      widgets: [...currentSettings.widgets, newWidget],
      updatedAt: new Date().toISOString()
    };

    // Update user's dashboard settings
    await user.update({
      dashboard_settings: updatedSettings,
      updated_at: new Date()
    });

    res.json({
      success: true,
      data: newWidget,
      message: 'Widget added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add widget',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/dashboard/widgets/:widgetId
 * Remove a widget from user's dashboard
 */
router.delete('/widgets/:widgetId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { widgetId } = req.params;

    if (!widgetId) {
      return res.status(400).json({
        success: false,
        message: 'Widget ID is required'
      });
    }

    // Get user
    const user = await models.User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get current dashboard settings
    const currentSettings = user.dashboard_settings || { widgets: [] };

    // Find widget index
    const widgetIndex = currentSettings.widgets.findIndex(w => w.id === widgetId);

    if (widgetIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found'
      });
    }

    // Remove widget and reorder
    const updatedWidgets = currentSettings.widgets
      .filter(w => w.id !== widgetId)
      .map((widget, index) => ({ ...widget, order: index }));

    const updatedSettings = {
      ...currentSettings,
      widgets: updatedWidgets,
      updatedAt: new Date().toISOString()
    };

    // Update user's dashboard settings
    await user.update({
      dashboard_settings: updatedSettings,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Widget removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove widget',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/dashboard/widgets/:widgetId
 * Update a specific widget's settings
 */
router.put('/widgets/:widgetId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { widgetId } = req.params;
    const { settings, order } = req.body;

    if (!widgetId) {
      return res.status(400).json({
        success: false,
        message: 'Widget ID is required'
      });
    }

    // Get user
    const user = await models.User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get current dashboard settings
    const currentSettings = user.dashboard_settings || { widgets: [] };

    // Find widget
    const widgetIndex = currentSettings.widgets.findIndex(w => w.id === widgetId);

    if (widgetIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found'
      });
    }

    // Update widget
    const updatedWidgets = [...currentSettings.widgets];
    if (settings !== undefined) {
      updatedWidgets[widgetIndex].settings = { ...updatedWidgets[widgetIndex].settings, ...settings };
    }
    if (order !== undefined) {
      updatedWidgets[widgetIndex].order = order;
      // Reorder all widgets
      updatedWidgets.sort((a, b) => a.order - b.order);
      updatedWidgets.forEach((widget, index) => widget.order = index);
    }

    const updatedSettings = {
      ...currentSettings,
      widgets: updatedWidgets,
      updatedAt: new Date().toISOString()
    };

    // Update user's dashboard settings
    await user.update({
      dashboard_settings: updatedSettings,
      updated_at: new Date()
    });

    res.json({
      success: true,
      data: updatedWidgets[widgetIndex],
      message: 'Widget updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update widget',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;