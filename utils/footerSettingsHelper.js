import path from 'path';
import models from '../models/index.js';

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
      hidden: false,
      rotation: 0,
      url: path.join(process.cwd(), 'assets', 'images', 'logo.png'), // Always use standard logo path
      position: { x: 50, y: 95 },
      style: { size: 80, opacity: 100 }
    },
    text: {
      visible: true,
      hidden: false,
      rotation: 0,
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
      hidden: false,
      rotation: 0,
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

// =====================================
// NEW TEMPLATE-BASED FOOTER RESOLUTION
// =====================================

/**
 * Resolve footer template for a file
 * Determines which template to use based on file settings and defaults
 *
 * @param {Object} fileEntity - File entity from database
 * @returns {Promise<Object|null>} SystemTemplate instance or null if not found
 */
export async function resolveFooterTemplate(fileEntity) {
  let template = null;

  // Step 1: Check if file has a specific footer template
  if (fileEntity.footer_template_id) {
    try {
      template = await models.SystemTemplate.findByPk(fileEntity.footer_template_id);
      if (template) {
        console.log('🎯 Using file-specific footer template:', template.id, template.name);
        return template;
      } else {
        console.warn('⚠️ File references non-existent footer template:', fileEntity.footer_template_id);
      }
    } catch (error) {
      console.error('❌ Error fetching file footer template:', error);
    }
  }

  // Step 2: Fall back to default footer template
  try {
    template = await models.SystemTemplate.findDefaultByType('footer');
    if (template) {
      console.log('🎯 Using default footer template:', template.id, template.name);
      return template;
    } else {
      console.warn('⚠️ No default footer template found in system');
    }
  } catch (error) {
    console.error('❌ Error fetching default footer template:', error);
  }

  return null;
}

/**
 * Merge template data with file-specific overrides
 * NEW SystemTemplate-based footer resolution
 *
 * @param {Object} fileEntity - File entity from database
 * @returns {Promise<Object>} Complete footer settings ready for PDF rendering
 */
export async function resolveFooterSettingsFromTemplate(fileEntity) {
  // Get the appropriate template
  const template = await resolveFooterTemplate(fileEntity);

  if (!template) {
    console.warn('⚠️ No footer template available, using defaults');
    return getDefaultFooterSettings();
  }

  // Start with template data
  let footerSettings = JSON.parse(JSON.stringify(template.template_data));

  // Apply file-specific overrides if they exist
  if (fileEntity.footer_overrides && Object.keys(fileEntity.footer_overrides).length > 0) {
    footerSettings = fileEntity.mergeWithTemplateData(footerSettings);
    console.log('🔄 Applied file-specific footer overrides');
  }

  // Always ensure the standard logo path is used (security/consistency)
  if (footerSettings.logo) {
    footerSettings.logo.url = path.join(process.cwd(), 'assets', 'images', 'logo.png');
  }

  console.log('✅ Footer settings resolved from template:', {
    templateId: template.id,
    templateName: template.name,
    hasFileOverrides: !!(fileEntity.footer_overrides && Object.keys(fileEntity.footer_overrides).length > 0)
  });

  return footerSettings;
}

/**
 * Resolve footer settings with legacy Settings fallback
 * This function bridges the old and new systems during transition
 *
 * @param {Object} fileEntity - File entity from database
 * @param {Object} legacySettings - Legacy Settings entity (optional)
 * @returns {Promise<Object>} Complete footer settings ready for PDF rendering
 */
export async function resolveFooterSettingsWithFallback(fileEntity, legacySettings = null) {
  // Try new template system first
  try {
    const template = await resolveFooterTemplate(fileEntity);
    if (template) {
      return await resolveFooterSettingsFromTemplate(fileEntity);
    }
  } catch (error) {
    console.error('❌ Error with template-based footer resolution:', error);
  }

  // Fallback to legacy system if template system fails
  console.warn('⚠️ Falling back to legacy Settings-based footer resolution');

  if (legacySettings) {
    return mergeFooterSettings(fileEntity.footer_settings || fileEntity.footer_overrides, legacySettings);
  }

  // Final fallback to defaults
  console.warn('⚠️ No legacy settings available, using defaults');
  return getDefaultFooterSettings();
}
