/**
 * Template System Configuration
 *
 * Centralizes all hardcoded values for the template system
 * to make them configurable and maintainable
 */

import path from 'path';

/**
 * Template system configuration with environment variable support
 */
export const TEMPLATE_CONFIG = {
  // URLs and domains
  urls: {
    frontend: process.env.FRONTEND_URL || 'https://ludora.app',
    defaultUrl: process.env.FRONTEND_URL || 'https://ludora.app',
    fallbackUrl: 'https://ludora.app'
  },

  // Asset paths and locations
  assets: {
    logo: {
      defaultPath: path.join(process.cwd(), 'assets', 'images', 'logo.svg'),
      fallbackApiPath: '/api/assets/image/settings/logo.svg',
      fallbackText: 'LOGO',
      fallbackColor: { r: 0.2, g: 0.4, b: 0.8 } // Blue-ish color for logo placeholder
    },
    fonts: {
      // English fonts (Inter)
      english: {
        regular: path.join(process.cwd(), 'fonts', 'Inter-Regular.ttf'),
        bold: path.join(process.cwd(), 'fonts', 'Inter-Bold.ttf')
      },
      // Hebrew fonts (NotoSansHebrew)
      hebrew: {
        regular: path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Regular.ttf'),
        bold: path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Bold.ttf'),
        variable: path.join(process.cwd(), 'fonts', 'NotoSansHebrew-Variable.ttf')
      }
    }
  },

  // Default content and text
  defaultContent: {
    userInfo: {
      hebrew: 'קובץ זה נוצר עבור {{user.email}}',
      english: 'This file was created for {{user.email}}'
    },
    logo: {
      fallbackText: 'LOGO'
    }
  },

  // Template element defaults
  defaults: {
    logo: {
      size: 80,
      opacity: 100,
      rotation: 0,
      position: { x: 50, y: 95 }
    },
    text: {
      fontSize: 12,
      color: '#000000',
      bold: false,
      italic: false,
      opacity: 80,
      rotation: 0,
      width: 300
    },
    url: {
      fontSize: 12,
      color: '#0066cc',
      bold: false,
      italic: false,
      opacity: 100,
      rotation: 45
    }
  },

  // Predefined templates (removed automatic preview template)

  // System settings
  system: {
    // Support for different logo sources
    logoSources: ['file', 'url', 'base64'],
    // Font fallback order
    fontFallbacks: {
      english: ['Inter', 'Helvetica', 'Arial'],
      hebrew: ['NotoSansHebrew', 'Arial']
    },
    // Coordinate system settings
    coordinates: {
      // Visual editor uses Y=0 at top, PDF uses Y=0 at bottom
      editorYIsTop: true,
      pdfYIsBottom: true
    },
    // Element type mappings
    elementTypes: {
      logo: ['logo', 'watermark-logo'],
      text: ['text', 'copyright-text', 'free-text', 'user-info', 'watermark-text'],
      url: ['url'],
      shape: ['box', 'circle'],
      line: ['line', 'dotted-line']
    }
  }
};

/**
 * Get logo configuration based on environment and settings
 * @param {Object} options - Configuration options
 * @returns {Object} Logo configuration
 */
export function getLogoConfig(options = {}) {
  return {
    path: options.logoPath || TEMPLATE_CONFIG.assets.logo.defaultPath,
    fallbackApiPath: TEMPLATE_CONFIG.assets.logo.fallbackApiPath,
    fallbackText: TEMPLATE_CONFIG.assets.logo.fallbackText,
    fallbackColor: TEMPLATE_CONFIG.assets.logo.fallbackColor,
    size: options.size || TEMPLATE_CONFIG.defaults.logo.size
  };
}

/**
 * Get font configuration for a given language
 * @param {string} language - 'hebrew' or 'english'
 * @returns {Object} Font paths configuration
 */
export function getFontConfig(language = 'english') {
  const fonts = TEMPLATE_CONFIG.assets.fonts[language];
  if (!fonts) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return fonts;
}

/**
 * Get URL configuration with fallbacks
 * @param {Object} options - URL options
 * @returns {Object} URL configuration
 */
export function getUrlConfig(options = {}) {
  return {
    frontend: options.frontendUrl || TEMPLATE_CONFIG.urls.frontend,
    default: options.defaultUrl || TEMPLATE_CONFIG.urls.defaultUrl,
    fallback: TEMPLATE_CONFIG.urls.fallbackUrl
  };
}

/**
 * Get default content for element types
 * @param {string} elementType - Type of element
 * @param {string} language - Language for content
 * @returns {string} Default content
 */
export function getDefaultContent(elementType, language = 'hebrew') {
  if (elementType === 'user-info') {
    return TEMPLATE_CONFIG.defaultContent.userInfo[language] ||
           TEMPLATE_CONFIG.defaultContent.userInfo.hebrew;
  }
  if (elementType === 'logo') {
    return TEMPLATE_CONFIG.defaultContent.logo.fallbackText;
  }
  return '';
}

/**
 * Get element defaults for a given type
 * @param {string} elementType - Type of element
 * @returns {Object} Default style configuration
 */
export function getElementDefaults(elementType) {
  // Map element types to their default category
  if (TEMPLATE_CONFIG.system.elementTypes.logo.includes(elementType)) {
    return TEMPLATE_CONFIG.defaults.logo;
  }
  if (TEMPLATE_CONFIG.system.elementTypes.text.includes(elementType)) {
    return TEMPLATE_CONFIG.defaults.text;
  }
  if (TEMPLATE_CONFIG.system.elementTypes.url.includes(elementType)) {
    return TEMPLATE_CONFIG.defaults.url;
  }

  // Return basic defaults for unknown types
  return {
    opacity: 100,
    rotation: 0
  };
}

// Removed getPreviewTemplate - no longer using automatic preview watermarks

export default TEMPLATE_CONFIG;