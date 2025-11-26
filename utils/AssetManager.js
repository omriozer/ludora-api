/**
 * Asset Manager for Template System
 *
 * Centralizes asset loading (logos, fonts) with configurable sources
 * and proper error handling/fallbacks
 */

import fs from 'fs';
import path from 'path';
import { TEMPLATE_CONFIG, getLogoConfig, getFontConfig, getUrlConfig } from '../config/templateConfig.js';
import { luderror } from '../lib/ludlog.js';

/**
 * Asset Manager class for handling template assets
 */
export class AssetManager {
  constructor() {
    this.fontCache = new Map();
    this.logoCache = new Map();
  }

  /**
   * Load logo asset with multiple source support
   * @param {Object} options - Logo loading options
   * @param {string} options.source - 'file', 'url', or 'base64'
   * @param {string} options.path - Custom path/URL for logo
   * @param {string} options.fallbackText - Text to use if logo fails
   * @returns {Promise<Object>} Logo asset data
   */
  async loadLogo(options = {}) {
    const config = getLogoConfig(options);
    const cacheKey = `${options.source || 'file'}-${options.path || config.path}`;

    // Check cache first
    if (this.logoCache.has(cacheKey)) {
      return this.logoCache.get(cacheKey);
    }

    let logoResult = null;

    try {
      switch (options.source) {
        case 'file':
        default:
          logoResult = await this._loadLogoFromFile(config);
          break;
        case 'url':
          logoResult = await this._loadLogoFromUrl(options.path);
          break;
        case 'base64':
          logoResult = await this._loadLogoFromBase64(options.path);
          break;
      }

      // Cache successful result
      if (logoResult && logoResult.data) {
        this.logoCache.set(cacheKey, logoResult);
      }

      return logoResult;
    } catch (error) {
      luderror.file('⚠️ Logo loading failed:', error.message);
      return this._getLogoFallback(config);
    }
  }

  /**
   * Load logo from file system
   * @private
   * @param {Object} config - Logo configuration
   * @returns {Promise<Object>} Logo data with metadata
   */
  async _loadLogoFromFile(config) {
    const logoPath = config.path;

    if (!fs.existsSync(logoPath)) {
      throw new Error(`Logo file not found: ${logoPath}`);
    }

    const logoData = fs.readFileSync(logoPath);
    const logoBuffer = Buffer.from(logoData);

    // Detect image type
    const imageType = this._detectImageType(logoBuffer);

    return {
      data: logoData,
      type: imageType,
      source: 'file',
      path: logoPath,
      fallback: false
    };
  }

  /**
   * Load logo from URL
   * @private
   * @param {string} url - Logo URL
   * @returns {Promise<Object>} Logo data with metadata
   */
  async _loadLogoFromUrl(url) {
    // Note: In a real implementation, you'd use fetch or similar
    throw new Error('URL logo loading not implemented yet');
  }

  /**
   * Load logo from base64 string
   * @private
   * @param {string} base64Data - Base64 encoded logo
   * @returns {Promise<Object>} Logo data with metadata
   */
  async _loadLogoFromBase64(base64Data) {
    if (!base64Data || !base64Data.startsWith('data:')) {
      throw new Error('Invalid base64 data format');
    }

    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    const imageType = this._detectImageType(buffer);

    return {
      data: buffer,
      type: imageType,
      source: 'base64',
      path: 'base64',
      fallback: false
    };
  }

  /**
   * Get logo fallback when loading fails
   * @private
   * @param {Object} config - Logo configuration
   * @returns {Object} Fallback logo configuration
   */
  _getLogoFallback(config) {
    return {
      data: null,
      type: 'text',
      source: 'fallback',
      text: config.fallbackText,
      color: config.fallbackColor,
      fallback: true
    };
  }

  /**
   * Detect image type from buffer
   * @private
   * @param {Buffer} buffer - Image buffer
   * @returns {string} Image type ('png', 'jpeg', or 'unknown')
   */
  _detectImageType(buffer) {
    // PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }
    // JPEG signature
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }
    return 'unknown';
  }

  /**
   * Load fonts for PDF embedding
   * @param {Object} pdfDoc - PDF document instance
   * @param {Array<string>} languages - Languages to load fonts for ('english', 'hebrew')
   * @returns {Promise<Object>} Font collections by language
   */
  async loadFonts(pdfDoc, languages = ['english', 'hebrew']) {
    const fonts = {
      english: {},
      hebrew: {}
    };

    for (const language of languages) {
      try {
        fonts[language] = await this._loadLanguageFonts(pdfDoc, language);
      } catch (error) {
        luderror.file(`⚠️ Failed to load ${language} fonts:`, error.message);
        fonts[language] = {};
      }
    }

    return fonts;
  }

  /**
   * Load fonts for a specific language
   * @private
   * @param {Object} pdfDoc - PDF document instance
   * @param {string} language - Language to load fonts for
   * @returns {Promise<Object>} Font collection for the language
   */
  async _loadLanguageFonts(pdfDoc, language) {
    const fontConfig = getFontConfig(language);
    const fonts = {};

    for (const [variant, fontPath] of Object.entries(fontConfig)) {
      try {
        if (fs.existsSync(fontPath)) {
          const fontBytes = fs.readFileSync(fontPath);
          fonts[variant] = await pdfDoc.embedFont(fontBytes);
        } else {
          luderror.file(`⚠️ Font file not found: ${fontPath}`);
        }
      } catch (embedError) {
        luderror.file(`⚠️ Failed to embed ${language} ${variant} font:`, embedError.message);
      }
    }

    return fonts;
  }


  /**
   * Clear caches
   */
  clearCache() {
    this.fontCache.clear();
    this.logoCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      fonts: this.fontCache.size,
      logos: this.logoCache.size
    };
  }
}

// Create singleton instance
export const assetManager = new AssetManager();

/**
 * Convenience functions for common operations
 */

/**
 * Load logo using the global asset manager
 * @param {Object} options - Logo loading options
 * @returns {Promise<Object>} Logo asset data
 */
export function loadLogo(options = {}) {
  return assetManager.loadLogo(options);
}

/**
 * Load fonts using the global asset manager
 * @param {Object} pdfDoc - PDF document instance
 * @param {Array<string>} languages - Languages to load
 * @returns {Promise<Object>} Font collections
 */
export function loadFonts(pdfDoc, languages = ['english', 'hebrew']) {
  return assetManager.loadFonts(pdfDoc, languages);
}


export default AssetManager;