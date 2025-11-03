import officeParser from 'officeparser';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

/**
 * Count slides in a PowerPoint file
 * @param {Buffer|string} fileData - File buffer or file path
 * @param {string} fileName - Original filename for extension detection
 * @returns {Promise<number>} - Number of slides found
 */
export async function countSlidesInPowerPoint(fileData, fileName) {
  console.log(`📊 Starting slide count for file: ${fileName}`);

  try {
    const fileExtension = path.extname(fileName).toLowerCase();

    // Check if it's a PowerPoint file
    if (!['.ppt', '.pptx'].includes(fileExtension)) {
      console.log(`⚠️ File ${fileName} is not a PowerPoint file (${fileExtension}), returning 0 slides`);
      return 0;
    }

    let tempFilePath = null;

    try {
      // If fileData is a Buffer, write it to a temporary file
      if (Buffer.isBuffer(fileData)) {
        const tempDir = '/tmp';
        const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}${fileExtension}`;
        tempFilePath = path.join(tempDir, tempFileName);

        console.log(`📊 Writing buffer to temp file: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, fileData);

        // Use the temp file path for parsing
        fileData = tempFilePath;
      }

      console.log(`📊 Parsing PowerPoint file: ${typeof fileData === 'string' ? fileData : 'buffer'}`);

      // Parse the PowerPoint file
      const parseFile = promisify(officeParser.parseOffice);
      const result = await parseFile(fileData);

      console.log(`📊 Raw parser result:`, typeof result === 'string' ? `${result.length} chars` : 'object');

      if (!result || typeof result !== 'string') {
        console.log(`❌ Failed to parse PowerPoint file or empty result`);
        return 0;
      }

      // Count slides by looking for slide markers in the parsed text
      // Different approaches based on file type
      let slideCount = 0;

      if (fileExtension === '.pptx') {
        // For PPTX files, look for slide XML markers or content
        const slideMarkers = [
          /slide\d+\.xml/gi,           // Direct slide file references
          /<p:sld\b/gi,                // PowerPoint slide elements
          /Slide \d+/gi,               // Slide title patterns
          /\n\s*\d+\s*\n/g            // Numbered slides in content
        ];

        for (const marker of slideMarkers) {
          const matches = result.match(marker);
          if (matches && matches.length > slideCount) {
            slideCount = matches.length;
          }
        }
      } else {
        // For older PPT files, look for different patterns
        const slideMarkers = [
          /Slide \d+/gi,
          /\f/g,                      // Form feed characters often separate slides
          /PowerPoint Document/gi
        ];

        for (const marker of slideMarkers) {
          const matches = result.match(marker);
          if (matches && matches.length > slideCount) {
            slideCount = matches.length;
          }
        }
      }

      // If no specific slide markers found, try to estimate from content structure
      if (slideCount === 0) {
        // Look for common slide transition indicators
        const contentBlocks = result.split(/\n\s*\n/).filter(block => block.trim().length > 20);
        slideCount = Math.max(1, Math.floor(contentBlocks.length / 3)); // Rough estimate
      }

      // Ensure minimum of 1 slide for valid PowerPoint files
      slideCount = Math.max(1, slideCount);

      console.log(`📊 Detected ${slideCount} slides in ${fileName}`);
      return slideCount;

    } finally {
      // Clean up temporary file if we created one
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`🧹 Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to clean up temp file ${tempFilePath}:`, cleanupError.message);
        }
      }
    }

  } catch (error) {
    console.error(`❌ Error counting slides in ${fileName}:`, error);

    // Return 1 as fallback for PowerPoint files (assume at least 1 slide)
    const fileExtension = path.extname(fileName).toLowerCase();
    if (['.ppt', '.pptx'].includes(fileExtension)) {
      console.log(`⚠️ Falling back to 1 slide for PowerPoint file: ${fileName}`);
      return 1;
    }

    return 0;
  }
}

/**
 * Calculate total slides from lesson plan file configs
 * @param {Object} fileConfigs - Lesson plan file_configs object
 * @returns {number} - Total slides from opening + body files
 */
export function calculateTotalSlides(fileConfigs) {
  if (!fileConfigs || !fileConfigs.files) {
    return 0;
  }

  let totalSlides = 0;

  for (const fileConfig of fileConfigs.files) {
    // Only count slides from opening and body files
    if (fileConfig.file_role === 'opening' || fileConfig.file_role === 'body') {
      const slideCount = fileConfig.slide_count || 0;
      totalSlides += slideCount;
      console.log(`📊 Adding ${slideCount} slides from ${fileConfig.file_role} file: ${fileConfig.filename}`);
    }
  }

  console.log(`📊 Total calculated slides: ${totalSlides}`);
  return totalSlides;
}