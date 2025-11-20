/**
 * Date utilities for Israel timezone handling
 *
 * Simple, focused utilities to replace problematic new Date() calls
 * with Israel timezone-aware equivalents throughout the application.
 */

import moment from 'moment-timezone';

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

/**
 * Get current date/time in Israel timezone as a Date object
 * Use this instead of new Date() for business logic comparisons
 * @returns {Date} Current time in Israel timezone as Date object
 */
export function nowInIsrael() {
  return moment().tz(ISRAEL_TIMEZONE).toDate();
}

/**
 * Convert any date to Israel timezone and return as Date object
 * Use this for converting UTC dates from database to Israel timezone for comparisons
 * @param {Date|string|moment} date - Date to convert
 * @returns {Date} Date converted to Israel timezone as Date object
 */
export function israelDate(date) {
  if (!date) return null;
  return moment(date).tz(ISRAEL_TIMEZONE).toDate();
}

/**
 * Create expiration date N days from now in Israel timezone
 * Use this for creating access_expires_at dates
 * @param {number} days - Number of days from now
 * @returns {Date} Expiration date in Israel timezone as Date object
 */
export function createExpirationDate(days) {
  if (!days || days <= 0) return null; // null = lifetime access
  return moment().tz(ISRAEL_TIMEZONE).add(days, 'days').toDate();
}

/**
 * Check if a date has expired (is in the past) according to Israel timezone
 * @param {Date|string} expirationDate - Date to check
 * @returns {boolean} True if expired, false otherwise
 */
export function isExpired(expirationDate) {
  if (!expirationDate) return false;
  const now = nowInIsrael();
  const expiry = israelDate(expirationDate);
  return expiry < now;
}

/**
 * Format date for API response with Israel timezone
 * @param {Date|string} date - Date to format
 * @returns {string} ISO string in Israel timezone
 */
export function formatForAPI(date) {
  if (!date) return null;
  return moment(date).tz(ISRAEL_TIMEZONE).format();
}

/**
 * Format date for display in Israel timezone
 * @param {Date|string} date - Date to format
 * @param {string} format - Format string (default: DD/MM/YYYY)
 * @returns {string} Formatted date string
 */
export function formatForDisplay(date, format = 'DD/MM/YYYY') {
  if (!date) return null;
  return moment(date).tz(ISRAEL_TIMEZONE).format(format);
}

/**
 * Get timezone info for debugging
 * @returns {Object} Current timezone information
 */
export function getTimezoneInfo() {
  const now = moment().tz(ISRAEL_TIMEZONE);
  return {
    israelTime: now.format(),
    utcTime: now.utc().format(),
    isDST: now.isDST(),
    offset: now.utcOffset(),
    zoneName: now.format('z')
  };
}