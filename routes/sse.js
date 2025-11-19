// routes/sse.js
// Server-Sent Events (SSE) API routes for real-time communication

import express from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import AuthService from '../services/AuthService.js';
import { getSSEBroadcaster, SSE_CHANNEL_TYPES, SSE_PRIORITY_TYPES } from '../services/SSEBroadcaster.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

// Rate limiting for SSE connections - Development-friendly limits
const sseConnectionLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (shorter window for faster reset)
  max: 100, // 100 connection attempts per minute (generous for development)
  message: { error: 'Too many SSE connection attempts, please try again later' }
});

// Rate limiting for subscription management - Development-friendly limits
const sseSubscriptionLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 subscription changes per minute (generous for development)
  message: { error: 'Too many subscription changes, please slow down' }
});

/**
 * Middleware to validate channel format
 */
function validateChannels(req, res, next) {
  const channels = req.query.channels ? req.query.channels.split(',') : [];

  const validChannels = [];
  const invalidChannels = [];

  channels.forEach(channel => {
    const trimmed = channel.trim();
    if (trimmed && validateChannelFormat(trimmed)) {
      validChannels.push(trimmed);
    } else if (trimmed) {
      invalidChannels.push(trimmed);
    }
  });

  if (invalidChannels.length > 0) {
    return res.status(400).json({
      error: 'Invalid channel format',
      invalid_channels: invalidChannels,
      valid_format: 'channelType:channelId (e.g., game:123, lobby:456, system:maintenance)'
    });
  }

  req.validatedChannels = validChannels;
  next();
}

/**
 * Middleware to handle authentication for SSE using cookies
 * Uses standard access token from httpOnly cookies
 */
async function authenticateSSE(req, res, next) {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required for SSE' });
    }

    // Validate access token using AuthService
    const authService = new AuthService();
    const tokenData = await authService.verifyToken(token);

    req.user = {
      id: tokenData.id,
      role: tokenData.role || 'user'
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token for SSE' });
  }
}

/**
 * Validate channel name format
 */
function validateChannelFormat(channel) {
  const validPattern = /^(game|lobby|session|system|user|global):[a-zA-Z0-9_\-\.]+$/;
  return validPattern.test(channel);
}

/**
 * Middleware to parse subscription request body
 */
function validateSubscriptionBody(req, res, next) {
  const { channels, action } = req.body;

  if (!channels || !Array.isArray(channels)) {
    return res.status(400).json({
      error: 'Missing or invalid channels array'
    });
  }

  if (action && !['subscribe', 'unsubscribe'].includes(action)) {
    return res.status(400).json({
      error: 'Invalid action. Must be "subscribe" or "unsubscribe"'
    });
  }

  const validChannels = [];
  const invalidChannels = [];

  channels.forEach(channel => {
    if (typeof channel === 'string' && validateChannelFormat(channel)) {
      validChannels.push(channel);
    } else {
      invalidChannels.push(channel);
    }
  });

  if (invalidChannels.length > 0) {
    return res.status(400).json({
      error: 'Invalid channel format',
      invalid_channels: invalidChannels
    });
  }

  req.validatedChannels = validChannels;
  req.subscriptionAction = action || 'subscribe';
  next();
}

/**
 * Middleware to parse session context for priority calculation
 */
function parseSessionContext(req, res, next) {
  try {
    // Debug: Log all incoming query parameters and relevant headers
    clog('🔍 SSE Request URL:', req.originalUrl);
    clog('🔍 SSE Query parameters:', req.query);
    clog('🔍 SSE Query parameter details:', {
      channels: req.query.channels,
      game_id: req.query.game_id,
      lobby_id: req.query.lobby_id,
      session_id: req.query.session_id,
      is_lobby_owner: req.query.is_lobby_owner,
      is_active_participant: req.query.is_active_participant,
      priority_hint: req.query.priority_hint
    });
    clog('🔍 SSE Relevant headers:', {
      'x-sse-active-participant': req.headers['x-sse-active-participant'],
      'x-sse-lobby-owner': req.headers['x-sse-lobby-owner'],
      'x-sse-session-id': req.headers['x-sse-session-id'],
      'x-sse-lobby-id': req.headers['x-sse-lobby-id'],
      'x-sse-game-id': req.headers['x-sse-game-id'],
      'x-sse-priority-hint': req.headers['x-sse-priority-hint']
    });

    // Parse session context from query parameters or headers
    const context = {
      isActiveParticipant: req.query.is_active_participant === 'true' || req.headers['x-sse-active-participant'] === 'true',
      isLobbyOwner: req.query.is_lobby_owner === 'true' || req.headers['x-sse-lobby-owner'] === 'true',
      sessionId: req.query.session_id || req.headers['x-sse-session-id'],
      lobbyId: req.query.lobby_id || req.headers['x-sse-lobby-id'],
      gameId: req.query.game_id || req.headers['x-sse-game-id'],
      priorityHint: req.query.priority_hint || req.headers['x-sse-priority-hint']
    };

    // Validate priority hint if provided
    if (context.priorityHint && !Object.values(SSE_PRIORITY_TYPES).includes(context.priorityHint)) {
      return res.status(400).json({
        error: 'Invalid priority hint',
        valid_hints: Object.values(SSE_PRIORITY_TYPES)
      });
    }

    req.sessionContext = context;
    next();

  } catch (error) {
    cerror('❌ Failed to parse session context:', error);
    res.status(400).json({
      error: 'Invalid session context parameters'
    });
  }
}

// =============================================
// SSE CONNECTION ROUTES
// =============================================

/**
 * GET /api/sse/events
 * Main SSE endpoint - establishes EventSource connection
 * Query params:
 *   - channels: Comma-separated list of channels to subscribe to
 *   - heartbeat: Enable/disable heartbeat (default: true)
 *   - is_active_participant: Set to 'true' if user is actively playing a game (highest priority)
 *   - is_lobby_owner: Set to 'true' if user owns/hosts the lobby (high priority)
 *   - session_id: Session ID for session monitoring
 *   - lobby_id: Lobby ID for lobby management
 *   - game_id: Game ID for game-related events
 *   - priority_hint: Explicit priority type hint (active_game_session, lobby_management, session_monitoring, lobby_status, catalog_browsing)
 * Headers (alternative to query params):
 *   - X-SSE-Active-Participant: 'true' if actively playing
 *   - X-SSE-Lobby-Owner: 'true' if lobby owner
 *   - X-SSE-Session-Id: Session identifier
 *   - X-SSE-Lobby-Id: Lobby identifier
 *   - X-SSE-Game-Id: Game identifier
 *   - X-SSE-Priority-Hint: Explicit priority type
 */
router.get('/events',
  sseConnectionLimit,
  optionalAuth,
  validateChannels,
  parseSessionContext,
  async (req, res) => {
    try {
      const user = req.user; // May be null for anonymous users
      const initialChannels = req.validatedChannels;
      const sessionContext = req.sessionContext;

      // For anonymous users, filter to only allow public channels
      let allowedChannels = initialChannels;
      if (!user) {
        allowedChannels = initialChannels.filter(channel => {
          const [channelType] = channel.split(':');
          return ['system', 'global', 'game'].includes(channelType);
        });

        if (allowedChannels.length !== initialChannels.length) {
          return res.status(403).json({
            error: 'Anonymous access limited to public channels only',
            allowed_types: ['system', 'global', 'game'],
            denied_channels: initialChannels.filter(c => !allowedChannels.includes(c))
          });
        }
      }

      // Generate unique connection ID
      const connectionId = user ? `${user.id}_${uuidv4()}` : `guest_${uuidv4()}`;

      if (user) {
        clog(`📡 SSE connection request from authenticated user ${user.id} (role: ${user.role}) for channels:`, allowedChannels);
      } else {
        clog(`📡 SSE connection request from anonymous user for channels:`, allowedChannels);
      }
      clog(`📊 Session context:`, sessionContext);

      // Add connection to broadcaster
      const broadcaster = getSSEBroadcaster();
      const success = broadcaster.addConnection(
        connectionId,
        res,
        user?.id || null,
        user?.role || 'guest',
        allowedChannels,
        sessionContext
      );

      if (!success) {
        return; // Response already sent by broadcaster
      }

      clog(`✅ SSE connection established: ${connectionId}`);

    } catch (error) {
      cerror('❌ Failed to establish SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          message: error.message
        });
      }
    }
  }
);


// =============================================
// SUBSCRIPTION MANAGEMENT ROUTES
// =============================================

/**
 * POST /api/sse/subscribe
 * Add channels to existing SSE connection (supports both authenticated and anonymous users)
 */
router.post('/subscribe',
  sseSubscriptionLimit,
  optionalAuth,
  validateSubscriptionBody,
  async (req, res) => {
    try {
      const user = req.user; // May be null for anonymous users
      const channels = req.validatedChannels;

      // For anonymous users, filter to only allow public channels
      let allowedChannels = channels;
      if (!user) {
        allowedChannels = channels.filter(channel => {
          const [channelType] = channel.split(':');
          return ['system', 'global', 'game'].includes(channelType);
        });

        if (allowedChannels.length !== channels.length) {
          return res.status(403).json({
            error: 'Anonymous users limited to public channels only',
            allowed_types: ['system', 'global', 'game'],
            denied_channels: channels.filter(c => !allowedChannels.includes(c))
          });
        }
      }

      // Find active connection for this user (authenticated) or any guest connection (anonymous)
      const broadcaster = getSSEBroadcaster();
      let userConnection = null;
      let connectionId = null;

      if (user) {
        // Find user's active connection
        broadcaster.connections.forEach((connection, id) => {
          if (connection.userId === user.id && !connection.response.destroyed) {
            userConnection = connection;
            connectionId = id;
          }
        });
      } else {
        // For anonymous users, find the most recent guest connection from this session
        // This is a limitation - we can't perfectly match anonymous users to connections
        // In practice, the frontend should manage this better
        const guestConnections = Array.from(broadcaster.connections.entries()).filter(([id, connection]) =>
          connection.role === 'guest' && !connection.response.destroyed
        );

        if (guestConnections.length > 0) {
          // Use the most recently created guest connection
          const [latestId, latestConnection] = guestConnections[guestConnections.length - 1];
          userConnection = latestConnection;
          connectionId = latestId;
        }
      }

      if (!userConnection) {
        return res.status(404).json({
          error: 'No active SSE connection found. Please establish a connection first via /api/sse/events'
        });
      }

      // Subscribe to new channels
      const results = {
        subscribed: [],
        failed: []
      };

      allowedChannels.forEach(channel => {
        const success = broadcaster.subscribeToChannel(connectionId, channel);
        if (success) {
          results.subscribed.push(channel);
        } else {
          results.failed.push(channel);
        }
      });

      const userIdentifier = user ? user.id : 'anonymous';
      clog(`📺 Subscription update for ${userIdentifier}: +${results.subscribed.length} channels`);

      res.status(200).json({
        message: 'Subscription updated',
        results: results,
        current_channels: Array.from(userConnection.channels)
      });

    } catch (error) {
      cerror('❌ Failed to manage subscription:', error);
      res.status(500).json({
        error: 'Failed to update subscription',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/sse/unsubscribe
 * Remove channels from existing SSE connection (supports both authenticated and anonymous users)
 */
router.post('/unsubscribe',
  sseSubscriptionLimit,
  optionalAuth,
  validateSubscriptionBody,
  async (req, res) => {
    try {
      const user = req.user; // May be null for anonymous users
      const channels = req.validatedChannels;

      // Find active connection for this user (authenticated) or any guest connection (anonymous)
      const broadcaster = getSSEBroadcaster();
      let userConnection = null;
      let connectionId = null;

      if (user) {
        // Find user's active connection
        broadcaster.connections.forEach((connection, id) => {
          if (connection.userId === user.id && !connection.response.destroyed) {
            userConnection = connection;
            connectionId = id;
          }
        });
      } else {
        // For anonymous users, find the most recent guest connection from this session
        const guestConnections = Array.from(broadcaster.connections.entries()).filter(([id, connection]) =>
          connection.role === 'guest' && !connection.response.destroyed
        );

        if (guestConnections.length > 0) {
          // Use the most recently created guest connection
          const [latestId, latestConnection] = guestConnections[guestConnections.length - 1];
          userConnection = latestConnection;
          connectionId = latestId;
        }
      }

      if (!userConnection) {
        return res.status(404).json({
          error: 'No active SSE connection found'
        });
      }

      // Unsubscribe from channels
      const unsubscribed = [];

      channels.forEach(channel => {
        if (userConnection.channels.has(channel)) {
          broadcaster.unsubscribeFromChannel(connectionId, channel);
          unsubscribed.push(channel);
        }
      });

      const userIdentifier = user ? user.id : 'anonymous';
      clog(`📺 Unsubscription for ${userIdentifier}: -${unsubscribed.length} channels`);

      res.status(200).json({
        message: 'Unsubscribed successfully',
        unsubscribed: unsubscribed,
        current_channels: Array.from(userConnection.channels)
      });

    } catch (error) {
      cerror('❌ Failed to unsubscribe:', error);
      res.status(500).json({
        error: 'Failed to unsubscribe',
        message: error.message
      });
    }
  }
);

// =============================================
// ADMIN/UTILITY ROUTES
// =============================================

/**
 * GET /api/sse/stats
 * Get SSE connection and channel statistics (admin only)
 */
router.get('/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const user = req.user;

      // Only allow admins to view stats
      if (user.role !== 'admin' && user.role !== 'sysadmin') {
        return res.status(403).json({
          error: 'Access denied: Admin privileges required'
        });
      }

      const broadcaster = getSSEBroadcaster();
      const stats = broadcaster.getStats();

      res.status(200).json({
        ...stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      cerror('❌ Failed to get SSE stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve SSE statistics',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/sse/broadcast
 * Broadcast a test message (admin only)
 */
router.post('/broadcast',
  authenticateToken,
  async (req, res) => {
    try {
      const user = req.user;
      const { eventType, data, channels } = req.body;

      // Only allow admins to broadcast
      if (user.role !== 'admin' && user.role !== 'sysadmin') {
        return res.status(403).json({
          error: 'Access denied: Admin privileges required'
        });
      }

      if (!eventType) {
        return res.status(400).json({
          error: 'Missing eventType in request body'
        });
      }

      const broadcaster = getSSEBroadcaster();
      let sentCount = 0;

      if (channels && Array.isArray(channels) && channels.length > 0) {
        // Broadcast to specific channels
        sentCount = broadcaster.broadcastToChannels(
          `admin:${eventType}`,
          { ...data, sentBy: user.id },
          channels
        );
      } else {
        // Broadcast to all connections
        sentCount = broadcaster.broadcastToAll(
          `admin:${eventType}`,
          { ...data, sentBy: user.id }
        );
      }

      res.status(200).json({
        message: 'Broadcast sent',
        eventType: `admin:${eventType}`,
        sentToConnections: sentCount,
        targetChannels: channels || 'all'
      });

    } catch (error) {
      cerror('❌ Failed to broadcast message:', error);
      res.status(500).json({
        error: 'Failed to broadcast message',
        message: error.message
      });
    }
  }
);

export default router;