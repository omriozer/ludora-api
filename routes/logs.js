import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { admin } from '../config/firebase.js';
import LogService from '../services/LogService.js';

const router = express.Router();

// Create log entry endpoint
router.post('/', async (req, res) => {
  try {
    const { source_type, log_type = 'log', message } = req.body;

    // Validate required fields
    if (!source_type || !message) {
      return res.status(400).json({
        error: 'source_type and message are required'
      });
    }

    // Validate source_type
    if (!['app', 'api'].includes(source_type)) {
      return res.status(400).json({
        error: 'source_type must be "app" or "api"'
      });
    }

    // Validate log_type
    if (!['log', 'error', 'debug', 'warn', 'info'].includes(log_type)) {
      return res.status(400).json({
        error: 'log_type must be one of: log, error, debug, warn, info'
      });
    }

    // Get user_id from token if available (optional)
    let user_id = null;
    if (req.headers.authorization) {
      try {
        // Try to get user from token but don't fail if it's invalid
        const token = req.headers.authorization.replace('Bearer ', '');
        const decodedToken = await admin.auth().verifyIdToken(token);
        user_id = decodedToken.uid;
      } catch (error) {
        // Ignore auth errors for logging - logs should work even without auth
      }
    }

    // Create log entry
    const logEntry = await LogService.createLog({
      source_type,
      log_type,
      message,
      user_id
    });

    res.status(201).json({
      success: true,
      id: logEntry.id
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create log entry'
    });
  }
});

// Get logs endpoint (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you may need to implement this check)
    // For now, allowing any authenticated user to read logs

    const {
      source_type,
      log_type,
      user_id,
      limit = 100,
      offset = 0,
      start_date,
      end_date
    } = req.query;

    const filters = {};
    if (source_type) filters.source_type = source_type;
    if (log_type) filters.log_type = log_type;
    if (user_id) filters.user_id = user_id;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const logs = await LogService.getLogs({
      filters,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch logs'
    });
  }
});

export default router;