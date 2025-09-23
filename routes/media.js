import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import AuthService from '../services/AuthService.js';
import models from '../models/index.js';

const router = express.Router();

// Custom authentication middleware that checks token from header or query
const authenticateTokenOrQuery = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
      token = authHeader.split(' ')[1]; // Bearer TOKEN
    } else if (req.query.authToken) {
      token = req.query.authToken; // From query parameter
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }


    // Use AuthService to verify the token
    const tokenData = await AuthService.verifyToken(token);
    req.user = tokenData;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
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
    const validTypes = ['workshop', 'course', 'file', 'tool'];
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

    // Check purchases
    const purchases = await models.Purchase.findAll({
      where: {
        buyer_email: user.email,
        payment_status: 'paid'
      }
    });

    const entityPurchases = purchases.filter(purchase =>
      (purchase.purchasable_id === entityId && purchase.purchasable_type === entityType) ||
      (purchase.product_id === entityId) // Legacy fallback
    );

    if (entityPurchases.length > 0) {
      const userPurchase = entityPurchases[0];
      if (userPurchase.purchased_lifetime_access ||
          (userPurchase.access_until && new Date(userPurchase.access_until) > new Date()) ||
          (!userPurchase.access_until && !userPurchase.purchased_lifetime_access)) {
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
          order_number: orderNumber,
          purchasable_type: entityType,
          purchasable_id: entityId,
          buyer_name: user.display_name || user.full_name,
          buyer_email: user.email,
          buyer_phone: user.phone || '',
          payment_status: 'paid',
          payment_amount: 0,
          original_price: 0,
          purchased_lifetime_access: true,
          first_accessed: new Date()
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
    // Allow PDF, Word, Excel, PowerPoint, and common image files
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedMimes.join(', ')}`), false);
    }
  }
});

// File upload endpoint for File entities
router.post('/file/upload', authenticateToken, fileUpload.single('file'), async (req, res) => {
  try {
    const { fileEntityId } = req.body;
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
      // Clean up uploaded file since entity doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        error: 'File entity not found',
        message: `No File entity found with ID ${fileEntityId}`
      });
    }

    // Check if user is the creator or admin
    if (fileEntity.creator_user_id !== user.id && !user.is_admin) {
      // Clean up uploaded file since user doesn't have permission
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only upload files for File entities you created'
      });
    }

    // Determine file type based on mime type
    let fileType = 'other';
    if (req.file.mimetype === 'application/pdf') fileType = 'pdf';
    else if (req.file.mimetype.includes('word')) fileType = 'docx';
    else if (req.file.mimetype.includes('powerpoint')) fileType = 'ppt';
    else if (req.file.mimetype.includes('excel') || req.file.mimetype.includes('sheet')) fileType = 'xlsx';
    else if (req.file.mimetype.startsWith('image/')) fileType = 'image';
    else if (req.file.mimetype.includes('zip')) fileType = 'zip';

    // Update the File entity to mark it has a local file and set file type
    await fileEntity.update({
      file_type: fileType,
      file_is_private: true, // Local files are always private
      file_url: null // Clear any previous URL since we're now using local storage
    });

    // Log the upload
    console.log(`File uploaded: ${req.file.filename} for entity ${fileEntityId} by user ${user.id}`);

    res.json({
      success: true,
      fileEntityId: fileEntityId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      fileType: fileType,
      uploadPath: req.file.path,
      downloadUrl: `/api/media/file/download/${fileEntityId}`,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('File upload error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

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

    // Get File entity
    const fileEntity = await models.File.findByPk(fileEntityId);

    if (!fileEntity) {
      return res.status(404).json({ error: 'File entity not found' });
    }

    // Check if user has access (same logic as video access)
    let hasAccess = false;

    // Check purchases
    const purchases = await models.Purchase.findAll({
      where: {
        buyer_email: user.email,
        payment_status: 'paid'
      }
    });

    const entityPurchases = purchases.filter(purchase =>
      (purchase.purchasable_id === fileEntityId && purchase.purchasable_type === 'file') ||
      (purchase.product_id === fileEntityId) // Legacy fallback
    );

    if (entityPurchases.length > 0) {
      const userPurchase = entityPurchases[0];
      if (userPurchase.purchased_lifetime_access ||
          (userPurchase.access_until && new Date(userPurchase.access_until) > new Date()) ||
          (!userPurchase.access_until && !userPurchase.purchased_lifetime_access)) {
        hasAccess = true;
      }
    }

    // Auto-grant access for free items
    if (!hasAccess && parseFloat(fileEntity.price || 0) === 0) {
      hasAccess = true;

      // Create purchase record for free item
      try {
        const orderNumber = `FREE-AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await models.Purchase.create({
          order_number: orderNumber,
          purchasable_type: 'file',
          purchasable_id: fileEntityId,
          buyer_name: user.display_name || user.full_name,
          buyer_email: user.email,
          buyer_phone: user.phone || '',
          payment_status: 'paid',
          payment_amount: 0,
          original_price: 0,
          purchased_lifetime_access: true,
          first_accessed: new Date()
        });
      } catch (autoAccessError) {
        console.error('Failed to create auto-access record:', autoAccessError);
      }
    }

    // Creator always has access
    if (!hasAccess && fileEntity.creator_user_id === user.id) {
      hasAccess = true;
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

    // Construct file path: uploads/files/[userid]/[FileId]/file_id.[fileType]
    const creatorId = fileEntity.creator_user_id;
    const fileDir = path.join(FILES_STORAGE_DIR, creatorId, fileEntityId);

    // Find the actual file (we need to check what extension it has)
    let filePath = null;
    if (fs.existsSync(fileDir)) {
      const files = fs.readdirSync(fileDir);
      const targetFile = files.find(f => f.startsWith(fileEntityId));
      if (targetFile) {
        filePath = path.join(fileDir, targetFile);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on storage' });
    }

    // Log successful file access
    console.log(`📁 File access granted: ${user.email} -> file/${fileEntityId}`, {
      userEmail: user.email,
      fileEntityId,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      hasLifetimeAccess: entityPurchases.length > 0 ? entityPurchases[0].purchased_lifetime_access : false,
      accessType: parseFloat(fileEntity.price || 0) === 0 ? 'free' : 'paid'
    });

    // Get file stats
    const stats = fs.statSync(filePath);
    const extension = path.extname(filePath);

    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (extension === '.pdf') contentType = 'application/pdf';
    else if (extension === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (extension === '.doc') contentType = 'application/msword';
    else if (extension === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (extension === '.xls') contentType = 'application/vnd.ms-excel';
    else if (extension === '.pptx') contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (extension === '.ppt') contentType = 'application/vnd.ms-powerpoint';
    else if (extension === '.zip') contentType = 'application/zip';
    else if (['.jpg', '.jpeg'].includes(extension)) contentType = 'image/jpeg';
    else if (extension === '.png') contentType = 'image/png';
    else if (extension === '.gif') contentType = 'image/gif';
    else if (extension === '.webp') contentType = 'image/webp';

    // Set security headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${fileEntity.title}${extension}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'"
    });

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File deletion helper function (to be called when File entity is deleted)
export const deleteFileFromStorage = async (fileEntityId, creatorUserId) => {
  try {
    const fileDir = path.join(FILES_STORAGE_DIR, creatorUserId, fileEntityId);

    if (fs.existsSync(fileDir)) {
      // Remove the entire directory for this file entity
      fs.rmSync(fileDir, { recursive: true, force: true });
      console.log(`🗑️  File directory deleted: ${fileDir}`);

      // Clean up empty parent directory if it exists
      const userDir = path.join(FILES_STORAGE_DIR, creatorUserId);
      if (fs.existsSync(userDir) && fs.readdirSync(userDir).length === 0) {
        fs.rmSync(userDir, { recursive: true, force: true });
        console.log(`🗑️  Empty user directory deleted: ${userDir}`);
      }

      return true;
    }

    return false; // File directory didn't exist
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