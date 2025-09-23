import AWS from 'aws-sdk';
import sharp from 'sharp';
import { generateId } from '../models/baseModel.js';
import models from '../models/index.js';
import fs from 'fs';
import path from 'path';

class FileService {
  constructor() {
    this.s3 = null;
    this.localStoragePath = process.env.LOCAL_STORAGE_PATH || './uploads';
    this.useS3 = process.env.USE_S3 === 'true';
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
        created_by: userId
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

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov'
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
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

export default new FileService();