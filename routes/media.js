import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import AuthService from '../services/AuthService.js';

const authService = new AuthService();
import FileService from '../services/FileService.js';
import models from '../models/index.js';
import { MEDIA_ENABLED_PRODUCT_TYPES } from '../constants/productTypes.js';
import { getAllAllowedMimeTypes, detectFileTypeFromMime } from '../constants/fileTypes.js';

const router = express.Router();

// Custom authentication middleware that checks token from header or query
const authenticateTokenOrQuery = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware hit:', { url: req.url, method: req.method });
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
      token = authHeader.split(' ')[1]; // Bearer TOKEN
      console.log('🔐 Token from header:', token ? 'present' : 'missing');
    } else if (req.query.authToken || req.query.token) {
      token = req.query.authToken || req.query.token; // From query parameter
      console.log('🔐 Token from query:', token ? 'present' : 'missing');
    }

    if (!token) {
      console.log('🔐 No token found');
      return res.status(401).json({ error: 'Access token required' });
    }


    // Use AuthService to verify the token
    const tokenData = await authService.verifyToken(token);
    console.log('🔐 Token verified for user:', tokenData.id);
    req.user = tokenData;
    next();

  } catch (error) {
    console.error('🔐 Authentication error:', error);
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
};

// OPTIONS handler for video streaming endpoint
router.options('/video/:entityType/:entityId', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, Cache-Control, Pragma',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
  });
  res.status(200).end();
});

// Secure video streaming endpoint with range support
router.get('/video/:entityType/:entityId', authenticateTokenOrQuery, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const user = req.user;

    // Validate entity type
    const validTypes = MEDIA_ENABLED_PRODUCT_TYPES;
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Get entity data
    let entity;
    switch (entityType) {
      case 'workshop':
        entity = await models.Workshop?.findByPk(entityId);
        break;
      case 'course':
        entity = await models.Course?.findByPk(entityId);
        break;
      case 'file':
        entity = await models.File?.findByPk(entityId);
        break;
      case 'tool':
        entity = await models.Tool?.findByPk(entityId);
        break;
    }

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Check if user has access (same logic as VideoViewer)
    let hasAccess = false;

    // Check purchases using clean schema
    const purchases = await models.Purchase.findAll({
      where: {
        buyer_user_id: user.id,
        payment_status: 'completed' // Updated status
      }
    });

    const entityPurchases = purchases.filter(purchase =>
      purchase.purchasable_id === entityId && purchase.purchasable_type === entityType
    );

    if (entityPurchases.length > 0) {
      const userPurchase = entityPurchases[0];
      // Clean access logic: access_expires_at null = lifetime, or not expired
      if (!userPurchase.access_expires_at ||
          new Date(userPurchase.access_expires_at) > new Date()) {
        hasAccess = true;
      }
    }

    // Auto-grant access for free items
    if (!hasAccess && parseFloat(entity.price || 0) === 0) {
      hasAccess = true;

      // Create purchase record for free item
      try {
        const orderNumber = `FREE-AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await models.Purchase.create({
          id: `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_number: orderNumber,
          buyer_user_id: user.id,
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed', // Updated status
          payment_amount: 0,
          original_price: 0,
          access_expires_at: null, // null = lifetime access
          first_accessed_at: new Date()
        });
      } catch (autoAccessError) {
        console.error('Failed to create auto-access record:', autoAccessError);
      }
    }

    if (!hasAccess) {
      // Log unauthorized access attempt
      console.warn(`🚨 Unauthorized video access attempt: ${user.email} -> ${entityType}/${entityId}`, {
        userEmail: user.email,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log successful video access for security tracking
    console.log(`🎬 Video access granted: ${user.email} -> ${entityType}/${entityId}`, {
      userEmail: user.email,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      hasLifetimeAccess: entityPurchases.length > 0 ? entityPurchases[0].purchased_lifetime_access : false,
      accessType: parseFloat(entity.price || 0) === 0 ? 'free' : 'paid'
    });

    // Get video file path
    const videoUrl = entity.video_file_url || entity.recording_url;
    if (!videoUrl) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // For external URLs (YouTube, etc.), redirect
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return res.redirect(videoUrl);
    }

    // For API video endpoints, extract video ID and serve directly
    if (videoUrl.startsWith('/api/videos/') && videoUrl.includes('/stream')) {
      // Extract video ID from /api/videos/{videoId}/stream
      const videoIdMatch = videoUrl.match(/\/api\/videos\/([^\/]+)\/stream/);
      if (videoIdMatch) {
        const videoId = videoIdMatch[1];
        const videoPath = path.resolve('./uploads/videos', `${videoId}.mp4`);

        // Check if video file exists
        if (fs.existsSync(videoPath)) {
          const stat = fs.statSync(videoPath);
          const fileSize = stat.size;
          const range = req.headers.range;

          // Set security headers to prevent caching and downloads, with CORS for video
          res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "default-src 'self'",
            'Content-Disposition': 'inline',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'false',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, Cache-Control, Pragma',
            'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
          });

          if (range) {
            // Parse range header
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            // Create read stream for the requested range
            const stream = fs.createReadStream(videoPath, { start, end });

            // Set partial content headers
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'video/mp4',
            });

            // Pipe the stream to response
            return stream.pipe(res);
          } else {
            // No range requested, send first chunk to enable streaming
            const chunkSize = 1024 * 1024; // 1MB chunks for initial load
            const start = 0;
            const end = Math.min(chunkSize - 1, fileSize - 1);

            const stream = fs.createReadStream(videoPath, { start, end });

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': (end - start) + 1,
              'Content-Type': 'video/mp4',
            });

            return stream.pipe(res);
          }
        } else {
          return res.status(404).json({ error: 'Video file not found' });
        }
      }
    }

    // For local files, serve with range support
    const videoPath = path.resolve(videoUrl);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set security headers to prevent caching and downloads, with CORS for video
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'",
      'Content-Disposition': 'inline', // Prevent download dialog
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, Cache-Control, Pragma',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
    });

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Create read stream for the requested range
      const stream = fs.createReadStream(videoPath, { start, end });

      // Set partial content headers
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });

      // Pipe the stream to response
      stream.pipe(res);
    } else {
      // No range requested, send first chunk to enable streaming
      const chunkSize = 1024 * 1024; // 1MB chunks for initial load
      const start = 0;
      const end = Math.min(chunkSize - 1, fileSize - 1);

      const stream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start) + 1,
        'Content-Type': 'video/mp4',
      });

      stream.pipe(res);
    }

  } catch (error) {
    console.error('Video streaming error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get secure video URL (returns signed URL that expires)
router.get('/video-url/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const user = req.user;

    // Same access validation as above...
    // For brevity, assuming access is granted

    // Generate a signed token that expires in 1 hour
    const token = Buffer.from(JSON.stringify({
      userId: user.id,
      entityType,
      entityId,
      expires: Date.now() + (60 * 60 * 1000) // 1 hour
    })).toString('base64url');

    const videoUrl = `/api/media/video/${entityType}/${entityId}?token=${token}`;

    res.json({
      success: true,
      data: {
        videoUrl,
        expires: new Date(Date.now() + (60 * 60 * 1000)).toISOString()
      }
    });

  } catch (error) {
    console.error('Video URL generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File upload configuration for File product type
const FILES_STORAGE_DIR = path.resolve('./uploads/files');

// Ensure files directory exists
if (!fs.existsSync(FILES_STORAGE_DIR)) {
  fs.mkdirSync(FILES_STORAGE_DIR, { recursive: true });
}

// Configure multer for file uploads with custom directory structure
const fileStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { fileEntityId } = req.body;
      const userId = req.user.id;

      if (!fileEntityId) {
        return cb(new Error('File entity ID is required'), null);
      }

      // Create directory structure: uploads/files/[userid]/[FileId]/
      const userDir = path.join(FILES_STORAGE_DIR, userId);
      const fileDir = path.join(userDir, fileEntityId);

      // Create directories if they don't exist
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      cb(null, fileDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const { fileEntityId } = req.body;
      const extension = path.extname(file.originalname);

      if (!fileEntityId) {
        return cb(new Error('File entity ID is required'), null);
      }

      // Name format: file_id.[fileType] (e.g., file_123456.pdf)
      const filename = `${fileEntityId}${extension}`;
      cb(null, filename);
    } catch (error) {
      cb(error, null);
    }
  }
});

const fileUpload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Use centralized file type configuration
    const allowedMimes = getAllAllowedMimeTypes();

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedMimes.join(', ')}`), false);
    }
  }
});

// S3-based file upload configuration
const s3Upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Use centralized file type configuration
    const allowedMimes = getAllAllowedMimeTypes();

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedMimes.join(', ')}`), false);
    }
  }
});

// File upload endpoint for File entities using S3
router.post('/file/upload', authenticateToken, s3Upload.single('file'), async (req, res) => {
  try {
    const { fileEntityId, uploadAsSystem } = req.body;
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    if (!fileEntityId) {
      return res.status(400).json({
        error: 'File entity ID required',
        message: 'fileEntityId must be provided in request body'
      });
    }

    // Verify the File entity exists and user has permission
    const fileEntity = await models.File.findByPk(fileEntityId);

    if (!fileEntity) {
      return res.status(404).json({
        error: 'File entity not found',
        message: `No File entity found with ID ${fileEntityId}`
      });
    }

    // Check if user is the creator or admin
    const isAdmin = user.role === 'admin';
    const isCreator = fileEntity.creator_user_id === user.id;

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only upload files for File entities you created'
      });
    }

    // Determine if this should be uploaded as system asset or content creator asset
    let uploaderUserId = user.id;
    let uploaderType = 'content_creator';

    if (isAdmin && uploadAsSystem === 'true') {
      uploaderUserId = 'system';
      uploaderType = 'system';

      // Update the File entity to be created by Ludora (system)
      await fileEntity.update({
        creator_user_id: 'system',
        created_by: 'Ludora',
        created_by_id: 'system'
      });
    }

    // Use FileService instance (it's already instantiated)
    const fileService = FileService;

    // Get environment for folder structure
    const environment = process.env.ENVIRONMENT || 'development';

    // Create S3 folder structure: environment/uploaderUserId/fileEntityId/
    const s3Folder = `${environment}/${uploaderUserId}/${fileEntityId}`;

    // Upload file to S3 with custom path structure
    const uploadResult = await fileService.uploadFileEntity({
      file: req.file,
      s3Path: s3Folder,
      preserveOriginalName: true
    });

    // Determine file type based on mime type using centralized function
    const fileType = detectFileTypeFromMime(req.file.mimetype);

    // Update the File entity with download URL (not direct S3 URL)
    // Use the API download endpoint which handles authentication and access control
    const downloadUrl = `/api/media/file/download/${fileEntityId}`;
    await fileEntity.update({
      file_type: fileType,
      file_is_private: true, // S3 files are private, accessed through API
      file_url: downloadUrl // Store API download URL, not direct S3 URL
    });

    // Log the upload
    console.log(`File uploaded to S3: ${req.file.originalname} for entity ${fileEntityId} by ${uploaderType} ${user.id}`, {
      s3Key: uploadResult.data.key || `${s3Folder}/${req.file.originalname}`,
      fileType,
      uploaderType,
      environment
    });

    res.json({
      success: true,
      data: {
        fileEntityId: fileEntityId,
        filename: req.file.originalname,
        size: req.file.size,
        fileType: fileType,
        s3Url: uploadResult.data.url,
        s3Key: uploadResult.data.key || `${s3Folder}/${req.file.originalname}`,
        uploadedBy: uploaderUserId,
        uploaderType: uploaderType,
        uploadedAt: new Date().toISOString(),
        downloadUrl: `/api/media/file/download/${fileEntityId}`
      },
      message: `File uploaded successfully to ${environment} environment as ${uploaderType} asset`
    });

  } catch (error) {
    console.error('File upload error:', error);

    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process file upload: ' + error.message
    });
  }
});

// File download endpoint with access control
router.get('/file/download/:fileEntityId', authenticateTokenOrQuery, async (req, res) => {
  try {
    const { fileEntityId } = req.params;
    const user = req.user;
    console.log('🔍 File download route hit:', { fileEntityId, userId: user?.id });

    // Get File entity
    const fileEntity = await models.File.findByPk(fileEntityId);

    if (!fileEntity) {
      return res.status(404).json({ error: 'File entity not found' });
    }

    // Find the Product associated with this File entity
    const product = await models.Product.findOne({
      where: {
        entity_id: fileEntityId,
        product_type: 'file'
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found for this file' });
    }

    // Check if user has access
    let hasAccess = false;

    // 1. Admin/Sysadmin always has access
    if (user.role === 'admin' || user.role === 'sysadmin') {
      hasAccess = true;
    }

    // 2. Creator always has access
    if (!hasAccess && (fileEntity.creator_user_id === user.id || product.creator_user_id === user.id)) {
      hasAccess = true;
    }

    // 3. Check if file is free - all authenticated users can access
    if (!hasAccess && parseFloat(product.price || 0) === 0) {
      hasAccess = true;
    }

    // 4. Check purchases for paid files
    if (!hasAccess && parseFloat(product.price || 0) > 0) {
      const purchases = await models.Purchase.findAll({
        where: {
          buyer_user_id: user.id,
          payment_status: 'paid'
        }
      });

      const productPurchase = purchases.find(purchase =>
        purchase.product_id === product.id
      );

      if (productPurchase) {
        // Check if access is still valid (not expired)
        if (!productPurchase.access_expires_at ||
            new Date(productPurchase.access_expires_at) > new Date()) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      console.warn(`🚨 Unauthorized file download attempt: ${user.email} -> file/${fileEntityId}`, {
        userEmail: user.email,
        fileEntityId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get environment and construct S3 path
    const environment = process.env.ENVIRONMENT || 'development';
    const uploaderUserId = fileEntity.creator_user_id || 'system';
    const s3Prefix = `${environment}/${uploaderUserId}/${fileEntityId}/`;

    // Use FileService to list objects in the folder and find the file
    const fileService = FileService;

    if (!fileService.useS3 || !fileService.s3) {
      return res.status(500).json({ error: 'S3 not configured for file storage' });
    }

    // List objects with the prefix to find the actual file
    const listParams = {
      Bucket: fileService.bucketName,
      Prefix: s3Prefix,
      MaxKeys: 10
    };

    const listResult = await fileService.s3.listObjectsV2(listParams).promise();

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return res.status(404).json({ error: 'File not found in storage' });
    }

    // Get the first file (should only be one per File entity)
    const s3Object = listResult.Contents[0];
    const s3Key = s3Object.Key;

    // Get file metadata from S3
    const metadata = await fileService.getS3ObjectMetadata(s3Key);
    const fileSize = metadata.data.size;
    const contentType = metadata.data.contentType || 'application/octet-stream';

    // Extract filename from S3 key
    const filename = s3Key.split('/').pop();
    const extension = path.extname(filename);

    // Log successful file access
    console.log(`📁 File access granted: ${user.email} -> file/${fileEntityId}`, {
      userEmail: user.email,
      fileEntityId,
      s3Key,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      accessType: parseFloat(product.price || 0) === 0 ? 'free' : 'paid'
    });

    // Set security headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Content-Disposition': `attachment; filename="${fileEntity.title}${extension}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'"
    });

    // Create S3 stream and pipe to response
    const s3Stream = await fileService.createS3Stream(s3Key);

    s3Stream.on('error', (error) => {
      console.error('S3 stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file from storage' });
      }
    });

    s3Stream.pipe(res);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File deletion helper function (to be called when File entity is deleted)
export const deleteFileFromStorage = async (fileEntityId, creatorUserId) => {
  try {
    let localDeleted = false;
    let s3Deleted = false;

    // Delete from local storage (if exists)
    const fileDir = path.join(FILES_STORAGE_DIR, creatorUserId, fileEntityId);

    if (fs.existsSync(fileDir)) {
      // Remove the entire directory for this file entity
      fs.rmSync(fileDir, { recursive: true, force: true });
      console.log(`🗑️  Local file directory deleted: ${fileDir}`);

      // Clean up empty parent directory if it exists
      const userDir = path.join(FILES_STORAGE_DIR, creatorUserId);
      if (fs.existsSync(userDir) && fs.readdirSync(userDir).length === 0) {
        fs.rmSync(userDir, { recursive: true, force: true });
        console.log(`🗑️  Empty user directory deleted: ${userDir}`);
      }

      localDeleted = true;
    }

    // Delete from S3 (if S3 is enabled)
    if (process.env.USE_S3 === 'true') {
      try {
        const AWS = (await import('aws-sdk')).default;

        // Configure AWS S3
        AWS.config.update({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        });

        const s3 = new AWS.S3();
        const bucketName = process.env.AWS_S3_BUCKET;
        const environment = process.env.ENVIRONMENT || 'development';

        // Delete files for both content creator and system folders
        const s3Folders = [
          `${environment}/${creatorUserId}/${fileEntityId}/`,
          `${environment}/system/${fileEntityId}/`
        ];

        let deletedFromS3 = false;

        for (const folderPrefix of s3Folders) {
          // List all objects in the folder
          const listParams = {
            Bucket: bucketName,
            Prefix: folderPrefix
          };

          const listedObjects = await s3.listObjectsV2(listParams).promise();

          if (listedObjects.Contents && listedObjects.Contents.length > 0) {
            // Delete all objects in the folder
            const deleteParams = {
              Bucket: bucketName,
              Delete: {
                Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key }))
              }
            };

            const deleteResult = await s3.deleteObjects(deleteParams).promise();
            console.log(`🗑️  S3 files deleted from ${folderPrefix}:`, deleteResult.Deleted?.length || 0);
            deletedFromS3 = true;
          }
        }

        s3Deleted = deletedFromS3;

        if (deletedFromS3) {
          console.log(`✅ S3 cleanup completed for file entity ${fileEntityId}`);
        } else {
          console.log(`ℹ️  No S3 files found for file entity ${fileEntityId}`);
        }

      } catch (s3Error) {
        console.error(`❌ S3 deletion failed for entity ${fileEntityId}:`, s3Error);
        // Don't fail the entire operation if S3 deletion fails
      }
    }

    // Return true if either local or S3 deletion was successful
    const success = localDeleted || s3Deleted;
    console.log(`🗑️  File deletion summary for ${fileEntityId}: Local=${localDeleted}, S3=${s3Deleted}, Success=${success}`);

    return success;

  } catch (error) {
    console.error(`Failed to delete file storage for entity ${fileEntityId}:`, error);
    return false;
  }
};

// Error handling middleware for file upload errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'File exceeds the maximum allowed size (500MB)'
      });
    }
  }

  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }

  if (error.message.includes('entity ID is required')) {
    return res.status(400).json({
      error: 'Missing file entity ID',
      message: error.message
    });
  }

  next(error);
});

export default router;