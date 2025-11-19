// services/SSEBroadcaster.js
// Server-Sent Events (SSE) Broadcasting Service for Real-time Updates

import { EventEmitter } from 'events';
import { clog, cerror } from '../lib/utils.js';

/**
 * SSE Event Types - Comprehensive event system for real-time updates
 */
export const SSE_EVENT_TYPES = {
  // Lobby Events (Teacher Portal)
  LOBBY_CREATED: 'lobby:created',
  LOBBY_ACTIVATED: 'lobby:activated',
  LOBBY_CLOSED: 'lobby:closed',
  LOBBY_EXPIRED: 'lobby:expired',
  LOBBY_SESSION_ADDED: 'lobby:session:added',
  LOBBY_SESSION_REMOVED: 'lobby:session:removed',
  LOBBY_PARTICIPANT_COUNT_CHANGED: 'lobby:participant:count_changed',

  // Session Events (Both Portals)
  SESSION_CREATED: 'session:created',
  SESSION_STARTED: 'session:started',
  SESSION_FINISHED: 'session:finished',
  SESSION_PARTICIPANT_JOINED: 'session:participant:joined',
  SESSION_PARTICIPANT_LEFT: 'session:participant:left',
  SESSION_STATE_UPDATED: 'session:state:updated',

  // Game Play Events (Student Portal)
  GAME_STATE_CHANGED: 'game:state:changed',
  PLAYER_ACTION: 'game:player:action',
  GAME_FINISHED: 'game:finished',

  // System Events (Both Portals)
  MAINTENANCE_MODE_CHANGED: 'system:maintenance:changed',
  SERVER_RESTART_NOTICE: 'system:server:restart_notice',

  // Meta Events
  HEARTBEAT: 'meta:heartbeat',
  CONNECTION_COUNT: 'meta:connection_count'
};

/**
 * Channel Types for Subscription Management
 */
export const SSE_CHANNEL_TYPES = {
  // Game-specific channels
  GAME: 'game',          // game:123 - all events for a specific game
  LOBBY: 'lobby',        // lobby:456 - all events for a specific lobby
  SESSION: 'session',    // session:789 - all events for a specific session

  // System channels
  SYSTEM: 'system',      // system:* - system-wide events
  USER: 'user',          // user:123 - user-specific events

  // Global channels
  GLOBAL: 'global'       // global:* - broadcast to all users
};

/**
 * Connection Priority Levels (1 = highest priority, 5 = lowest priority)
 */
export const SSE_PRIORITY_LEVELS = {
  ACTIVE_GAME_SESSION: 1,    // Active game session participants (highest priority)
  LOBBY_MANAGEMENT: 2,       // Lobby owners/hosts managing lobbies
  SESSION_MONITORING: 3,     // Session participants waiting/watching
  LOBBY_STATUS: 4,           // Teachers monitoring lobby status
  CATALOG_BROWSING: 5        // Students/teachers browsing catalogs (lowest priority)
};

/**
 * Priority Type Categories
 */
export const SSE_PRIORITY_TYPES = {
  ACTIVE_GAME_SESSION: 'active_game_session',
  LOBBY_MANAGEMENT: 'lobby_management',
  SESSION_MONITORING: 'session_monitoring',
  LOBBY_STATUS: 'lobby_status',
  CATALOG_BROWSING: 'catalog_browsing'
};

/**
 * Connection Management and Event Broadcasting Service
 */
class SSEBroadcaster {
  constructor() {
    this.connections = new Map(); // connectionId -> connection info
    this.channels = new Map();    // channelName -> Set of connectionIds
    this.eventEmitter = new EventEmitter();
    this.heartbeatInterval = null;
    this.cleanupInterval = null;
    this.connectionCount = 0;

    // Configuration
    this.config = {
      heartbeatIntervalMs: 30000,    // 30 seconds
      cleanupIntervalMs: 60000,      // 1 minute
      maxConnections: 1000,          // Per process (absolute maximum)
      maxChannelsPerConnection: 50,  // Prevent subscription abuse
      connectionTimeoutMs: 300000,   // 5 minutes
      retryTimeoutMs: 1000,          // 1 second

      // Priority-based connection limits (soft limits within maxConnections)
      priorityLimits: {
        [SSE_PRIORITY_TYPES.ACTIVE_GAME_SESSION]: 300,  // 30% reserved for active games
        [SSE_PRIORITY_TYPES.LOBBY_MANAGEMENT]: 200,     // 20% for lobby management
        [SSE_PRIORITY_TYPES.SESSION_MONITORING]: 200,   // 20% for session monitoring
        [SSE_PRIORITY_TYPES.LOBBY_STATUS]: 200,         // 20% for lobby status
        [SSE_PRIORITY_TYPES.CATALOG_BROWSING]: 100     // 10% for catalog browsing
      },

      // Eviction policy: how many connections to evict when at capacity
      evictionBatchSize: 10,

      // Grace period before evicting connections (ms)
      evictionGracePeriod: 5000
    };

    this.startHeartbeat();
    this.startCleanup();

    clog('📡 SSEBroadcaster initialized');
  }

  /**
   * Calculate connection priority based on channels and user role
   */
  calculateConnectionPriority(channels, userRole, sessionContext = {}) {
    let priority = SSE_PRIORITY_LEVELS.CATALOG_BROWSING; // Default to lowest priority
    let priorityType = SSE_PRIORITY_TYPES.CATALOG_BROWSING;

    // Check channels for priority indicators
    for (const channel of channels) {
      const [channelType, channelId] = channel.split(':');

      switch (channelType) {
        case SSE_CHANNEL_TYPES.SESSION:
          // Active game session participation (highest priority)
          if (sessionContext.isActiveParticipant) {
            priority = SSE_PRIORITY_LEVELS.ACTIVE_GAME_SESSION;
            priorityType = SSE_PRIORITY_TYPES.ACTIVE_GAME_SESSION;
            return { priority, priorityType }; // Return immediately for highest priority
          }
          // Session monitoring (waiting/watching)
          if (priority > SSE_PRIORITY_LEVELS.SESSION_MONITORING) {
            priority = SSE_PRIORITY_LEVELS.SESSION_MONITORING;
            priorityType = SSE_PRIORITY_TYPES.SESSION_MONITORING;
          }
          break;

        case SSE_CHANNEL_TYPES.LOBBY:
          // Lobby management (owners/hosts)
          if (sessionContext.isLobbyOwner || userRole === 'admin' || userRole === 'sysadmin') {
            if (priority > SSE_PRIORITY_LEVELS.LOBBY_MANAGEMENT) {
              priority = SSE_PRIORITY_LEVELS.LOBBY_MANAGEMENT;
              priorityType = SSE_PRIORITY_TYPES.LOBBY_MANAGEMENT;
            }
          } else {
            // Lobby status monitoring
            if (priority > SSE_PRIORITY_LEVELS.LOBBY_STATUS) {
              priority = SSE_PRIORITY_LEVELS.LOBBY_STATUS;
              priorityType = SSE_PRIORITY_TYPES.LOBBY_STATUS;
            }
          }
          break;

        case SSE_CHANNEL_TYPES.GAME:
          // Game catalog browsing or lobby status monitoring
          if (priority > SSE_PRIORITY_LEVELS.LOBBY_STATUS) {
            priority = SSE_PRIORITY_LEVELS.LOBBY_STATUS;
            priorityType = SSE_PRIORITY_TYPES.LOBBY_STATUS;
          }
          break;

        case SSE_CHANNEL_TYPES.SYSTEM:
        case SSE_CHANNEL_TYPES.GLOBAL:
        case SSE_CHANNEL_TYPES.USER:
          // System channels maintain current priority (don't downgrade)
          break;

        default:
          // Unknown channel type maintains catalog browsing priority
          break;
      }
    }

    return { priority, priorityType };
  }

  /**
   * Find candidates for eviction (lowest priority connections)
   */
  findEvictionCandidates(requestedPriority, requestedPriorityType, count = 1) {
    const candidates = [];

    // Sort connections by priority (highest priority number = lowest priority)
    const sortedConnections = Array.from(this.connections.entries())
      .sort((a, b) => {
        const [, connA] = a;
        const [, connB] = b;

        // First sort by priority level (higher number = lower priority)
        if (connA.priority !== connB.priority) {
          return connB.priority - connA.priority;
        }

        // Then by connection time (older connections evicted first)
        return connA.connectedAt - connB.connectedAt;
      });

    // Find connections with lower priority than requested
    for (const [connectionId, connection] of sortedConnections) {
      if (connection.priority > requestedPriority) {
        candidates.push({ connectionId, connection });
        if (candidates.length >= count) break;
      }
    }

    return candidates;
  }

  /**
   * Evict connections gracefully
   */
  evictConnections(candidates, reason = 'capacity_limit') {
    const evicted = [];

    candidates.forEach(({ connectionId, connection }) => {
      try {
        // Send eviction notice
        this.sendToConnection(connectionId, {
          eventType: 'connection:evicted',
          data: {
            reason: reason,
            priority: connection.priority,
            priorityType: connection.priorityType,
            message: 'Your connection has been replaced by a higher priority connection',
            reconnectSuggestion: 'Please reconnect in a few moments',
            gracePeriod: this.config.evictionGracePeriod
          }
        });

        // Schedule removal after grace period
        setTimeout(() => {
          this.removeConnection(connectionId);
        }, this.config.evictionGracePeriod);

        evicted.push({
          connectionId,
          userId: connection.userId,
          priority: connection.priority,
          priorityType: connection.priorityType
        });

        clog(`⚠️  Evicting connection ${connectionId} (priority: ${connection.priority}, type: ${connection.priorityType})`);

      } catch (error) {
        cerror(`❌ Failed to evict connection ${connectionId}:`, error);
        // Force remove if graceful eviction fails
        this.removeConnection(connectionId);
      }
    });

    return evicted;
  }

  /**
   * Add a new SSE connection with priority-based management
   */
  addConnection(connectionId, response, userId, userRole, initialChannels = [], sessionContext = {}) {
    try {
      // Calculate connection priority
      const { priority, priorityType } = this.calculateConnectionPriority(initialChannels, userRole, sessionContext);

      // Check if we need to evict lower priority connections
      if (this.connectionCount >= this.config.maxConnections) {
        // Find candidates for eviction
        const evictionCandidates = this.findEvictionCandidates(priority, priorityType, this.config.evictionBatchSize);

        if (evictionCandidates.length === 0) {
          // No lower priority connections to evict
          cerror(`❌ SSE connection rejected: No lower priority connections to evict (priority: ${priority}, type: ${priorityType})`);
          response.status(503).json({
            error: 'Server at capacity with no lower priority connections available',
            priority: priority,
            priorityType: priorityType,
            suggestion: 'All current connections have equal or higher priority'
          });
          return false;
        }

        // Evict lower priority connections
        const evicted = this.evictConnections(evictionCandidates, 'higher_priority_connection');
        clog(`🔄 Evicted ${evicted.length} lower priority connections for new connection (priority: ${priority}, type: ${priorityType})`);
      }

      // Setup SSE headers (let Express CORS middleware handle CORS)
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      // Store connection info
      const connection = {
        id: connectionId,
        response: response,
        userId: userId,
        userRole: userRole,
        channels: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        priority: priority,
        priorityType: priorityType,
        sessionContext: sessionContext
      };

      this.connections.set(connectionId, connection);
      this.connectionCount++;

      // Subscribe to initial channels with permission validation
      initialChannels.forEach(channel => {
        this.subscribeToChannel(connectionId, channel);
      });

      // Send welcome message
      this.sendToConnection(connectionId, {
        eventType: 'connection:established',
        data: {
          connectionId: connectionId,
          serverTime: new Date().toISOString(),
          subscribedChannels: Array.from(connection.channels),
          priority: priority,
          priorityType: priorityType
        }
      });

      // Handle client disconnect
      response.req.on('close', () => {
        this.removeConnection(connectionId);
      });

      response.req.on('error', (error) => {
        cerror(`❌ SSE connection error for ${connectionId}:`, error);
        this.removeConnection(connectionId);
      });

      clog(`✅ SSE connection added: ${connectionId} (user: ${userId}, role: ${userRole}, priority: ${priority}, type: ${priorityType})`);
      return true;

    } catch (error) {
      cerror('❌ Failed to add SSE connection:', error);
      response.status(500).json({ error: 'Failed to establish SSE connection' });
      return false;
    }
  }

  /**
   * Remove a connection and cleanup
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from all channels
    connection.channels.forEach(channel => {
      this.unsubscribeFromChannel(connectionId, channel);
    });

    // Remove connection
    this.connections.delete(connectionId);
    this.connectionCount--;

    clog(`🔌 SSE connection removed: ${connectionId} (total: ${this.connectionCount})`);
  }

  /**
   * Subscribe connection to a channel with permission validation
   */
  subscribeToChannel(connectionId, channel) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      cerror(`❌ Cannot subscribe to channel ${channel}: connection ${connectionId} not found`);
      return false;
    }

    // Validate channel permissions
    if (!this.validateChannelPermission(channel, connection.userId, connection.userRole)) {
      cerror(`❌ Permission denied for channel ${channel} (user: ${connection.userId}, role: ${connection.userRole})`);
      return false;
    }

    // Check subscription limits
    if (connection.channels.size >= this.config.maxChannelsPerConnection) {
      cerror(`❌ Channel subscription limit reached for connection ${connectionId}`);
      return false;
    }

    // Add to connection's channels
    connection.channels.add(channel);

    // Add to global channel registry
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(connectionId);

    clog(`📺 Subscribed ${connectionId} to channel: ${channel}`);
    return true;
  }

  /**
   * Unsubscribe connection from a channel
   */
  unsubscribeFromChannel(connectionId, channel) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.channels.delete(channel);
    }

    if (this.channels.has(channel)) {
      this.channels.get(channel).delete(connectionId);

      // Clean up empty channels
      if (this.channels.get(channel).size === 0) {
        this.channels.delete(channel);
      }
    }

    clog(`📺 Unsubscribed ${connectionId} from channel: ${channel}`);
  }

  /**
   * Validate if a user can access a specific channel
   */
  validateChannelPermission(channel, userId, userRole) {
    const [channelType, ...channelParts] = channel.split(':');
    const channelId = channelParts.join(':');

    switch (channelType) {
      case SSE_CHANNEL_TYPES.SYSTEM:
        // System channels are accessible to all authenticated users
        return true;

      case SSE_CHANNEL_TYPES.GLOBAL:
        // Global channels are accessible to all authenticated users
        return true;

      case SSE_CHANNEL_TYPES.USER:
        // Users can only access their own user channel
        return channelId === String(userId) || userRole === 'admin' || userRole === 'sysadmin';

      case SSE_CHANNEL_TYPES.GAME:
      case SSE_CHANNEL_TYPES.LOBBY:
      case SSE_CHANNEL_TYPES.SESSION:
        // For now, allow access to all game/lobby/session channels for authenticated users
        // TODO: Implement ownership/permission checking with database queries
        return true;

      default:
        cerror(`❌ Unknown channel type: ${channelType}`);
        return false;
    }
  }

  /**
   * Broadcast event to specific channels
   */
  broadcastToChannels(eventType, data, targetChannels, excludeConnections = []) {
    const event = {
      eventType: eventType,
      timestamp: new Date().toISOString(),
      data: data
    };

    let sentCount = 0;

    targetChannels.forEach(channel => {
      if (this.channels.has(channel)) {
        this.channels.get(channel).forEach(connectionId => {
          if (!excludeConnections.includes(connectionId)) {
            this.sendToConnection(connectionId, event);
            sentCount++;
          }
        });
      }
    });

    clog(`📡 Broadcasted ${eventType} to ${sentCount} connections across ${targetChannels.length} channels`);
    return sentCount;
  }

  /**
   * Broadcast event to all connections
   */
  broadcastToAll(eventType, data, excludeConnections = []) {
    const event = {
      eventType: eventType,
      timestamp: new Date().toISOString(),
      data: data
    };

    let sentCount = 0;

    this.connections.forEach((connection, connectionId) => {
      if (!excludeConnections.includes(connectionId)) {
        this.sendToConnection(connectionId, event);
        sentCount++;
      }
    });

    clog(`📡 Broadcasted ${eventType} to all ${sentCount} connections`);
    return sentCount;
  }

  /**
   * Send event to specific connection
   */
  sendToConnection(connectionId, event) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.response.destroyed) {
      this.removeConnection(connectionId);
      return false;
    }

    try {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      connection.response.write(eventData);
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      cerror(`❌ Failed to send event to connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Start heartbeat system
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.broadcastToAll(SSE_EVENT_TYPES.HEARTBEAT, {
        serverTime: new Date().toISOString(),
        connectionCount: this.connectionCount
      });
    }, this.config.heartbeatIntervalMs);

    clog(`💓 SSE heartbeat started (${this.config.heartbeatIntervalMs}ms interval)`);
  }

  /**
   * Start connection cleanup process
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const staleConnections = [];

      this.connections.forEach((connection, connectionId) => {
        const timeSinceActivity = now - connection.lastActivity;
        if (timeSinceActivity > this.config.connectionTimeoutMs) {
          staleConnections.push(connectionId);
        }
      });

      staleConnections.forEach(connectionId => {
        clog(`🧹 Cleaning up stale connection: ${connectionId}`);
        this.removeConnection(connectionId);
      });

      if (staleConnections.length > 0) {
        clog(`🧹 Cleaned up ${staleConnections.length} stale connections`);
      }

    }, this.config.cleanupIntervalMs);

    clog(`🧹 SSE cleanup started (${this.config.cleanupIntervalMs}ms interval)`);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connectionCount,
      totalChannels: this.channels.size,
      connectionsByRole: this.getConnectionsByRole(),
      connectionsByPriority: this.getConnectionsByPriority(),
      connectionsByPriorityType: this.getConnectionsByPriorityType(),
      channelDistribution: this.getChannelDistribution(),
      priorityDistribution: this.getPriorityDistribution()
    };
  }

  /**
   * Get connections grouped by user role
   */
  getConnectionsByRole() {
    const roleStats = {};
    this.connections.forEach(connection => {
      const role = connection.userRole || 'unknown';
      roleStats[role] = (roleStats[role] || 0) + 1;
    });
    return roleStats;
  }

  /**
   * Get connections grouped by priority level
   */
  getConnectionsByPriority() {
    const priorityStats = {};
    this.connections.forEach(connection => {
      const priority = connection.priority || 5;
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
    });
    return priorityStats;
  }

  /**
   * Get connections grouped by priority type
   */
  getConnectionsByPriorityType() {
    const typeStats = {};
    this.connections.forEach(connection => {
      const type = connection.priorityType || SSE_PRIORITY_TYPES.CATALOG_BROWSING;
      typeStats[type] = (typeStats[type] || 0) + 1;
    });
    return typeStats;
  }

  /**
   * Get priority distribution with detailed information
   */
  getPriorityDistribution() {
    const distribution = {
      [SSE_PRIORITY_TYPES.ACTIVE_GAME_SESSION]: { level: 1, count: 0, connections: [] },
      [SSE_PRIORITY_TYPES.LOBBY_MANAGEMENT]: { level: 2, count: 0, connections: [] },
      [SSE_PRIORITY_TYPES.SESSION_MONITORING]: { level: 3, count: 0, connections: [] },
      [SSE_PRIORITY_TYPES.LOBBY_STATUS]: { level: 4, count: 0, connections: [] },
      [SSE_PRIORITY_TYPES.CATALOG_BROWSING]: { level: 5, count: 0, connections: [] }
    };

    this.connections.forEach((connection, connectionId) => {
      const type = connection.priorityType || SSE_PRIORITY_TYPES.CATALOG_BROWSING;
      if (distribution[type]) {
        distribution[type].count++;
        distribution[type].connections.push({
          id: connectionId,
          userId: connection.userId,
          userRole: connection.userRole,
          connectedAt: connection.connectedAt,
          channelCount: connection.channels.size
        });
      }
    });

    return distribution;
  }

  /**
   * Get channel subscriber distribution
   */
  getChannelDistribution() {
    const channelStats = {};
    this.channels.forEach((connectionIds, channel) => {
      channelStats[channel] = connectionIds.size;
    });
    return channelStats;
  }

  /**
   * Shutdown the broadcaster (cleanup)
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections gracefully
    this.connections.forEach((connection, connectionId) => {
      this.sendToConnection(connectionId, {
        eventType: 'connection:closing',
        data: { reason: 'server_shutdown' }
      });
      this.removeConnection(connectionId);
    });

    clog('📡 SSEBroadcaster shut down');
  }
}

// Singleton instance
let broadcasterInstance = null;

/**
 * Get the singleton SSEBroadcaster instance
 */
export function getSSEBroadcaster() {
  if (!broadcasterInstance) {
    broadcasterInstance = new SSEBroadcaster();
  }
  return broadcasterInstance;
}

/**
 * Convenience function to broadcast lobby events
 */
export function broadcastLobbyEvent(eventType, lobbyId, gameId, data) {
  const broadcaster = getSSEBroadcaster();
  const channels = [
    `${SSE_CHANNEL_TYPES.LOBBY}:${lobbyId}`,
    `${SSE_CHANNEL_TYPES.GAME}:${gameId}`
  ];

  return broadcaster.broadcastToChannels(eventType, {
    lobbyId,
    gameId,
    ...data
  }, channels);
}

/**
 * Convenience function to broadcast session events
 */
export function broadcastSessionEvent(eventType, sessionId, lobbyId, gameId, data) {
  const broadcaster = getSSEBroadcaster();
  const channels = [
    `${SSE_CHANNEL_TYPES.SESSION}:${sessionId}`,
    `${SSE_CHANNEL_TYPES.LOBBY}:${lobbyId}`,
    `${SSE_CHANNEL_TYPES.GAME}:${gameId}`
  ];

  return broadcaster.broadcastToChannels(eventType, {
    sessionId,
    lobbyId,
    gameId,
    ...data
  }, channels);
}

/**
 * Convenience function to broadcast system events
 */
export function broadcastSystemEvent(eventType, data) {
  const broadcaster = getSSEBroadcaster();
  return broadcaster.broadcastToAll(eventType, data);
}

export default SSEBroadcaster;