// services/LobbySocketService.js
// Socket.IO service for broadcasting lobby updates in real-time
// Replaces the removed SSE system for lobby visibility updates

import { error } from '../lib/errorLogger.js';

/**
 * LobbySocketService - Manages real-time lobby updates via Socket.IO
 * Broadcasts lobby and session changes to connected clients on 'lobby-updates' channel
 */
class LobbySocketService {

  /**
   * Get the global Socket.IO instance
   * @returns {Object} Socket.IO server instance
   */
  static getSocketIO() {
    if (!global.io) {
      error.lobby('❌ Socket.IO instance not available');
      throw new Error('Socket.IO server not initialized');
    }
    return global.io;
  }

  /**
   * Broadcast lobby creation event
   * @param {Object} lobbyData - Created lobby data
   */
  static broadcastLobbyCreated(lobbyData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'lobby_created',
        data: lobbyData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast lobby created:', error);
    }
  }

  /**
   * Broadcast lobby activated/opened event
   * @param {Object} lobbyData - Activated lobby data
   */
  static broadcastLobbyActivated(lobbyData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'lobby_activated',
        data: lobbyData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast lobby activated:', error);
    }
  }

  /**
   * Broadcast lobby closed event
   * @param {Object} lobbyData - Closed lobby data
   */
  static broadcastLobbyClosed(lobbyData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'lobby_closed',
        data: lobbyData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast lobby closed:', error);
    }
  }

  /**
   * Broadcast session created event
   * @param {Object} sessionData - Created session data
   */
  static broadcastSessionCreated(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'session_created',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.auth('❌ Failed to broadcast session created:', error);
    }
  }

  /**
   * Broadcast participant joined session event
   * @param {Object} sessionData - Updated session data with new participant
   */
  static broadcastParticipantJoined(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'participant_joined',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast participant joined:', error);
    }
  }

  /**
   * Broadcast participant left session event
   * @param {Object} sessionData - Updated session data after participant left
   */
  static broadcastParticipantLeft(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'participant_left',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast participant left:', error);
    }
  }

  /**
   * Broadcast game state updated event
   * @param {Object} sessionData - Updated session data with new game state
   */
  static broadcastGameStateUpdated(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'game_state_updated',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.lobby('❌ Failed to broadcast game state updated:', error);
    }
  }

  /**
   * Broadcast session started event
   * @param {Object} sessionData - Started session data
   */
  static broadcastSessionStarted(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'session_started',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.auth('❌ Failed to broadcast session started:', error);
    }
  }

  /**
   * Broadcast session finished event
   * @param {Object} sessionData - Finished session data
   */
  static broadcastSessionFinished(sessionData) {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'session_finished',
        data: sessionData,
        timestamp: new Date().toISOString()
      };

      io.to('lobby-updates').emit('lobby:update', eventData);

    } catch (error) {
      error.auth('❌ Failed to broadcast session finished:', error);
    }
  }

  /**
   * Get current lobby updates channel statistics
   * @returns {Object} Channel statistics
   */
  static getLobbyUpdatesStats() {
    try {
      const io = this.getSocketIO();
      const lobbyUpdatesRoom = io.sockets.adapter.rooms.get('lobby-updates');

      return {
        connected_clients: lobbyUpdatesRoom?.size || 0,
        room_exists: !!lobbyUpdatesRoom,
        server_socket_count: io.sockets.sockets.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      error.lobby('❌ Failed to get lobby updates stats:', error);
      return {
        connected_clients: 0,
        room_exists: false,
        server_socket_count: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test broadcast to verify Socket.IO is working
   * @param {string} testMessage - Test message to broadcast
   */
  static broadcastTest(testMessage = 'Socket.IO test broadcast') {
    try {
      const io = this.getSocketIO();

      const eventData = {
        type: 'test_broadcast',
        data: { message: testMessage },
        timestamp: new Date().toISOString()
      };

      const stats = this.getLobbyUpdatesStats();

      io.to('lobby-updates').emit('lobby:update', eventData);

      return { success: true, stats };
    } catch (error) {
      error.lobby('❌ Failed to send test broadcast:', error);
      return { success: false, error: error.message };
    }
  }
}

export default LobbySocketService;