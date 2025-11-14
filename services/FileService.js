import AWS from 'aws-sdk';
import sharp from 'sharp';
import { generateId } from '../models/baseModel.js';
import models from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { constructS3Path } from '../utils/s3PathUtils.js';
import { createFileMetadataEnhancer } from '../utils/fileMetadataEnhancer.js';

class FileService {
  constructor() {
    this.s3 = null;
    this.localStoragePath = process.env.LOCAL_STORAGE_PATH || './uploads';
    this.useS3 = true;
    this.bucketName = process.env.AWS_S3_BUCKET;
    
    if (this.useS3) {
      this.initializeS3();
    } else {
      this.ensureLocalStorageDir();
    }
  }

  // Initialize AWS S3
  initializeS3() {
    try {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      this.s3 = new AWS.S3();
    } catch (error) {
      this.useS3 = false;
    }
  }

  // Ensure local storage directory exists
  ensureLocalStorageDir() {
    try {
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
    } catch (error) {
      // Fail silently for local storage directory creation
    }
  }

  // Extract data from uploaded file
  async extractDataFromUploadedFile({ file, extractionType = 'text' }) {
    try {
      this.validateFile(file);

      let extractedData = {
        type: 'unknown',
        message: 'Data extraction not implemented for this file type'
      };

      switch (file.mimetype) {
        case 'application/pdf':
          extractedData = await this.extractFromPDF(file);
          break;
        case 'image/jpeg':
        case 'image/png':
        case 'image/gif':
          extractedData = await this.extractFromImage(file);
          break;
        case 'text/csv':
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          extractedData = await this.extractFromSpreadsheet(file);
          break;
        case 'text/plain':
          extractedData = {
            type: 'text',
            content: file.buffer.toString('utf-8'),
            length: file.buffer.length
          };
          break;
        default:
          extractedData = {
            type: 'binary',
            message: `Binary file of type ${file.mimetype}`,
            size: file.buffer.length
          };
      }

      return {
        success: true,
        data: {
          fileId: generateId(),
          fileName: file.originalname,
          mimeType: file.mimetype,
          extractionType,
          extractedData,
          extractedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper methods for data extraction
  async extractFromPDF(file) {
    // TODO: Implement PDF parsing with pdf-parse or similar
    return {
      type: 'pdf',
      text: 'PDF text extraction not implemented yet',
      pages: 1,
      size: file.buffer.length,
      metadata: {
        title: 'Extracted PDF',
        author: 'Unknown'
      }
    };
  }

  async extractFromImage(file) {
    try {
      // Get image metadata using sharp
      const metadata = await sharp(file.buffer).metadata();
      
      return {
        type: 'image',
        ocrText: 'OCR text extraction not implemented yet',
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
        metadata: {
          format: file.mimetype,
          size: file.buffer.length
        }
      };
    } catch (error) {
      return {
        type: 'image',
        error: 'Failed to process image',
        metadata: { format: file.mimetype, size: file.buffer.length }
      };
    }
  }

  async extractFromSpreadsheet(file) {
    // TODO: Implement spreadsheet parsing with xlsx or csv-parse
    return {
      type: 'spreadsheet',
      message: 'Spreadsheet parsing not implemented yet',
      size: file.buffer.length,
      estimatedRows: Math.floor(file.buffer.length / 50), // rough estimate
      headers: ['Column1', 'Column2', 'Column3'],
      sample: []
    };
  }

  // File validation
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File is empty');
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.buffer.length > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/svg+xml', // SVG slides for presentations
      'application/pdf',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', // .ppt files (legacy support)
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx files (legacy support)
      'application/msword', // .doc files
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx files
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-ms-wmv'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }
  }

  // Get file extension from filename
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase().substring(1);
  }

  // Delete file
  async deleteFile({ fileId, filePath }) {
    try {
      // Delete from storage
      if (this.useS3 && this.s3 && filePath) {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: filePath
        }).promise();
      } else if (filePath) {
        const fullPath = path.join(this.localStoragePath, filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      // Delete from database if fileId provided
      if (fileId) {
        await models.AudioFile.destroy({ where: { id: fileId } });
      }

      return {
        success: true,
        message: 'File deleted successfully',
        data: { fileId, deleted: true }
      };
    } catch (error) {
      throw error;
    }
  }

  // Stream S3 object for public access (for marketing videos)
  async createS3Stream(s3Key, range = null) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured for streaming');
      }

      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      // Add range if provided (for HTTP range requests)
      if (range && range.start !== undefined && range.end !== undefined) {
        params.Range = `bytes=${range.start}-${range.end}`;
      }

      // Return the S3 stream object
      return this.s3.getObject(params).createReadStream();
    } catch (error) {
      throw error;
    }
  }

  // Download S3 object to buffer
  async downloadToBuffer(s3Key) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const data = await this.s3.getObject(params).promise();
      return data.Body; // Returns Buffer
    } catch (error) {
      throw error;
    }
  }

  // Get S3 object metadata
  async getS3ObjectMetadata(s3Key) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const metadata = await this.s3.headObject(params).promise();
      return {
        success: true,
        data: {
          size: metadata.ContentLength,
          contentType: metadata.ContentType,
          lastModified: metadata.LastModified,
          etag: metadata.ETag
        }
      };
    } catch (error) {
      throw error;
    }
  }



  // CONSOLIDATED UPLOAD METHODS

  /**
   * Upload Asset - Unified transaction-safe upload method
   *
   * Replaces: uploadFile, uploadFileEntity, uploadPublicFile, uploadPublicVideo, uploadPrivateVideo
   *
   * @param {Object} params - Upload parameters
   * @param {Object} params.file - Multer file object
   * @param {string} params.entityType - Type of entity (workshop, course, file, tool)
   * @param {string} params.entityId - ID of the entity
   * @param {string} params.assetType - Type of asset (document, image, marketing-video, content-video)
   * @param {string} params.userId - ID of uploading user
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {boolean} params.preserveOriginalName - Whether to preserve original filename (default: true for documents, false for others)
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Upload result with transaction safety
   */
  async uploadAsset({
    file,
    entityType,
    entityId,
    assetType,
    userId,
    transaction = null,
    preserveOriginalName = null,
    logger = null
  }) {
    try {
      // Validate file
      this.validateFile(file);
      logger?.info('File validation passed for unified upload', {
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        assetType
      });

      // Determine privacy level and filename handling
      const isPublic = assetType === 'marketing-video' || assetType === 'image';
      const shouldPreserveName = preserveOriginalName !== null
        ? preserveOriginalName
        : assetType === 'document';

      // Generate appropriate filename
      let filename;
      if (assetType === 'marketing-video' || assetType === 'content-video') {
        filename = 'video.mp4'; // Standardized video filename
      } else if (assetType === 'image') {
        filename = 'image.jpg'; // Standardized image filename
      } else if (shouldPreserveName) {
        filename = file.originalname; // Preserve original for documents
      } else {
        const extension = this.getFileExtension(file.originalname);
        filename = `${generateId()}.${extension}`; // Generate unique filename
      }

      // Construct S3 path using standardized utility
      const s3Key = constructS3Path(entityType, entityId, assetType, filename);
      logger?.info('S3 path constructed', { s3Key, filename, assetType });

      // Analyze file for enhanced metadata and checksums
      const metadataEnhancer = createFileMetadataEnhancer(logger);
      const fileAnalysis = await metadataEnhancer.analyzeFile(file, assetType);

      if (!fileAnalysis.success) {
        logger?.warn('File analysis failed, proceeding with basic metadata', {
          error: fileAnalysis.error?.message,
          fileName: file.originalname
        });
      }

      // Prepare enhanced metadata for S3
      // Encode originalName to Base64 to handle Hebrew and other Unicode characters
      const encodedOriginalName = Buffer.from(file.originalname, 'utf8').toString('base64');

      const metadata = {
        uploadedBy: userId,
        entityType,
        entityId,
        assetType,
        originalName: encodedOriginalName, // Base64 encoded to handle Hebrew characters
        originalNameEncoding: 'base64', // Indicate that the name is encoded
        uploadedAt: new Date().toISOString(),
        // Enhanced metadata fields
        sha256: fileAnalysis.metadata?.integrity?.sha256 || 'calculation_failed',
        md5: fileAnalysis.metadata?.integrity?.md5 || 'calculation_failed',
        contentType: fileAnalysis.metadata?.content?.type || 'unknown',
        analyzed: fileAnalysis.success ? 'true' : 'false'
      };

      // Upload to S3 with transaction safety
      const uploadResult = await this.uploadToS3WithTransaction({
        buffer: file.buffer,
        key: s3Key,
        contentType: file.mimetype,
        metadata,
        transaction,
        logger
      });

      if (!uploadResult.success) {
        throw new Error(`S3 upload failed: ${uploadResult.error}`);
      }

      logger?.info('S3 upload completed successfully', { s3Key, size: uploadResult.size });

      // For documents on File entities, update database within same transaction
      if (assetType === 'document' && entityType === 'file' && transaction) {
        try {
          const FileModel = models.File;
          const fileEntity = await FileModel.findByPk(entityId, { transaction });

          if (fileEntity) {
            await fileEntity.update({ file_name: filename }, { transaction });
            logger?.info('File entity updated with filename', { entityId, filename });
          } else {
            logger?.warn('File entity not found for filename update', { entityId });
          }
        } catch (dbError) {
          logger?.error('Database update failed during upload', { error: dbError.message });
          // Don't throw here - S3 upload succeeded, just log the DB issue
        }
      }

      // Return standardized upload result with enhanced metadata
      const result = {
        success: true,
        s3Key,
        filename,
        originalName: file.originalname,
        entityType,
        entityId,
        assetType,
        size: uploadResult.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        accessLevel: isPublic ? 'public' : 'private',
        url: uploadResult.url,
        etag: uploadResult.etag,
        // Enhanced metadata
        integrity: {
          sha256: fileAnalysis.metadata?.integrity?.sha256,
          md5: fileAnalysis.metadata?.integrity?.md5,
          verified: fileAnalysis.metadata?.integrity?.verified || false
        },
        analysis: {
          contentType: fileAnalysis.metadata?.content?.type,
          contentMetadata: fileAnalysis.metadata?.content?.metadata,
          analysisTime: fileAnalysis.metadata?.analysis?.analysisTime,
          success: fileAnalysis.success
        }
      };

      logger?.info('Asset upload completed successfully', {
        s3Key,
        assetType,
        accessLevel: result.accessLevel,
        size: result.size
      });

      return result;

    } catch (error) {
      logger?.error('Asset upload failed', { error: error.message, assetType });
      throw error;
    }
  }

  /**
   * Upload to S3 with Transaction Support - Low-level S3 upload method
   *
   * Replaces the original uploadToS3 method with transaction awareness
   * and enhanced error handling for atomic operations.
   *
   * @param {Object} params - Upload parameters
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.key - S3 key/path
   * @param {string} params.contentType - MIME type
   * @param {Object} params.metadata - File metadata
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Upload result with transaction safety
   */
  async uploadToS3WithTransaction({
    buffer,
    key,
    contentType,
    metadata = {},
    transaction = null,
    logger = null
  }) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

      logger?.info('Starting S3 upload with transaction support', {
        key,
        contentType,
        size: buffer.length,
        hasTransaction: !!transaction
      });

      // Convert metadata values to strings (AWS S3 requirement)
      const stringMetadata = {};
      Object.keys(metadata).forEach(k => {
        stringMetadata[k] = String(metadata[k]);
      });

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: stringMetadata
      };

      // If we have a transaction, we're in an atomic operation context
      if (transaction) {
        logger?.info('Performing S3 upload within transaction context', { key });

        // Note: S3 operations can't participate in database transactions,
        // but we can coordinate with the transaction lifecycle
        if (typeof transaction.afterCommit === 'function') {
          transaction.afterCommit(() => {
            logger?.info('Transaction committed - S3 upload confirmed', { key });
          });
        }

        if (typeof transaction.afterRollback === 'function') {
          transaction.afterRollback(async () => {
            logger?.warn('Transaction rolled back - cleaning up S3 upload', { key });
            try {
              await this.deleteS3Object(key);
              logger?.info('S3 cleanup successful after transaction rollback', { key });
            } catch (cleanupError) {
              logger?.error('S3 cleanup failed after transaction rollback', {
                key,
                error: cleanupError.message
              });
            }
          });
        }
      }

      const result = await this.s3.upload(uploadParams).promise();

      logger?.info('S3 upload completed successfully', {
        key: result.Key,
        etag: result.ETag,
        size: buffer.length
      });

      return {
        success: true,
        url: result.Location,
        key: result.Key,
        etag: result.ETag,
        size: buffer.length
      };

    } catch (error) {
      logger?.error('S3 upload failed', {
        key,
        error: error.message,
        errorCode: error.code
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        key
      };
    }
  }

  // S3 CLIENT ACCESSOR for other utilities
  get s3Client() {
    return this.s3;
  }

  // LEGACY UPLOAD METHODS (DEPRECATED - Use uploadAsset instead)
  // These methods are maintained for backwards compatibility during transition
  //
  // DEPRECATED METHODS:
  // - uploadFile() → use uploadAsset()
  // - uploadFileEntity() → use uploadAsset()
  // - uploadPublicFile() → use uploadAsset()
  // - uploadPublicVideo() → use uploadAsset()
  // - uploadPrivateVideo() → use uploadAsset()
  // - uploadToS3() → use uploadToS3WithTransaction()


  // CONSOLIDATED DELETE METHODS

  /**
   * Delete Asset - Unified transaction-safe deletion method
   *
   * Replaces: deleteFile, deleteS3Object (for asset operations)
   *
   * @param {Object} params - Deletion parameters
   * @param {string} params.entityType - Type of entity (workshop, course, file, tool)
   * @param {string} params.entityId - ID of the entity
   * @param {string} params.assetType - Type of asset (document, image, marketing-video, content-video)
   * @param {string} params.userId - ID of user performing deletion
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Deletion result with transaction safety
   */
  async deleteAsset({
    entityType,
    entityId,
    assetType,
    userId,
    transaction = null,
    logger = null
  }) {
    try {
      logger?.info('Starting asset deletion', {
        entityType,
        entityId,
        assetType,
        userId,
        hasTransaction: !!transaction
      });

      // Generate appropriate filename and S3 key
      let filename;
      if (assetType === 'marketing-video' || assetType === 'content-video') {
        filename = 'video.mp4';
      } else if (assetType === 'image') {
        filename = 'image.jpg';
      } else if (assetType === 'document' && entityType === 'file') {
        // For documents, get filename from database
        const FileModel = models.File;
        const fileEntity = await FileModel.findByPk(entityId, { transaction });

        if (!fileEntity || !fileEntity.file_name) {
          logger?.warn('Document not found or no filename set', { entityId });
          return {
            success: false,
            reason: 'Document not found or file_name is NULL',
            entityType,
            entityId,
            assetType
          };
        }

        filename = fileEntity.file_name;
      } else {
        throw new Error(`Unsupported asset type: ${assetType} for entity type: ${entityType}`);
      }

      // Construct S3 path
      const s3Key = constructS3Path(entityType, entityId, assetType, filename);
      logger?.info('S3 key constructed for deletion', { s3Key, filename });

      // Delete from S3 with transaction coordination
      const s3Result = await this.deleteS3ObjectWithTransaction({
        key: s3Key,
        transaction,
        logger
      });

      if (!s3Result.success) {
        logger?.error('S3 deletion failed', { s3Key, error: s3Result.error });
        return {
          success: false,
          error: 'S3 deletion failed',
          details: s3Result.error,
          s3Key,
          entityType,
          entityId,
          assetType
        };
      }

      // Handle database updates for document assets
      if (assetType === 'document' && entityType === 'file' && transaction) {
        try {
          const FileModel = models.File;
          const fileEntity = await FileModel.findByPk(entityId, { transaction });

          if (fileEntity) {
            await fileEntity.update({ file_name: null }, { transaction });
            logger?.info('File entity updated - filename cleared', { entityId });
          }
        } catch (dbError) {
          logger?.error('Database update failed during deletion', {
            entityId,
            error: dbError.message
          });

          // If we're in a transaction, this will cause rollback and S3 cleanup
          if (transaction) {
            throw dbError;
          }

          // If no transaction, we have inconsistent state - log but don't fail
          logger?.warn('Inconsistent state: S3 deleted but database update failed', {
            s3Key,
            entityId
          });
        }
      }

      const result = {
        success: true,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType,
        deletedBy: userId,
        deletedAt: new Date().toISOString(),
        databaseUpdated: assetType === 'document' && entityType === 'file'
      };

      logger?.info('Asset deletion completed successfully', {
        s3Key,
        assetType,
        databaseUpdated: result.databaseUpdated
      });

      return result;

    } catch (error) {
      logger?.error('Asset deletion failed', {
        entityType,
        entityId,
        assetType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete S3 Object with Transaction Support - Low-level S3 deletion method
   *
   * @param {Object} params - Deletion parameters
   * @param {string} params.key - S3 key/path
   * @param {Object} params.transaction - Optional Sequelize transaction
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Deletion result with transaction safety
   */
  async deleteS3ObjectWithTransaction({
    key,
    transaction = null,
    logger = null
  }) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

      logger?.info('Starting S3 deletion with transaction support', {
        key,
        hasTransaction: !!transaction
      });

      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      // If we have a transaction, coordinate with its lifecycle
      if (transaction) {
        logger?.info('Performing S3 deletion within transaction context', { key });

        // Note: We can't rollback S3 operations, but we can be aware of transaction state
        if (typeof transaction.afterRollback === 'function') {
          transaction.afterRollback(async () => {
            logger?.warn('Transaction rolled back - S3 object was deleted but transaction failed', {
              key,
              note: 'Manual cleanup may be required'
            });
          });
        }
      }

      await this.s3.deleteObject(params).promise();

      logger?.info('S3 deletion completed successfully', { key });

      return {
        success: true,
        key,
        message: 'Object deleted successfully'
      };

    } catch (error) {
      // Handle "not found" errors gracefully for delete operations
      if (error.code === 'NoSuchKey' || error.statusCode === 404) {
        logger?.info('S3 object not found - treating as successful deletion', { key });
        return {
          success: true,
          key,
          message: 'Object not found (already deleted)',
          alreadyDeleted: true
        };
      }

      logger?.error('S3 deletion failed', {
        key,
        error: error.message,
        errorCode: error.code
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        key
      };
    }
  }

  // Delete S3 object (Legacy method - Use deleteS3ObjectWithTransaction instead)
  async deleteS3Object(s3Key) {
    const result = await this.deleteS3ObjectWithTransaction({ key: s3Key });
    return result;
  }

  // FILE INTEGRITY VERIFICATION

  /**
   * Verify File Integrity - Check if uploaded file matches expected checksum
   *
   * @param {Object} params - Verification parameters
   * @param {string} params.entityType - Type of entity
   * @param {string} params.entityId - ID of entity
   * @param {string} params.assetType - Type of asset
   * @param {string} params.expectedSha256 - Expected SHA-256 checksum
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Verification result
   */
  async verifyFileIntegrity({
    entityType,
    entityId,
    assetType,
    expectedSha256,
    logger = null
  }) {
    try {
      logger?.info('Starting file integrity verification', {
        entityType,
        entityId,
        assetType,
        expectedSha256: expectedSha256.substring(0, 16) + '...'
      });

      // Generate appropriate filename and S3 key
      let filename;
      if (assetType === 'marketing-video' || assetType === 'content-video') {
        filename = 'video.mp4';
      } else if (assetType === 'image') {
        filename = 'image.jpg';
      } else if (assetType === 'document' && entityType === 'file') {
        // For documents, get filename from database
        const FileModel = models.File;
        const fileEntity = await FileModel.findByPk(entityId);

        if (!fileEntity || !fileEntity.file_name) {
          return {
            success: false,
            verified: false,
            error: 'Document not found or no filename set',
            entityType,
            entityId,
            assetType
          };
        }

        filename = fileEntity.file_name;
      } else {
        throw new Error(`Unsupported asset type: ${assetType} for entity type: ${entityType}`);
      }

      // Construct S3 path and download file
      const s3Key = constructS3Path(entityType, entityId, assetType, filename);
      logger?.info('Downloading file for verification', { s3Key });

      const buffer = await this.downloadToBuffer(s3Key);

      if (!buffer) {
        return {
          success: false,
          verified: false,
          error: 'Failed to download file for verification',
          s3Key,
          entityType,
          entityId,
          assetType
        };
      }

      // Verify integrity using metadata enhancer
      const metadataEnhancer = createFileMetadataEnhancer(logger);
      const verificationResult = metadataEnhancer.verifyFileIntegrity(buffer, expectedSha256);

      const result = {
        success: true,
        verified: verificationResult.valid,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType,
        expected: verificationResult.expected,
        calculated: verificationResult.calculated,
        fileSize: buffer.length,
        verifiedAt: verificationResult.verifiedAt
      };

      logger?.info('File integrity verification completed', {
        s3Key,
        verified: result.verified,
        expectedHash: result.expected.substring(0, 16) + '...',
        calculatedHash: result.calculated.substring(0, 16) + '...'
      });

      return result;

    } catch (error) {
      logger?.error('File integrity verification failed', {
        entityType,
        entityId,
        assetType,
        error: error.message
      });

      return {
        success: false,
        verified: false,
        error: error.message,
        entityType,
        entityId,
        assetType
      };
    }
  }

  /**
   * Get File Metadata - Retrieve comprehensive metadata for an uploaded file
   *
   * @param {Object} params - Metadata retrieval parameters
   * @param {string} params.entityType - Type of entity
   * @param {string} params.entityId - ID of entity
   * @param {string} params.assetType - Type of asset
   * @param {Object} params.logger - Optional logger instance
   * @returns {Promise<Object>} Comprehensive file metadata
   */
  async getFileMetadata({
    entityType,
    entityId,
    assetType,
    logger = null
  }) {
    try {
      logger?.info('Retrieving file metadata', {
        entityType,
        entityId,
        assetType
      });

      // Generate appropriate filename and S3 key
      let filename;
      if (assetType === 'marketing-video' || assetType === 'content-video') {
        filename = 'video.mp4';
      } else if (assetType === 'image') {
        filename = 'image.jpg';
      } else if (assetType === 'document' && entityType === 'file') {
        const FileModel = models.File;
        const fileEntity = await FileModel.findByPk(entityId);

        if (!fileEntity || !fileEntity.file_name) {
          return {
            success: false,
            error: 'Document not found or no filename set',
            entityType,
            entityId,
            assetType
          };
        }

        filename = fileEntity.file_name;
      } else {
        throw new Error(`Unsupported asset type: ${assetType} for entity type: ${entityType}`);
      }

      // Get S3 metadata and enhanced file analysis
      const s3Key = constructS3Path(entityType, entityId, assetType, filename);

      // Get basic S3 metadata
      const s3Metadata = await this.getS3ObjectMetadata(s3Key);

      if (!s3Metadata.success) {
        return {
          success: false,
          error: 'File not found in storage',
          s3Key,
          entityType,
          entityId,
          assetType
        };
      }

      // Download file for enhanced analysis (only for smaller files to avoid memory issues)
      let enhancedAnalysis = null;
      const fileSizeMB = s3Metadata.data.size / (1024 * 1024);

      if (fileSizeMB <= 50) { // Only analyze files <= 50MB
        try {
          const buffer = await this.downloadToBuffer(s3Key);
          const mockFile = {
            buffer,
            originalname: filename,
            mimetype: s3Metadata.data.contentType,
            size: buffer.length
          };

          const metadataEnhancer = createFileMetadataEnhancer(logger);
          const analysis = await metadataEnhancer.analyzeFile(mockFile, assetType);

          if (analysis.success) {
            enhancedAnalysis = analysis.metadata;
          }
        } catch (analysisError) {
          logger?.warn('Enhanced analysis failed for large file', {
            s3Key,
            fileSizeMB,
            error: analysisError.message
          });
        }
      }

      const result = {
        success: true,
        s3Key,
        filename,
        entityType,
        entityId,
        assetType,
        s3Metadata: s3Metadata.data,
        enhancedAnalysis,
        retrievedAt: new Date().toISOString()
      };

      logger?.info('File metadata retrieved successfully', {
        s3Key,
        hasEnhancedAnalysis: !!enhancedAnalysis,
        fileSizeMB: Math.round(fileSizeMB * 100) / 100
      });

      return result;

    } catch (error) {
      logger?.error('File metadata retrieval failed', {
        entityType,
        entityId,
        assetType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        entityType,
        entityId,
        assetType
      };
    }
  }
}

export default new FileService();