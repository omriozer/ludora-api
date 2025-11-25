import crypto from 'crypto';
import { error as logger } from '../lib/errorLogger.js';
import PaymentService from '../services/PaymentService.js';

/**
 * PayPlus Webhook Signature Verification Utility
 *
 * Provides cryptographic verification of PayPlus webhook signatures to prevent
 * payment fraud and ensure webhook authenticity.
 */

/**
 * Verifies PayPlus webhook signature using HMAC-SHA256
 * @param {Object|string} payload - Request body (raw payload)
 * @param {string} signature - Signature from webhook headers
 * @param {string} [providedSecretKey] - Optional secret key override
 * @returns {boolean} - True if signature is valid
 */
function verifyPayPlusSignature(payload, signature, providedSecretKey = null) {
  try {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification started');

    // Validate required parameters
    if (!signature) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification failed: Missing signature');
      return false;
    }

    // Get secret key (use provided or fetch from PaymentService)
    let secretKey = providedSecretKey;
    if (!secretKey) {
      try {
        const credentials = PaymentService.getPayPlusCredentials();
        secretKey = credentials.payment_secret_key;
      } catch (error) {
        // TODO remove debug - webhook signature verification
        logger.payment('PayPlus signature verification failed: Could not get credentials', error);
        return false;
      }
    }

    if (!secretKey) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification failed: Missing secret key');
      return false;
    }

    // Normalize payload to string for signature generation
    // PayPlus sends JSON body, we need consistent string representation
    const message = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification: payload normalized', {
      payloadType: typeof payload,
      messageLength: message.length
    });

    // Remove any prefixes from received signature (PayPlus might add 'sha256=' prefix)
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Detect signature format: PayPlus uses base64, others might use hex
    const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(cleanSignature) && cleanSignature.length > 32;
    const isHex = /^[a-f0-9]{64}$/i.test(cleanSignature);

    if (!isBase64 && !isHex) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: FAILED - invalid signature format', {
        received: cleanSignature.substring(0, 10) + '...',
        length: cleanSignature.length,
        isBase64: isBase64,
        isHex: isHex
      });
      return false;
    }

    // Generate expected signature in the same format as received
    const expectedSignature = isBase64
      ? crypto.createHmac('sha256', secretKey).update(message).digest('base64')
      : crypto.createHmac('sha256', secretKey).update(message).digest('hex');

    // Use constant-time comparison to prevent timing attacks
    // This is critical for security - prevents attackers from determining
    // correct signature characters by measuring response time
    const isValid = isBase64
      ? crypto.timingSafeEqual(Buffer.from(cleanSignature, 'base64'), Buffer.from(expectedSignature, 'base64'))
      : crypto.timingSafeEqual(Buffer.from(cleanSignature, 'hex'), Buffer.from(expectedSignature, 'hex'));

    if (isValid) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: SUCCESS');
    } else {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: FAILED - signature mismatch', {
        received: cleanSignature.substring(0, 10) + '...',
        expected: expectedSignature.substring(0, 10) + '...'
      });
    }

    return isValid;

  } catch (error) {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification: FAILED - exception occurred', error);
    return false;
  }
}

/**
 * Generate a PayPlus-style signature for testing purposes
 * @param {Object|string} payload - Payload to sign
 * @param {string} [providedSecretKey] - Optional secret key override
 * @returns {string} - Generated signature
 */
function generatePayPlusSignature(payload, providedSecretKey = null) {
  try {
    // Get secret key (use provided or fetch from PaymentService)
    let secretKey = providedSecretKey;
    if (!secretKey) {
      const credentials = PaymentService.getPayPlusCredentials();
      secretKey = credentials.payment_secret_key;
    }

    // Normalize payload to string
    const message = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    // Generate signature
    return crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('hex');

  } catch (error) {
    logger.payment('PayPlus signature generation failed:', error);
    throw error;
  }
}

/**
 * Validate PayPlus webhook signature according to official PayPlus documentation
 * @param {Object} req - Express request object
 * @param {Array<string>} possibleHeaders - Array of possible signature header names (for backward compatibility)
 * @returns {boolean} - True if signature is valid
 */
function validateWebhookSignature(req, possibleHeaders = ['hash']) {
  try {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus webhook validation started');

    // STEP 1: Check user-agent header (required by PayPlus)
    const userAgent = req.headers['user-agent'];
    if (userAgent !== 'PayPlus') {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: Invalid user-agent', {
        userAgent: userAgent,
        expected: 'PayPlus'
      });
      return false;
    }

    // STEP 2: Get the hash from headers
    const hash = req.headers['hash'];
    if (!hash) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: No hash header found', {
        availableHeaders: Object.keys(req.headers)
      });
      return false;
    }

    // STEP 3: Get the message body as JSON string
    const message = req.body && JSON.stringify(req.body);
    if (!message) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: No message body found');
      return false;
    }

    // STEP 4: Get secret key
    let secretKey;
    try {
      const credentials = PaymentService.getPayPlusCredentials();
      secretKey = credentials.payment_secret_key;
    } catch (error) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: Could not get credentials', error);
      return false;
    }

    if (!secretKey) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: Missing secret key');
      return false;
    }

    // STEP 5: Generate expected hash according to PayPlus specification
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('base64');

    // STEP 6: Compare hashes using constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, 'base64'),
      Buffer.from(expectedHash, 'base64')
    );

    if (isValid) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation: SUCCESS');
    } else {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation: FAILED - hash mismatch', {
        receivedHash: hash.substring(0, 10) + '...',
        expectedHash: expectedHash.substring(0, 10) + '...'
      });
    }

    return isValid;

  } catch (error) {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus webhook validation failed with exception:', error);
    return false;
  }
}

export {
  verifyPayPlusSignature,
  generatePayPlusSignature,
  validateWebhookSignature
};