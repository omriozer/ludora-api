import express from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken as requireAuth } from '../middleware/auth.js';
import { checkVideoAccess, videoAccessMiddleware } from '../services/videoAccessControl.js';

const router = express.Router();

// Convert fs methods to async
const stat = promisify(fs.stat);
const access = promisify(fs.access);

// Video storage directory
const VIDEO_STORAGE_DIR = path.resolve('./uploads/videos');

// Ensure videos directory exists
if (!fs.existsSync(VIDEO_STORAGE_DIR)) {
  fs.mkdirSync(VIDEO_STORAGE_DIR, { recursive: true });
}

/**
 * Video streaming endpoint with HTTP Range support and access control
 * GET /api/videos/:videoId/stream
 */
router.get('/:videoId/stream', requireAuth, videoAccessMiddleware, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Construct the video file path
    // In a real application, you might store the actual file path in the database
    const videoPath = path.join(VIDEO_STORAGE_DIR, `${videoId}.mp4`);
    
    // Check if the video file exists
    try {
      await access(videoPath, fs.constants.F_OK);
    } catch (error) {
      return res.status(404).json({
        error: 'Video file not found',
        message: `Video file for ID ${videoId} does not exist on storage`,
        videoId: videoId
      });
    }

    // Get file statistics
    const stats = await stat(videoPath);
    const fileSize = stats.size;
    
    // Check if this is a range request
    const range = req.headers.range;
    
    // Log access for analytics
    console.log(`Video access: User ${req.user.id} accessing video ${videoId} via ${req.videoAccess.reason}`);
    
    if (range) {
      // Parse the range header
      // Format: "bytes=start-end" or "bytes=start-"
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
      
      // Create a read stream for the specified range
      const stream = fs.createReadStream(videoPath, { start, end });
      
      // Set partial content headers
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour but keep private
        'X-Access-Type': req.videoAccess.reason, // Custom header for debugging
        'X-Video-ID': videoId
      });
      
      // Pipe the stream to the response
      stream.pipe(res);
      
      // Handle stream errors
      stream.on('error', (error) => {
        console.error('Video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error', message: 'Failed to stream video content' });
        }
      });
      
    } else {
      // No range header - send the entire file
      
      // Create a read stream for the entire file
      const stream = fs.createReadStream(videoPath);
      
      // Set headers for full content
      res.set({
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour but keep private
        'X-Access-Type': req.videoAccess.reason, // Custom header for debugging
        'X-Video-ID': videoId
      });
      
      // Pipe the stream to the response
      stream.pipe(res);
      
      // Handle stream errors
      stream.on('error', (error) => {
        console.error('Video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error', message: 'Failed to stream video content' });
        }
      });
    }
    
  } catch (error) {
    console.error('Video streaming error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process video request'
      });
    }
  }
});

/**
 * Check video access endpoint (for debugging/frontend)
 * GET /api/videos/:videoId/access
 */
router.get('/:videoId/access', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = req.user;

    const accessResult = await checkVideoAccess(user.id, videoId);
    
    res.json({
      videoId: videoId,
      userId: user.id,
      userEmail: user.email,
      access: accessResult
    });
    
  } catch (error) {
    console.error('Error checking video access:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check video access'
    });
  }
});

/**
 * Video upload endpoint
 * POST /api/videos/upload
 */

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEO_STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using UUID
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, uniqueId + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No video file uploaded',
        message: 'Please select a video file to upload'
      });
    }

    // Extract the video ID from the filename (without extension)
    const videoId = path.parse(req.file.filename).name;

    // Log the upload
    console.log(`Video uploaded: ${req.file.filename} by user ${req.user.id}`);

    res.json({
      success: true,
      videoId: videoId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      // Return the streaming URL (with access control)
      streamUrl: `/api/videos/${videoId}/stream`,
      // Add file_uri for ProductModal compatibility (private file)
      file_uri: `/api/videos/${videoId}/stream`,
      accessCheckUrl: `/api/videos/${videoId}/access`,
      uploadedBy: req.user.id,
      uploadedAt: new Date().toISOString(),
      message: 'Video uploaded successfully'
    });
    
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to process video upload'
    });
  }
});

/**
 * Get video metadata
 * GET /api/videos/:videoId/info
 */
router.get('/:videoId/info', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = req.user;

    // First check if user has access
    const accessResult = await checkVideoAccess(user.id, videoId);
    
    if (!accessResult.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this video information'
      });
    }

    // Get file info if it exists
    const videoPath = path.join(VIDEO_STORAGE_DIR, `${videoId}.mp4`);
    
    try {
      await access(videoPath, fs.constants.F_OK);
      const stats = await stat(videoPath);
      
      res.json({
        videoId: videoId,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        streamUrl: `/api/videos/${videoId}/stream`,
        accessType: accessResult.reason,
        hasAccess: true
      });
      
    } catch (error) {
      // File doesn't exist physically, but user has access to the video reference
      res.json({
        videoId: videoId,
        streamUrl: `/api/videos/${videoId}/stream`,
        accessType: accessResult.reason,
        hasAccess: true,
        fileExists: false,
        message: 'Video reference found but file not available on storage'
      });
    }
    
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to get video information'
    });
  }
});

/**
 * List user's accessible videos
 * GET /api/videos/my-videos
 */
router.get('/my-videos', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    
    // This would typically involve querying the database for user's purchased products
    // and subscription access, then checking which videos they can access
    
    // For now, we'll return a basic structure
    // In a real implementation, you'd query purchases and subscriptions
    
    res.json({
      message: 'This endpoint would list all videos the user has access to',
      userId: user.id,
      implementation: 'TODO: Implement based on purchases and subscriptions'
    });
    
  } catch (error) {
    console.error('Error listing user videos:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to list accessible videos'
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Video file exceeds the maximum allowed size (10GB)'
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