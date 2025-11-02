/**
 * File Metadata Enhancer
 *
 * Provides comprehensive file metadata extraction and integrity verification
 * including checksum calculation, file analysis, and validation metadata.
 */

import crypto from 'crypto';
import sharp from 'sharp';
import { createErrorResponse } from './fileOperationLogger.js';

/**
 * File Metadata Enhancer Class
 */
class FileMetadataEnhancer {
  constructor(logger = null) {
    this.logger = logger;
  }

  /**
   * Calculate file checksum (SHA-256)
   * @param {Buffer} buffer - File buffer
   * @returns {Object} Checksum data
   */
  calculateChecksum(buffer) {
    try {
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');

      this.logger?.info('File checksums calculated', {
        sha256: sha256Hash.substring(0, 16) + '...',
        md5: md5Hash.substring(0, 16) + '...',
        bufferSize: buffer.length
      });

      return {
        sha256: sha256Hash,
        md5: md5Hash,
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error(error, { stage: 'checksum_calculation' });
      throw new Error(`Failed to calculate file checksum: ${error.message}`);
    }
  }

  /**
   * Extract image metadata using Sharp
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimeType - MIME type
   * @returns {Promise<Object>} Image metadata
   */
  async extractImageMetadata(buffer, mimeType) {
    try {
      const metadata = await sharp(buffer).metadata();

      const imageData = {
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        format: metadata.format,
        colorSpace: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };

      this.logger?.info('Image metadata extracted', {
        dimensions: `${metadata.width}x${metadata.height}`,
        format: metadata.format,
        size: buffer.length
      });

      return {
        type: 'image',
        metadata: imageData,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.warn('Failed to extract image metadata', {
        error: error.message,
        mimeType,
        bufferSize: buffer.length
      });

      return {
        type: 'image',
        metadata: {
          error: 'Failed to extract image metadata',
          fallback: true
        },
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract basic video metadata
   * @param {Buffer} buffer - Video buffer
   * @param {string} mimeType - MIME type
   * @returns {Object} Video metadata
   */
  extractVideoMetadata(buffer, mimeType) {
    // Note: For full video metadata extraction, we'd need ffprobe or similar
    // For now, return basic metadata that can be expanded later

    this.logger?.info('Video metadata extraction (basic)', {
      mimeType,
      bufferSize: buffer.length
    });

    return {
      type: 'video',
      metadata: {
        format: mimeType,
        estimatedBitrate: Math.round((buffer.length * 8) / 1000), // Rough estimate in kbps
        note: 'Enhanced video metadata requires ffprobe integration'
      },
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Extract document metadata
   * @param {Buffer} buffer - Document buffer
   * @param {string} mimeType - MIME type
   * @param {string} filename - Original filename
   * @returns {Object} Document metadata
   */
  extractDocumentMetadata(buffer, mimeType, filename) {
    this.logger?.info('Document metadata extraction (basic)', {
      mimeType,
      filename,
      bufferSize: buffer.length
    });

    const fileExtension = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];

    return {
      type: 'document',
      metadata: {
        format: mimeType,
        extension: fileExtension,
        pageCount: null, // Would require PDF parsing for actual count
        note: 'Enhanced document metadata requires specialized parsers'
      },
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Comprehensive file analysis
   * @param {Object} file - Multer file object or file data
   * @param {string} assetType - Type of asset
   * @returns {Promise<Object>} Complete file metadata
   */
  async analyzeFile(file, assetType) {
    try {
      this.logger?.info('Starting comprehensive file analysis', {
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size || file.buffer?.length,
        assetType
      });

      const buffer = file.buffer;
      const startTime = Date.now();

      // Calculate checksums (always done for integrity)
      const checksums = this.calculateChecksum(buffer);

      // Extract content-specific metadata based on file type
      let contentMetadata = {};

      if (file.mimetype.startsWith('image/')) {
        contentMetadata = await this.extractImageMetadata(buffer, file.mimetype);
      } else if (file.mimetype.startsWith('video/')) {
        contentMetadata = this.extractVideoMetadata(buffer, file.mimetype);
      } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('word')) {
        contentMetadata = this.extractDocumentMetadata(buffer, file.mimetype, file.originalname);
      } else {
        contentMetadata = {
          type: 'other',
          metadata: {
            format: file.mimetype,
            note: 'Generic file - no specialized metadata extraction'
          },
          extractedAt: new Date().toISOString()
        };
      }

      const analysisTime = Date.now() - startTime;

      // Compile comprehensive metadata
      const enhancedMetadata = {
        basic: {
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: buffer.length,
          assetType
        },
        integrity: {
          sha256: checksums.sha256,
          md5: checksums.md5,
          verified: true,
          calculatedAt: checksums.calculatedAt
        },
        content: contentMetadata,
        analysis: {
          version: '1.0',
          analysisTime: `${analysisTime}ms`,
          completedAt: new Date().toISOString()
        }
      };

      this.logger?.info('File analysis completed successfully', {
        fileName: file.originalname,
        analysisTime: `${analysisTime}ms`,
        sha256Preview: checksums.sha256.substring(0, 16) + '...',
        contentType: contentMetadata.type
      });

      return {
        success: true,
        metadata: enhancedMetadata
      };

    } catch (error) {
      this.logger?.error(error, {
        stage: 'file_analysis',
        fileName: file.originalname,
        assetType
      });

      return {
        success: false,
        error: createErrorResponse(
          'File analysis failed',
          `Failed to analyze file metadata: ${error.message}`,
          {
            fileName: file.originalname,
            assetType,
            details: error.message
          }
        ),
        metadata: {
          basic: {
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.buffer?.length || 0,
            assetType
          },
          integrity: {
            error: 'Checksum calculation failed',
            verified: false
          },
          analysis: {
            failed: true,
            error: error.message,
            failedAt: new Date().toISOString()
          }
        }
      };
    }
  }

  /**
   * Verify file integrity using stored checksum
   * @param {Buffer} buffer - File buffer to verify
   * @param {string} expectedSha256 - Expected SHA-256 checksum
   * @returns {Object} Verification result
   */
  verifyFileIntegrity(buffer, expectedSha256) {
    try {
      const calculatedChecksum = this.calculateChecksum(buffer);
      const isValid = calculatedChecksum.sha256 === expectedSha256;

      this.logger?.info('File integrity verification', {
        expected: expectedSha256.substring(0, 16) + '...',
        calculated: calculatedChecksum.sha256.substring(0, 16) + '...',
        isValid,
        bufferSize: buffer.length
      });

      return {
        valid: isValid,
        expected: expectedSha256,
        calculated: calculatedChecksum.sha256,
        verifiedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger?.error(error, { stage: 'integrity_verification' });

      return {
        valid: false,
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generate metadata summary for API responses
   * @param {Object} enhancedMetadata - Full enhanced metadata
   * @returns {Object} API-friendly metadata summary
   */
  generateMetadataSummary(enhancedMetadata) {
    return {
      fileName: enhancedMetadata.basic?.fileName,
      mimeType: enhancedMetadata.basic?.mimeType,
      size: enhancedMetadata.basic?.size,
      sha256: enhancedMetadata.integrity?.sha256,
      contentType: enhancedMetadata.content?.type,
      dimensions: enhancedMetadata.content?.metadata?.dimensions,
      verified: enhancedMetadata.integrity?.verified,
      analyzedAt: enhancedMetadata.analysis?.completedAt
    };
  }
}

/**
 * Factory function to create file metadata enhancer
 * @param {Object} logger - Optional logger instance
 * @returns {FileMetadataEnhancer} Enhancer instance
 */
export function createFileMetadataEnhancer(logger = null) {
  return new FileMetadataEnhancer(logger);
}

/**
 * Quick file analysis helper
 * @param {Object} file - File object
 * @param {string} assetType - Asset type
 * @param {Object} logger - Optional logger
 * @returns {Promise<Object>} Analysis result
 */
export async function quickAnalyzeFile(file, assetType, logger = null) {
  const enhancer = createFileMetadataEnhancer(logger);
  return await enhancer.analyzeFile(file, assetType);
}

export default FileMetadataEnhancer;