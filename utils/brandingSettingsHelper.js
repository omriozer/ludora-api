import path from 'path';
import models from '../models/index.js';

/**
 * Get default branding settings structure
 * Used when no branding settings exist in database
 *
 * @returns {Object} Default branding configuration
 */
export function getDefaultBrandingSettings() {
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
      rotation: 45, // CRITICAL FIX: Match the visual editor rotation
      href: '${FRONTEND_URL}', // Use variable that resolves to correct URL
      position: { x: 85, y: 85 }, // CRITICAL FIX: Match the visual editor position
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
  // Get base settings (file-specific or defaults)
  const baseSettings = fileFooterSettings || getDefaultBrandingSettings();

  // Extract system values - CRITICAL FIX: Use correct field name from Settings model
  const copyrightText = systemSettings?.copyright_text || '';
  // ALWAYS use the standard logo path - ignore any stored URLs that might be wrong
  const logoUrl = path.join(process.cwd(), 'assets', 'images', 'logo.png');


  // Build complete footer settings - preserve ALL properties from base settings
  // CRITICAL FIX: Always override text content with system copyright text, regardless of what's in file settings
  const mergedSettings = {
    ...baseSettings,
    logo: {
      ...baseSettings.logo,
      url: logoUrl // Only override the URL, preserve all other logo properties
    },
    text: {
      ...baseSettings.text,
      content: copyrightText, // ALWAYS override with system copyright text
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
export function updateBrandingTextContent(brandingSettings, copyrightText) {
  const settings = brandingSettings || getDefaultBrandingSettings();

  return {
    ...settings,
    text: {
      ...settings.text,
      content: copyrightText
    }
  };
}

// Note: Removed legacy aliases since we're not maintaining backward compatibility

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
// NEW TEMPLATE-BASED BRANDING RESOLUTION
// =====================================

/**
 * Resolve branding template for a file
 * Determines which template to use based on file settings and defaults
 *
 * @param {Object} fileEntity - File entity from database
 * @returns {Promise<Object|null>} SystemTemplate instance or null if not found
 */
export async function resolveBrandingTemplate(fileEntity) {
  let template = null;

  // Step 1: Check if file has a specific branding template (via branding_template_id field)
  if (fileEntity.branding_template_id) {
    try {
      template = await models.SystemTemplate.findByPk(fileEntity.branding_template_id);
      if (template) {
        return template;
      }
    } catch (error) {
      // Error fetching template
    }
  }

  // Step 2: Fall back to default branding template for this target format
  try {
    // CRITICAL FIX: Pass the target_format to ensure we get the right default template
    const targetFormat = fileEntity.target_format || 'pdf-a4-landscape';
    template = await models.SystemTemplate.findDefaultByType('branding', targetFormat);
    if (template) {
      return template;
    }
  } catch (error) {
    // Error fetching default template
  }

  return null;
}

/**
 * Merge template data with file-specific overrides and system settings
 * NEW SystemTemplate-based branding resolution
 *
 * @param {Object} fileEntity - File entity from database
 * @param {Object} systemSettings - System settings object (optional)
 * @returns {Promise<Object>} Complete branding settings ready for PDF rendering
 */
export async function resolveBrandingSettingsFromTemplate(fileEntity, systemSettings = null) {
  // Get the appropriate branding template
  const template = await resolveBrandingTemplate(fileEntity);

  if (!template) {
    return getDefaultBrandingSettings();
  }

  // Start with template data
  let footerSettings = JSON.parse(JSON.stringify(template.template_data));

  // Apply file-specific overrides if they exist
  if (fileEntity.branding_settings && Object.keys(fileEntity.branding_settings).length > 0) {
    footerSettings = fileEntity.mergeWithTemplateData(footerSettings);
  }

  // CRITICAL FIX: Merge system settings to populate copyright text
  if (systemSettings) {
    // Extract copyright text from system settings - use correct field name
    const copyrightText = systemSettings?.copyright_text || '';

    // Merge copyright text into template text element
    if (footerSettings.text) {
      footerSettings.text.content = copyrightText;
    }
  }

  // Always ensure the standard logo path is used (security/consistency)
  if (footerSettings.logo) {
    footerSettings.logo.url = path.join(process.cwd(), 'assets', 'images', 'logo.png');
  }

  return footerSettings;
}

/**
 * Resolve branding settings with legacy Settings fallback
 * This function bridges the old and new systems during transition
 *
 * @param {Object} fileEntity - File entity from database
 * @param {Object} legacySettings - Legacy Settings entity (optional)
 * @returns {Promise<Object>} Complete branding settings ready for PDF rendering
 */
export async function resolveBrandingSettingsWithFallback(fileEntity, legacySettings = null) {
  console.log('🔍 resolveBrandingSettingsWithFallback called with:');
  console.log('- fileEntity:', {
    id: fileEntity?.id,
    title: fileEntity?.title,
    branding_template_id: fileEntity?.branding_template_id,
    branding_settings: fileEntity?.branding_settings,
    target_format: fileEntity?.target_format
  });
  console.log('- legacySettings:', {
    id: legacySettings?.id,
    copyright_text: legacySettings?.copyright_text
  });

  // Try new branding template system first
  try {
    const template = await resolveBrandingTemplate(fileEntity);
    console.log('- resolveBrandingTemplate result:', template ? 'found template' : 'no template');
    if (template) {
      // CRITICAL FIX: Pass system settings to template resolver to populate copyright text
      const result = await resolveBrandingSettingsFromTemplate(fileEntity, legacySettings);
      console.log('✅ Using template-based branding settings');
      return result;
    }
  } catch (error) {
    console.log('⚠️ Template resolution failed:', error.message);
  }

  if (legacySettings) {
    console.log('✅ Using legacy branding settings via mergeFooterSettings');
    const result = mergeFooterSettings(fileEntity.branding_settings, legacySettings);
    console.log('- merged result text content:', result?.text?.content || 'NO TEXT CONTENT');
    return result;
  }

  console.log('⚠️ Falling back to default branding settings');
  return getDefaultBrandingSettings();
}

