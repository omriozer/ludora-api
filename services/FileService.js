import AWS from 'aws-sdk';
import sharp from 'sharp';
import { generateId } from '../models/baseModel.js';
import models from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { constructS3Path } from '../utils/s3PathUtils.js';

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
      console.log('✅ S3 initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing S3:', error);
      this.useS3 = false;
    }
  }

  // Ensure local storage directory exists
  ensureLocalStorageDir() {
    try {
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
      console.log(`✅ Local storage initialized: ${this.localStoragePath}`);
    } catch (error) {
      console.error('❌ Error creating local storage directory:', error);
    }
  }

  // Upload file (public)
  async uploadFile({ file, folder = 'general', userId }) {
    try {
      // Validate file
      this.validateFile(file);

      // Generate unique filename
      const fileId = generateId();
      const fileExtension = this.getFileExtension(file.originalname);
      const fileName = `${fileId}.${fileExtension}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3 (private bucket)
        const uploadParams = {
          Bucket: this.bucketName,
          Key: filePath,
          Body: file.buffer,
          ContentType: file.mimetype
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;
      } else {
        // Upload to local storage
        const localPath = path.join(this.localStoragePath, folder);
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);
        fs.writeFileSync(fullPath, file.buffer);

        url = `/uploads/${filePath}`;
        size = file.buffer.length;
      }

      // Save file record to database
      const fileRecord = await models.AudioFile.create({
        id: fileId,
        name: file.originalname,
        file_url: url,
        file_size: size,
        file_type: file.mimetype,
        created_at: new Date(),
        updated_at: new Date(),
      });

      return {
        success: true,
        data: {
          fileId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size,
          url,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId
        }
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // Upload file with custom path (for file entities)
  async uploadFileEntity({ file, s3Path, preserveOriginalName = true }) {
    try {
      // Validate file
      this.validateFile(file);

      // Use original filename or generate new one
      const fileName = preserveOriginalName ? file.originalname : `${generateId()}.${this.getFileExtension(file.originalname)}`;
      const fullS3Key = `${s3Path}/${fileName}`;

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3
        const uploadParams = {
          Bucket: this.bucketName,
          Key: fullS3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
          // Ensure private access
          ACL: undefined
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName,
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString()
          }
        };
      } else {
        // Local storage fallback
        const localPath = path.join(this.localStoragePath, s3Path);
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);
        fs.writeFileSync(fullPath, file.buffer);

        url = `/uploads/${s3Path}/${fileName}`;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: `${s3Path}/${fileName}`,
            fileName,
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      console.error('Error uploading file entity:', error);
      throw error;
    }
  }

  // Upload public file (accessible without authentication)
  async uploadPublicFile({ file, contentType, entityType, entityId, preserveOriginalName = true }) {
    try {
      // Validate file
      this.validateFile(file);

      // Map contentType to standardized assetType for marketing videos
      const assetType = contentType === 'marketing/videos' ? 'marketing-video' : contentType;

      // Use original filename or generate new one
      const fileName = preserveOriginalName ? file.originalname : `${generateId()}.${this.getFileExtension(file.originalname)}`;

      // Use standardized S3 path construction
      const fullS3Key = constructS3Path(entityType, entityId, assetType, fileName);

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3 with public access
        const uploadParams = {
          Bucket: this.bucketName,
          Key: fullS3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read' // Make publicly accessible
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName,
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'public'
          }
        };
      } else {
        // Local storage fallback - extract directory from full S3 key
        const localDir = path.dirname(fullS3Key);
        const localPath = path.join(this.localStoragePath, localDir);
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);
        fs.writeFileSync(fullPath, file.buffer);

        url = `/uploads/${fullS3Key}`;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName,
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'public'
          }
        };
      }
    } catch (error) {
      console.error('Error uploading public file:', error);
      throw error;
    }
  }

  // Enhanced uploadFileEntity for private files with environment-first structure
  async uploadPrivateFileEntity({ file, contentType, entityType, entityId, userId, preserveOriginalName = true }) {
    try {
      // Validate file
      this.validateFile(file);

      // Map contentType to standardized assetType
      const assetType = contentType === 'content/videos' ? 'content-video' : contentType;

      // Use original filename or generate new one
      const fileName = preserveOriginalName ? file.originalname : `${generateId()}.${this.getFileExtension(file.originalname)}`;

      // For S3 storage, use sanitized filename to avoid signature issues with Hebrew characters
      // but preserve original filename for display purposes
      const sanitizedFileName = preserveOriginalName ?
        `${generateId()}.${this.getFileExtension(file.originalname)}` :
        fileName;

      // Use standardized S3 path construction with sanitized filename for storage
      const fullS3Key = constructS3Path(entityType, entityId, assetType, sanitizedFileName);

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3
        const uploadParams = {
          Bucket: this.bucketName,
          Key: fullS3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
          // Ensure private access
          ACL: undefined
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName, // Original Hebrew filename for display
            storageFileName: sanitizedFileName, // Sanitized filename used for storage
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'private'
          }
        };
      } else {
        // Local storage fallback - extract directory from full S3 key
        const localDir = path.dirname(fullS3Key);
        const localPath = path.join(this.localStoragePath, localDir);
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);
        fs.writeFileSync(fullPath, file.buffer);

        url = `/uploads/${fullS3Key}`;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName,
            mimeType: file.mimetype,
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'private'
          }
        };
      }
    } catch (error) {
      console.error('Error uploading private file entity:', error);
      throw error;
    }
  }

  // Upload private file
  async uploadPrivateFile({ file, folder = 'private', tags = [], userId }) {
    try {
      this.validateFile(file);

      const fileId = generateId();
      const fileExtension = this.getFileExtension(file.originalname);
      const fileName = `${fileId}.${fileExtension}`;
      const filePath = `private/${folder}/${fileName}`;

      let url, size;

      if (this.useS3 && this.s3) {
        const uploadParams = {
          Bucket: this.bucketName,
          Key: filePath,
          Body: file.buffer,
          ContentType: file.mimetype
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;
      } else {
        const localPath = path.join(this.localStoragePath, 'private', folder);
        if (!fs.existsSync(localPath)) {
          fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);
        fs.writeFileSync(fullPath, file.buffer);
        
        url = `/private/${folder}/${fileName}`;
        size = file.buffer.length;
      }

      return {
        success: true,
        data: {
          fileId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size,
          folder,
          tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
          privateUrl: url,
          accessLevel: 'private',
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId
        }
      };
    } catch (error) {
      console.error('Error uploading private file:', error);
      throw error;
    }
  }

  // Generate signed URL
  async createFileSignedUrl({ fileName, operation = 'read', expiresIn = 3600, contentType }) {
    try {
      if (!fileName) {
        throw new Error('fileName is required');
      }

      let signedUrl;

      if (this.useS3 && this.s3) {
        const params = {
          Bucket: this.bucketName,
          Key: fileName,
          Expires: expiresIn,
          ...(contentType && { ContentType: contentType })
        };

        const s3Operation = operation === 'write' ? 'putObject' : 'getObject';
        signedUrl = await this.s3.getSignedUrlPromise(s3Operation, params);
      } else {
        // Generate mock signed URL for local development
        const token = Buffer.from(`${fileName}:${Date.now() + (expiresIn * 1000)}:${operation}`).toString('base64');
        signedUrl = `/api/files/signed/${fileName}?token=${token}&operation=${operation}`;
      }

      return {
        success: true,
        data: {
          fileName,
          signedUrl,
          operation,
          expiresIn,
          expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
          contentType: contentType || 'application/octet-stream',
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error creating signed URL:', error);
      throw error;
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
      console.error('Error extracting data from file:', error);
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

    // Debug logging for file validation
    console.log(`🔍 FileService validation - File mimetype: "${file.mimetype}", originalname: "${file.originalname}"`);

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', // .ppt files
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx files
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-ms-wmv'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      console.error(`❌ File type "${file.mimetype}" not in allowed types:`, allowedTypes);
      throw new Error(`File type ${file.mimetype} not allowed`);
    }

    console.log(`✅ File validation passed for ${file.mimetype}`);
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
      console.error('Error deleting file:', error);
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
      console.error('Error creating S3 stream:', error);
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
      console.error('Error downloading to buffer:', error);
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
      console.error('Error getting S3 object metadata:', error);
      throw error;
    }
  }

  // Upload public marketing video (always .mp4)
  async uploadPublicVideo({ file, entityType, entityId }) {
    try {
      // Validate file
      this.validateFile(file);

      // Validate that it's a video file
      if (!file.mimetype.startsWith('video/')) {
        throw new Error('File must be a video');
      }

      const fileName = 'video.mp4'; // Standardized filename
      const assetType = 'marketing-video'; // Standardized asset type

      // Use standardized S3 path construction
      const fullS3Key = constructS3Path(entityType, entityId, assetType, fileName);

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3 (bucket has public ACLs blocked, so no ACL parameter needed)
        const uploadParams = {
          Bucket: this.bucketName,
          Key: fullS3Key,
          Body: file.buffer,
          ContentType: 'video/mp4' // Standardized content type
          // Note: No ACL parameter - bucket has public ACLs blocked
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            url,
            key: fullS3Key,
            fileName,
            mimeType: 'video/mp4',
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'public',
            entityType,
            entityId
          }
        };
      } else {
        // For development without S3, still return structured response
        // but indicate local fallback is not supported for videos
        throw new Error('S3 storage required for video uploads');
      }
    } catch (error) {
      console.error('Error uploading public video:', error);
      throw error;
    }
  }

  // Upload private video (always .mp4)
  async uploadPrivateVideo({ file, entityType, entityId }) {
    try {
      // Validate file
      this.validateFile(file);

      // Validate that it's a video file
      if (!file.mimetype.startsWith('video/')) {
        throw new Error('File must be a video');
      }

      const fileName = 'video.mp4'; // Standardized filename
      const assetType = 'content-video'; // Standardized asset type

      // Use standardized S3 path construction
      const fullS3Key = constructS3Path(entityType, entityId, assetType, fileName);

      let url, size;

      if (this.useS3 && this.s3) {
        // Upload to S3 with private access
        const uploadParams = {
          Bucket: this.bucketName,
          Key: fullS3Key,
          Body: file.buffer,
          ContentType: 'video/mp4', // Standardized content type
          ACL: undefined // Private access (default)
        };

        const result = await this.s3.upload(uploadParams).promise();
        url = result.Location;
        size = file.buffer.length;

        return {
          success: true,
          data: {
            // For private videos, return internal reference path, not direct S3 URL
            url: `/api/files/stream-video/${entityType}/${entityId}`,
            s3Url: url, // Keep S3 URL for internal use
            key: fullS3Key,
            fileName,
            mimeType: 'video/mp4',
            size,
            uploadedAt: new Date().toISOString(),
            accessLevel: 'private',
            entityType,
            entityId
          }
        };
      } else {
        // For development without S3, still return structured response
        // but indicate local fallback is not supported for videos
        throw new Error('S3 storage required for video uploads');
      }
    } catch (error) {
      console.error('Error uploading private video:', error);
      throw error;
    }
  }

  // Upload to S3 (generic method for any asset)
  async uploadToS3({ buffer, key, contentType, metadata = {} }) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

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

      const result = await this.s3.upload(uploadParams).promise();

      return {
        success: true,
        url: result.Location,
        key: result.Key,
        etag: result.ETag,
        size: buffer.length
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete S3 object
  async deleteS3Object(s3Key) {
    try {
      if (!this.useS3 || !this.s3) {
        throw new Error('S3 not configured');
      }

      console.log(`🗑️ Deleting S3 object: ${s3Key}`);

      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      await this.s3.deleteObject(params).promise();

      console.log(`✅ Successfully deleted S3 object: ${s3Key}`);
      return {
        success: true,
        key: s3Key,
        message: 'Object deleted successfully'
      };
    } catch (error) {
      console.error(`❌ Error deleting S3 object ${s3Key}:`, error);
      return {
        success: false,
        error: error.message,
        key: s3Key
      };
    }
  }
}

export default new FileService();