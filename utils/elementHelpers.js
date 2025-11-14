/**
 * Element Helper Functions
 * Provides unified access to element properties across builtin and custom elements
 * Eliminates duplication and inconsistencies in rotation/styling logic
 */

import { clog, cerror } from '../lib/utils.js';

/**
 * Check if an element type is a builtin element
 * @param {string} elementType - Element type/key (e.g., 'logo', 'text', 'url', 'free-text', 'box')
 * @returns {boolean} True if it's a builtin element
 */
export function isBuiltinElement(elementType) {
  return ['logo', 'text', 'url', 'copyright-text', 'user-info', 'watermark-logo'].includes(elementType);
}

/**
 * Get rotation value from element using correct property path
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @returns {number} Rotation in degrees (0 if not set)
 */
export function getElementRotation(element, elementType) {
  if (!element) return 0;

  if (isBuiltinElement(elementType)) {
    // Built-in elements: use element.rotation
    return element.rotation || 0;
  } else {
    // Custom elements: use element.style.rotation
    return element.style?.rotation || 0;
  }
}

/**
 * Set rotation value on element using correct property path
 * @param {Object} element - Element object (modified in place)
 * @param {string} elementType - Element type/key
 * @param {number} rotation - Rotation in degrees
 * @returns {Object} Modified element (for chaining)
 */
export function setElementRotation(element, elementType, rotation) {
  if (!element) return element;

  if (isBuiltinElement(elementType)) {
    // Built-in elements: use element.rotation
    element.rotation = rotation;
  } else {
    // Custom elements: use element.style.rotation
    if (!element.style) element.style = {};
    element.style.rotation = rotation;
  }

  return element;
}

/**
 * Get position from element
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @returns {Object} Position object {x, y} or {x: 50, y: 50} default
 */
export function getElementPosition(element, elementType) {
  if (!element) return { x: 50, y: 50 };

  // Both builtin and custom elements use .position
  return element.position || { x: 50, y: 50 };
}

/**
 * Set position on element
 * @param {Object} element - Element object (modified in place)
 * @param {string} elementType - Element type/key
 * @param {Object} position - Position object {x, y}
 * @returns {Object} Modified element (for chaining)
 */
export function setElementPosition(element, elementType, position) {
  if (!element) return element;

  // Both builtin and custom elements use .position
  element.position = position;

  return element;
}

/**
 * Get visibility from element
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @returns {boolean} True if visible
 */
export function getElementVisibility(element, elementType) {
  if (!element) return false;

  // Check for hidden flag first (takes precedence)
  if (element.hidden === true) return false;

  // Then check visible flag
  return element.visible !== false; // Default to true if not explicitly set to false
}

/**
 * Set visibility on element
 * @param {Object} element - Element object (modified in place)
 * @param {string} elementType - Element type/key
 * @param {boolean} visible - Whether element should be visible
 * @returns {Object} Modified element (for chaining)
 */
export function setElementVisibility(element, elementType, visible) {
  if (!element) return element;

  element.visible = visible;

  // Clear hidden flag when setting to visible
  if (visible && element.hidden) {
    element.hidden = false;
  }

  return element;
}

/**
 * Get style property from element using correct path
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @param {string} styleProperty - Style property name (e.g., 'fontSize', 'color')
 * @param {*} defaultValue - Default value if property not found
 * @returns {*} Style property value
 */
export function getElementStyleProperty(element, elementType, styleProperty, defaultValue = null) {
  if (!element || !element.style) return defaultValue;

  return element.style[styleProperty] !== undefined ? element.style[styleProperty] : defaultValue;
}

/**
 * Set style property on element
 * @param {Object} element - Element object (modified in place)
 * @param {string} elementType - Element type/key
 * @param {string} styleProperty - Style property name
 * @param {*} value - Style property value
 * @returns {Object} Modified element (for chaining)
 */
export function setElementStyleProperty(element, elementType, styleProperty, value) {
  if (!element) return element;

  if (!element.style) element.style = {};
  element.style[styleProperty] = value;

  return element;
}

/**
 * Get content from element using correct property path
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @returns {string} Content string or empty string
 */
export function getElementContent(element, elementType) {
  if (!element) return '';

  // Both builtin and custom elements typically use .content
  // But URL elements might use .href
  if (elementType === 'url') {
    return element.content || element.href || '';
  }

  return element.content || '';
}

/**
 * Set content on element
 * @param {Object} element - Element object (modified in place)
 * @param {string} elementType - Element type/key
 * @param {string} content - Content string
 * @returns {Object} Modified element (for chaining)
 */
export function setElementContent(element, elementType, content) {
  if (!element) return element;

  element.content = content;

  // For URL elements, also update href if it exists
  if (elementType === 'url' && element.href !== undefined) {
    element.href = content;
  }

  return element;
}

/**
 * Create a unified element info object for easier handling
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @param {string} elementKey - Element key/id for custom elements
 * @returns {Object} Unified element info object
 */
export function createUnifiedElementInfo(element, elementType, elementKey = null) {
  return {
    element,
    elementType,
    elementKey,
    isBuiltin: isBuiltinElement(elementType),
    rotation: getElementRotation(element, elementType),
    position: getElementPosition(element, elementType),
    visible: getElementVisibility(element, elementType),
    content: getElementContent(element, elementType)
  };
}

/**
 * Get shadow settings from element
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @returns {Object|null} Shadow settings object or null if no shadow
 */
export function getElementShadow(element, elementType) {
  if (!element || !element.style || !element.style.shadow) return null;

  const shadow = element.style.shadow;

  // Return null if shadow is disabled
  if (!shadow.enabled) return null;

  // Return shadow settings with defaults
  return {
    enabled: true,
    offsetX: shadow.offsetX || 0,
    offsetY: shadow.offsetY || 0,
    blur: shadow.blur || 0,
    color: shadow.color || '#000000',
    opacity: shadow.opacity !== undefined ? shadow.opacity : 50
  };
}

/**
 * Convert shadow settings to PDF rendering parameters
 * For PDF-lib, we need to create shadow effects using additional drawing operations
 * @param {Object} shadowSettings - Shadow settings from getElementShadow
 * @returns {Object} PDF shadow parameters
 */
export function getPdfShadowParams(shadowSettings) {
  if (!shadowSettings || !shadowSettings.enabled) return null;

  // Convert opacity from 0-100 to 0-1
  const alpha = shadowSettings.opacity / 100;

  // Convert hex color to RGB values for pdf-lib
  const hexColor = shadowSettings.color.replace('#', '');
  const r = parseInt(hexColor.substr(0, 2), 16) / 255;
  const g = parseInt(hexColor.substr(2, 2), 16) / 255;
  const b = parseInt(hexColor.substr(4, 2), 16) / 255;

  return {
    offsetX: shadowSettings.offsetX,
    offsetY: shadowSettings.offsetY,
    blur: shadowSettings.blur,
    color: { r, g, b },
    opacity: alpha
  };
}

/**
 * Debug helper to log element rotation source
 * @param {Object} element - Element object
 * @param {string} elementType - Element type/key
 * @param {string} context - Context string for logging
 */
export function debugElementRotation(element, elementType, context = '') {
  const isBuiltin = isBuiltinElement(elementType);
  const rotation = getElementRotation(element, elementType);

  clog(`🔄 Element Rotation Debug ${context}:`, {
    elementType,
    isBuiltin,
    rotation,
    elementRotationField: element?.rotation,
    styleRotationField: element?.style?.rotation,
    actualRotationUsed: rotation,
    rotationSource: isBuiltin ? 'element.rotation' : 'element.style.rotation'
  });
}