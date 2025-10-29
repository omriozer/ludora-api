/**
 * Age Calculator Utility
 * Handles parsing of age strings and date comparisons for trash cleanup
 */

/**
 * Parse age string into milliseconds
 * Supports: 7d, 30d, 6m, 1y, etc.
 * @param {string} ageString - Age string like "30d", "6m", "1y"
 * @returns {number} Milliseconds
 */
function parseAgeString(ageString) {
  const match = ageString.match(/^(\d+)([dmyDMY])$/);
  if (!match) {
    throw new Error(`Invalid age format: ${ageString}. Use format like "30d", "6m", "1y"`);
  }

  const [, amount, unit] = match;
  const num = parseInt(amount, 10);

  switch (unit.toLowerCase()) {
    case 'd': // days
      return num * 24 * 60 * 60 * 1000;
    case 'm': // months (approximate as 30 days)
      return num * 30 * 24 * 60 * 60 * 1000;
    case 'y': // years (approximate as 365 days)
      return num * 365 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid age unit: ${unit}. Use 'd' for days, 'm' for months, 'y' for years`);
  }
}

/**
 * Check if a date is older than the specified age
 * @param {Date|string} date - Date to check
 * @param {string} ageString - Age string like "30d"
 * @returns {boolean} True if date is older than specified age
 */
function isOlderThan(date, ageString) {
  const targetDate = new Date(date);
  const ageMs = parseAgeString(ageString);
  const cutoffDate = new Date(Date.now() - ageMs);

  return targetDate < cutoffDate;
}

/**
 * Format a date as "X days ago", "X months ago", etc.
 * @param {Date|string} date - Date to format
 * @returns {string} Human-readable relative time
 */
function formatRelativeTime(date) {
  const targetDate = new Date(date);
  const now = new Date();
  const diffMs = now - targetDate;

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } else if (months > 0) {
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
}

/**
 * Validate age string format
 * @param {string} ageString - Age string to validate
 * @returns {boolean} True if valid format
 */
function isValidAgeString(ageString) {
  try {
    parseAgeString(ageString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all files older than specified age from a list
 * @param {Array} files - Array of file objects with lastModified property
 * @param {string} ageString - Age string like "30d"
 * @returns {Array} Filtered array of files older than specified age
 */
function filterFilesByAge(files, ageString) {
  return files.filter(file => isOlderThan(file.lastModified, ageString));
}

export {
  parseAgeString,
  isOlderThan,
  formatRelativeTime,
  isValidAgeString,
  filterFilesByAge
};