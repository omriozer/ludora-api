/**
 * Font Selector for Template System
 *
 * Centralizes font selection logic with Hebrew/English detection,
 * italic handling, and proper fallbacks
 */

import { TEMPLATE_CONFIG } from '../config/templateConfig.js';
import { ludlog } from '../lib/ludlog.js';

/**
 * Font Selector class for handling template font selection
 */
export class FontSelector {
  /**
   * Create a font selector
   * @param {Object} standardFonts - Standard PDF fonts (Helvetica family)
   * @param {Object} customFonts - Custom fonts (Inter, NotoSansHebrew)
   */
  constructor(standardFonts, customFonts) {
    this.standardFonts = standardFonts || {};
    this.customFonts = customFonts || { english: {}, hebrew: {} };
  }

  /**
   * Select the best font for given content and style
   * @param {string} content - Text content to analyze
   * @param {Object} style - Text style options
   * @param {boolean} style.bold - Whether text should be bold
   * @param {boolean} style.italic - Whether text should be italic
   * @returns {Object} Selected font information
   */
  selectFont(content, style = {}) {
    const { bold = false, italic = false } = style;

    // Detect content language
    const hasHebrew = this.containsHebrew(content);
    const isMixedContent = hasHebrew && this.containsLatin(content);

    if (hasHebrew) {
      return this._selectHebrewFont(bold, italic, isMixedContent);
    } else {
      return this._selectEnglishFont(bold, italic);
    }
  }

  /**
   * Select font for Hebrew content
   * @private
   * @param {boolean} bold - Whether text should be bold
   * @param {boolean} italic - Whether text should be italic
   * @param {boolean} isMixed - Whether content has mixed languages
   * @returns {Object} Selected font information
   */
  _selectHebrewFont(bold, italic, isMixed) {
    // Hebrew fonts (NotoSansHebrew) do not support italic
    // Always prioritize Hebrew character support over italic styling

    if (this.customFonts.hebrew && this.customFonts.hebrew.regular) {
      const selectedFont = bold && this.customFonts.hebrew.bold
        ? this.customFonts.hebrew.bold
        : this.customFonts.hebrew.regular;

      return {
        font: selectedFont,
        fontFamily: 'NotoSansHebrew',
        language: 'hebrew',
        actualStyle: { bold, italic: false }, // Force italic off for Hebrew
        fallback: false,
        warning: italic ? 'Italic disabled for Hebrew font compatibility' : null
      };
    }

    // Hebrew fonts unavailable - fall back to standard fonts
    // This will likely fail for Hebrew characters, but try anyway
    // TODO .prod
    ludlog.file('⚠️ Warning: Using Helvetica for Hebrew text - may fail to render Hebrew characters');

    return this._selectStandardFont(bold, italic, 'hebrew-fallback');
  }

  /**
   * Select font for English/Latin content
   * @private
   * @param {boolean} bold - Whether text should be bold
   * @param {boolean} italic - Whether text should be italic
   * @returns {Object} Selected font information
   */
  _selectEnglishFont(bold, italic) {
    // Prefer custom English fonts (Inter) if available
    if (this.customFonts.english && this.customFonts.english.regular) {
      const selectedFont = this._selectFromCustomEnglish(bold, italic);
      if (selectedFont) {
        return {
          font: selectedFont,
          fontFamily: 'Inter',
          language: 'english',
          actualStyle: { bold, italic },
          fallback: false,
          warning: null
        };
      }
    }

    // Fall back to standard fonts
    return this._selectStandardFont(bold, italic, 'english');
  }

  /**
   * Select from custom English fonts (Inter)
   * @private
   * @param {boolean} bold - Whether text should be bold
   * @param {boolean} italic - Whether text should be italic
   * @returns {Object|null} Selected font or null if not available
   */
  _selectFromCustomEnglish(bold, italic) {
    const englishFonts = this.customFonts.english;

    // Note: Inter fonts may not have all style variants
    if (bold && italic && englishFonts.boldItalic) {
      return englishFonts.boldItalic;
    }
    if (bold && englishFonts.bold) {
      return englishFonts.bold;
    }
    if (italic && englishFonts.italic) {
      return englishFonts.italic;
    }
    if (englishFonts.regular) {
      return englishFonts.regular;
    }

    return null;
  }

  /**
   * Select from standard fonts (Helvetica family)
   * @private
   * @param {boolean} bold - Whether text should be bold
   * @param {boolean} italic - Whether text should be italic
   * @param {string} reason - Reason for using standard fonts
   * @returns {Object} Selected font information
   */
  _selectStandardFont(bold, italic, reason) {
    if (!this.standardFonts.regular) {
      throw new Error('No fonts available - cannot render text');
    }

    let selectedFont;

    if (bold && italic && this.standardFonts.boldItalic) {
      selectedFont = this.standardFonts.boldItalic;
    } else if (bold && this.standardFonts.bold) {
      selectedFont = this.standardFonts.bold;
    } else if (italic && this.standardFonts.italic) {
      selectedFont = this.standardFonts.italic;
    } else {
      selectedFont = this.standardFonts.regular;
    }

    return {
      font: selectedFont,
      fontFamily: 'Helvetica',
      language: reason.includes('hebrew') ? 'hebrew' : 'english',
      actualStyle: { bold, italic },
      fallback: true,
      warning: reason === 'hebrew-fallback'
        ? 'May fail to render Hebrew characters with Helvetica'
        : null
    };
  }

  /**
   * Check if text contains Hebrew characters
   * @param {string} text - Text to check
   * @returns {boolean} True if contains Hebrew
   */
  containsHebrew(text) {
    if (!text) return false;
    // Hebrew Unicode range: \u0590-\u05FF
    return /[\u0590-\u05FF]/.test(text);
  }

  /**
   * Check if text contains Latin characters
   * @param {string} text - Text to check
   * @returns {boolean} True if contains Latin characters
   */
  containsLatin(text) {
    if (!text) return false;
    // Basic Latin and Latin-1 Supplement: \u0000-\u00FF
    // Extended to include common punctuation and numbers
    return /[A-Za-z0-9@.com]/.test(text);
  }

  /**
   * Get font fallback chain for a language
   * @param {string} language - 'english' or 'hebrew'
   * @returns {Array<string>} Ordered list of font families to try
   */
  getFontFallbacks(language) {
    return TEMPLATE_CONFIG.system.fontFallbacks[language] || ['Helvetica'];
  }

  /**
   * Validate font style compatibility
   * @param {string} content - Text content
   * @param {Object} style - Requested style
   * @returns {Object} Validated style with warnings
   */
  validateStyle(content, style) {
    const hasHebrew = this.containsHebrew(content);
    const validatedStyle = { ...style };
    const warnings = [];

    // Hebrew fonts don't support italic
    if (hasHebrew && style.italic) {
      validatedStyle.italic = false;
      warnings.push('Italic styling disabled for Hebrew text compatibility');
    }

    // Check if requested font variants are available
    if (style.bold && !this._hasBoldVariant(hasHebrew ? 'hebrew' : 'english')) {
      warnings.push('Bold font variant not available, using regular weight');
    }

    if (style.italic && !this._hasItalicVariant('english') && !hasHebrew) {
      warnings.push('Italic font variant not available, using regular style');
    }

    return {
      style: validatedStyle,
      warnings
    };
  }

  /**
   * Check if bold variant is available for language
   * @private
   * @param {string} language - 'english' or 'hebrew'
   * @returns {boolean} True if bold variant exists
   */
  _hasBoldVariant(language) {
    if (language === 'hebrew') {
      return !!(this.customFonts.hebrew?.bold || this.standardFonts.bold);
    } else {
      return !!(this.customFonts.english?.bold || this.standardFonts.bold);
    }
  }

  /**
   * Check if italic variant is available for language
   * @private
   * @param {string} language - 'english' or 'hebrew'
   * @returns {boolean} True if italic variant exists
   */
  _hasItalicVariant(language) {
    if (language === 'hebrew') {
      return false; // Hebrew fonts don't support italic
    } else {
      return !!(this.customFonts.english?.italic || this.standardFonts.italic);
    }
  }

  /**
   * Get font information for debugging
   * @returns {Object} Font availability information
   */
  getFontInfo() {
    return {
      standardFonts: Object.keys(this.standardFonts),
      customFonts: {
        english: Object.keys(this.customFonts.english),
        hebrew: Object.keys(this.customFonts.hebrew)
      },
      fallbacks: TEMPLATE_CONFIG.system.fontFallbacks
    };
  }

  /**
   * Create a new font selector with updated fonts
   * @param {Object} standardFonts - Updated standard fonts
   * @param {Object} customFonts - Updated custom fonts
   * @returns {FontSelector} New font selector instance
   */
  withFonts(standardFonts, customFonts) {
    return new FontSelector(standardFonts, customFonts);
  }
}

/**
 * Create font selector from loaded fonts
 * @param {Object} standardFonts - Standard PDF fonts
 * @param {Object} customFonts - Custom fonts by language
 * @returns {FontSelector} Font selector instance
 */
export function createFontSelector(standardFonts, customFonts) {
  return new FontSelector(standardFonts, customFonts);
}

/**
 * Quick font selection utility function
 * @param {string} content - Text content
 * @param {Object} style - Text style
 * @param {Object} standardFonts - Standard fonts
 * @param {Object} customFonts - Custom fonts
 * @returns {Object} Selected font information
 */
export function selectFont(content, style, standardFonts, customFonts) {
  const selector = new FontSelector(standardFonts, customFonts);
  return selector.selectFont(content, style);
}

export default FontSelector;