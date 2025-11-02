import express from 'express';
import AuthService from '../services/AuthService.js';
import fileService from '../services/FileService.js';
import db from '../models/index.js';

const router = express.Router();
const authService = new AuthService();

/**
 * Helper: Check if user has access to private video content
 *
 * Access is granted if:
 * - User is admin
 * - User is the creator
 * - Content is free (no purchase required)
 * - User has valid purchase
 *
 * @param {Object} user - Authenticated user object
 * @param {string} entityType - Type of entity (workshop, course, file, tool)
 * @param {string} entityId - ID of the entity
 * @returns {Promise<boolean>} True if user has access
 */
async function checkVideoAccess(user, entityType, entityId) {
  if (user.role === 'admin' || user.role === 'sysadmin') {
    return true;
  }
  
  // Check if content is free by looking up the Product
  let isFree = false;
  try {
    // Get the Product associated with this entity
    const product = await db.Product.findOne({
      where: {
        product_type: entityType,
        entity_id: entityId
      }
    });
    
    if (product.creator_user_id === user.id) {
      return true;
    }
    isFree = product ? parseFloat(product.price || 0) === 0 : false;
  } catch (error) {
    console.error('Error checking product price:', error);
    // Default to not free if we can't determine price
    isFree = false;
  }

  if (isFree) {
    // Auto-create purchase record for free content with transaction safety
    try {
      const { sequelize } = db;
      const transaction = await sequelize.transaction();

      try {
        const orderNumber = `FREE-AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Use findOrCreate within transaction to prevent race conditions
        const [purchase, created] = await db.Purchase.findOrCreate({
          where: {
            buyer_user_id: user.id,
            purchasable_type: entityType,
            purchasable_id: entityId
          },
          defaults: {
            id: `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order_number: orderNumber,
            buyer_user_id: user.id,
            purchasable_type: entityType,
            purchasable_id: entityId,
            payment_status: 'completed',
            payment_amount: 0,
            original_price: 0,
            access_expires_at: null,
            first_accessed_at: new Date()
          },
          transaction
        });

        await transaction.commit();

        if (created) {
          console.log(`✅ Auto-created purchase record for free content: ${user.id} -> ${entityType}/${entityId}`);
        } else {
          console.log(`ℹ️ Purchase record already exists for free content: ${user.id} -> ${entityType}/${entityId}`);
        }

      } catch (transactionError) {
        await transaction.rollback();
        console.error('❌ Auto-purchase transaction failed, rolled back:', transactionError);
        // Still return true for free content access, even if purchase record creation failed
        console.warn(`⚠️ Allowing free content access despite purchase record creation failure: ${user.id} -> ${entityType}/${entityId}`);
      }
    } catch (error) {
      console.error('❌ Failed to create auto-access record transaction:', error);
      // Still return true for free content access
      console.warn(`⚠️ Allowing free content access despite transaction setup failure: ${user.id} -> ${entityType}/${entityId}`);
    }

    return true;
  }

  // Check if user has purchased this content
  const purchases = await db.Purchase.findAll({
    where: {
      buyer_user_id: user.id,
      payment_status: 'completed'
    }
  });

  const validPurchase = purchases.find(purchase => {
    if (purchase.purchasable_id !== entityId || purchase.purchasable_type !== entityType) {
      return false;
    }

    // Check if access is still valid (not expired)
    if (!purchase.access_expires_at || new Date(purchase.access_expires_at) > new Date()) {
      return true;
    }

    return false;
  });

  return !!validPurchase;
}

/**
 * Helper: Determine if entity type has marketing videos (public access)
 *
 * @param {string} entityType - Type of entity
 * @returns {boolean} True if entity type can have marketing videos
 */
function isMarketingVideoType(entityType) {
  return ['workshop', 'course', 'file', 'tool'].includes(entityType);
}

/**
 * OPTIONS handler for video streaming endpoint (CORS preflight)
 */
router.options('/stream/:entityType/:entityId', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, Cache-Control, Pragma',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
  });
  res.status(200).end();
});

/**
 * Stream Video
 *
 * Unified streaming endpoint for all videos (marketing and private content).
 * Automatically detects if video is public marketing or private content.
 * Marketing videos (public) require no authentication.
 * Private content videos require authentication and access check.
 *
 * S3 Path Structure:
 * - Marketing videos: {env}/public/marketing-video/{entityType}/{entityId}/video.mp4
 * - Private videos: {env}/private/content-video/{entityType}/{entityId}/video.mp4
 *
 * @route GET /api/media/stream/:entityType/:entityId
 * @access Public for marketing videos, Private for content videos
 *
 * @param {string} entityType - Type of entity (workshop, course, file, tool, etc.)
 * @param {string} entityId - ID of the entity
 * @queryparam {string} [token] - Auth token (for private videos, alternative to header)
 * @queryparam {string} [authToken] - Auth token (alias, for private videos)
 * @header {string} [Authorization] - Bearer token (for private videos)
 * @header {string} [Range] - Byte range for partial content (video seeking)
 *
 * @returns {200} Full video stream
 * @returns {206} Partial content (range request)
 * @returns {401} Unauthorized (private video, no token)
 * @returns {403} Forbidden (no access to private video)
 * @returns {404} Video not found
 * @returns {500} Server error
 *
 * @example Marketing Video (Public - No Auth Required)
 * GET /api/media/stream/workshop/abc123
 *
 * Response: 200 OK or 206 Partial Content
 * Content-Type: video/mp4
 * Accept-Ranges: bytes
 * [Binary video stream]
 *
 * @example Private Video (Auth Required)
 * GET /api/media/stream/course/xyz789
 * Authorization: Bearer eyJhbGc...
 *
 * Response: 200 OK or 206 Partial Content (if user has access)
 * Content-Type: video/mp4
 * Accept-Ranges: bytes
 * [Binary video stream]
 *
 * @example Private Video with Query Token
 * GET /api/media/stream/course/xyz789?authToken=eyJhbGc...
 *
 * Response: 200 OK or 206 Partial Content (if user has access)
 *
 * @example Video Seeking (Range Request)
 * GET /api/media/stream/workshop/abc123
 * Range: bytes=1024000-2048000
 *
 * Response: 206 Partial Content
 * Content-Range: bytes 1024000-2048000/52428800
 * Content-Length: 1024001
 * [Binary video chunk]
 */
router.get('/stream/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const env = process.env.ENVIRONMENT || 'development';


    // Determine if this is a potential marketing video type
    const canBeMarketing = isMarketingVideoType(entityType);

    // Try marketing video first (public - no auth required)
    if (canBeMarketing) {
      const marketingS3Key = `${env}/public/marketing-video/${entityType}/${entityId}/video.mp4`;

      try {
        // Check if marketing video exists in S3
        const metadataResult = await fileService.getS3ObjectMetadata(marketingS3Key);

        if (metadataResult.success) {
          console.log(`📺 Serving public marketing video: ${entityType}/${entityId}`);

          const metadata = metadataResult.data;
          const fileSize = metadata.size;
          const range = req.headers.range;

          // Set CORS and cache headers for public content
          const headers = {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400', // Public cache for 24 hours
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'false',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
            'X-Content-Type': 'marketing-video',
            'X-Entity-Type': entityType,
            'X-Entity-ID': entityId
          };

          if (range) {
            // Parse range header
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
            const rangeStream = await fileService.createS3Stream(marketingS3Key, { start, end });

            // Set partial content headers
            res.status(206).set({
              ...headers,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': chunkSize
            });

            rangeStream.pipe(res);

            rangeStream.on('error', (error) => {
              console.error('❌ Marketing video range stream error:', error);
              if (!res.headersSent) {
                res.status(500).json({
                  error: 'Stream error',
                  message: 'Failed to stream marketing video content'
                });
              }
            });

            return; // Marketing video served successfully
          } else {
            // No range header - send full stream
            const stream = await fileService.createS3Stream(marketingS3Key);

            res.set({
              ...headers,
              'Content-Length': fileSize
            });

            stream.pipe(res);

            stream.on('error', (error) => {
              console.error('❌ Marketing video stream error:', error);
              if (!res.headersSent) {
                res.status(500).json({
                  error: 'Stream error',
                  message: 'Failed to stream marketing video content'
                });
              }
            });

            return; // Marketing video served successfully
          }
        }
      } catch (marketingError) {
        // Marketing video not found, continue to check for private content video
        console.log(`ℹ️ No marketing video found, checking for private content video: ${entityType}/${entityId}`);
      }
    }

    // PRIVATE CONTENT VIDEO - Authentication required
    console.log(`🔐 Checking authentication for private content video: ${entityType}/${entityId}`);

    // Extract token from header or query
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
      token = authHeader.split(' ')[1]; // Bearer TOKEN
    } else if (req.query.authToken || req.query.token) {
      token = req.query.authToken || req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Private content requires authentication',
        hint: 'Provide token via Authorization header or query parameter (authToken or token)'
      });
    }

    // Verify token
    let user;
    try {
      user = await authService.verifyToken(token);
      console.log(`🔐 Token verified for user: ${user.id}`);
    } catch (authError) {
      console.error('🔐 Token verification failed:', authError);
      return res.status(403).json({
        error: 'Invalid or expired token',
        message: authError.message || 'Token verification failed'
      });
    }

    // Check access to private content
    const hasAccess = await checkVideoAccess(user, entityType, entityId);

    if (!hasAccess) {
      console.warn(`🚨 Unauthorized video access attempt: ${user.email} -> ${entityType}/${entityId}`, {
        userEmail: user.email,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this video',
        hint: 'Purchase the content or contact the creator for access'
      });
    }

    // User has access - serve private content video
    console.log(`✅ Video access granted: ${user.email} -> ${entityType}/${entityId}`);

    const privateS3Key = `${env}/private/content-video/${entityType}/${entityId}/video.mp4`;

    try {
      // Get video metadata
      const metadataResult = await fileService.getS3ObjectMetadata(privateS3Key);

      if (!metadataResult.success) {
        return res.status(404).json({
          error: 'Video not found',
          message: `Private video for ${entityType}/${entityId} not found in storage`
        });
      }

      const metadata = metadataResult.data;
      const fileSize = metadata.size;
      const range = req.headers.range;

      // Set headers for private content
      const headers = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "default-src 'self'",
        'Content-Disposition': 'inline',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
        'X-Content-Type': 'private-video',
        'X-Entity-Type': entityType,
        'X-Entity-ID': entityId
      };

      if (range) {
        // Parse range header
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
        const rangeStream = await fileService.createS3Stream(privateS3Key, { start, end });

        // Set partial content headers
        res.status(206).set({
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize
        });

        rangeStream.pipe(res);

        rangeStream.on('error', (error) => {
          console.error('❌ Private video range stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Stream error',
              message: 'Failed to stream private video content'
            });
          }
        });

      } else {
        // No range header - send full stream
        const stream = await fileService.createS3Stream(privateS3Key);

        res.set({
          ...headers,
          'Content-Length': fileSize
        });

        stream.pipe(res);

        stream.on('error', (error) => {
          console.error('❌ Private video stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Stream error',
              message: 'Failed to stream private video content'
            });
          }
        });
      }

    } catch (s3Error) {
      console.error('❌ S3 streaming error:', s3Error);
      return res.status(404).json({
        error: 'Video not found',
        message: `Video for ${entityType}/${entityId} not found in storage`,
        details: s3Error.message
      });
    }

  } catch (error) {
    console.error('❌ Video streaming error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process video stream request'
      });
    }
  }
});

export default router;
