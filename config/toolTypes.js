/**
 * Tool Types Configuration
 *
 * Defines the allowed tool types and their configurations for the Ludora platform.
 * This serves as the single source of truth for available tools.
 */

export const TOOL_TYPES = {
  CONTACT_PAGE_GENERATOR: {
    key: 'CONTACT_PAGE_GENERATOR',
    name: 'Contact Page Generator',
    hebrewName: 'מחולל דף קשר',
    description: 'Generate customizable contact pages',
    hebrewDescription: 'מחולל דפי קשר הניתנים להתאמה אישית',
    category: 'generators',
    defaultAccessDays: 365,
    enabled: true
  },
  SCHEDULE_GENERATOR: {
    key: 'SCHEDULE_GENERATOR',
    name: 'Schedule Generator',
    hebrewName: 'מחולל לוח זמנים',
    description: 'Generate customizable schedule templates',
    hebrewDescription: 'מחולל תבניות לוחות זמנים הניתנים להתאמה',
    category: 'generators',
    defaultAccessDays: 365,
    enabled: true
  }
};

export const TOOL_CATEGORIES = {
  generators: {
    name: 'Generators',
    hebrewName: 'כלים אוטומטיים',
    description: 'Automated content generation tools',
    hebrewDescription: 'כלים לייצור תוכן אוטומטי'
  },
  utilities: {
    name: 'Utilities',
    hebrewName: 'כלים שימושיים',
    description: 'General utility tools',
    hebrewDescription: 'כלים שימושיים כלליים'
  }
};

/**
 * Get all available tool types
 * @returns {Array} Array of tool type configurations
 */
export const getAllToolTypes = () => {
  return Object.values(TOOL_TYPES).filter(tool => tool.enabled);
};

/**
 * Get tool type by key
 * @param {string} key - Tool key (e.g., 'CONTACT_PAGE_GENERATOR')
 * @returns {Object|null} Tool configuration or null if not found
 */
export const getToolType = (key) => {
  return TOOL_TYPES[key] || null;
};

/**
 * Check if a tool type is valid and enabled
 * @param {string} key - Tool key to validate
 * @returns {boolean} Whether the tool type is valid and enabled
 */
export const isValidToolType = (key) => {
  const tool = TOOL_TYPES[key];
  return tool && tool.enabled;
};

/**
 * Get tools by category
 * @param {string} category - Category name (e.g., 'generators')
 * @returns {Array} Array of tools in the specified category
 */
export const getToolsByCategory = (category) => {
  return Object.values(TOOL_TYPES).filter(tool =>
    tool.enabled && tool.category === category
  );
};

/**
 * Get all available categories
 * @returns {Array} Array of category configurations
 */
export const getAllCategories = () => {
  return Object.values(TOOL_CATEGORIES);
};