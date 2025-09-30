import express from 'express';
import multer from 'multer';
import { authenticateToken as requireAuth } from '../middleware/auth.js';
import fileService from '../services/FileService.js';

const router = express.Router();

// Configure multer for video uploads (memory storage for S3)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit for videos
  },
  fileFilter: (req, file, cb) => {
    console.log(`🔍 Multer fileFilter - File mimetype: "${file.mimetype}", originalname: "${file.originalname}"`);
    // Only allow video files
    if (file.mimetype.startsWith('video/')) {
      console.log(`✅ Multer: Video file accepted`);
      cb(null, true);
    } else {
      console.error(`❌ Multer: Non-video file rejected - mimetype: ${file.mimetype}`);
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

/**
 * Check if marketing video exists
 * GET /api/files/check-marketing-video
 * Query params: entityType, entityId
 */
router.get('/check-marketing-video', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    console.log(`Marketing video existence check: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    // Generate the S3 key for the public marketing video
    const environment = process.env.ENVIRONMENT || 'development';
    const s3Key = `${environment}/public/marketing/videos/${entityType}/${entityId}/video.mp4`;

    try {
      // Check if video exists in S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

      if (metadataResult.success) {
        const metadata = metadataResult.data;
        // Generate public URL for marketing video
        const publicUrl = `https://${process.env.AWS_S3_BUCKET || 'ludora-files'}.s3.${process.env.AWS_REGION || 'eu-central-1'}.amazonaws.com/${s3Key}`;

        res.json({
          success: true,
          exists: true,
          entityType,
          entityId,
          fileName: 'video.mp4',
          size: metadata.size,
          mimeType: metadata.contentType,
          url: publicUrl,
          file_uri: publicUrl,
          streamUrl: publicUrl,
          lastModified: metadata.lastModified,
          accessLevel: 'public',
          s3Key: s3Key,
          message: 'Marketing video exists'
        });
      } else {
        res.json({
          success: true,
          exists: false,
          entityType,
          entityId,
          message: 'No marketing video found'
        });
      }

    } catch (s3Error) {
      console.log('Marketing video not found in S3:', s3Error.message);
      res.json({
        success: true,
        exists: false,
        entityType,
        entityId,
        message: 'No marketing video found'
      });
    }

  } catch (error) {
    console.error('Marketing video check error:', error);
    res.status(500).json({
      error: 'Check failed',
      message: 'Failed to check for marketing video'
    });
  }
});

/**
 * Check if public marketing video exists (legacy endpoint for upload flow)
 * GET /api/files/upload-public-video
 * Query params: entityType, entityId
 */
router.get('/upload-public-video', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    console.log(`Marketing video check: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    // Generate the S3 key for the public marketing video
    const environment = process.env.ENVIRONMENT || 'development';
    const s3Key = `${environment}/public/marketing/videos/${entityType}/${entityId}/video.mp4`;

    try {
      // Check if video exists in S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);

      if (metadataResult.success) {
        const metadata = metadataResult.data;
        // Generate public URL for marketing video
        const publicUrl = `https://${process.env.AWS_S3_BUCKET || 'ludora-files'}.s3.${process.env.AWS_REGION || 'eu-central-1'}.amazonaws.com/${s3Key}`;

        res.json({
          success: true,
          exists: true,
          entityType,
          entityId,
          fileName: 'video.mp4',
          size: metadata.size,
          mimeType: metadata.contentType,
          url: publicUrl,
          file_uri: publicUrl,
          streamUrl: publicUrl,
          lastModified: metadata.lastModified,
          accessLevel: 'public',
          s3Key: s3Key,
          message: 'Marketing video exists'
        });
      } else {
        res.json({
          success: true,
          exists: false,
          entityType,
          entityId,
          message: 'No marketing video found'
        });
      }

    } catch (s3Error) {
      console.log('Marketing video not found in S3:', s3Error.message);
      res.json({
        success: true,
        exists: false,
        entityType,
        entityId,
        message: 'No marketing video found'
      });
    }

  } catch (error) {
    console.error('Marketing video check error:', error);
    res.status(500).json({
      error: 'Check failed',
      message: 'Failed to check for marketing video'
    });
  }
});

/**
 * Upload public marketing video
 * POST /api/files/upload-public-video
 * Query params: entityType, entityId
 */
router.post('/upload-public-video', requireAuth, videoUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No video file uploaded',
        message: 'Please select a video file to upload'
      });
    }

    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    console.log(`Public video upload: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    try {
      // Upload to S3 using FileService - PUBLIC storage for marketing videos
      const uploadResult = await fileService.uploadPublicVideo({
        file: req.file,
        entityType,
        entityId,
        userId: req.user.id
      });

      if (!uploadResult.success) {
        throw new Error('Failed to upload to S3');
      }

      const { data } = uploadResult;

      res.json({
        success: true,
        entityType,
        entityId,
        fileName: data.fileName,
        originalName: req.file.originalname,
        size: data.size,
        mimeType: data.mimeType,
        // Return the direct S3 URL for public access (no authentication required)
        url: data.url,
        file_uri: data.url,
        streamUrl: data.url,
        uploadedBy: req.user.id,
        uploadedAt: data.uploadedAt,
        accessLevel: data.accessLevel,
        s3Key: data.key,
        message: 'Public marketing video uploaded successfully to S3'
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'Failed to upload video to S3: ' + uploadError.message
      });
    }

  } catch (error) {
    console.error('Public video upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process public video upload'
    });
  }
});

/**
 * Upload private video
 * POST /api/files/upload-private-video
 * Query params: entityType, entityId
 */
router.post('/upload-private-video', requireAuth, videoUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No video file uploaded',
        message: 'Please select a video file to upload'
      });
    }

    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    console.log(`Private video upload: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    try {
      // Upload to S3 using FileService - PRIVATE storage
      const uploadResult = await fileService.uploadPrivateVideo({
        file: req.file,
        entityType,
        entityId,
        userId: req.user.id
      });

      if (!uploadResult.success) {
        throw new Error('Failed to upload to S3');
      }

      const { data } = uploadResult;

      res.json({
        success: true,
        entityType,
        entityId,
        fileName: data.fileName,
        originalName: req.file.originalname,
        size: data.size,
        mimeType: data.mimeType,
        // Return the API streaming URL for private access (requires authentication)
        url: data.url,
        file_uri: data.url,
        streamUrl: data.url,
        uploadedBy: req.user.id,
        uploadedAt: data.uploadedAt,
        accessLevel: data.accessLevel,
        s3Key: data.key,
        message: 'Private video uploaded successfully to S3'
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'Failed to upload video to S3: ' + uploadError.message
      });
    }

  } catch (error) {
    console.error('Private video upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process private video upload'
    });
  }
});

/**
 * Stream private video
 * GET /api/files/stream-video/:entityType/:entityId
 */
router.get('/stream-video/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    // Generate the S3 key for the private video
    const environment = process.env.ENVIRONMENT || 'development';
    const s3Key = `${environment}/private/content/videos/${entityType}/${entityId}/video.mp4`;

    console.log(`Private video stream request: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    // TODO: Add access control logic here based on entityType and entityId
    // For now, any authenticated user can access any private video
    // In production, you'd check if user has purchased/subscribed to the entity

    try {
      // Get video metadata from S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);
      if (!metadataResult.success) {
        return res.status(404).json({
          error: 'Video not found',
          message: `Video for ${entityType}/${entityId} not found`
        });
      }

      const metadata = metadataResult.data;
      const fileSize = metadata.size;

      // Create S3 stream
      const stream = await fileService.createS3Stream(s3Key);

      // Handle range requests for video streaming
      const range = req.headers.range;

      if (range) {
        // Parse the range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          return res.status(416).set({
            'Content-Range': `bytes */${fileSize}`
          }).json({
            error: 'Range not satisfiable',
            message: 'The requested range is invalid'
          });
        }

        const chunkSize = (end - start) + 1;

        // Set partial content headers
        res.status(206).set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'private, max-age=3600',
          'X-Entity-Type': entityType,
          'X-Entity-ID': entityId
        });
      } else {
        // No range header - set headers for full content
        res.set({
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
          'X-Entity-Type': entityType,
          'X-Entity-ID': entityId
        });
      }

      // Pipe the S3 stream to the response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error) => {
        console.error('Video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error', message: 'Failed to stream video content' });
        }
      });

    } catch (s3Error) {
      console.error('S3 streaming error:', s3Error);
      return res.status(404).json({
        error: 'Video not found',
        message: `Video for ${entityType}/${entityId} not found in storage`
      });
    }

  } catch (error) {
    console.error('Video streaming error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process video stream request'
      });
    }
  }
});

/**
 * Delete marketing video
 * DELETE /api/files/marketing-video
 * Query params: entityType, entityId
 */
router.delete('/marketing-video', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'entityType and entityId are required as query parameters'
      });
    }

    console.log(`Marketing video delete request: User ${req.user.id}, EntityType: ${entityType}, EntityId: ${entityId}`);

    // Generate the S3 key for the public marketing video
    const environment = process.env.ENVIRONMENT || 'development';
    const s3Key = `${environment}/public/marketing/videos/${entityType}/${entityId}/video.mp4`;

    try {
      // Delete from S3 using FileService
      const deleteResult = await fileService.deleteS3Object(s3Key);

      if (deleteResult.success) {
        res.json({
          success: true,
          entityType,
          entityId,
          s3Key: s3Key,
          message: 'Marketing video deleted successfully'
        });
      } else {
        return res.status(404).json({
          error: 'Video not found',
          message: `Marketing video for ${entityType}/${entityId} not found or already deleted`
        });
      }

    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      if (s3Error.code === 'NoSuchKey') {
        return res.status(404).json({
          error: 'Video not found',
          message: `Marketing video for ${entityType}/${entityId} not found`
        });
      }
      
      return res.status(500).json({
        error: 'Delete failed',
        message: 'Failed to delete marketing video from storage: ' + s3Error.message
      });
    }

  } catch (error) {
    console.error('Marketing video delete error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: 'Failed to process marketing video delete request'
    });
  }
});

/**
 * Stream public marketing video (no authentication required)
 * GET /api/files/stream-marketing-video/:entityType/:entityId
 */
router.get('/stream-marketing-video/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    // Generate the S3 key for the public marketing video
    const environment = process.env.ENVIRONMENT || 'development';
    const s3Key = `${environment}/public/marketing/videos/${entityType}/${entityId}/video.mp4`;

    console.log(`Marketing video stream request: EntityType: ${entityType}, EntityId: ${entityId}`);

    try {
      // Get video metadata from S3
      const metadataResult = await fileService.getS3ObjectMetadata(s3Key);
      if (!metadataResult.success) {
        return res.status(404).json({
          error: 'Marketing video not found',
          message: `Marketing video for ${entityType}/${entityId} not found`
        });
      }

      const metadata = metadataResult.data;
      const fileSize = metadata.size;

      // Create S3 stream
      const stream = await fileService.createS3Stream(s3Key);

      // Handle range requests for video streaming
      const range = req.headers.range;

      if (range) {
        // Parse the range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          return res.status(416).set({
            'Content-Range': `bytes */${fileSize}`
          }).json({
            error: 'Range not satisfiable',
            message: 'The requested range is invalid'
          });
        }

        const chunkSize = (end - start) + 1;

        // Create range stream
        const rangeStream = await fileService.createS3Stream(s3Key, { start, end });

        // Set partial content headers
        res.status(206).set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=86400', // Public cache for 24 hours
          'X-Content-Type': 'marketing-video',
          'X-Entity-Type': entityType,
          'X-Entity-ID': entityId
        });

        rangeStream.pipe(res);

        rangeStream.on('error', (error) => {
          console.error('Marketing video range stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error', message: 'Failed to stream marketing video content' });
          }
        });

      } else {
        // No range header - send the entire file
        res.set({
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400', // Public cache for 24 hours
          'X-Content-Type': 'marketing-video',
          'X-Entity-Type': entityType,
          'X-Entity-ID': entityId
        });

        stream.pipe(res);

        stream.on('error', (error) => {
          console.error('Marketing video stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error', message: 'Failed to stream marketing video content' });
          }
        });
      }

    } catch (s3Error) {
      console.error('S3 marketing video streaming error:', s3Error);
      return res.status(404).json({
        error: 'Marketing video not found',
        message: `Marketing video for ${entityType}/${entityId} not found in storage`
      });
    }

  } catch (error) {
    console.error('Marketing video streaming error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process marketing video stream request'
      });
    }
  }
});

// Error handling middleware for multer errors
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Video file exceeds the maximum allowed size (5GB)'
      });
    }
  }

  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only video files are allowed for upload'
    });
  }

  next(error);
});


export default router;