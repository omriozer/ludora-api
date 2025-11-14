/**
 * Slide Counting Utilities for Lesson Plan Presentations
 *
 * These utilities handle slide counting for PowerPoint files and
 * total slide calculation for lesson plan file configurations.
 */

/**
 * Count slides in a PowerPoint file buffer
 *
 * @param {Buffer} fileBuffer - The PowerPoint file buffer
 * @param {string} fileName - The filename for logging purposes
 * @returns {Promise<number>} Number of slides found in the PowerPoint file
 */
export async function countSlidesInPowerPoint(fileBuffer, fileName) {
  try {
    // TODO: Implement actual PowerPoint slide counting
    // This would require a library like 'officegen' or 'pptx-parser'
    // For now, return a placeholder value to prevent runtime errors

    // Estimate based on file size (very rough approximation)
    // A typical slide in a PowerPoint file is roughly 50-200KB
    const estimatedSlides = Math.max(1, Math.floor(fileBuffer.length / (100 * 1024)));
    const cappedEstimate = Math.min(estimatedSlides, 50); // Cap at 50 slides

    return cappedEstimate;

  } catch (error) {
    return 1; // Default to 1 slide if counting fails
  }
}

/**
 * Calculate total slides from lesson plan file configurations
 *
 * @param {Object} fileConfigs - The lesson plan's file_configs object
 * @returns {number} Total number of slides across all opening and body files
 */
export function calculateTotalSlides(fileConfigs) {
  try {
    if (!fileConfigs || !fileConfigs.files || !Array.isArray(fileConfigs.files)) {
      return 0;
    }

    // Count slides from opening and body files only (presentation files)
    const presentationFiles = fileConfigs.files.filter(file =>
      file.file_role === 'opening' || file.file_role === 'body'
    );

    const totalSlides = presentationFiles.reduce((total, file) => {
      const slideCount = file.slide_count || 0;
      return total + slideCount;
    }, 0);

    // If we have presentation files but no slide count, assume at least 1 slide per file
    if (totalSlides === 0 && presentationFiles.length > 0) {
      return presentationFiles.length;
    }

    return totalSlides;

  } catch (error) {
    return 0; // Default to 0 if calculation fails
  }
}

/**
 * Validate and normalize slide count value
 *
 * @param {any} slideCount - The slide count value to validate
 * @returns {number} Validated slide count (always >= 0)
 */
export function validateSlideCount(slideCount) {
  if (typeof slideCount !== 'number' || isNaN(slideCount) || slideCount < 0) {
    return 0;
  }

  return Math.floor(slideCount); // Ensure integer value
}

/**
 * Get presentation summary from file configs
 *
 * @param {Object} fileConfigs - The lesson plan's file_configs object
 * @returns {Object} Summary with counts and details
 */
export function getPresentationSummary(fileConfigs) {
  try {
    if (!fileConfigs || !fileConfigs.files) {
      return {
        totalSlides: 0,
        openingFiles: 0,
        bodyFiles: 0,
        hasPresentation: false,
        presentationFiles: []
      };
    }

    const openingFiles = fileConfigs.files.filter(f => f.file_role === 'opening');
    const bodyFiles = fileConfigs.files.filter(f => f.file_role === 'body');
    const presentationFiles = [...openingFiles, ...bodyFiles];

    const totalSlides = calculateTotalSlides(fileConfigs);

    return {
      totalSlides,
      openingFiles: openingFiles.length,
      bodyFiles: bodyFiles.length,
      hasPresentation: presentationFiles.length > 0,
      presentationFiles: presentationFiles.map(f => ({
        id: f.file_id,
        filename: f.filename,
        role: f.file_role,
        slideCount: f.slide_count || 0,
        isAssetOnly: f.is_asset_only
      }))
    };

  } catch (error) {
    return {
      totalSlides: 0,
      openingFiles: 0,
      bodyFiles: 0,
      hasPresentation: false,
      presentationFiles: [],
      error: error.message
    };
  }
}