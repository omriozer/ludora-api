import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import EmailService from '../services/EmailService.js';
import CouponValidationService from '../services/CouponValidationService.js';
import CouponCodeGenerator from '../utils/couponCodeGenerator.js';
import models from '../models/index.js';
import EntityService from '../services/EntityService.js';

const router = express.Router();

// Get applicable public coupons for cart auto-suggestion
router.post('/getApplicableCoupons', authenticateToken, async (req, res) => {
  try {
    const { userId, cartItems, cartTotal } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.getApplicablePublicCoupons({
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get the best single coupon for a cart
router.post('/getBestCoupon', authenticateToken, async (req, res) => {
  try {
    const { userId, cartItems, cartTotal } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.getBestCouponForCart({
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate multiple coupons for stacking
router.post('/validateCouponStacking', authenticateToken, async (req, res) => {
  try {
    const { couponCodes, userId, cartItems, cartTotal } = req.body;

    if (!couponCodes || !Array.isArray(couponCodes) || couponCodes.length === 0) {
      return res.status(400).json({ error: 'Coupon codes are required' });
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.validateCouponStacking({
      couponCodes,
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Coupon Code Generation Endpoints
// Generate coupon codes with custom patterns
router.post('/generateCouponCodes', authenticateToken, async (req, res) => {
  try {
    const { pattern, count = 1, charSet = 'alphanumeric', couponData = {} } = req.body;

    // Basic validation
    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    if (count < 1 || count > 1000) {
      return res.status(400).json({ error: 'Count must be between 1 and 1000' });
    }

    // Validate pattern first
    const validation = CouponCodeGenerator.validatePattern(pattern);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await CouponCodeGenerator.generateAndCreateCoupons({
      pattern,
      count,
      charSet,
      couponData
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate coupon code pattern
router.post('/validateCouponPattern', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const validation = CouponCodeGenerator.validatePattern(pattern);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get preset patterns for common use cases
router.get('/getCouponPresetPatterns', authenticateToken, async (req, res) => {
  try {
    const { type, suffix } = req.query;

    const presets = {
      student: CouponCodeGenerator.generatePresetPattern('student', suffix),
      vip: CouponCodeGenerator.generatePresetPattern('vip', suffix),
      holiday: CouponCodeGenerator.generatePresetPattern('holiday', suffix),
      general: CouponCodeGenerator.generatePresetPattern('general', suffix),
      referral: CouponCodeGenerator.generatePresetPattern('referral', suffix),
      welcome: CouponCodeGenerator.generatePresetPattern('welcome', suffix),
      flashsale: CouponCodeGenerator.generatePresetPattern('flashsale', suffix),
      earlybird: CouponCodeGenerator.generatePresetPattern('earlybird', suffix),
      loyalty: CouponCodeGenerator.generatePresetPattern('loyalty', suffix),
      creator: CouponCodeGenerator.generatePresetPattern('creator', suffix)
    };

    if (type) {
      const pattern = presets[type.toLowerCase()];
      if (!pattern) {
        return res.status(400).json({ error: 'Invalid preset type' });
      }
      return res.json({ pattern, validation: CouponCodeGenerator.validatePattern(pattern) });
    }

    res.json({ presets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics for a coupon pattern
router.get('/getCouponPatternStats', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.query;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const stats = await CouponCodeGenerator.getPatternStatistics(pattern);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk deactivate coupons by pattern
router.post('/deactivateCouponsByPattern', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const result = await CouponCodeGenerator.deactivateCouponsByPattern(pattern);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registration Functions - DEPRECATED: Registration model removed

router.post('/sendRegistrationEmail', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendRegistrationEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Functions
router.post('/processEmailTriggers', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.processEmailTriggers(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduleEmailProcessor', authenticateToken, async (req, res) => {
  try {
    const { schedule, triggers } = req.body;

    // Create a scheduled task record for future processing
    const scheduledTask = await models.EmailSchedule?.create({
      schedule_time: schedule.time || new Date(),
      triggers: JSON.stringify(triggers || []),
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }) || null;

    res.json({
      success: true,
      message: 'Email processor scheduled',
      data: {
        scheduled: true,
        schedule,
        taskId: scheduledTask?.id || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/triggerEmailAutomation', authenticateToken, async (req, res) => {
  try {
    const { automationId, userId, recipientEmail, data } = req.body;

    // Find automation template
    const automation = await models.EmailTemplate.findOne({
      where: { id: automationId, is_active: true }
    });

    if (!automation) {
      return res.status(404).json({ error: 'Email automation not found' });
    }

    // Trigger the email using EmailService
    const result = await EmailService.processEmailTriggers({
      triggers: [{
        type: automation.trigger_type,
        recipient: recipientEmail,
        data,
        entityId: userId
      }]
    });

    res.json({
      success: true,
      message: 'Email automation triggered',
      data: { automationId, triggered: true, result }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sendInvitationEmails', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendInvitationEmails(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Game Functions
router.post('/updateExistingGames', authenticateToken, async (req, res) => {
  try {
    const { gameUpdates } = req.body;

    if (!Array.isArray(gameUpdates)) {
      return res.status(400).json({ error: 'gameUpdates must be an array' });
    }

    const results = [];
    for (const gameUpdate of gameUpdates) {
      try {
        const updated = await EntityService.update('Game', gameUpdate.id, gameUpdate);
        results.push({ id: gameUpdate.id, status: 'updated', data: updated });
      } catch (error) {
        results.push({ id: gameUpdate.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Games update completed',
      data: {
        total: gameUpdates.length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/uploadVerbsBulk', authenticateToken, async (req, res) => {
  try {
    const { verbs } = req.body;

    if (!Array.isArray(verbs)) {
      return res.status(400).json({ error: 'verbs must be an array' });
    }

    // Use Word model to store verbs with proper categorization
    const verbEntries = verbs.map(verb => ({
      ...verb,
      category: verb.category || 'verb',
      language: verb.language || 'he', // Default to Hebrew
      is_active: true
    }));

    const results = await EntityService.bulkCreate('Word', verbEntries);

    res.json({
      success: true,
      message: 'Verbs uploaded successfully',
      data: {
        uploaded: results.length,
        verbs: results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File Functions
router.post('/deleteFile', authenticateToken, async (req, res) => {
  try {
    const { fileId, filePath, entityType } = req.body;

    if (fileId && entityType) {
      // Delete File entity from database (includes automatic S3 cleanup via EntityService)
      const result = await EntityService.delete(entityType, fileId);
      res.json({
        success: true,
        message: `${entityType} record and associated files deleted successfully`,
        data: result
      });
    } else if (filePath) {
      // Direct file path deletion from S3
      try {
        const { deleteFileFromStorage } = await import('./media.js');

        // Extract file entity ID and user ID from the file path if possible
        // Expected format: environment/userId/fileEntityId/filename
        const pathParts = filePath.split('/');
        if (pathParts.length >= 3) {
          const userId = pathParts[1];
          const fileEntityId = pathParts[2];

          const deleted = await deleteFileFromStorage(fileEntityId, userId);

          res.json({
            success: deleted,
            message: deleted ? 'File deleted from storage successfully' : 'File not found in storage',
            data: { filePath, deleted }
          });
        } else {
          res.status(400).json({
            error: 'Invalid file path format. Expected: environment/userId/fileEntityId/filename'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: 'Failed to delete file from storage',
          details: error.message
        });
      }
    } else {
      res.status(400).json({ error: 'Either fileId with entityType or filePath is required' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/createSignedUrl', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, operation = 'upload' } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    // Generate a secure token for the URL
    const token = Buffer.from(`${fileName}_${Date.now()}_${Math.random()}`).toString('base64url');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // In a real implementation, this would integrate with cloud storage
    const signedUrl = `https://storage.ludora.app/files/${operation}/${encodeURIComponent(fileName)}?token=${token}&expires=${expiresAt.getTime()}`;

    res.json({
      success: true,
      message: 'Signed URL created',
      data: {
        signedUrl,
        fileName,
        fileType,
        operation,
        expiresAt: expiresAt.toISOString(),
        token
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Template Functions
router.post('/initializeSystemEmailTemplates', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.initializeSystemEmailTemplates();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/updateSystemEmailTemplates', authenticateToken, async (req, res) => {
  try {
    const { templates } = req.body;

    if (!Array.isArray(templates)) {
      return res.status(400).json({ error: 'templates must be an array' });
    }

    const results = [];
    for (const template of templates) {
      try {
        const updated = await EntityService.update('EmailTemplate', template.id, template);
        results.push({ id: template.id, status: 'updated', data: updated });
      } catch (error) {
        results.push({ id: template.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'System email templates update completed',
      data: {
        total: templates.length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Functions
router.post('/testCallback', authenticateToken, async (req, res) => {
  try {
    const { testData } = req.body;

    res.json({
      success: true,
      message: 'Test callback processed',
      data: { received: testData, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;