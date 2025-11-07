/**
 * Hebrew Filename Utilities
 *
 * Enhanced Hebrew filename handling utilities for Israeli users.
 * Provides comprehensive support for Hebrew filenames across different
 * browsers, operating systems, and download scenarios.
 *
 * Features:
 * - Advanced Hebrew character normalization
 * - RTL filename handling
 * - Hebrew-friendly fallback generation
 * - Content-Disposition optimization for Hebrew
 * - Cross-platform compatibility
 */

/**
 * Hebrew character ranges and patterns
 */
const HEBREW_PATTERNS = {
  // Hebrew Unicode ranges
  HEBREW_LETTERS: /[\u0590-\u05FF]/g, // Hebrew block
  HEBREW_POINTS: /[\u0591-\u05C7]/g, // Hebrew points (nikud)
  HEBREW_PUNCTUATION: /[\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4]/g, // Hebrew punctuation

  // Common Hebrew words that should be preserved
  COMMON_HEBREW_WORDS: [
    'קורס', 'שיעור', 'תרגיל', 'מטלה', 'פרויקט', 'מבחן', 'עבודה',
    'חלק', 'יחידה', 'סרטון', 'קובץ', 'תמונה', 'מסמך', 'טבלה',
    'דוגמה', 'תשובה', 'פתרון', 'הסבר', 'הוראות', 'מדריך'
  ]
};

/**
 * Hebrew text direction indicators
 */
const RTL_MARKERS = {
  RLM: '\u200F', // Right-to-Left Mark
  LRM: '\u200E', // Left-to-Right Mark
  RLO: '\u202E', // Right-to-Left Override
  LRO: '\u202D', // Left-to-Right Override
  PDF: '\u202C'  // Pop Directional Formatting
};

/**
 * Detect if filename contains Hebrew characters
 * @param {string} filename - Filename to check
 * @returns {boolean} True if contains Hebrew
 */
export function containsHebrew(filename) {
  if (!filename) return false;
  return HEBREW_PATTERNS.HEBREW_LETTERS.test(filename);
}

/**
 * Normalize Hebrew text in filename
 * Removes unnecessary diacritics and normalizes Hebrew characters
 * @param {string} filename - Original filename
 * @returns {string} Normalized filename
 */
export function normalizeHebrewFilename(filename) {
  if (!filename || !containsHebrew(filename)) {
    return filename;
  }

  return filename
    // Normalize Unicode (NFD -> NFC for Hebrew)
    .normalize('NFC')
    // Remove most Hebrew diacritics (nikud) for cleaner filenames
    .replace(/[\u0591-\u05C7]/g, '')
    // Normalize Hebrew punctuation
    .replace(/[\u05BE]/g, '-') // Hebrew punctuation Maqaf to dash
    .replace(/[\u05F3\u05F4]/g, "'") // Hebrew punctuation to apostrophe
    // Clean up directional markers that might cause issues
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate Hebrew-aware ASCII fallback filename
 * Creates a meaningful ASCII filename from Hebrew text
 * @param {string} filename - Hebrew filename
 * @returns {string} ASCII fallback filename
 */
export function generateHebrewAsciiFallback(filename) {
  if (!filename) return 'file';

  // If no Hebrew, return normalized version
  if (!containsHebrew(filename)) {
    return filename
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  // Transliterate common Hebrew words
  let transliterated = filename;

  const hebrewToLatin = {
    'קורס': 'course',
    'שיעור': 'lesson',
    'תרגיל': 'exercise',
    'מטלה': 'assignment',
    'פרויקט': 'project',
    'מבחן': 'exam',
    'עבודה': 'work',
    'חלק': 'part',
    'יחידה': 'unit',
    'סרטון': 'video',
    'קובץ': 'file',
    'תמונה': 'image',
    'מסמך': 'document',
    'דוגמה': 'example',
    'תשובה': 'answer',
    'פתרון': 'solution',
    'הסבר': 'explanation',
    'מדריך': 'guide',
    'הוראות': 'instructions'
  };

  // Replace known Hebrew words
  Object.entries(hebrewToLatin).forEach(([hebrew, latin]) => {
    const regex = new RegExp(hebrew, 'g');
    transliterated = transliterated.replace(regex, latin);
  });

  // Replace remaining Hebrew characters with placeholder
  transliterated = transliterated
    .replace(HEBREW_PATTERNS.HEBREW_LETTERS, 'he')
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  // Ensure we have something meaningful
  if (!transliterated || transliterated === 'he') {
    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
    return 'hebrew_file' + ext;
  }

  return transliterated;
}

/**
 * Enhanced Content-Disposition header for Hebrew filenames
 * Optimized for Israeli browsers and download scenarios
 * @param {string} disposition - 'attachment' or 'inline'
 * @param {string} filename - Original filename (may contain Hebrew)
 * @returns {string} Properly formatted Content-Disposition header
 */
export function generateHebrewContentDisposition(disposition, filename) {
  if (!filename) {
    return `${disposition}; filename="file"`;
  }

  // Normalize Hebrew filename
  const normalizedFilename = normalizeHebrewFilename(filename);

  // Generate Hebrew-aware ASCII fallback
  const asciiFallback = generateHebrewAsciiFallback(normalizedFilename);

  if (!containsHebrew(normalizedFilename)) {
    // No Hebrew - use standard encoding
    const encodedFilename = encodeURIComponent(normalizedFilename);
    return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
  }

  // Hebrew content - use enhanced encoding
  const encodedFilename = encodeURIComponent(normalizedFilename);

  // Add RTL marker for proper display in Hebrew-aware browsers
  const rtlFilename = RTL_MARKERS.RLM + normalizedFilename + RTL_MARKERS.RLM;
  const encodedRtlFilename = encodeURIComponent(rtlFilename);

  return [
    `${disposition}`,
    `filename="${asciiFallback}"`,
    `filename*=UTF-8''${encodedFilename}`,
    `filename*0*=UTF-8''${encodedRtlFilename}` // Extended parameter for RTL support
  ].join('; ');
}

/**
 * Validate Hebrew filename for S3 compatibility
 * Checks if filename is safe for S3 storage while preserving Hebrew
 * @param {string} filename - Filename to validate
 * @returns {Object} Validation result with suggestions
 */
export function validateHebrewFilenameForS3(filename) {
  if (!filename) {
    return {
      valid: false,
      issues: ['Empty filename'],
      suggested: 'file.dat'
    };
  }

  const issues = [];
  let suggested = filename;

  // Check length (S3 limit is 1024 bytes in UTF-8)
  const utf8Length = Buffer.byteLength(filename, 'utf8');
  if (utf8Length > 1000) { // Leave some margin
    issues.push('Filename too long for S3 (UTF-8 encoded)');
    suggested = filename.substring(0, 200) + '...' + (filename.includes('.') ? filename.split('.').pop() : '');
  }

  // Check for problematic characters
  const problematicChars = /[<>:"|?*\x00-\x1f\x7f]/g;
  if (problematicChars.test(filename)) {
    issues.push('Contains characters problematic for S3');
    suggested = suggested.replace(problematicChars, '_');
  }

  // Check for path separators
  if (/[/\\]/.test(filename)) {
    issues.push('Contains path separators');
    suggested = suggested.replace(/[/\\]/g, '_');
  }

  // Normalize suggested filename
  suggested = normalizeHebrewFilename(suggested);

  return {
    valid: issues.length === 0,
    issues,
    suggested,
    containsHebrew: containsHebrew(filename),
    utf8ByteLength: utf8Length
  };
}

/**
 * Generate Hebrew-safe S3 key component
 * Creates S3-compatible filename while preserving Hebrew readability
 * @param {string} filename - Original filename
 * @returns {string} S3-safe filename
 */
export function generateHebrewSafeS3Key(filename) {
  if (!filename) return 'file';

  const validation = validateHebrewFilenameForS3(filename);
  let safeFilename = validation.suggested;

  // Additional S3-specific cleanup
  safeFilename = safeFilename
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^[\s.-]+|[\s.-]+$/g, '') // Trim special chars
    .trim();

  // Ensure we have something
  if (!safeFilename) {
    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
    return containsHebrew(filename) ? 'hebrew_file' + ext : 'file' + ext;
  }

  return safeFilename;
}

/**
 * Hebrew filename metadata for logging and debugging
 * @param {string} filename - Filename to analyze
 * @returns {Object} Metadata about Hebrew filename
 */
export function getHebrewFilenameMetadata(filename) {
  if (!filename) {
    return {
      hasHebrew: false,
      hebrewCharCount: 0,
      rtlMarkers: 0,
      normalizedLength: 0,
      utf8ByteLength: 0
    };
  }

  const hebrewMatches = filename.match(HEBREW_PATTERNS.HEBREW_LETTERS) || [];
  const rtlMatches = filename.match(/[\u200E\u200F\u202A-\u202E]/g) || [];
  const normalized = normalizeHebrewFilename(filename);

  return {
    hasHebrew: containsHebrew(filename),
    hebrewCharCount: hebrewMatches.length,
    rtlMarkers: rtlMatches.length,
    normalizedLength: normalized.length,
    utf8ByteLength: Buffer.byteLength(filename, 'utf8'),
    normalized,
    asciiFallback: generateHebrewAsciiFallback(filename),
    s3Safe: generateHebrewSafeS3Key(filename)
  };
}

export default {
  containsHebrew,
  normalizeHebrewFilename,
  generateHebrewAsciiFallback,
  generateHebrewContentDisposition,
  validateHebrewFilenameForS3,
  generateHebrewSafeS3Key,
  getHebrewFilenameMetadata,
  HEBREW_PATTERNS,
  RTL_MARKERS
};