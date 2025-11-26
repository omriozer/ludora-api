import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { luderror } from '../lib/ludlog.js';

class LogService {

  /**
   * Create a new log entry
   * @param {Object} logData - The log data
   * @param {string} logData.source_type - 'app' or 'api'
   * @param {string} logData.log_type - 'log', 'error', 'debug', 'warn', 'info'
   * @param {string} logData.message - The log message
   * @param {string} [logData.user_id] - Optional user ID
   * @returns {Promise<Object>} The created log entry
   */
  async createLog({ source_type, log_type = 'log', message, user_id = null }) {
    try {
      // Don't use generateId() for logs since we're using auto-increment
      const logEntry = await models.Logs.create({
        source_type,
        log_type,
        message,
        user_id,
        created_at: new Date()
      });

      return logEntry;
    } catch (error) {
      luderror.api('Error creating log entry:', error);
      throw new Error('Failed to create log entry');
    }
  }

  /**
   * Get logs with filtering and pagination
   * @param {Object} options - Query options
   * @param {Object} [options.filters] - Filters to apply
   * @param {string} [options.filters.source_type] - Filter by source type
   * @param {string} [options.filters.log_type] - Filter by log type
   * @param {string} [options.filters.user_id] - Filter by user ID
   * @param {string} [options.filters.start_date] - Filter by start date
   * @param {string} [options.filters.end_date] - Filter by end date
   * @param {number} [options.limit=100] - Number of logs to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<Array>} The filtered logs
   */
  async getLogs({ filters = {}, limit = 100, offset = 0 } = {}) {
    try {
      const where = {};

      // Apply filters
      if (filters.source_type) {
        where.source_type = filters.source_type;
      }

      if (filters.log_type) {
        where.log_type = filters.log_type;
      }

      if (filters.user_id) {
        where.user_id = filters.user_id;
      }

      // Date range filters
      if (filters.start_date || filters.end_date) {
        where.created_at = {};
        if (filters.start_date) {
          where.created_at['>='] = new Date(filters.start_date);
        }
        if (filters.end_date) {
          where.created_at['<='] = new Date(filters.end_date);
        }
      }

      const logs = await models.Logs.findAll({
        where,
        limit,
        offset,
        orderBy: 'created_at DESC'
      });

      return logs;
    } catch (error) {
      luderror.api('Error fetching logs:', error);
      throw new Error('Failed to fetch logs');
    }
  }

  /**
   * Get log count with filtering
   * @param {Object} [filters] - Filters to apply
   * @returns {Promise<number>} The count of matching logs
   */
  async getLogCount(filters = {}) {
    try {
      const where = {};

      if (filters.source_type) {
        where.source_type = filters.source_type;
      }

      if (filters.log_type) {
        where.log_type = filters.log_type;
      }

      if (filters.user_id) {
        where.user_id = filters.user_id;
      }

      if (filters.start_date || filters.end_date) {
        where.created_at = {};
        if (filters.start_date) {
          where.created_at['>='] = new Date(filters.start_date);
        }
        if (filters.end_date) {
          where.created_at['<='] = new Date(filters.end_date);
        }
      }

      const count = await models.Logs.count({ where });
      return count;
    } catch (error) {
      luderror.api('Error counting logs:', error);
      throw new Error('Failed to count logs');
    }
  }

  /**
   * Delete old logs (for cleanup)
   * @param {number} daysOld - Delete logs older than this many days
   * @returns {Promise<number>} Number of deleted logs
   */
  async deleteOldLogs(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deletedCount = await models.Logs.delete({
        where: {
          created_at: { '<': cutoffDate }
        }
      });

      return deletedCount;
    } catch (error) {
      luderror.api('Error deleting old logs:', error);
      throw new Error('Failed to delete old logs');
    }
  }
}

export default new LogService();