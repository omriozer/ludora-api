import express from 'express';
import multer from 'multer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas, customValidators } from '../middleware/validation.js';
import EmailService from '../services/EmailService.js';
import FileService from '../services/FileService.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

const { sequelize } = models;

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  storage: multer.memoryStorage()
});

// Core Integration: Send Email
router.post('/sendEmail', authenticateToken, rateLimiters.email, validateBody(schemas.sendEmail), async (req, res) => {
  try {
    const result = await EmailService.sendEmail(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Upload File (with transaction support for AudioFile)
router.post('/uploadFile', authenticateToken, rateLimiters.upload, upload.single('file'), customValidators.validateFileUpload, async (req, res) => {
  const transaction = await sequelize.transaction();
  let s3UploadCompleted = false;
  let s3Key = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file (same as FileService)
    if (!req.file.buffer || req.file.buffer.length === 0) {
      throw new Error('File is empty');
    }
    const maxSize = 50 * 1024 * 1024;
    if (req.file.buffer.length > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
    }

    // Generate unique ID for AudioFile
    const audioFileId = generateId();
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${audioFileId}.${fileExtension}`;

    // Use proper S3 path structure for AudioFile (System Layer)
    const environment = process.env.NODE_ENV || 'development';
    const s3Path = `${environment}/private/audio/audiofile/${audioFileId}/${fileName}`;

    // Upload to S3 first
    const uploadResult = await FileService.uploadToS3WithTransaction({
      buffer: req.file.buffer,
      key: s3Path,
      contentType: req.file.mimetype,
      metadata: {
        uploadedBy: req.user.uid,
        originalName: req.file.originalname,
        entityType: 'audiofile',
        entityId: audioFileId
      },
      transaction
    });

    if (!uploadResult.success) {
      throw new Error('S3 upload failed');
    }

    s3UploadCompleted = true;
    s3Key = s3Path;
    console.log(`✅ S3 upload completed: ${s3Key}`);

    // Extract metadata from form data
    const audioMetadata = {
      name: req.body.name || req.file.originalname,
      volume: req.body.volume ? parseFloat(req.body.volume) : 1.0,
      duration: req.body.duration ? parseFloat(req.body.duration) : null,
      is_default_for: req.body.is_default_for ? JSON.parse(req.body.is_default_for) : []
    };

    // Create AudioFile record within transaction using STANDARDIZED fields
    const audioFileRecord = await models.AudioFile.create({
      id: audioFileId,
      name: audioMetadata.name,
      // Use standardized fields instead of deprecated file_url
      has_file: true,
      file_filename: fileName,
      // Metadata fields
      duration: audioMetadata.duration,
      volume: audioMetadata.volume,
      file_size: req.file.buffer.length,
      file_type: req.file.mimetype,
      is_default_for: audioMetadata.is_default_for,
      // Timestamps
      created_at: new Date(),
      updated_at: new Date(),
    }, { transaction });

    // Commit transaction - both S3 upload and DB creation succeeded
    await transaction.commit();
    console.log(`✅ Transaction committed for AudioFile upload: ${s3Key}`);

    res.json({
      success: true,
      data: {
        id: audioFileId,
        name: audioMetadata.name,
        filename: fileName,
        mimeType: req.file.mimetype,
        size: req.file.buffer.length,
        duration: audioMetadata.duration,
        volume: audioMetadata.volume,
        has_file: true,
        file_filename: fileName,
        s3Key: s3Path,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.uid
      }
    });

  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    console.log(`🔄 Transaction rolled back for failed AudioFile upload`);

    // Clean up S3 file if it was uploaded but DB operation failed
    if (s3UploadCompleted && s3Key) {
      try {
        await FileService.deleteS3Object(s3Key);
        console.log(`🧹 Cleaned up orphaned S3 file: ${s3Key}`);
      } catch (cleanupError) {
        console.error(`❌ Failed to cleanup S3 file ${s3Key}:`, cleanupError);
        // Continue with error response - cleanup failure shouldn't hide original error
      }
    }

    console.error('❌ AudioFile upload transaction failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Extract Data from Uploaded File
router.post('/extractDataFromUploadedFile', authenticateToken, rateLimiters.upload, upload.single('file'), customValidators.validateFileUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded for data extraction' });
    }
    
    const result = await FileService.extractDataFromUploadedFile({ 
      file: req.file, 
      extractionType: req.body.extractionType 
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error extracting data from file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for integrations
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    integrations: {
      email: 'available',
      fileUpload: 'available',
      imageGeneration: 'available',
      dataExtraction: 'available',
      signedUrls: 'available'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;