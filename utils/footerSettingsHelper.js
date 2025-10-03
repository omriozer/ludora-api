import path from 'path';

/**
 * Get default footer settings structure
 * Used when no footer settings exist in database
 *
 * @returns {Object} Default footer configuration
 */
export function getDefaultFooterSettings() {
  return {
    logo: {
      visible: true,
      url: path.join(process.cwd(), 'assets', 'images', 'logo.png'), // Always use standard logo path
      position: { x: 50, y: 95 },
      style: { size: 80, opacity: 100 }
    },
    text: {
      visible: true,
      content: '', // Will be populated from system settings
      position: { x: 50, y: 90 },
      style: {
        fontSize: 12,
        color: '#000000',
        bold: false,
        italic: false,
        opacity: 80,
        width: 300
      }
    },
    url: {
      visible: true,
      href: 'https://ludora.app',
      position: { x: 50, y: 85 },
      style: {
        fontSize: 12,
        color: '#0066cc',
        bold: false,
        italic: false,
        opacity: 100
      }
    },
    customElements: {}
  };
}

/**
 * Merge file-specific footer settings with system defaults
 * File settings control positioning and styling
 * System settings control content (text, logo URL)
 *
 * @param {Object} fileFooterSettings - Footer settings from File entity (can be null)
 * @param {Object} systemSettings - System settings object
 * @returns {Object} Complete footer settings ready for PDF rendering
 */
export function mergeFooterSettings(fileFooterSettings, systemSettings) {
  // Get base settings (file-specific or system or defaults)
  const baseSettings = fileFooterSettings || systemSettings?.footer_settings || getDefaultFooterSettings();

  // Extract system values
  const copyrightText = systemSettings?.footer_settings?.text?.content || systemSettings?.copyright_footer_text || '';
  // ALWAYS use the standard logo path - ignore any stored URLs that might be wrong
  const logoUrl = path.join(process.cwd(), 'assets', 'images', 'logo.png');

  // DEBUG: Log the merge process
  console.log('🔄 mergeFooterSettings Debug:', {
    hasFileSettings: !!fileFooterSettings,
    hasSystemSettings: !!systemSettings,
    hasSystemFooterSettings: !!systemSettings?.footer_settings,
    copyrightText: copyrightText.substring(0, 50) + (copyrightText.length > 50 ? '...' : ''),
    logoUrl: logoUrl
  });

  console.log('🎯 DETAILED Position Values in Base Settings:', {
    hasLogo: !!baseSettings.logo,
    hasText: !!baseSettings.text,
    hasUrl: !!baseSettings.url,
    hasCustomElements: !!baseSettings.customElements,
    logoPosition: baseSettings.logo?.position,
    textPosition: baseSettings.text?.position,
    textStyle: baseSettings.text?.style,
    urlPosition: baseSettings.url?.position,
    source: fileFooterSettings ? 'FILE_SPECIFIC' : (systemSettings?.footer_settings ? 'SYSTEM_GLOBAL' : 'DEFAULTS'),
    coordinateAnalysis: {
      logoY: baseSettings.logo?.position?.y,
      textY: baseSettings.text?.position?.y,
      urlY: baseSettings.url?.position?.y,
      note: 'These Y values should match what frontend editor displays'
    }
  });

  // Build complete footer settings - preserve ALL properties from base settings
  const mergedSettings = {
    ...baseSettings,
    logo: {
      ...baseSettings.logo,
      url: logoUrl // Only override the URL, preserve all other logo properties
    },
    text: {
      ...baseSettings.text,
      content: copyrightText, // Only override the content, preserve all other text properties
      style: {
        ...baseSettings.text?.style,
        width: baseSettings.text?.style?.width || 300 // Ensure width is always present for line wrapping
      }
    },
    // Explicitly preserve url element (this was missing before!)
    url: {
      ...baseSettings.url
    },
    // Explicitly preserve custom elements (this was missing before!)
    customElements: {
      ...baseSettings.customElements
    }
  };

  console.log('🎯 FINAL Position Values After Merge:', {
    hasLogo: !!mergedSettings.logo,
    hasText: !!mergedSettings.text,
    hasUrl: !!mergedSettings.url,
    hasCustomElements: !!mergedSettings.customElements,
    textWidth: mergedSettings.text?.style?.width,
    logoSize: mergedSettings.logo?.style?.size,
    urlHref: mergedSettings.url?.href,
    finalCoordinates: {
      logoY: mergedSettings.logo?.position?.y,
      textY: mergedSettings.text?.position?.y,
      urlY: mergedSettings.url?.position?.y,
      logoPosition: mergedSettings.logo?.position,
      textPosition: mergedSettings.text?.position,
      urlPosition: mergedSettings.url?.position,
      note: 'These are the exact coordinates that will be sent to PDF merger'
    }
  });

  return mergedSettings;
}

/**
 * Extract copyright text from footer settings for backwards compatibility
 * Used to populate the legacy copyright_footer_text field
 *
 * @param {Object} footerSettings - Footer settings object
 * @returns {string} Copyright text or empty string
 */
export function extractCopyrightText(footerSettings) {
  if (!footerSettings) return '';
  return footerSettings.text?.content || '';
}

/**
 * Update footer settings with new copyright text
 * Ensures text.content is updated when legacy field is used
 *
 * @param {Object} footerSettings - Existing footer settings (can be null)
 * @param {string} copyrightText - New copyright text
 * @returns {Object} Updated footer settings
 */
export function updateFooterTextContent(footerSettings, copyrightText) {
  const settings = footerSettings || getDefaultFooterSettings();

  return {
    ...settings,
    text: {
      ...settings.text,
      content: copyrightText
    }
  };
}

/**
 * Validate footer settings structure
 * Ensures all required fields are present with proper types
 *
 * @param {Object} footerSettings - Footer settings to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateFooterSettings(footerSettings) {
  const errors = [];

  if (!footerSettings || typeof footerSettings !== 'object') {
    return { valid: false, errors: ['Footer settings must be an object'] };
  }

  // Validate logo
  if (footerSettings.logo) {
    if (typeof footerSettings.logo.visible !== 'boolean') {
      errors.push('logo.visible must be a boolean');
    }
    if (footerSettings.logo.position) {
      if (typeof footerSettings.logo.position.x !== 'number' || typeof footerSettings.logo.position.y !== 'number') {
        errors.push('logo.position.x and logo.position.y must be numbers');
      }
    }
  }

  // Validate text
  if (footerSettings.text) {
    if (typeof footerSettings.text.visible !== 'boolean') {
      errors.push('text.visible must be a boolean');
    }
    if (footerSettings.text.position) {
      if (typeof footerSettings.text.position.x !== 'number' || typeof footerSettings.text.position.y !== 'number') {
        errors.push('text.position.x and text.position.y must be numbers');
      }
    }
  }

  // Validate url
  if (footerSettings.url) {
    if (typeof footerSettings.url.visible !== 'boolean') {
      errors.push('url.visible must be a boolean');
    }
    if (footerSettings.url.position) {
      if (typeof footerSettings.url.position.x !== 'number' || typeof footerSettings.url.position.y !== 'number') {
        errors.push('url.position.x and url.position.y must be numbers');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
