import path from 'path';
import models from '../models/index.js';

/**
 * Get default branding settings structure using unified format
 * Used when no branding settings exist in database
 *
 * @returns {Object} Default branding configuration in unified structure
 */
export function getDefaultBrandingSettings() {
  return {
    elements: {
      logo: [
        {
          id: 'default-logo-1',
          type: 'logo',
          visible: true,
          deletable: true,
          position: { x: 50, y: 95 },
          style: {
            size: 80,
            opacity: 100,
            rotation: 0
          }
        }
      ],
      'copyright-text': [
        {
          id: 'default-copyright-1',
          type: 'copyright-text',
          visible: true,
          deletable: true,
          content: '', // Will be populated from system settings
          position: { x: 50, y: 90 },
          style: {
            fontSize: 12,
            color: '#000000',
            bold: false,
            italic: false,
            opacity: 80,
            width: 300,
            rotation: 0
          }
        }
      ],
      url: [
        {
          id: 'default-url-1',
          type: 'url',
          visible: true,
          deletable: true,
          content: '${FRONTEND_URL}', // Use variable that resolves to correct URL
          href: '${FRONTEND_URL}',
          position: { x: 85, y: 85 },
          style: {
            fontSize: 12,
            color: '#0066cc',
            bold: false,
            italic: false,
            opacity: 100,
            rotation: 45
          }
        }
      ]
    },
    globalSettings: {}
  };
}

/**
 * Merge file-specific footer settings with system defaults using unified structure
 * File settings control positioning and styling
 * System settings control content (text, logo URL)
 *
 * @param {Object} fileFooterSettings - Footer settings from File entity (can be null)
 * @param {Object} systemSettings - System settings object
 * @returns {Object} Complete footer settings ready for PDF rendering in unified structure
 */
export function mergeFooterSettings(fileFooterSettings, systemSettings) {
  // Get base settings (file-specific or defaults) in unified structure
  const baseSettings = fileFooterSettings || getDefaultBrandingSettings();

  // Extract system values - use correct field name from Settings model
  const copyrightText = systemSettings?.copyright_text || '';

  // Deep clone base settings to avoid mutation
  const mergedSettings = JSON.parse(JSON.stringify(baseSettings));

  // Update copyright text in all copyright-text elements
  if (mergedSettings.elements?.['copyright-text']) {
    mergedSettings.elements['copyright-text'].forEach(element => {
      element.content = copyrightText;
    });
  }

  // Ensure globalSettings exists
  mergedSettings.globalSettings = mergedSettings.globalSettings || {};

  return mergedSettings;
}

/**
 * Extract copyright text from unified footer settings for backwards compatibility
 * Used to populate the legacy copyright_footer_text field
 *
 * @param {Object} footerSettings - Unified footer settings object
 * @returns {string} Copyright text or empty string
 */
export function extractCopyrightText(footerSettings) {
  if (!footerSettings?.elements?.['copyright-text']) return '';
  const copyrightElements = footerSettings.elements['copyright-text'];
  if (Array.isArray(copyrightElements) && copyrightElements.length > 0) {
    return copyrightElements[0]?.content || '';
  }
  return '';
}

/**
 * Update unified footer settings with new copyright text
 * Ensures all copyright-text elements are updated
 *
 * @param {Object} brandingSettings - Existing unified branding settings (can be null)
 * @param {string} copyrightText - New copyright text
 * @returns {Object} Updated unified branding settings
 */
export function updateBrandingTextContent(brandingSettings, copyrightText) {
  const settings = brandingSettings || getDefaultBrandingSettings();
  const updatedSettings = JSON.parse(JSON.stringify(settings));

  // Update all copyright-text elements
  if (updatedSettings.elements?.['copyright-text']) {
    updatedSettings.elements['copyright-text'].forEach(element => {
      element.content = copyrightText;
    });
  }

  return updatedSettings;
}

// Note: Legacy structure support has been removed - only unified structure is supported

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
 * Uses unified structure only - legacy structure support removed
 *
 * @param {Object} fileEntity - File entity from database
 * @param {Object} configurationSettings - Configuration settings object (optional)
 * @returns {Promise<Object>} Complete branding settings ready for PDF rendering in unified structure
 */
export async function resolveBrandingSettingsFromTemplate(fileEntity, configurationSettings = null) {
  // Get the appropriate branding template
  const template = await resolveBrandingTemplate(fileEntity);

  if (!template) {
    return getDefaultBrandingSettings();
  }

  // Start with template data (must be unified structure)
  let brandingSettings = JSON.parse(JSON.stringify(template.template_data));

  // Ensure unified structure
  if (!brandingSettings.elements) {
    console.warn('Template does not have unified structure - using defaults');
    return getDefaultBrandingSettings();
  }

  // Apply file-specific overrides if they exist
  if (fileEntity.branding_settings && Object.keys(fileEntity.branding_settings).length > 0) {
    // Merge file settings with template settings
    brandingSettings = mergeFooterSettings(brandingSettings, fileEntity.branding_settings);
  }

  // Merge configuration settings to populate copyright text
  if (configurationSettings?.copyright_text) {
    const copyrightText = configurationSettings.copyright_text;

    // Update all copyright-text elements
    if (brandingSettings.elements?.['copyright-text']) {
      brandingSettings.elements['copyright-text'].forEach(element => {
        element.content = copyrightText;
      });
    }
  }

  // Ensure globalSettings exists
  brandingSettings.globalSettings = brandingSettings.globalSettings || {};

  return brandingSettings;
}

/**
 * Resolve branding settings using proper priority order
 * Implements the correct template resolution flow with Configuration system
 *
 * @param {Object} fileEntity - File entity from database
 * @param {Object} configurationSettings - Configuration settings object (optional)
 * @returns {Promise<Object>} Complete branding settings ready for PDF rendering
 */
export async function resolveBrandingSettingsWithFallback(fileEntity, configurationSettings = null) {
  console.log('🔍 Resolving branding template for file:', fileEntity?.id);
  console.log('- File details:', {
    id: fileEntity?.id,
    title: fileEntity?.title,
    branding_template_id: fileEntity?.branding_template_id,
    has_branding_settings: !!(fileEntity?.branding_settings && Object.keys(fileEntity.branding_settings).length > 0),
    target_format: fileEntity?.target_format
  });

  // PRIORITY 1: Check if file has custom branding_settings
  if (fileEntity?.branding_settings && Object.keys(fileEntity.branding_settings).length > 0) {
    console.log('✅ Using file-specific branding_settings');
    console.log('- branding_settings content:', Object.keys(fileEntity.branding_settings));

    // Apply copyright text from Configuration settings
    let result = JSON.parse(JSON.stringify(fileEntity.branding_settings));
    if (configurationSettings?.copyright_text && result.elements?.['copyright-text']) {
      result.elements['copyright-text'].forEach(element => {
        element.content = configurationSettings.copyright_text;
      });
      console.log('- Applied copyright text from Configuration settings');
    }

    return result;
  }

  // PRIORITY 2: Check if file has branding_template_id
  if (fileEntity?.branding_template_id) {
    try {
      const template = await models.SystemTemplate.findByPk(fileEntity.branding_template_id);
      if (template) {
        console.log('✅ Using template by ID:', template.id, '-', template.name);
        const result = await resolveBrandingSettingsFromTemplate(fileEntity, configurationSettings);
        return result;
      } else {
        console.log('⚠️ Template ID not found in database:', fileEntity.branding_template_id);
      }
    } catch (error) {
      console.log('⚠️ Error fetching template by ID:', error.message);
    }
  }

  // PRIORITY 3: Look for default template by type + target_format
  const targetFormat = fileEntity?.target_format || 'pdf-a4-landscape';
  console.log('- Looking for default branding template for format:', targetFormat);

  try {
    const defaultTemplate = await models.SystemTemplate.findDefaultByType('branding', targetFormat);
    if (defaultTemplate) {
      console.log('✅ Using default template:', defaultTemplate.id, '-', defaultTemplate.name, 'for format:', targetFormat);
      const result = await resolveBrandingSettingsFromTemplate(fileEntity, configurationSettings);
      return result;
    } else {
      console.log('⚠️ No default template found for branding + format:', targetFormat);
    }
  } catch (error) {
    console.log('⚠️ Error fetching default template:', error.message);
  }

  // PRIORITY 4: FAIL - No template configuration found
  console.log('❌ No branding template found for file:', fileEntity?.id);
  console.log('- No branding_settings');
  console.log('- No valid branding_template_id');
  console.log('- No default template for format:', targetFormat);

  throw new Error(`No branding template configured for file ${fileEntity?.id}. Please configure branding_settings, branding_template_id, or set a default template for format: ${targetFormat}`);
}

